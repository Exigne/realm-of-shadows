/**
 * 🏝️ CANDY ISLAND - LOCAL MULTIPLAYER EDITION
 * - Dynamic Seasons (Summer to Winter crossfade)
 * - Rigid Camera (Stops dead on release)
 * - Custom Server IP Input for Local Network Play
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Float, Instance, Instances, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { io } from 'socket.io-client';

let socket;

// ─── Pure Math Terrain Generation ────────────────────────────────────────────

function getTerrainY(x, z) {
  const d = Math.sqrt(x * x + z * z);
  if (d > 55) return -2.5;
  let h = (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.0) + 
          (Math.sin(x * 0.05 + z * 0.04) * 1.5) + 
          (Math.cos(x * 0.2 + z * 0.2) * 0.5);
  return h * Math.max(0, 1 - Math.pow(d / 60, 4));
}

// Global state for rigid camera and smooth seasons
const camState = { yaw: Math.PI, pitch: 0.4 };
const keyState = { prevE: false };
const globalSeason = { factor: 0 }; // 0 = Summer, 1 = Winter

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  SPEED: 6.0,             
  ACCEL: 12,               
  DECEL: 15,               
  GRAVITY: 35,             
  JUMP_FORCE: 14,          
  COLORS: {
    barnaby: '#6aaddb', luna: '#c07ed4', pip: '#f5c842', coco: '#c4813a',
    rosie: '#ff8fab', maple: '#ff7a1a', bubbles: '#6ecfb5',
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
    dialogue: null,
    ui: 'start',
    playerConfig: { 
      name: '', 
      creatureType: 'cat',
      colors: { head: '#ffccd8', body: '#f4a0b0', arms: '#f4a0b0', legs: '#f4a0b0' }
    },
    onlinePlayers: {},
    chatMessages: [],
  });

  const actions = useMemo(() => ({
    setUI:           (v)  => setState(s => ({ ...s, ui: v })),
    addBells:        (n)  => setState(s => ({ ...s, bells: s.bells + n })),
    addItem:         (t, n=1) => setState(s => ({ ...s, inventory: { ...s.inventory, [t]: (s.inventory[t]||0) + n } })),
    setDialogue:     (d)  => setState(s => ({ ...s, dialogue: d })),
    setPlayerConfig: (cfg) => setState(s => ({ ...s, playerConfig: { ...s.playerConfig, ...cfg } })),
    setOnlinePlayers:(p)  => setState(s => ({ ...s, onlinePlayers: p })),
    addChatMessage:  (m)  => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-8), m] })),
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
      [523.25, 12, 0.9], [493.88, 13, 0.9], [440.00, 14, 1.8]
    ];

    const bass = [
      [130.81, 0, 1.6], [174.61, 4, 1.6], [146.83, 8, 1.6], [130.81, 12, 1.6]
    ];

    const playNote = (freq, beatOffset, durBeats, startTime, vol = 0.06, type = 'sine') => {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      const t0 = startTime + beatOffset * BEAT;
      const dur = durBeats * BEAT;

      osc.type = type; osc.frequency.value = freq;
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
      const nextStart = startTime + 16 * BEAT;
      const scheduleAhead = (nextStart - this.ctx.currentTime - 0.5) * 1000;
      setTimeout(() => { if (this.bgm) scheduleLoop(nextStart); }, Math.max(0, scheduleAhead));
    };

    scheduleLoop(this.ctx.currentTime + 0.1);
  }

  sfx(type) {
    if (!this.ctx) return;
    
    if (type === 'step') {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      // Muffle the step sound slightly if it's winter
      const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; 
      filter.frequency.value = globalSeason.factor > 0.5 ? 400 : 1000;
      const gain = this.ctx.createGain(); gain.gain.value = 0.4;
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start();
    }
    
    if (type === 'splash') {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 3);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 1.0;
      const gain = this.ctx.createGain(); gain.gain.value = 0.3;
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start();
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
//  DYNAMIC BIPED -> QUADRUPED ANIMATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });
const matWhite = new THREE.MeshBasicMaterial({ color: '#fff' });
const matPink  = new THREE.MeshBasicMaterial({ color: '#ffb3cc' });

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts });
}

function useCreatureAnim({ velRef, isSwimmingRef, isNPC, npcMovingRef }) {
  const body = useRef(); const head = useRef(); 
  const armL = useRef(); const armR = useRef(); 
  const legL = useRef(); const legR = useRef(); const tail = useRef();
  const walk = useRef(0);
  const tilt = useRef(0);

  useFrame((_, delta) => {
    let isMoving = false;
    let isSwimming = false;

    if (isNPC && npcMovingRef) {
      isMoving = npcMovingRef.current;
    } else if (velRef && isSwimmingRef) {
      isMoving = Math.sqrt(velRef.current.x**2 + velRef.current.z**2) > 0.5;
      isSwimming = isSwimmingRef.current;
    }

    if (isMoving) walk.current += delta * (isSwimming ? 5 : 12);
    
    // FULL QUADRUPED TILT
    const targetTilt = isSwimming ? -1.2 : (isMoving ? -1.5 : 0);
    tilt.current = THREE.MathUtils.lerp(tilt.current, targetTilt, 12 * delta);
    const targetY = isSwimming ? -0.2 : (isMoving ? 0.35 : 0.6);

    if (body.current) {
      body.current.rotation.x = tilt.current;
      body.current.position.y = THREE.MathUtils.lerp(body.current.position.y, targetY, 12 * delta);
      if (isSwimming) body.current.position.y += Math.sin(walk.current * 0.5) * 0.05;
    }
    
    if (head.current) head.current.rotation.x = -tilt.current + (isMoving && !isSwimming ? Math.sin(walk.current * 2) * 0.05 : 0);
    if (tail.current) tail.current.rotation.z = Math.sin(walk.current * 1.5) * 0.3;

    const limbBase = Math.abs(tilt.current); 
    const s = Math.sin(walk.current) * 0.8;
    
    if (isSwimming) {
      if (armL.current) armL.current.rotation.x = -1.0 + Math.sin(walk.current)*0.4;
      if (armR.current) armR.current.rotation.x = -1.0 - Math.sin(walk.current)*0.4;
      if (legL.current) legL.current.rotation.x =  1.0 - Math.sin(walk.current)*0.4;
      if (legR.current) legR.current.rotation.x =  1.0 + Math.sin(walk.current)*0.4;
    } else {
      if (armL.current) armL.current.rotation.x = limbBase + s;
      if (armR.current) armR.current.rotation.x = limbBase - s;
      if (legL.current) legL.current.rotation.x = limbBase - s;
      if (legR.current) legR.current.rotation.x = limbBase + s;
    }
  });

  return { body, head, armL, armR, legL, legR, tail };
}

// ─── CREATURE MESHES ─────────────────────────────────────────────────────────

function CatCreature(props) {
  const { body, head, armL, armR, legL, legR, tail } = useCreatureAnim(props);
  const cHead = props.colors?.head || props.color || '#fff';
  const cBody = props.colors?.body || props.color || '#fff';
  const cArms = props.colors?.arms || props.color || '#fff';
  const cLegs = props.colors?.legs || props.color || '#fff';
  
  const headMat = useMemo(() => stdMat(cHead), [cHead]);
  const bodyMat = useMemo(() => stdMat(cBody), [cBody]);
  const armMat  = useMemo(() => stdMat(cArms), [cArms]);
  const legMat  = useMemo(() => stdMat(cLegs), [cLegs]);
  const innerMat = useMemo(() => stdMat('#ffccd8'), []);

  return (
    <group ref={body} position={[0, 0.6, 0]}>
      <mesh material={bodyMat} castShadow><sphereGeometry args={[0.5, 16, 16]} /></mesh>
      <group ref={head} position={[0, 0.45, 0.2]}>
        <mesh material={headMat} castShadow><sphereGeometry args={[0.4, 16, 16]} /></mesh>
        <mesh material={headMat} position={[-0.2, 0.3, 0]} rotation={[0,0,0.2]} castShadow><coneGeometry args={[0.1, 0.3, 8]} /></mesh>
        <mesh material={innerMat} position={[-0.2, 0.3, 0.05]} rotation={[0,0,0.2]}><coneGeometry args={[0.06, 0.2, 8]} /></mesh>
        <mesh material={headMat} position={[0.2, 0.3, 0]} rotation={[0,0,-0.2]} castShadow><coneGeometry args={[0.1, 0.3, 8]} /></mesh>
        <mesh material={innerMat} position={[0.2, 0.3, 0.05]} rotation={[0,0,-0.2]}><coneGeometry args={[0.06, 0.2, 8]} /></mesh>
        <mesh material={matBlack} position={[-0.15, 0.05, 0.37]}><sphereGeometry args={[0.06, 8, 8]} /></mesh>
        <mesh material={matBlack} position={[0.15, 0.05, 0.37]}><sphereGeometry args={[0.06, 8, 8]} /></mesh>
        <mesh material={matPink} position={[0, -0.05, 0.4]}><sphereGeometry args={[0.03, 8, 8]} /></mesh>
      </group>
      <group ref={armL} position={[-0.25, 0.1, 0]}>
        <mesh material={armMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.1, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={armR} position={[0.25, 0.1, 0]}>
        <mesh material={armMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.1, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={legL} position={[-0.25, -0.2, 0]}>
        <mesh material={legMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.12, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={legR} position={[0.25, -0.2, 0]}>
        <mesh material={legMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.12, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={tail} position={[0, -0.3, -0.4]}>
        <mesh material={bodyMat} position={[0, 0.3, -0.2]} rotation={[-0.5, 0, 0]} castShadow><cylinderGeometry args={[0.06, 0.08, 0.6, 8]} /></mesh>
      </group>
    </group>
  );
}

function BearCreature(props) {
  const { body, head, armL, armR, legL, legR } = useCreatureAnim(props);
  const cHead = props.colors?.head || props.color || '#fff';
  const cBody = props.colors?.body || props.color || '#fff';
  const cArms = props.colors?.arms || props.color || '#fff';
  const cLegs = props.colors?.legs || props.color || '#fff';
  
  const headMat = useMemo(() => stdMat(cHead), [cHead]);
  const bodyMat = useMemo(() => stdMat(cBody), [cBody]);
  const armMat  = useMemo(() => stdMat(cArms), [cArms]);
  const legMat  = useMemo(() => stdMat(cLegs), [cLegs]);
  const bellyMat = useMemo(() => stdMat('#d4eef8'), []);

  return (
    <group ref={body} position={[0, 0.6, 0]}>
      <mesh material={bodyMat} scale={[1.1, 1, 1]} castShadow><sphereGeometry args={[0.55, 16, 16]} /></mesh>
      <mesh material={bellyMat} position={[0, 0, 0.48]}><sphereGeometry args={[0.35, 16, 16]} /></mesh>
      <group ref={head} position={[0, 0.55, 0.2]}>
        <mesh material={headMat} castShadow><sphereGeometry args={[0.42, 16, 16]} /></mesh>
        <mesh material={bellyMat} position={[0, -0.1, 0.38]}><sphereGeometry args={[0.18, 16, 16]} /></mesh>
        <mesh material={headMat} position={[-0.25, 0.3, 0]} castShadow><sphereGeometry args={[0.15, 12, 12]} /></mesh>
        <mesh material={headMat} position={[0.25, 0.3, 0]} castShadow><sphereGeometry args={[0.15, 12, 12]} /></mesh>
        <mesh material={matBlack} position={[-0.15, 0.05, 0.39]}><sphereGeometry args={[0.06, 8, 8]} /></mesh>
        <mesh material={matBlack} position={[0.15, 0.05, 0.39]}><sphereGeometry args={[0.06, 8, 8]} /></mesh>
        <mesh material={matBlack} position={[0, -0.05, 0.55]}><sphereGeometry args={[0.04, 8, 8]} /></mesh>
      </group>
      <group ref={armL} position={[-0.35, 0.1, 0]}>
        <mesh material={armMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.12, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={armR} position={[0.35, 0.1, 0]}>
        <mesh material={armMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.12, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={legL} position={[-0.3, -0.2, 0]}>
        <mesh material={legMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.15, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={legR} position={[0.3, -0.2, 0]}>
        <mesh material={legMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.15, 0.5, 8, 8]} /></mesh>
      </group>
    </group>
  );
}

function BunnyCreature(props) {
  const { body, head, armL, armR, legL, legR, tail } = useCreatureAnim(props);
  const cHead = props.colors?.head || props.color || '#fff';
  const cBody = props.colors?.body || props.color || '#fff';
  const cArms = props.colors?.arms || props.color || '#fff';
  const cLegs = props.colors?.legs || props.color || '#fff';
  
  const headMat = useMemo(() => stdMat(cHead), [cHead]);
  const bodyMat = useMemo(() => stdMat(cBody), [cBody]);
  const armMat  = useMemo(() => stdMat(cArms), [cArms]);
  const legMat  = useMemo(() => stdMat(cLegs), [cLegs]);
  const innerMat = useMemo(() => stdMat('#ffe0a0'), []);

  return (
    <group ref={body} position={[0, 0.6, 0]}>
      <mesh material={bodyMat} castShadow><sphereGeometry args={[0.5, 16, 16]} /></mesh>
      <group ref={head} position={[0, 0.45, 0.2]}>
        <mesh material={headMat} castShadow><sphereGeometry args={[0.38, 16, 16]} /></mesh>
        <mesh material={innerMat} position={[0, -0.05, 0.35]}><sphereGeometry args={[0.12, 10, 10]} /></mesh>
        <mesh material={headMat} position={[-0.15, 0.45, -0.05]} rotation={[0, 0, -0.1]} castShadow><capsuleGeometry args={[0.08, 0.5, 8, 8]} /></mesh>
        <mesh material={innerMat} position={[-0.15, 0.45, 0]} rotation={[0, 0, -0.1]}><capsuleGeometry args={[0.04, 0.45, 8, 8]} /></mesh>
        <mesh material={headMat} position={[0.15, 0.45, -0.05]} rotation={[0, 0, 0.1]} castShadow><capsuleGeometry args={[0.08, 0.5, 8, 8]} /></mesh>
        <mesh material={innerMat} position={[0.15, 0.45, 0]} rotation={[0, 0, 0.1]}><capsuleGeometry args={[0.04, 0.45, 8, 8]} /></mesh>
        <mesh material={matBlack} position={[-0.12, 0.05, 0.35]}><sphereGeometry args={[0.06, 8, 8]} /></mesh>
        <mesh material={matBlack} position={[0.12, 0.05, 0.35]}><sphereGeometry args={[0.06, 8, 8]} /></mesh>
        <mesh material={matPink} position={[0, -0.02, 0.46]}><sphereGeometry args={[0.03, 8, 8]} /></mesh>
      </group>
      <group ref={armL} position={[-0.25, 0.1, 0]}>
        <mesh material={armMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.09, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={armR} position={[0.25, 0.1, 0]}>
        <mesh material={armMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.09, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={legL} position={[-0.25, -0.2, 0]}>
        <mesh material={legMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.13, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={legR} position={[0.25, -0.2, 0]}>
        <mesh material={legMat} position={[0, -0.25, 0]} castShadow><capsuleGeometry args={[0.13, 0.5, 8, 8]} /></mesh>
      </group>
      <group ref={tail} position={[0, -0.3, -0.45]}>
        <mesh material={matWhite} castShadow><sphereGeometry args={[0.15, 12, 12]} /></mesh>
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
  const S = 512; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#78b050'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * S, y = Math.random() * S; const r = 4 + Math.random() * 16;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(140,200,85,${0.1 + Math.random() * 0.16})` : `rgba(55,105,25,${0.1  + Math.random() * 0.16})`;
    ctx.fill();
  }
  applyNoise(ctx, S, 12); 
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16);
  return t;
}

function Terrain() {
  const grassTex = useMemo(() => makeGroundTexture(), []);
  const geoGrass = useMemo(() => {
    const g = new THREE.PlaneGeometry(150, 150, 128, 128); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, getTerrainY(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals(); return g;
  }, []);

  const snowMat = useRef();
  useFrame(() => {
    // Fade in snow mesh when it gets to winter
    if (snowMat.current) snowMat.current.opacity = globalSeason.factor * 0.95;
  });

  return (
    <group>
      <mesh geometry={geoGrass} receiveShadow position={[0, 0.002, 0]}>
        <meshStandardMaterial map={grassTex} roughness={0.88} />
      </mesh>
      {/* WINTER OVERLAY */}
      <mesh geometry={geoGrass} receiveShadow position={[0, 0.05, 0]}>
        <meshStandardMaterial ref={snowMat} color="#ffffff" transparent roughness={0.9} />
      </mesh>
    </group>
  );
}

function Water() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = -1.18 + Math.sin(clock.elapsedTime * 0.65) * 0.09;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#5bc8f0" transparent opacity={0.72} metalness={0.55} roughness={0.06} />
    </mesh>
  );
}

// ─── Weather Effects (Seasons & Snow) ─────────────────────────────────────────

function WeatherController() {
  useFrame(({ clock }) => {
    // Smooth transition: 0 (Summer) -> 1 (Winter) -> 0 (Summer) every 60 seconds
    globalSeason.factor = (Math.sin(clock.elapsedTime * 0.1) + 1) / 2;
  });

  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flakes = useMemo(() => {
    const arr = [];
    for(let i=0; i<600; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 100, y: Math.random() * 40, z: (Math.random() - 0.5) * 100,
        speed: 1 + Math.random() * 2, sway: Math.random() * Math.PI * 2
      });
    }
    return arr;
  }, []);

  const matRef = useRef();

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return;
    
    // Only show snow if it's winter!
    matRef.current.opacity = globalSeason.factor > 0.4 ? (globalSeason.factor - 0.4) * 1.5 : 0;
    
    if (matRef.current.opacity > 0) {
      flakes.forEach((f, i) => {
        f.y -= f.speed * delta;
        f.sway += delta;
        if (f.y < -2) f.y = 40;
        dummy.position.set(f.x + Math.sin(f.sway)*0.5, f.y, f.z);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, 600]}>
      <sphereGeometry args={[0.08, 4, 4]} />
      <meshBasicMaterial ref={matRef} color="#ffffff" transparent opacity={0} />
    </instancedMesh>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function CameraRig() {
  const { playerGroupRef } = useContext(GameContext);
  const { camera } = useThree();

  useFrame((_, delta) => {
    // RIGID CAMERA - No more icy swinging, stops dead instantly!
    const rotateSpeed = 2.5 * delta;
    if (keyState['arrowleft'])  camState.yaw += rotateSpeed;
    if (keyState['arrowright']) camState.yaw -= rotateSpeed;
    if (keyState['arrowup'])    camState.pitch -= rotateSpeed;
    if (keyState['arrowdown'])  camState.pitch += rotateSpeed;

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

// ─── Local Player Controller ─────────────────────────────────────────────────

function PlayerController() {
  const { state, actions, playerPosRef, playerGroupRef } = useContext(GameContext);
  const vel       = useRef(new THREE.Vector3());
  const movingRef = useRef(false);
  const prevGrounded = useRef(true);
  const isSwimmingRef = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const downVec   = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const { scene } = useThree();
  const lastSend = useRef(0);
  const lastStep = useRef(0);

  useFrame(({ clock }, delta) => {
    const g = playerGroupRef.current;
    if (!g || state.ui !== 'play') return;
    
    if (keyState['e'] && !keyState.prevE) {
      let closestNPC = null; let minDist = 4.0;
      scene.traverse(child => {
        if (child.userData?.isNPC) {
          const dist = child.getWorldPosition(new THREE.Vector3()).distanceTo(g.position);
          if (dist < minDist) { minDist = dist; closestNPC = child; }
        }
      });
      if (closestNPC && !state.dialogue) {
        actions.setDialogue({ name: closestNPC.userData.name, color: closestNPC.userData.color, nodes: closestNPC.userData.dialogues, step: 0 });
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
        if (floorHeight < -1.48) { floorHeight = -1.48; isSwimming = true; }
        if (g.position.y <= floorHeight + 0.3 && vel.current.y <= 0) {
          g.position.y = floorHeight;
          isGrounded = true;
          vel.current.y = 0;
        }
      }
    }

    prevGrounded.current = isGrounded; isSwimmingRef.current = isSwimming;

    if (keyState[' '] && isGrounded && !isSwimming) { vel.current.y = CONFIG.JUMP_FORCE; isGrounded = false; }

    const spd2D = Math.sqrt(vel.current.x ** 2 + vel.current.z ** 2);
    movingRef.current = spd2D > 0.5 && isGrounded; 

    if (movingRef.current) {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), Math.min(1, 15 * delta));
      lastStep.current += (spd2D * delta);
      if (lastStep.current > (isSwimming ? 1.5 : 1.2)) {
        audio.sfx(isSwimming ? 'splash' : 'step'); lastStep.current = 0;
      }
    } else { lastStep.current = 0; }

    playerPosRef.current.copy(g.position);

    if (socket && clock.elapsedTime - lastSend.current > 0.05) {
      socket.emit('move', { position: g.position, rotation: { y: g.rotation.y }, isMoving: movingRef.current, isSwimming: isSwimming });
      lastSend.current = clock.elapsedTime;
    }
  });

  const Creature = state.playerConfig.creatureType === 'bear' ? BearCreature : state.playerConfig.creatureType === 'bunny' ? BunnyCreature : CatCreature;

  return (
    <group ref={playerGroupRef} position={[0, 1, 0]}>
      <Creature colors={state.playerConfig.colors} velRef={vel} isSwimmingRef={isSwimmingRef} />
      <ContactShadows opacity={0.45} scale={4} blur={2.5} position={[0, 0.02, 0]} />
    </group>
  );
}

// ─── Network Player Renderer ──────────────────────────────────────────────────
function NetworkPlayer({ data }) {
  const ref = useRef();
  const movingRef = useRef(false);
  const isSwimmingRef = useRef(false);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(data.position.x, data.position.y, data.position.z), 10 * delta);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, data.rotation.y, 10 * delta);
    movingRef.current = data.isMoving;
    isSwimmingRef.current = data.isSwimming;
  });

  const Creature = data.creatureType === 'bear' ? BearCreature : data.creatureType === 'bunny' ? BunnyCreature : CatCreature;
  return (
    <group ref={ref}>
      <Creature colors={data.colors} isNPC={true} npcMovingRef={movingRef} isSwimmingRef={isSwimmingRef} />
      <Html position={[0, 2.3, 0]} center>
        <div style={{ background:'rgba(0,0,0,0.5)', color:'white', padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:'bold', border:`2px solid ${data.colors?.head || '#fff'}`, whiteSpace:'nowrap' }}>
          {data.name}
        </div>
      </Html>
    </group>
  );
}

// ─── World Data ───────────────────────────────────────────────────────────────

function seededRand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
const BLOCKED = [[-15,-15],[20,5],[0,25],[0,0]];
const isClear = (x, z, r=8) => BLOCKED.every(([bx,bz]) => Math.hypot(x-bx, z-bz) > r);

const TREE_DATA = (() => {
  const rng = seededRand(42); const out = []; let att = 0;
  while (out.length < 52 && att++ < 600) {
    const a = rng()*Math.PI*2, r = 9+rng()*43; const x = Math.cos(a)*r, z = Math.sin(a)*r, y = getTerrainY(x,z);
    if (y > 0.25 && isClear(x,z)) out.push({ x, y, z, s: 0.65+rng()*0.75, type: rng()>0.3?'pine':'palm' });
  }
  return out;
})();

const HOUSE_CFGS = [
  { pos: [-15, getTerrainY(-15,-15), -15], color: CONFIG.COLORS.barnaby },
  { pos: [ 20, getTerrainY( 20,  5),   5], color: CONFIG.COLORS.luna    },
  { pos: [  0, getTerrainY(  0, 25),  25], color: CONFIG.COLORS.pip     },
];

// ─── StaticWorld ──────────────────────────────────────────────────────────────

function House({ position, color }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow><boxGeometry args={[5, 3, 5]} /><meshStandardMaterial color="#fffaf0" roughness={0.8} /></mesh>
      <mesh position={[0, 4.1, 0]} rotation={[0, Math.PI/4, 0]} castShadow><coneGeometry args={[4, 2.8, 4]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      <mesh position={[0, 0.7, 2.51]}><boxGeometry args={[0.9, 1.4, 0.05]} /><meshStandardMaterial color="#6b3310" /></mesh>
      <pointLight position={[0, 2.5, 3.5]} intensity={1.5} color={color} distance={14} decay={2} />
    </group>
  );
}

function StaticWorld() {
  const pines = TREE_DATA.filter(t => t.type === 'pine');
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
    </group>
  );
}

// ─── Atmosphere & Lighting ────────────────────────────────────────────────────

function Atmosphere() {
  const lightColor = useRef(new THREE.Color());
  const ambientColor = useRef(new THREE.Color());

  useFrame(() => {
    // Interpolate lighting based on season!
    lightColor.current.lerpColors(new THREE.Color('#fff8f0'), new THREE.Color('#d0e0ff'), globalSeason.factor);
    ambientColor.current.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#aaccff'), globalSeason.factor);
  });

  return (
    <>
      <Sky sunPosition={[80, 20, 20]} turbidity={0.4} rayleigh={1.5} mieCoefficient={0.005} />
      <directionalLight position={[80, 20, 20]} intensity={1.6} castShadow shadow-mapSize={[2048,2048]}>
        <primitive object={lightColor.current} attach="color" />
      </directionalLight>
      <ambientLight intensity={0.4}>
        <primitive object={ambientColor.current} attach="color" />
      </ambientLight>
    </>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function GameUI() {
  const { state, actions } = useContext(GameContext);
  const [chatText, setChatText] = useState("");
  // IMPORTANT: This is where they type in the NAS IP address!
  const [serverIP, setServerIP] = useState("http://192.168.1.50:3001"); 

  const updateColor = (part, val) => actions.setPlayerConfig({ colors: { ...state.playerConfig.colors, [part]: val } });

  const connectToGame = () => {
    if (!state.playerConfig.name) return alert("Enter a name!");
    
    // Connect to the custom server IP instead of hardcoded localhost
    socket = io(serverIP);
    
    socket.emit('join', state.playerConfig);
    socket.on('currentPlayers', (p) => actions.setOnlinePlayers(p));
    socket.on('stateUpdate', (p) => actions.setOnlinePlayers(p));
    socket.on('chatMessage', (m) => actions.addChatMessage(m));
    socket.on('playerLeft', (id) => {
      actions.setOnlinePlayers(prev => { const n = {...prev}; delete n[id]; return n; });
    });
    audio.init(); 
    audio.playBGM();
    actions.setUI('play');
  };

  if (state.ui === 'start') return (
    <div style={ST.overlay}>
       <div style={{...ST.modal, maxWidth: 450}}>
          <h1 style={{ fontSize: 48, margin: '4px 0', textShadow: '2px 2px #ff69b4', color: '#fff' }}>🏝️ CANDY ISLAND</h1>
          <p style={{ fontWeight: 'bold', color: '#333' }}>MULTIPLAYER EDITION</p>
          
          <input style={ST.input} placeholder="Type your name..." maxLength={10} onChange={e => actions.setPlayerConfig({ name: e.target.value })} />
          
          <div style={ST.row}>
            {['cat', 'bear', 'bunny'].map(t => (
              <button key={t} onClick={() => actions.setPlayerConfig({ creatureType: t })} 
                style={{...ST.btn, border: state.playerConfig.creatureType === t ? '4px solid #ff8fab' : '4px solid transparent'}}>
                {t === 'cat' ? '🐱' : t === 'bear' ? '🐻' : '🐰'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, textAlign: 'left' }}>
            <div style={ST.colorRow}><b>Head:</b> <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.head} onChange={e => updateColor('head', e.target.value)} /></div>
            <div style={ST.colorRow}><b>Body:</b> <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.body} onChange={e => updateColor('body', e.target.value)} /></div>
            <div style={ST.colorRow}><b>Arms:</b> <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.arms} onChange={e => updateColor('arms', e.target.value)} /></div>
            <div style={ST.colorRow}><b>Legs:</b> <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.legs} onChange={e => updateColor('legs', e.target.value)} /></div>
          </div>
          
          {/* NAS SERVER IP INPUT */}
          <div style={{ marginBottom: 15, textAlign: 'left' }}>
            <label style={{fontWeight: 'bold', color:'#555'}}>Server IP (Your NAS):</label>
            <input style={{...ST.input, padding: '10px', marginBottom: 0, marginTop: 5}} value={serverIP} onChange={e => setServerIP(e.target.value)} />
          </div>

          <button style={ST.startBtn} onClick={connectToGame}>JUMP IN!</button>
       </div>
    </div>
  );

  return (
    <>
      <div style={ST.chatArea}>
        <div style={ST.chatLog}>
          {state.chatMessages.map((m, i) => <div key={i}><b style={{ color: m.color }}>{m.name}:</b> {m.text}</div>)}
        </div>
        <input style={ST.chatInput} placeholder="Type here and hit Enter..." value={chatText} onChange={e => setChatText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && chatText.trim()) {
              if (socket) socket.emit('chat', chatText);
              setChatText("");
            }
          }} />
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CandyIslandUltimate() {
  const store = useIslandStore();

  useEffect(() => {
    const onDown = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      keyState[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    const onUp = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      keyState[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
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
            <StaticWorld />
            <WeatherController />
            <PlayerController />
            {Object.values(store.state.onlinePlayers).map(p => socket && p.id !== socket.id && <NetworkPlayer key={p.id} data={p} />)}
            <CameraRig />
            
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
  modal:       { background: 'white', padding: 40, borderRadius: 30, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  input:       { width: '100%', padding: '15px', marginBottom: 20, borderRadius: 15, border: '2px solid #eee', fontSize: 18, boxSizing: 'border-box', outline: 'none', fontFamily: FF, color: '#333' },
  row:         { display: 'flex', justifyContent: 'space-around', marginBottom: 20 },
  btn:         { fontSize: 40, background: '#fcfcfc', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 20, transition: '0.2s' },
  colorRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f8f8', padding: '5px 15px', borderRadius: 15, color: '#555' },
  colorPicker: { width: 45, height: 45, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent' },
  startBtn:    { width: '100%', background: '#ff8fab', color: 'white', border: 'none', padding: '18px', borderRadius: 20, fontSize: 20, fontWeight: 'bold', cursor: 'pointer', fontFamily: FF, marginTop: 10 },
  
  chatArea:    { position: 'absolute', bottom: 20, left: 20, zIndex: 5, width: 300, fontFamily: FF, pointerEvents: 'auto' },
  chatLog:     { background: 'rgba(0,0,0,0.4)', color: '#fff', padding: 15, borderRadius: 15, height: 160, overflowY: 'auto', marginBottom: 10, fontSize: 14, backdropFilter: 'blur(10px)', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' },
  chatInput:   { width: '100%', background: 'rgba(255,255,255,0.95)', border: 'none', padding: 12, borderRadius: 10, boxSizing: 'border-box', outline: 'none', fontFamily: FF, color: '#333', fontSize: 16 }
};
