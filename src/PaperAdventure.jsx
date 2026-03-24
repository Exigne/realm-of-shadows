/**
 * 🏝️ CANDY ISLAND
 * - Dependency-Free Procedural Terrain (No external noise libraries required!)
 * - Animated water with UV scrolling
 * - Rock clusters, palm trees, flower patches
 * - Interactive Branching Dialogue System
 * - Smooth Gimbal Camera System (Velocity + Damping)
 * - Seamless Water Swimming & Floating Mechanics
 * - Ultra-Stable Rendering (Fixed React State Loop)
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Stars, Sparkles,
  Float, Instance, Instances, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';

// ─── Pure Math Terrain Generation (No Simplex-Noise Needed) ──────────────────

function getTerrainY(x, z) {
  const d = Math.sqrt(x * x + z * z);
  if (d > 55) return -2.5;
  // Wavy math to create natural-looking hills without external libraries
  let h = (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.0) + 
          (Math.sin(x * 0.05 + z * 0.04) * 1.5) + 
          (Math.cos(x * 0.2 + z * 0.2) * 0.5);
  // Smoothly taper off the edges into the ocean
  return h * Math.max(0, 1 - Math.pow(d / 60, 4));
}

// Global states outside React to prevent re-renders
const camState = { yaw: Math.PI, pitch: 0.4, yawVel: 0, pitchVel: 0 };
const keyState = { prevE: false };

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  SPEED: 5.5,              
  ACCEL: 12,               
  DECEL: 15,               
  GRAVITY: 35,             
  JUMP_FORCE: 14,          
  COLORS: {
    player:  '#f4a0b0',
    barnaby: '#6aaddb',
    luna:    '#c07ed4',
    pip:     '#f5c842',
    coco:    '#c4813a',
    rosie:   '#ff8fab',
    maple:   '#ff7a1a',
    bubbles: '#6ecfb5',
  }
};

// ─── Store ────────────────────────────────────────────────────────────────────

const GameContext = createContext();

const useIslandStore = () => {
  const playerPosRef   = useRef(new THREE.Vector3(0, 1, 0));
  const playerGroupRef = useRef();

  const [state, setState] = useState({
    bells: 100,
    inventory: { fruit: 0 },
    gameTime: 9.0,
    dialogue: null,
    ui: 'start',
  });

  const actions = useMemo(() => ({
    setUI:       (v)  => setState(s => ({ ...s, ui: v })),
    addBells:    (n)  => setState(s => ({ ...s, bells: s.bells + n })),
    addItem:     (t, n=1) => setState(s => ({ ...s, inventory: { ...s.inventory, [t]: (s.inventory[t]||0) + n } })),
    setDialogue: (d)  => setState(s => ({ ...s, dialogue: d })),
    tickTime:    ()   => setState(s => ({ ...s, gameTime: (s.gameTime + 0.05) % 24 })), // Safe 1-second increment
  }), []);

  return { state, actions, playerPosRef, playerGroupRef };
};

// ─── Audio ────────────────────────────────────────────────────────────────────

class GameAudio {
  constructor() { this.ctx = null; this.master = null; this.bgm = false; }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.14;
    this.master.connect(this.ctx.destination);
  }

  playBGM() {
    if (this.bgm || !this.ctx) return;
    this.bgm = true;

    const convLen = this.ctx.sampleRate * 1.2;
    const convBuf = this.ctx.createBuffer(2, convLen, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = convBuf.getChannelData(c);
      for (let i = 0; i < convLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / convLen, 2.5);
    }
    const reverb = this.ctx.createConvolver();
    reverb.buffer = convBuf;
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.22;
    reverb.connect(reverbGain);
    reverbGain.connect(this.master);

    const BPM   = 96;
    const BEAT  = 60 / BPM;
    const phrase = [
      [523.25, 0, 0.9], [587.33, 1, 0.9], [659.25, 2, 0.9], [523.25, 3, 0.9],
      [698.46, 4, 0.9], [659.25, 5, 0.9], [587.33, 6, 1.8],
      [392.00, 8, 0.9], [440.00, 9, 0.9], [523.25, 10, 0.9], [587.33, 11, 0.9],
      [523.25, 12, 0.9], [493.88, 13, 0.9], [440.00, 14, 1.8],
      [783.99, 16, 0.9], [698.46, 17, 0.9], [659.25, 18, 0.9], [587.33, 19, 0.9],
      [659.25, 20, 0.9], [587.33, 21, 0.9], [523.25, 22, 1.8],
      [587.33, 24, 0.9], [523.25, 25, 0.9], [493.88, 26, 0.9], [440.00, 27, 0.9],
      [392.00, 28, 0.9], [349.23, 29, 0.9], [261.63, 30, 1.8],
    ];

    const bass = [
      [130.81, 0, 1.6], [174.61, 4, 1.6], [146.83, 8, 1.6], [130.81, 12, 1.6],
      [130.81, 16, 1.6], [146.83, 20, 1.6], [174.61, 24, 1.6], [130.81, 28, 1.6],
    ];

    const playNote = (freq, beatOffset, durBeats, startTime, vol = 0.06, type = 'sine') => {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      const t0 = startTime + beatOffset * BEAT;
      const dur = durBeats * BEAT;

      osc.type = type;
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(vol, t0 + 0.018);
      env.gain.exponentialRampToValueAtTime(vol * 0.4, t0 + dur * 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.95);

      osc.connect(env); env.connect(this.master); env.connect(reverb);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    };

    const scheduleLoop = (startTime) => {
      phrase.forEach(([f, b, d]) => playNote(f, b, d, startTime, 0.055, 'sine'));
      bass.forEach(([f, b, d]) => playNote(f, b, d, startTime, 0.038, 'triangle'));
      const nextStart = startTime + 32 * BEAT;
      const scheduleAhead = (nextStart - this.ctx.currentTime - 0.5) * 1000;
      setTimeout(() => { if (this.bgm) scheduleLoop(nextStart); }, Math.max(0, scheduleAhead));
    };

    scheduleLoop(this.ctx.currentTime + 0.1);
  }

  sfx(type) {
    if (!this.ctx) return;
    if (type === 'munch') {
      [0, 0.07, 0.15].forEach((delay, i) => {
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / d.length, 1.5);
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const bpf = this.ctx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = 900 + i * 180; bpf.Q.value = 2.5;
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.18, this.ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + 0.07);
        src.connect(bpf); bpf.connect(g); g.connect(this.master);
        src.start(this.ctx.currentTime + delay); src.stop(this.ctx.currentTime + delay + 0.1);
      });
      const osc = this.ctx.createOscillator(); const og = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.22);
      osc.frequency.setValueAtTime(1046.5, this.ctx.currentTime + 0.30);
      og.gain.setValueAtTime(0.001, this.ctx.currentTime + 0.22);
      og.gain.linearRampToValueAtTime(0.07, this.ctx.currentTime + 0.24);
      og.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.55);
      osc.connect(og); og.connect(this.master);
      osc.start(this.ctx.currentTime + 0.22); osc.stop(this.ctx.currentTime + 0.6);
    }
    if (type === 'talk') {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 500 + Math.random() * 300;
      g.gain.setValueAtTime(0.025, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
      osc.connect(g); g.connect(this.master);
      osc.start(); osc.stop(this.ctx.currentTime + 0.07);
    }
  }
}
const audio = new GameAudio();

// ═══════════════════════════════════════════════════════════════════════════════
//  CREATURE MESHES
// ═══════════════════════════════════════════════════════════════════════════════

const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });
const matWhite = new THREE.MeshBasicMaterial({ color: '#fff' });
const matPink  = new THREE.MeshBasicMaterial({ color: '#ffb3cc' });

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
}

function CatCreature({ color, walkCycle = 0, isMoving = false }) {
  const bodyMat  = useMemo(() => stdMat(color), [color]);
  const innerCol = color === CONFIG.COLORS.player ? '#ffccd8' : '#e8c0f0';
  const innerMat = useMemo(() => stdMat(innerCol), [innerCol]);

  const fL = isMoving ? Math.sin(walkCycle)            * 0.42 : 0;
  const fR = isMoving ? Math.sin(walkCycle + Math.PI)  * 0.42 : 0;
  const bL = isMoving ? Math.sin(walkCycle + Math.PI)  * 0.35 : 0;
  const bR = isMoving ? Math.sin(walkCycle)            * 0.35 : 0;
  const bodyBob    = isMoving ? Math.abs(Math.sin(walkCycle * 2)) * 0.04 : 0;
  const bodySway   = isMoving ? Math.sin(walkCycle) * 0.025 : 0;
  const headNod    = isMoving ? Math.sin(walkCycle * 2) * 0.06 : 0;
  const tailWag    = Math.sin(walkCycle * 1.5) * 0.18;

  return (
    <group>
      <mesh castShadow position={[0, 0.55 + bodyBob, 0]} rotation={[0, 0, bodySway]} scale={[1, 1.05, 0.95]} material={bodyMat}><sphereGeometry args={[0.52, 18, 14]} /></mesh>
      <mesh castShadow position={[0, 1.22 + bodyBob, 0.08]} rotation={[headNod, 0, bodySway]} material={bodyMat}><sphereGeometry args={[0.4, 18, 14]} /></mesh>
      <mesh position={[0, 1.12 + bodyBob, 0.41]} rotation={[headNod, 0, 0]} material={innerMat}><sphereGeometry args={[0.18, 12, 10]} /></mesh>
      <mesh castShadow position={[-0.24, 1.61 + bodyBob, 0.05]} rotation={[headNod, 0, -0.28]} material={bodyMat}><coneGeometry args={[0.1, 0.28, 7]} /></mesh>
      <mesh position={[-0.24, 1.61 + bodyBob, 0.1]} rotation={[headNod, 0, -0.28]} material={innerMat}><coneGeometry args={[0.055, 0.2, 7]} /></mesh>
      <mesh castShadow position={[0.24, 1.61 + bodyBob, 0.05]} rotation={[headNod, 0, 0.28]} material={bodyMat}><coneGeometry args={[0.1, 0.28, 7]} /></mesh>
      <mesh position={[0.24, 1.61 + bodyBob, 0.1]} rotation={[headNod, 0, 0.28]} material={innerMat}><coneGeometry args={[0.055, 0.2, 7]} /></mesh>
      <mesh position={[-0.14, 1.26 + bodyBob, 0.37]} rotation={[headNod,0,0]} material={matBlack}><sphereGeometry args={[0.07, 9, 9]} /></mesh>
      <mesh position={[ 0.14, 1.26 + bodyBob, 0.37]} rotation={[headNod,0,0]} material={matBlack}><sphereGeometry args={[0.07, 9, 9]} /></mesh>
      <mesh position={[-0.11, 1.28 + bodyBob, 0.43]} material={matWhite}><sphereGeometry args={[0.025, 6, 6]} /></mesh>
      <mesh position={[ 0.17, 1.28 + bodyBob, 0.43]} material={matWhite}><sphereGeometry args={[0.025, 6, 6]} /></mesh>
      <mesh position={[0, 1.14 + bodyBob, 0.46]} material={matPink}><sphereGeometry args={[0.036, 7, 7]} /></mesh>
      <mesh castShadow position={[-0.26, 0.78, -0.46]} rotation={[0.55, tailWag, 0.32]} material={bodyMat}><cylinderGeometry args={[0.07, 0.11, 0.7, 8]} /></mesh>
      <mesh castShadow position={[-0.16 + tailWag*0.3, 1.08, -0.66]} material={innerMat}><sphereGeometry args={[0.1, 9, 9]} /></mesh>
      <group position={[-0.2, 0.42, 0.18]} rotation={[fL, 0, 0]}>
        <mesh castShadow position={[0, -0.21, 0]} material={bodyMat}><cylinderGeometry args={[0.1, 0.08, 0.42, 8]} /></mesh>
        <mesh castShadow position={[0, -0.44, 0.04]} material={bodyMat}><sphereGeometry args={[0.1, 8, 8]} /></mesh>
      </group>
      <group position={[0.2, 0.42, 0.18]} rotation={[fR, 0, 0]}>
        <mesh castShadow position={[0, -0.21, 0]} material={bodyMat}><cylinderGeometry args={[0.1, 0.08, 0.42, 8]} /></mesh>
        <mesh castShadow position={[0, -0.44, 0.04]} material={bodyMat}><sphereGeometry args={[0.1, 8, 8]} /></mesh>
      </group>
      <group position={[-0.2, 0.38, -0.18]} rotation={[bL, 0, 0]}>
        <mesh castShadow position={[0, -0.21, 0]} material={bodyMat}><cylinderGeometry args={[0.1, 0.09, 0.42, 8]} /></mesh>
        <mesh castShadow position={[0, -0.44, 0.04]} material={bodyMat}><sphereGeometry args={[0.1, 8, 8]} /></mesh>
      </group>
      <group position={[0.2, 0.38, -0.18]} rotation={[bR, 0, 0]}>
        <mesh castShadow position={[0, -0.21, 0]} material={bodyMat}><cylinderGeometry args={[0.1, 0.09, 0.42, 8]} /></mesh>
        <mesh castShadow position={[0, -0.44, 0.04]} material={bodyMat}><sphereGeometry args={[0.1, 8, 8]} /></mesh>
      </group>
    </group>
  );
}

function BearCreature({ color, walkCycle = 0, isMoving = false }) {
  const bodyMat  = useMemo(() => stdMat(color), [color]);
  const bellyMat = useMemo(() => stdMat('#d4eef8'), []);

  const fL = isMoving ? Math.sin(walkCycle)           * 0.38 : 0;
  const fR = isMoving ? Math.sin(walkCycle + Math.PI) * 0.38 : 0;
  const aL = isMoving ? Math.sin(walkCycle)           * 0.32 : 0;  
  const aR = isMoving ? Math.sin(walkCycle + Math.PI) * 0.32 : 0;
  const bodyBob  = isMoving ? Math.abs(Math.sin(walkCycle * 2)) * 0.04 : 0;
  const headNod  = isMoving ? Math.sin(walkCycle * 2) * 0.05 : 0;

  return (
    <group>
      <mesh castShadow position={[0, 0.62 + bodyBob, 0]} scale={[1.1, 1.0, 1.0]} material={bodyMat}><sphereGeometry args={[0.6, 18, 14]} /></mesh>
      <mesh position={[0, 0.62 + bodyBob, 0.54]} material={bellyMat}><sphereGeometry args={[0.38, 12, 10]} /></mesh>
      <mesh castShadow position={[0, 1.38 + bodyBob, 0.05]} rotation={[headNod, 0, 0]} material={bodyMat}><sphereGeometry args={[0.44, 18, 14]} /></mesh>
      <mesh position={[0, 1.24 + bodyBob, 0.45]} rotation={[headNod,0,0]} material={bellyMat}><sphereGeometry args={[0.2, 12, 10]} /></mesh>
      {[-0.3, 0.3].map((ex, i) => (
        <group key={i}>
          <mesh castShadow position={[ex, 1.76 + bodyBob, 0]} material={bodyMat}><sphereGeometry args={[0.14, 12, 12]} /></mesh>
          <mesh position={[ex, 1.76 + bodyBob, 0.05]} material={bellyMat}><sphereGeometry args={[0.08, 10, 10]} /></mesh>
        </group>
      ))}
      <mesh position={[-0.16, 1.40 + bodyBob, 0.42]} material={matBlack}><sphereGeometry args={[0.075, 9, 9]} /></mesh>
      <mesh position={[ 0.16, 1.40 + bodyBob, 0.42]} material={matBlack}><sphereGeometry args={[0.075, 9, 9]} /></mesh>
      <mesh position={[-0.12, 1.42 + bodyBob, 0.48]} material={matWhite}><sphereGeometry args={[0.026, 6, 6]} /></mesh>
      <mesh position={[ 0.20, 1.42 + bodyBob, 0.48]} material={matWhite}><sphereGeometry args={[0.026, 6, 6]} /></mesh>
      <mesh position={[0, 1.26 + bodyBob, 0.51]} material={matBlack}><sphereGeometry args={[0.044, 7, 7]} /></mesh>
      <group position={[-0.68, 0.96 + bodyBob, 0.05]} rotation={[aL, 0, 0.3]}><mesh castShadow material={bodyMat} position={[0, -0.2, 0]}><capsuleGeometry args={[0.1, 0.35, 6, 8]} /></mesh></group>
      <group position={[0.68, 0.96 + bodyBob, 0.05]} rotation={[aR, 0, -0.3]}><mesh castShadow material={bodyMat} position={[0, -0.2, 0]}><capsuleGeometry args={[0.1, 0.35, 6, 8]} /></mesh></group>
      <group position={[-0.22, 0.32, 0.12]} rotation={[fL, 0, 0]}><mesh castShadow material={bodyMat} position={[0, -0.25, 0]}><cylinderGeometry args={[0.13, 0.12, 0.5, 9]} /></mesh><mesh castShadow material={bodyMat} position={[0, -0.52, 0.06]}><sphereGeometry args={[0.13, 8, 8]} /></mesh></group>
      <group position={[0.22, 0.32, 0.12]} rotation={[fR, 0, 0]}><mesh castShadow material={bodyMat} position={[0, -0.25, 0]}><cylinderGeometry args={[0.13, 0.12, 0.5, 9]} /></mesh><mesh castShadow material={bodyMat} position={[0, -0.52, 0.06]}><sphereGeometry args={[0.13, 8, 8]} /></mesh></group>
    </group>
  );
}

function BunnyCreature({ color, walkCycle = 0, isMoving = false }) {
  const bodyMat  = useMemo(() => stdMat(color), [color]);
  const innerMat = useMemo(() => stdMat('#ffe0a0'), []);

  const fL = isMoving ? Math.sin(walkCycle)           * 0.45 : 0;
  const fR = isMoving ? Math.sin(walkCycle + Math.PI) * 0.45 : 0;
  const bL = isMoving ? Math.sin(walkCycle + Math.PI) * 0.52 : 0; 
  const bR = isMoving ? Math.sin(walkCycle)           * 0.52 : 0;
  const bodyBob  = isMoving ? Math.abs(Math.sin(walkCycle * 2)) * 0.06 : 0;
  const earBounce = isMoving ? Math.sin(walkCycle * 2) * 0.08 : 0;
  const headNod  = isMoving ? Math.sin(walkCycle * 2) * 0.06 : 0;

  return (
    <group>
      <mesh castShadow position={[0, 0.55 + bodyBob, 0]} scale={[1, 1.05, 1]} material={bodyMat}><sphereGeometry args={[0.5, 18, 14]} /></mesh>
      <mesh castShadow position={[0, 1.18 + bodyBob, 0.06]} rotation={[headNod, 0, 0]} material={bodyMat}><sphereGeometry args={[0.38, 18, 14]} /></mesh>
      <mesh position={[0, 1.08 + bodyBob, 0.38]} rotation={[headNod,0,0]} material={innerMat}><sphereGeometry args={[0.15, 10, 9]} /></mesh>
      {[-0.14, 0.14].map((ex, i) => (
        <group key={i} position={[ex, 1.6 + bodyBob + earBounce, 0]} rotation={[0, 0, ex < 0 ? -0.1 : 0.1]}>
          <mesh castShadow material={bodyMat} position={[0, 0.38, -0.04]}><capsuleGeometry args={[0.08, 0.55, 6, 8]} /></mesh>
          <mesh material={innerMat} position={[0, 0.38, 0.03]}><capsuleGeometry args={[0.04, 0.48, 6, 8]} /></mesh>
        </group>
      ))}
      <mesh position={[-0.14, 1.21 + bodyBob, 0.35]} material={matBlack}><sphereGeometry args={[0.068, 9, 9]} /></mesh>
      <mesh position={[ 0.14, 1.21 + bodyBob, 0.35]} material={matBlack}><sphereGeometry args={[0.068, 9, 9]} /></mesh>
      <mesh position={[-0.10, 1.23 + bodyBob, 0.41]} material={matWhite}><sphereGeometry args={[0.023, 6, 6]} /></mesh>
      <mesh position={[ 0.18, 1.23 + bodyBob, 0.41]} material={matWhite}><sphereGeometry args={[0.023, 6, 6]} /></mesh>
      <mesh position={[0, 1.09 + bodyBob, 0.42]} material={matPink}><sphereGeometry args={[0.034, 7, 7]} /></mesh>
      <mesh castShadow position={[0, 0.7, -0.52]} material={matWhite}><sphereGeometry args={[0.14, 10, 10]} /></mesh>
      <group position={[-0.18, 0.38, 0.18]} rotation={[fL, 0, 0]}>
        <mesh castShadow material={bodyMat} position={[0, -0.19, 0]}><cylinderGeometry args={[0.09, 0.08, 0.38, 8]} /></mesh>
        <mesh castShadow material={bodyMat} position={[0, -0.4, 0.04]}><sphereGeometry args={[0.09, 8, 8]} /></mesh>
      </group>
      <group position={[0.18, 0.38, 0.18]} rotation={[fR, 0, 0]}>
        <mesh castShadow material={bodyMat} position={[0, -0.19, 0]}><cylinderGeometry args={[0.09, 0.08, 0.38, 8]} /></mesh>
        <mesh castShadow material={bodyMat} position={[0, -0.4, 0.04]}><sphereGeometry args={[0.09, 8, 8]} /></mesh>
      </group>
      <group position={[-0.2, 0.32, -0.16]} rotation={[bL, 0, 0]}>
        <mesh castShadow material={bodyMat} position={[0, -0.25, 0]}><cylinderGeometry args={[0.11, 0.1, 0.5, 8]} /></mesh>
        <mesh castShadow material={bodyMat} position={[0, -0.52, 0.06]}><sphereGeometry args={[0.12, 8, 8]} /></mesh>
      </group>
      <group position={[0.2, 0.32, -0.16]} rotation={[bR, 0, 0]}>
        <mesh castShadow material={bodyMat} position={[0, -0.25, 0]}><cylinderGeometry args={[0.11, 0.1, 0.5, 8]} /></mesh>
        <mesh castShadow material={bodyMat} position={[0, -0.52, 0.06]}><sphereGeometry args={[0.12, 8, 8]} /></mesh>
      </group>
    </group>
  );
}

// ─── Terrain & Textures ────────────────────────────────────────────────────────

function applyNoise(ctx, S, intensity = 12) {
  const imgData = ctx.getImageData(0, 0, S, S);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * intensity;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i+1] = Math.min(255, Math.max(0, data[i+1] + n));
    data[i+2] = Math.min(255, Math.max(0, data[i+2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

function makeGroundTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#78b050';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 4 + Math.random() * 16;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(140,200,85,${0.1 + Math.random() * 0.16})` : `rgba(55,105,25,${0.1  + Math.random() * 0.16})`;
    ctx.fill();
  }
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const h = 5 + Math.random() * 11;
    ctx.strokeStyle = `rgba(${55+Math.random()*50},${145+Math.random()*55},${25+Math.random()*30},0.5)`;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * h * 0.6, y - h); ctx.stroke();
  }
  applyNoise(ctx, S, 12); 
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 16);
  return t;
}

function makeSandTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8ccaa';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 1 + Math.random() * 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${175+Math.random()*45},${145+Math.random()*30},${85+Math.random()*30},0.22)`;
    ctx.fill();
  }
  applyNoise(ctx, S, 8); 
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

function Terrain() {
  const grassTex = useMemo(() => makeGroundTexture(), []);
  const sandTex  = useMemo(() => makeSandTexture(),   []);

  const { geoBase, geoGrass } = useMemo(() => {
    const build = () => {
      const g = new THREE.PlaneGeometry(150, 150, 128, 128);
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, getTerrainY(x, z));
      }
      g.computeVertexNormals();
      return g;
    };
    return { geoBase: build(), geoGrass: build() };
  }, []);

  return (
    <group>
      <mesh geometry={geoBase} receiveShadow name="ground">
        <meshStandardMaterial map={sandTex} bumpMap={sandTex} bumpScale={0.02} roughness={0.95} metalness={0} />
      </mesh>
      <mesh geometry={geoGrass} receiveShadow position={[0, 0.002, 0]}>
        <meshStandardMaterial map={grassTex} bumpMap={grassTex} bumpScale={0.05} roughness={0.88} metalness={0}
          transparent alphaTest={0.01}
          onBeforeCompile={(shader) => {
            shader.vertexShader = 'attribute float grassMask;\nvarying float vGrassMask;\n' + shader.vertexShader
              .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrassMask = grassMask;');
            shader.fragmentShader = 'varying float vGrassMask;\n' + shader.fragmentShader
              .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
                'if(vGrassMask < 0.5) discard;\nvec4 diffuseColor = vec4( diffuse, opacity );');
          }}
        />
      </mesh>
    </group>
  );
}

// ─── Water ────────────────────────────────────────────────────────────────────

function makeWaterTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#38b4e8';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 20; i++) {
    const y = (i / 20) * S;
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.09})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= S; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.06 + i) * 3);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  return t;
}

function Water() {
  const ref = useRef();
  const tex = useMemo(() => makeWaterTexture(), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = -1.18 + Math.sin(clock.elapsedTime * 0.65) * 0.09;
    tex.offset.x = clock.elapsedTime * 0.011;
    tex.offset.y = clock.elapsedTime * 0.007;
    tex.needsUpdate = true;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial map={tex} color="#5bc8f0" transparent opacity={0.72} metalness={0.55} roughness={0.06} />
    </mesh>
  );
}

// ─── Particle Effects ─────────────────────────────────────────────────────────

function DustEffect() {
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useRef([]);
  const meshRef = useRef();

  useEffect(() => {
    const handleLand = (e) => {
      const pos = e.detail;
      for(let i=0; i<8; i++) {
         particles.current.push({
           pos: pos.clone().add(new THREE.Vector3((Math.random()-0.5)*0.8, 0.1, (Math.random()-0.5)*0.8)),
           vel: new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2 + 1, (Math.random()-0.5)*2),
           age: 0, life: 0.3 + Math.random()*0.3, scale: Math.random() * 0.3 + 0.2
         });
      }
    };
    window.addEventListener('player-land', handleLand);
    return () => window.removeEventListener('player-land', handleLand);
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    let count = 0;
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.age += delta;
      if (p.age >= p.life) { particles.current.splice(i, 1); continue; }
      p.pos.addScaledVector(p.vel, delta);
      p.scale *= 0.88; 
      dummy.position.copy(p.pos); dummy.scale.setScalar(p.scale);
      dummy.updateMatrix(); meshRef.current.setMatrixAt(count++, dummy.matrix);
    }
    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, 50]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#d4c0a5" roughness={1} />
    </instancedMesh>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function CameraRig() {
  const { playerGroupRef } = useContext(GameContext);
  const { camera } = useThree();

  useFrame((_, delta) => {
    // Smooth Gimbal Physics
    if (keyState['arrowleft'])  camState.yawVel += 25.0 * delta;
    if (keyState['arrowright']) camState.yawVel -= 25.0 * delta;
    if (keyState['arrowup'])    camState.pitchVel -= 15.0 * delta;
    if (keyState['arrowdown'])  camState.pitchVel += 15.0 * delta;

    camState.yawVel *= 0.82;
    camState.pitchVel *= 0.82;

    camState.yaw += camState.yawVel * delta;
    camState.pitch += camState.pitchVel * delta;
    camState.pitch = Math.max(0.1, Math.min(1.4, camState.pitch));

    const p = playerGroupRef.current;
    if (!p) return;
    
    const dist = 14;
    camera.position.set(
      p.position.x + Math.sin(camState.yaw) * dist * Math.cos(camState.pitch),
      p.position.y + dist * Math.sin(camState.pitch) + 1,
      p.position.z + Math.cos(camState.yaw) * dist * Math.cos(camState.pitch)
    );
    
    camera.lookAt(p.position.x, p.position.y + 1.1, p.position.z);
  });
  return null;
}

// ─── Player ───────────────────────────────────────────────────────────────────

function PlayerController() {
  const { state, actions, playerPosRef, playerGroupRef } = useContext(GameContext);
  const bodyRef   = useRef();
  const vel       = useRef(new THREE.Vector3());
  const walkRef   = useRef(0);
  const movingRef = useRef(false);
  const prevGrounded = useRef(true);
  const isSwimmingRef = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const downVec   = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const { scene } = useThree();

  useFrame(({ clock }, delta) => {
    const g = playerGroupRef.current;
    if (!g || state.ui !== 'play') return;
    
    if (keyState['e'] && !keyState.prevE) {
      let closestNPC = null;
      let minDist = 4.0;
      scene.traverse(child => {
        if (child.userData?.isNPC) {
          const dist = child.getWorldPosition(new THREE.Vector3()).distanceTo(g.position);
          if (dist < minDist) { minDist = dist; closestNPC = child; }
        }
      });
      if (closestNPC && !state.dialogue) {
        actions.setDialogue({
          name: closestNPC.userData.name, color: closestNPC.userData.color,
          nodes: closestNPC.userData.dialogues, step: 0
        });
        audio.sfx('talk');
      }
    }
    keyState.prevE = keyState['e']; 

    if (state.dialogue) return;

    const mx = (keyState['a'] ? -1 : 0) + (keyState['d'] ? 1 : 0);
    const mz = (keyState['w'] ? -1 : 0) + (keyState['s'] ? 1 : 0);

    const accelFactor = Math.min(1, CONFIG.ACCEL * delta);
    const decelFactor = Math.min(1, CONFIG.DECEL * delta);
    const targetSpeed = isSwimmingRef.current ? CONFIG.SPEED * 0.45 : CONFIG.SPEED;

    if (mx !== 0 || mz !== 0) {
      const angle = Math.atan2(mx, mz) + camState.yaw;
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, Math.sin(angle) * targetSpeed, accelFactor);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, Math.cos(angle) * targetSpeed, accelFactor);
    } else {
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, 0, decelFactor);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, 0, decelFactor);
    }

    vel.current.y -= CONFIG.GRAVITY * delta;

    g.position.x = Math.max(-56, Math.min(56, g.position.x + vel.current.x * delta));
    g.position.z = Math.max(-56, Math.min(56, g.position.z + vel.current.z * delta));
    g.position.y += vel.current.y * delta;

    raycaster.set(new THREE.Vector3(g.position.x, 20, g.position.z), downVec);
    const ground = scene.getObjectByName('ground');
    let isGrounded = false;
    let isSwimming = false;
    
    if (ground) {
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0) {
        let floorHeight = hits[0].point.y + 0.05;
        const SWIM_FLOAT_Y = -1.48; 

        if (floorHeight < SWIM_FLOAT_Y) {
           floorHeight = SWIM_FLOAT_Y;
           isSwimming = true;
        }

        const snapDist = 0.3; 
        if (g.position.y <= floorHeight + snapDist && vel.current.y <= 0) {
          g.position.y = floorHeight;
          isGrounded = true;

          if (!prevGrounded.current && vel.current.y < -5 && !isSwimming) {
             window.dispatchEvent(new CustomEvent('player-land', { detail: g.position }));
          }
          vel.current.y = 0;
        }
      }
    }

    prevGrounded.current = isGrounded;
    isSwimmingRef.current = isSwimming;

    if (keyState[' '] && isGrounded && !isSwimming) {
      vel.current.y = CONFIG.JUMP_FORCE;
      isGrounded = false; 
    }

    const spd2D = Math.sqrt(vel.current.x ** 2 + vel.current.z ** 2);
    movingRef.current = spd2D > 0.5 && isGrounded; 

    const rotSpeed = Math.min(1, 10 * delta);
    const bobSpeed = Math.min(1, 15 * delta);
    
    if (movingRef.current) {
      walkRef.current += delta * (isSwimming ? 5.0 : 7.5);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), rotSpeed);
      if (bodyRef.current) {
        bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, Math.sin(walkRef.current) * 0.03, bobSpeed);
      }
    } else {
      if (bodyRef.current) {
        bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, 0, bobSpeed);
      }
    }

    // Swim Animation Tilt
    if (bodyRef.current) {
       bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, isSwimming ? -0.5 : 0, rotSpeed);
       if (isSwimming) {
          bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, Math.sin(clock.elapsedTime * 2.5) * 0.05, rotSpeed);
       } else {
          bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0, rotSpeed);
       }
    }

    playerPosRef.current.copy(g.position);
  });

  return (
    <group ref={playerGroupRef} position={[0, 1, 0]}>
      <group ref={bodyRef}>
        <CatCreature color={CONFIG.COLORS.player} walkCycle={walkRef.current} isMoving={movingRef.current} />
      </group>
      <ContactShadows opacity={0.45} scale={4} blur={2.5} position={[0, 0.02, 0]} />
    </group>
  );
}

// ─── NPC ─────────────────────────────────────────────────────────────────────

function NPC({ name, color, home, dialogues, creatureType }) {
  const { state } = useContext(GameContext);
  const ref       = useRef();
  const modeRef   = useRef('idle');
  const target    = useRef(new THREE.Vector3(home.x, home.y, home.z));
  const walkRef   = useRef(0);
  const movingRef = useRef(false);

  useFrame(({ clock }, delta) => {
    if (!ref.current || state.dialogue?.name === name) return;
    const t = clock.elapsedTime + home.x;
    
    // NPCs will pick a random nearby spot to walk to every 10 seconds
    if (Math.floor(t) % 10 === 0 && modeRef.current === 'idle') {
      modeRef.current = 'walk';
      target.current.set(home.x + (Math.random()-0.5)*12, ref.current.position.y, home.z + (Math.random()-0.5)*12);
    }
    
    if (modeRef.current === 'walk') {
      const dir = target.current.clone().sub(ref.current.position).normalize();
      ref.current.position.add(dir.multiplyScalar(delta * 1.6));
      ref.current.lookAt(target.current.x, ref.current.position.y, target.current.z);
      walkRef.current += delta * 4.5;
      movingRef.current = true;
      if (ref.current.position.distanceTo(target.current) < 0.5) { 
        modeRef.current = 'idle'; 
        movingRef.current = false; 
      }
    } else {
      // Idle breathing bob
      ref.current.position.y = home.y + 0.05 + Math.sin(t * 1.6) * 0.06;
      movingRef.current = false;
    }
  });

  const Creature = creatureType === 'bear' ? BearCreature : creatureType === 'bunny' ? BunnyCreature : CatCreature;

  return (
    <group ref={ref} position={[home.x, home.y, home.z]} userData={{ isNPC: true, name, color, dialogues }}>
      <Creature color={color} walkCycle={walkRef.current} isMoving={movingRef.current} />
      <Html position={[0, 2.3, 0]} center occlude>
        <div style={{ background:'white', padding:'2px 10px', borderRadius:10, fontSize:12, border:`2px solid ${color}`, fontWeight:'bold', pointerEvents:'none', whiteSpace:'nowrap' }}>
          {name}
        </div>
      </Html>
      <ContactShadows opacity={0.35} scale={3} blur={2} position={[0, 0.02, 0]} />
    </group>
  );
}

// ─── World Data ───────────────────────────────────────────────────────────────

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const BLOCKED = [[-15,-15],[20,5],[0,25],[0,0]];
const isClear = (x, z, r=8) => BLOCKED.every(([bx,bz]) => Math.hypot(x-bx, z-bz) > r);

const TREE_DATA = (() => {
  const rng = seededRand(42); const out = []; let att = 0;
  while (out.length < 52 && att++ < 600) {
    const a = rng()*Math.PI*2, r = 9+rng()*43;
    const x = Math.cos(a)*r, z = Math.sin(a)*r, y = getTerrainY(x,z);
    if (y > 0.25 && isClear(x,z)) out.push({ x, y, z, s: 0.65+rng()*0.75, type: rng()>0.3?'pine':'palm' });
  }
  return out;
})();

const ROCK_DATA = (() => {
  const rng = seededRand(77); const out = []; let att = 0;
  while (out.length < 28 && att++ < 400) {
    const a = rng()*Math.PI*2, r = 5+rng()*50;
    const x = Math.cos(a)*r, z = Math.sin(a)*r, y = getTerrainY(x,z);
    if (y > -0.3 && isClear(x,z,4)) out.push({ x, y, z, s: 0.3+rng()*0.9, rx: rng()*Math.PI, ry: rng()*Math.PI });
  }
  return out;
})();

const FLOWER_DATA = (() => {
  const rng = seededRand(55); const cols = ['#ff6699','#ffdd44','#ff99cc','#cc88ff','#ff8833','#88ddff']; const out = []; let att = 0;
  while (out.length < 60 && att++ < 500) {
    const a = rng()*Math.PI*2, r = 4+rng()*46;
    const x = Math.cos(a)*r, z = Math.sin(a)*r, y = getTerrainY(x,z);
    if (y > 0.3) out.push({ x, y: y+0.22, z, color: cols[Math.floor(rng()*cols.length)], s: 0.5+rng()*0.8 });
  }
  return out;
})();

const FRUIT_DATA = (() => {
  const rng = seededRand(99); const out = [];
  while (out.length < 18) {
    const a = rng()*Math.PI*2, r = 8+rng()*38;
    const x = Math.cos(a)*r, z = Math.sin(a)*r, y = getTerrainY(x,z);
    if (y > 0.3) out.push(new THREE.Vector3(x, y+0.85, z));
  }
  return out;
})();

const HOUSE_CFGS = [
  { pos: [-15, getTerrainY(-15,-15), -15], color: CONFIG.COLORS.barnaby },
  { pos: [ 20, getTerrainY( 20,  5),   5], color: CONFIG.COLORS.luna    },
  { pos: [  0, getTerrainY(  0, 25),  25], color: CONFIG.COLORS.pip     },
];

// ─── FruitLayer ───────────────────────────────────────────────────────────────

function FruitLayer() {
  const { actions, playerPosRef } = useContext(GameContext);
  const [active, setActive] = useState(() => new Set(FRUIT_DATA.map((_,i)=>i)));
  useFrame(() => {
    FRUIT_DATA.forEach((pos, id) => {
      if (active.has(id) && playerPosRef.current.distanceTo(pos) < 1.6) {
        setActive(prev => { const n = new Set(prev); n.delete(id); return n; });
        actions.addItem('fruit'); actions.addBells(50); audio.sfx('munch');
      }
    });
  });
  return (
    <>
      {FRUIT_DATA.map((pos, id) => active.has(id) && (
        <Float key={id} position={[pos.x, pos.y, pos.z]} speed={4} floatIntensity={0.35}>
          <mesh castShadow>
            <sphereGeometry args={[0.26, 12, 12]} />
            <meshStandardMaterial color="#dd2222" emissive="#cc1111" emissiveIntensity={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.3, 0]} rotation={[0, 0, 0.5]}>
            <coneGeometry args={[0.06, 0.18, 5]} />
            <meshStandardMaterial color="#33aa33" />
          </mesh>
          <Sparkles count={5} scale={0.9} size={1.4} color="#ffee44" />
        </Float>
      ))}
    </>
  );
}

// ─── StaticWorld ──────────────────────────────────────────────────────────────

function House({ position, color }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow><boxGeometry args={[5, 3, 5]} /><meshStandardMaterial color="#fffaf0" roughness={0.8} /></mesh>
      <mesh position={[0, 4.1, 0]} rotation={[0, Math.PI/4, 0]} castShadow><coneGeometry args={[4, 2.8, 4]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      <mesh position={[0, 0.7, 2.51]}><boxGeometry args={[0.9, 1.4, 0.05]} /><meshStandardMaterial color="#6b3310" /></mesh>
      {[-1.5, 1.5].map(ox => (<mesh key={ox} position={[ox, 1.8, 2.51]}><boxGeometry args={[0.8, 0.8, 0.05]} /><meshStandardMaterial color="#aaddff" emissive="#aaddff" emissiveIntensity={0.4} /></mesh>))}
      {[-2.8,-2.1,-1.4,1.4,2.1,2.8].map((ox,i) => (<mesh key={i} position={[ox, 0.35, 2.9]} castShadow><boxGeometry args={[0.12, 0.7, 0.12]} /><meshStandardMaterial color="#c8a870" /></mesh>))}
      <pointLight position={[0, 2.5, 3.5]} intensity={1.5} color={color} distance={14} decay={2} />
    </group>
  );
}

function StaticWorld() {
  const pines = TREE_DATA.filter(t => t.type === 'pine');
  const palms = TREE_DATA.filter(t => t.type === 'palm');

  return (
    <group>
      {HOUSE_CFGS.map((h, i) => <House key={i} position={h.pos} color={h.color} />)}

      <Instances limit={55} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 7]} />
        <meshStandardMaterial color="#5c3a1e" roughness={1} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+0.8, t.z]} scale={t.s} />)}
      </Instances>
      <Instances limit={55} castShadow>
        <coneGeometry args={[1.7, 3.0, 8]} />
        <meshStandardMaterial color="#256325" roughness={0.9} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+2.8, t.z]} scale={t.s} />)}
      </Instances>
      <Instances limit={55} castShadow>
        <coneGeometry args={[1.1, 2.2, 8]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.9} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+4.4, t.z]} scale={t.s} />)}
      </Instances>

      <Instances limit={22} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 4.0, 7]} />
        <meshStandardMaterial color="#8B6914" roughness={0.95} />
        {palms.map((t,i) => <Instance key={i} position={[t.x, t.y+2.0, t.z]} scale={[t.s*0.8, t.s, t.s*0.8]} />)}
      </Instances>
      {palms.map((t,i) => (
        <group key={i} position={[t.x, t.y+4.1*t.s, t.z]}>
          {[0,72,144,216,288].map((deg,j) => (
            <mesh key={j} castShadow rotation={[0.62, 0, (deg*Math.PI)/180]} position={[Math.sin((deg*Math.PI)/180)*1.1*t.s, 0, Math.cos((deg*Math.PI)/180)*1.1*t.s]}>
              <coneGeometry args={[0.22*t.s, 2.2*t.s, 5]} />
              <meshStandardMaterial color="#3d8c3a" roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <mesh position={[0,-0.3,0]}><sphereGeometry args={[0.22*t.s, 8, 8]} /><meshStandardMaterial color="#7a5230" roughness={0.9} /></mesh>
        </group>
      ))}

      <Instances limit={32} castShadow receiveShadow>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#7a7060" roughness={0.95} />
        {ROCK_DATA.map((r,i) => <Instance key={i} position={[r.x, r.y+0.2*r.s, r.z]} scale={[r.s*1.2, r.s*0.7, r.s]} rotation={[r.rx, r.ry, 0]} />)}
      </Instances>

      <Instances limit={65}>
        <cylinderGeometry args={[0.02, 0.025, 0.28, 5]} />
        <meshStandardMaterial color="#44aa44" />
        {FLOWER_DATA.map((f,i) => <Instance key={i} position={[f.x, f.y-0.1, f.z]} scale={f.s} />)}
      </Instances>
      {['#ff6699','#ffdd44','#ff99cc','#cc88ff','#ff8833','#88ddff'].map(col => {
        const batch = FLOWER_DATA.filter(f => f.color === col);
        return (
          <Instances key={col} limit={15}>
            <sphereGeometry args={[0.1, 7, 7]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} />
            {batch.map((f,i) => <Instance key={i} position={[f.x, f.y+0.1, f.z]} scale={f.s} />)}
          </Instances>
        );
      })}
    </group>
  );
}

function WorldAssets() {
  return (<><StaticWorld /><FruitLayer /></>);
}

// ─── Atmosphere & Lighting ────────────────────────────────────────────────────

function Atmosphere() {
  const { state, actions } = useContext(GameContext);
  
  // SAFE TICK: Only update React state 1 time per second, eliminating white screens!
  useEffect(() => {
    const timer = setInterval(() => actions.tickTime(), 1000);
    return () => clearInterval(timer);
  }, [actions]);

  const sunAngle = ((state.gameTime - 6) / 12) * Math.PI - Math.PI;
  const sunPos   = [Math.cos(sunAngle)*80, Math.max(Math.sin(-sunAngle)*80, -10), 20];
  const isNight  = state.gameTime < 6 || state.gameTime > 18;
  const dusk     = state.gameTime > 16 && state.gameTime < 20;
  
  return (
    <>
      <Sky sunPosition={sunPos} turbidity={dusk?6:0.4} rayleigh={dusk?4:1.5} mieCoefficient={0.005} />
      <directionalLight position={sunPos} intensity={isNight?0.15:dusk?0.8:1.6} castShadow
        shadow-mapSize={[2048,2048]} color={dusk?'#ffaa55':'#fff8f0'} />
      <ambientLight intensity={isNight?0.08:0.35} color={isNight?'#334':'#fff'} />
      {isNight && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />}
    </>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function InlinedHUD({ gameTime }) {
  const timeStr = `${Math.floor(gameTime)}:${Math.floor((gameTime%1)*60).toString().padStart(2,'0')}`;
  return (
    <div style={{ position: 'absolute', top: 20, left: 20, pointerEvents: 'none', fontFamily: '"Comic Sans MS", cursive', zIndex: 10 }}>
      <div style={{ background:'rgba(255,255,255,0.8)', padding:'10px 20px', borderRadius:20, fontSize:18, fontWeight:'bold', border:'3px solid #fff', color: '#333', boxShadow:'0 4px 10px rgba(0,0,0,0.1)' }}>
        🕒 {timeStr}
      </div>
    </div>
  );
}

function GameUI() {
  const { state, actions } = useContext(GameContext);

  if (state.ui === 'start') return (
    <div style={ST.overlay} onClick={() => { actions.setUI('play'); audio.init(); audio.playBGM(); }}>
      <div style={{ fontSize: 76 }}>🏝️</div>
      <h1 style={{ fontSize: 62, margin: '4px 0', textShadow: '4px 4px #ff69b4, 0 0 40px rgba(255,105,180,0.5)' }}>CANDY ISLAND</h1>
      <p style={{ fontSize: 20, fontWeight: 'bold', margin: '6px 0 18px', opacity: 0.9 }}>THE ULTIMATE EDITION</p>
      <p style={{ fontSize: 14, opacity: 0.75, background: 'rgba(0,0,0,0.2)', padding: '8px 20px', borderRadius: 20 }}>
        Click to Start — W,A,S,D to move, Arrows to look, Space to jump, E to talk
      </p>
    </div>
  );

  const d = state.dialogue;
  const currentNode = d ? d.nodes[d.step] : null;

  const handleOptionClick = (nextStep) => {
    if (nextStep === undefined || nextStep === null || nextStep === 'end') {
      actions.setDialogue(null);
    } else {
      actions.setDialogue({ ...d, step: nextStep });
      audio.sfx('talk');
    }
  };

  return (
    <>
      {d && currentNode && (
        <div style={ST.dialogueBox}>
          <h2 style={{ margin: '0 0 10px 0', color: d.color, textTransform: 'uppercase' }}>{d.name}</h2>
          <p style={{ fontSize: 18, margin: '0 0 20px 0', color: '#444' }}>{currentNode.text}</p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            {currentNode.options ? (
              currentNode.options.map((opt, i) => (
                <button key={i} style={ST.dialogueBtn} onClick={() => handleOptionClick(opt.next)}>
                  {opt.label}
                </button>
              ))
            ) : (
              <button style={{...ST.dialogueBtn, background: d.color}} onClick={() => handleOptionClick(currentNode.next || 'end')}>
                {currentNode.next ? 'Next ▶' : 'Bye 👋'}
              </button>
            )}
          </div>
        </div>
      )}

      <div style={ST.backpack}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#6b3310' }}>🎒 Backpack</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={ST.bpItem}>
            <span style={{ fontSize: 20 }}>🍎</span>
            <span style={{ fontWeight: 'bold', color: '#333' }}>x {state.inventory.fruit}</span>
          </div>
          <div style={ST.bpItem}>
            <span style={{ fontSize: 20 }}>💰</span>
            <span style={{ fontWeight: 'bold', color: '#e5a50a' }}>{state.bells}</span>
          </div>
        </div>
      </div>

      <InlinedHUD gameTime={state.gameTime} />
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CandyIslandUltimate() {
  const store = useIslandStore();

  useEffect(() => {
    const onDown = (e) => {
      const k = e.key.toLowerCase();
      keyState[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
      }
    };
    const onUp = (e) => {
      keyState[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#87ceeb' }}>
      <GameContext.Provider value={store}>
        <Canvas shadows dpr={[1,2]} camera={{ fov:46, position:[0,12,18] }}
          gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}>
          <Suspense fallback={<Html center><div style={{fontFamily:'sans-serif', color:'white', background:'rgba(0,0,0,0.5)', padding:'10px 20px', borderRadius:20}}>Loading Island...</div></Html>}>
            <Atmosphere />
            <Terrain />
            <Water />
            <WorldAssets />
            <PlayerController />
            <DustEffect />
            <CameraRig />

            <NPC name="Barnaby" color={CONFIG.COLORS.barnaby} creatureType="bear"
              home={{ x:-15, y:getTerrainY(-15,-10), z:-10 }}
              dialogues={[
                { text: "Hey! Welcome to Candy Island! What are you up to today?", options: [
                    { label: "Picking fruit!", next: 1 },
                    { label: "Just exploring.", next: 2 }
                ]},
                { text: "Nice! I saw some apples by the big rocks earlier.", next: 'end' },
                { text: "It's a beautiful day for it. Take your time!", next: 'end' }
              ]} />

            <NPC name="Luna" color={CONFIG.COLORS.luna} creatureType="cat"
              home={{ x:20, y:getTerrainY(20,10), z:10 }}
              dialogues={[
                { text: "Meow~ Do you like the water here?", options: [
                  { label: "It's so calming.", next: 1 },
                  { label: "I prefer the forest.", next: 2 }
                ]},
                { text: "Right? I could sit by the shore all day.", next: 'end' },
                { text: "The trees are nice too, lots of shade for naps.", next: 'end' }
              ]} />

            <NPC name="Pip" color={CONFIG.COLORS.pip} creatureType="bunny"
              home={{ x:0, y:getTerrainY(0,22), z:22 }}
              dialogues={[
                { text: 'I could hop around here all day!', next: 1 },
                { text: 'The flowers smell amazing this time of year.', next: 'end' }
              ]} />

            <NPC name="Coco" color={CONFIG.COLORS.coco} creatureType="bear"
              home={{ x:-5, y:getTerrainY(-5,-22), z:-22 }}
              dialogues={[{ text: 'Every day here feels like a gentle hug.', next: 'end' }]} />

            <NPC name="Rosie" color={CONFIG.COLORS.rosie} creatureType="bunny"
              home={{ x:14, y:getTerrainY(14,-8), z:-8 }}
              dialogues={[{ text: "Pink flowers are obviously the best. Obviously.", next: 'end' }]} />

            <NPC name="Maple" color={CONFIG.COLORS.maple} creatureType="cat"
              home={{ x:-24, y:getTerrainY(-24,6), z:6 }}
              dialogues={[{ text: "I think I found a heart-shaped leaf today!", next: 'end' }]} />

            <NPC name="Bubbles" color={CONFIG.COLORS.bubbles} creatureType="bear"
              home={{ x:10, y:getTerrainY(10,-18), z:-18 }}
              dialogues={[{ text: 'Come back at night — the stars are incredible.', next: 'end' }]} />

            <EffectComposer multisampling={4}>
              <Bloom intensity={0.4} luminanceThreshold={0.88} luminanceSmoothing={0.4} />
              <Vignette darkness={0.4} offset={0.4} />
              <ChromaticAberration offset={[0.0004, 0.0004]} />
            </EffectComposer>
          </Suspense>
        </Canvas>
        <GameUI />
      </GameContext.Provider>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FF = '"Comic Sans MS", cursive';
const ST = {
  overlay:     { position:'absolute', inset:0, zIndex:100, cursor:'pointer', background:'linear-gradient(150deg,#87ceeb 0%,#b8e896 60%,#f4d98a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', fontFamily:FF, textAlign:'center' },
  backpack:    { position:'absolute', bottom:25, right:25, background:'rgba(255,255,255,0.85)', padding:15, borderRadius:15, border:'4px solid #fff', boxShadow:'0 4px 10px rgba(0,0,0,0.1)', fontFamily:FF, zIndex:50 },
  bpItem:      { background:'#fff', padding:'5px 10px', borderRadius:10, display:'flex', alignItems:'center', gap:8 },
  dialogueBox: { position:'absolute', bottom:40, left:'50%', transform:'translateX(-50%)', width:'60%', minWidth:320, background:'rgba(255,255,255,0.95)', padding:24, borderRadius:20, border:'5px solid #fff', boxShadow:'0 10px 30px rgba(0,0,0,0.15)', fontFamily:FF, textAlign:'center', zIndex:60 },
  dialogueBtn: { background:'#e0e0e0', border:'none', padding:'12px 24px', borderRadius:12, color:'#333', fontWeight:'bold', cursor:'pointer', fontSize:16, fontFamily:FF, boxShadow:'0 4px 0 rgba(0,0,0,0.1)', transition:'transform 0.1s' }
};
