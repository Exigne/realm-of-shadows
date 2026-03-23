/**
 * 🏝️ CANDY ISLAND
 * - Proper creature characters: cat, bear, bunny with procedural animation
 * - Canvas-generated terrain textures with noise variation
 * - Animated water with UV scrolling
 * - Rock clusters, palm trees, flower patches
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Stars, Sparkles,
  Float, Instance, Instances, Environment, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// ─── Noise & Terrain Formula ─────────────────────────────────────────────────

const noise2D = createNoise2D();
const GameContext = createContext();

function getTerrainY(x, z) {
  const d = Math.sqrt(x * x + z * z);
  if (d > 55) return -2.5;
  let h = noise2D(x * 0.04, z * 0.04) * 3 + noise2D(x * 0.1, z * 0.1) * 0.8;
  return h * Math.max(0, 1 - Math.pow(d / 60, 4));
}

// Module-level camera state — no React, no re-renders
const camState = { yaw: Math.PI, pitch: 0.4, locked: false };

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  FRICTION: 0.80,
  SPEEDS: { walk: 14, run: 25, ride: 42 },
  COLORS: {
    player: '#f4a0b0', barnaby: '#6aaddb', luna: '#c07ed4', pip: '#f5c842',
  },
  TIME_SPEED: 0.04,
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useIslandStore = () => {
  const playerPosRef   = useRef(new THREE.Vector3(0, 1, 0));
  const playerGroupRef = useRef();

  const [state, setState] = useState({
    bells: 100,
    inventory: { fruit: 0 },
    activeBoard: false,
    gameTime: 9.0,
    dialogue: null,
    ui: 'start',
  });

  const actions = useMemo(() => ({
    setUI:       (v)  => setState(s => ({ ...s, ui: v })),
    addBells:    (n)  => setState(s => ({ ...s, bells: s.bells + n })),
    addItem:     (t, n=1) => setState(s => ({ ...s, inventory: { ...s.inventory, [t]: (s.inventory[t]||0) + n } })),
    toggleBoard: ()   => setState(s => ({ ...s, activeBoard: !s.activeBoard })),
    setDialogue: (d)  => setState(s => ({ ...s, dialogue: d })),
    updateTime:  (dt) => setState(s => ({ ...s, gameTime: (s.gameTime + dt) % 24 })),
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
    this.master.gain.value = 0.07;
    this.master.connect(this.ctx.destination);
  }
  playBGM() {
    if (this.bgm || !this.ctx) return;
    this.bgm = true;
    const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
    let i = 0;
    const loop = () => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = notes[i % notes.length];
      g.gain.setValueAtTime(0.015, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);
      osc.connect(g); g.connect(this.master);
      osc.start(); osc.stop(this.ctx.currentTime + 1.8);
      i++; setTimeout(loop, 2200);
    };
    loop();
  }
  sfx(type) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.connect(g); g.connect(this.master);
    if (type === 'pop') {
      osc.frequency.setValueAtTime(380, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(860, this.ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.12, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
      osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    }
    if (type === 'talk') {
      osc.type = 'square';
      osc.frequency.value = 500 + Math.random() * 300;
      g.gain.setValueAtTime(0.025, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
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

// ── Cat Creature ──────────────────────────────────────────────────────────────
function CatCreature({ color, walkCycle = 0, isMoving = false }) {
  const bodyMat  = useMemo(() => stdMat(color), [color]);
  const innerCol = color === CONFIG.COLORS.player ? '#ffccd8' : '#e8c0f0';
  const innerMat = useMemo(() => stdMat(innerCol), [innerCol]);

  return (
    <group>
      {/* Body */}
      <mesh castShadow position={[0, 0.55, 0]} scale={[1, 1.05, 0.95]} material={bodyMat}>
        <sphereGeometry args={[0.52, 18, 14]} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 1.22, 0.08]} material={bodyMat}>
        <sphereGeometry args={[0.4, 18, 14]} />
      </mesh>
      {/* Muzzle */}
      <mesh position={[0, 1.12, 0.41]} material={innerMat}>
        <sphereGeometry args={[0.18, 12, 10]} />
      </mesh>
      {/* Ears */}
      <mesh castShadow position={[-0.24, 1.61, 0.05]} rotation={[0, 0, -0.28]} material={bodyMat}>
        <coneGeometry args={[0.1, 0.28, 7]} />
      </mesh>
      <mesh position={[-0.24, 1.61, 0.1]} rotation={[0, 0, -0.28]} material={innerMat}>
        <coneGeometry args={[0.055, 0.2, 7]} />
      </mesh>
      <mesh castShadow position={[0.24, 1.61, 0.05]} rotation={[0, 0, 0.28]} material={bodyMat}>
        <coneGeometry args={[0.1, 0.28, 7]} />
      </mesh>
      <mesh position={[0.24, 1.61, 0.1]} rotation={[0, 0, 0.28]} material={innerMat}>
        <coneGeometry args={[0.055, 0.2, 7]} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.14, 1.26, 0.37]} material={matBlack}><sphereGeometry args={[0.07, 9, 9]} /></mesh>
      <mesh position={[ 0.14, 1.26, 0.37]} material={matBlack}><sphereGeometry args={[0.07, 9, 9]} /></mesh>
      <mesh position={[-0.11, 1.28, 0.43]} material={matWhite}><sphereGeometry args={[0.025, 6, 6]} /></mesh>
      <mesh position={[ 0.17, 1.28, 0.43]} material={matWhite}><sphereGeometry args={[0.025, 6, 6]} /></mesh>
      {/* Nose */}
      <mesh position={[0, 1.14, 0.46]} material={matPink}><sphereGeometry args={[0.036, 7, 7]} /></mesh>
      {/* Tail */}
      <mesh castShadow position={[-0.26, 0.78, -0.46]} rotation={[0.55, 0, 0.32]} material={bodyMat}>
        <cylinderGeometry args={[0.07, 0.11, 0.7, 8]} />
      </mesh>
      <mesh castShadow position={[-0.16, 1.08, -0.66]} material={innerMat}>
        <sphereGeometry args={[0.1, 9, 9]} />
      </mesh>
      {/* Legs */}
      {[[-0.2, 0.24, true], [0.2, 0.24, false], [-0.2, -0.2, false], [0.2, -0.2, true]].map(([lx, lz, phase], i) => (
        <mesh key={i} castShadow material={bodyMat}
          position={[lx, 0.12 + (isMoving ? Math.sin(walkCycle + (phase ? 0 : Math.PI)) * 0.08 : 0), lz]}>
          <cylinderGeometry args={[0.1, 0.09, 0.42, 8]} />
        </mesh>
      ))}
    </group>
  );
}

// ── Bear Creature ─────────────────────────────────────────────────────────────
function BearCreature({ color, walkCycle = 0, isMoving = false }) {
  const bodyMat  = useMemo(() => stdMat(color), [color]);
  const bellyMat = useMemo(() => stdMat('#d4eef8'), []);

  return (
    <group>
      <mesh castShadow position={[0, 0.62, 0]} scale={[1.1, 1.0, 1.0]} material={bodyMat}>
        <sphereGeometry args={[0.6, 18, 14]} />
      </mesh>
      <mesh position={[0, 0.62, 0.54]} material={bellyMat}>
        <sphereGeometry args={[0.38, 12, 10]} />
      </mesh>
      <mesh castShadow position={[0, 1.38, 0.05]} material={bodyMat}>
        <sphereGeometry args={[0.44, 18, 14]} />
      </mesh>
      <mesh position={[0, 1.24, 0.45]} material={bellyMat}>
        <sphereGeometry args={[0.2, 12, 10]} />
      </mesh>
      {/* Round ears */}
      {[-0.3, 0.3].map((ex, i) => (
        <group key={i}>
          <mesh castShadow position={[ex, 1.76, 0]} material={bodyMat}><sphereGeometry args={[0.14, 12, 12]} /></mesh>
          <mesh position={[ex, 1.76, 0.05]} material={bellyMat}><sphereGeometry args={[0.08, 10, 10]} /></mesh>
        </group>
      ))}
      {/* Eyes */}
      <mesh position={[-0.16, 1.40, 0.42]} material={matBlack}><sphereGeometry args={[0.075, 9, 9]} /></mesh>
      <mesh position={[ 0.16, 1.40, 0.42]} material={matBlack}><sphereGeometry args={[0.075, 9, 9]} /></mesh>
      <mesh position={[-0.12, 1.42, 0.48]} material={matWhite}><sphereGeometry args={[0.026, 6, 6]} /></mesh>
      <mesh position={[ 0.20, 1.42, 0.48]} material={matWhite}><sphereGeometry args={[0.026, 6, 6]} /></mesh>
      <mesh position={[0, 1.26, 0.51]} material={matBlack}><sphereGeometry args={[0.044, 7, 7]} /></mesh>
      {/* Arms */}
      {[[-1, -0.68, 0.82, 0.1], [1, 0.68, 0.82, 0.1]].map(([side, ax, ay, az], i) => (
        <mesh key={i} castShadow material={bodyMat}
          position={[ax, ay, az]}
          rotation={[0, 0, isMoving ? Math.sin(walkCycle + (i===0?0:Math.PI)) * 0.4 + side*0.3 : side*0.3]}>
          <capsuleGeometry args={[0.1, 0.35, 6, 8]} />
        </mesh>
      ))}
      {/* Legs */}
      {[[-0.22, 0.14], [0.22, -0.14]].map(([lx, lz], i) => (
        <mesh key={i} castShadow material={bodyMat}
          position={[lx, 0.08 + (isMoving ? Math.sin(walkCycle + (i===0?0:Math.PI)) * 0.07 : 0), Math.abs(lz)]}>
          <cylinderGeometry args={[0.13, 0.12, 0.5, 9]} />
        </mesh>
      ))}
    </group>
  );
}

// ── Bunny Creature ────────────────────────────────────────────────────────────
function BunnyCreature({ color, walkCycle = 0, isMoving = false }) {
  const bodyMat  = useMemo(() => stdMat(color), [color]);
  const innerMat = useMemo(() => stdMat('#ffe0a0'), []);

  return (
    <group>
      <mesh castShadow position={[0, 0.55, 0]} scale={[1, 1.05, 1]} material={bodyMat}>
        <sphereGeometry args={[0.5, 18, 14]} />
      </mesh>
      <mesh castShadow position={[0, 1.18, 0.06]} material={bodyMat}>
        <sphereGeometry args={[0.38, 18, 14]} />
      </mesh>
      <mesh position={[0, 1.08, 0.38]} material={innerMat}>
        <sphereGeometry args={[0.15, 10, 9]} />
      </mesh>
      {/* Long ears */}
      {[-0.14, 0.14].map((ex, i) => (
        <group key={i} rotation={[isMoving ? Math.sin(walkCycle * 0.5 + i*0.3) * 0.15 : 0, 0, ex < 0 ? -0.1 : 0.1]}>
          <mesh castShadow position={[ex, 1.85, -0.04]} material={bodyMat}>
            <capsuleGeometry args={[0.08, 0.55, 6, 8]} />
          </mesh>
          <mesh position={[ex, 1.85, 0.03]} material={innerMat}>
            <capsuleGeometry args={[0.04, 0.48, 6, 8]} />
          </mesh>
        </group>
      ))}
      {/* Eyes */}
      <mesh position={[-0.14, 1.21, 0.35]} material={matBlack}><sphereGeometry args={[0.068, 9, 9]} /></mesh>
      <mesh position={[ 0.14, 1.21, 0.35]} material={matBlack}><sphereGeometry args={[0.068, 9, 9]} /></mesh>
      <mesh position={[-0.10, 1.23, 0.41]} material={matWhite}><sphereGeometry args={[0.023, 6, 6]} /></mesh>
      <mesh position={[ 0.18, 1.23, 0.41]} material={matWhite}><sphereGeometry args={[0.023, 6, 6]} /></mesh>
      <mesh position={[0, 1.09, 0.42]} material={matPink}><sphereGeometry args={[0.034, 7, 7]} /></mesh>
      {/* Pom tail */}
      <mesh castShadow position={[0, 0.7, -0.52]} material={matWhite}>
        <sphereGeometry args={[0.14, 10, 10]} />
      </mesh>
      {/* Legs */}
      {[[-0.18, 0.22, true], [0.18, 0.22, false], [-0.2, -0.18, false], [0.2, -0.18, true]].map(([lx, lz, ph], i) => (
        <mesh key={i} castShadow material={bodyMat}
          position={[lx, 0.08 + (isMoving ? Math.sin(walkCycle + (ph ? 0 : Math.PI)) * 0.1 : 0), lz]}
          rotation={lz < 0 ? [0.15, 0, 0] : [0, 0, 0]}>
          <cylinderGeometry args={[i<2?0.09:0.11, i<2?0.08:0.1, i<2?0.38:0.5, 8]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Terrain ─────────────────────────────────────────────────────────────────

function makeGroundTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#78b050';
  ctx.fillRect(0, 0, S, S);
  // Colour variation blobs
  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const r = 4 + Math.random() * 16;
    const bright = Math.random() > 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bright
      ? `rgba(140,200,85,${0.1 + Math.random() * 0.16})`
      : `rgba(55,105,25,${0.1  + Math.random() * 0.16})`;
    ctx.fill();
  }
  // Grass blades
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const h = 5 + Math.random() * 11;
    ctx.strokeStyle = `rgba(${55+Math.random()*50},${145+Math.random()*55},${25+Math.random()*30},0.5)`;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * h * 0.6, y - h);
    ctx.stroke();
  }
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
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${175+Math.random()*45},${145+Math.random()*30},${85+Math.random()*30},0.22)`;
    ctx.fill();
  }
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
        const d = Math.sqrt(x * x + z * z);
        let h = noise2D(x * 0.04, z * 0.04) * 3 + noise2D(x * 0.1, z * 0.1) * 0.8;
        const mask = Math.max(0, 1 - Math.pow(d / 60, 4));
        h *= mask;
        if (d > 55) h = -2.5;
        pos.setY(i, h);
      }
      g.computeVertexNormals();
      return g;
    };
    return { geoBase: build(), geoGrass: build() };
  }, []);

  // Grass geometry — only vertices where height > 0.35 are opaque
  const grassAlpha = useMemo(() => {
    const pos = geoGrass.attributes.position;
    const a = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      a[i] = pos.getY(i) > 0.35 ? 1 : 0;
    }
    geoGrass.setAttribute('grassMask', new THREE.BufferAttribute(a, 1));
    return a;
  }, [geoGrass]);

  return (
    <group>
      <mesh geometry={geoBase} receiveShadow name="ground">
        <meshStandardMaterial map={sandTex} roughness={0.95} metalness={0} />
      </mesh>
      <mesh geometry={geoGrass} receiveShadow position={[0, 0.002, 0]}>
        <meshStandardMaterial map={grassTex} roughness={0.88} metalness={0}
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
    ctx.beginPath();
    ctx.moveTo(0, y);
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
      <meshStandardMaterial map={tex} color="#5bc8f0" transparent opacity={0.72}
        metalness={0.55} roughness={0.06} />
    </mesh>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function CameraRig() {
  const { playerGroupRef } = useContext(GameContext);
  const { gl, camera } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onClick = () => canvas.requestPointerLock();
    const onLC = () => { camState.locked = document.pointerLockElement === canvas; };
    const onMM = (e) => {
      if (!camState.locked) return;
      camState.yaw   -= e.movementX * 0.003;
      camState.pitch  = Math.max(0.1, Math.min(1.05, camState.pitch - e.movementY * 0.003));
    };
    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLC);
    document.addEventListener('mousemove', onMM);
    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLC);
      document.removeEventListener('mousemove', onMM);
    };
  }, [gl]);

  const _tgt = useMemo(() => new THREE.Vector3(), []);
  const _cam = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const p = playerGroupRef.current;
    if (!p) return;
    const dist = 14;
    _cam.set(
      p.position.x + Math.sin(camState.yaw) * dist * Math.cos(camState.pitch),
      p.position.y + dist * Math.sin(camState.pitch) + 1,
      p.position.z + Math.cos(camState.yaw) * dist * Math.cos(camState.pitch),
    );
    camera.position.lerp(_cam, 0.1);
    _tgt.set(p.position.x, p.position.y + 1.1, p.position.z);
    camera.lookAt(_tgt);
  });
  return null;
}

// ─── Player ───────────────────────────────────────────────────────────────────

function PlayerController() {
  const { state, actions, playerPosRef, playerGroupRef } = useContext(GameContext);
  const bodyRef   = useRef();
  const vel       = useRef(new THREE.Vector3());
  const keys      = useRef({});
  const walkRef   = useRef(0);
  const movingRef = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const downVec   = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const { scene } = useThree();

  useEffect(() => {
    const onDown = (e) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.code === 'Space') { e.preventDefault(); actions.toggleBoard(); }
    };
    const onUp = (e) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, [actions]);

  useFrame(({ clock }, delta) => {
    const g = playerGroupRef.current;
    if (!g || state.ui !== 'play') return;
    const k = keys.current;
    const speed = state.activeBoard ? CONFIG.SPEEDS.ride : (k['shift'] ? CONFIG.SPEEDS.run : CONFIG.SPEEDS.walk);
    const mx = (k['a'] || k['arrowleft']  ? -1 : 0) + (k['d'] || k['arrowright'] ? 1 : 0);
    const mz = (k['w'] || k['arrowup']    ? -1 : 0) + (k['s'] || k['arrowdown']  ? 1 : 0);

    if (mx !== 0 || mz !== 0) {
      const angle = Math.atan2(mx, mz) + camState.yaw;
      vel.current.x += Math.sin(angle) * speed * delta;
      vel.current.z += Math.cos(angle) * speed * delta;
    }
    vel.current.multiplyScalar(CONFIG.FRICTION);
    g.position.x = Math.max(-56, Math.min(56, g.position.x + vel.current.x));
    g.position.z = Math.max(-56, Math.min(56, g.position.z + vel.current.z));

    raycaster.set(new THREE.Vector3(g.position.x, 12, g.position.z), downVec);
    const ground = scene.getObjectByName('ground');
    if (ground) {
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0)
        g.position.y = THREE.MathUtils.lerp(g.position.y, hits[0].point.y + 0.05, 0.3);
    }

    const spd2D = Math.sqrt(vel.current.x ** 2 + vel.current.z ** 2);
    movingRef.current = spd2D > 0.04;
    if (movingRef.current) {
      walkRef.current += delta * (state.activeBoard ? 6 : k['shift'] ? 10 : 8);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), 0.18);
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.abs(Math.sin(walkRef.current)) * 0.08;
        bodyRef.current.rotation.z = Math.sin(walkRef.current) * 0.04;
      }
    } else if (bodyRef.current) {
      bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0, 0.1);
      bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, 0, 0.1);
    }
    playerPosRef.current.copy(g.position);
  });

  return (
    <group ref={playerGroupRef} position={[0, 1, 0]}>
      <group ref={bodyRef}>
        <CatCreature color={CONFIG.COLORS.player} walkCycle={walkRef.current} isMoving={movingRef.current} />
        {state.activeBoard && (
          <mesh position={[0, -0.18, 0]}>
            <boxGeometry args={[1.8, 0.1, 0.9]} />
            <meshStandardMaterial color="hotpink" emissive="hotpink" emissiveIntensity={1.0} />
          </mesh>
        )}
      </group>
      <ContactShadows opacity={0.45} scale={4} blur={2.5} position={[0, 0.02, 0]} />
    </group>
  );
}

// ─── NPC ─────────────────────────────────────────────────────────────────────

function NPC({ name, color, home, dialogues, creatureType }) {
  const { state, actions } = useContext(GameContext);
  const ref       = useRef();
  const modeRef   = useRef('idle');
  const target    = useRef(new THREE.Vector3(home.x, home.y, home.z));
  const walkRef   = useRef(0);
  const movingRef = useRef(false);

  useFrame(({ clock }, delta) => {
    if (!ref.current || state.dialogue?.name === name) return;
    const t = clock.elapsedTime + home.x;
    if (Math.floor(t) % 10 === 0 && modeRef.current === 'idle') {
      modeRef.current = 'walk';
      target.current.set(home.x + (Math.random()-0.5)*12, ref.current.position.y, home.z + (Math.random()-0.5)*12);
    }
    if (modeRef.current === 'walk') {
      const dir = target.current.clone().sub(ref.current.position).normalize();
      ref.current.position.add(dir.multiplyScalar(delta * 2.8));
      ref.current.lookAt(target.current.x, ref.current.position.y, target.current.z);
      walkRef.current += delta * 7;
      movingRef.current = true;
      if (ref.current.position.distanceTo(target.current) < 0.5) { modeRef.current = 'idle'; movingRef.current = false; }
    } else {
      ref.current.position.y = home.y + 0.05 + Math.sin(t * 1.6) * 0.06;
      movingRef.current = false;
    }
  });

  const Creature = creatureType === 'bear' ? BearCreature : creatureType === 'bunny' ? BunnyCreature : CatCreature;

  return (
    <group ref={ref} position={[home.x, home.y, home.z]}
      onClick={() => { actions.setDialogue({ name, color, texts: dialogues, step: 0 }); audio.sfx('talk'); }}>
      <Creature color={color} walkCycle={walkRef.current} isMoving={movingRef.current} />
      <Html position={[0, 2.3, 0]} center occlude>
        <div style={{ background:'white', padding:'2px 10px', borderRadius:10, fontSize:12, border:`2px solid ${color}`, fontWeight:'bold', pointerEvents:'none', whiteSpace:'nowrap' }}>{name}</div>
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
        actions.addItem('fruit'); actions.addBells(50); audio.sfx('pop');
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
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 3, 5]} />
        <meshStandardMaterial color="#fffaf0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.1, 0]} rotation={[0, Math.PI/4, 0]} castShadow>
        <coneGeometry args={[4, 2.8, 4]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.7, 2.51]}>
        <boxGeometry args={[0.9, 1.4, 0.05]} />
        <meshStandardMaterial color="#6b3310" />
      </mesh>
      {[-1.5, 1.5].map(ox => (
        <mesh key={ox} position={[ox, 1.8, 2.51]}>
          <boxGeometry args={[0.8, 0.8, 0.05]} />
          <meshStandardMaterial color="#aaddff" emissive="#aaddff" emissiveIntensity={0.4} />
        </mesh>
      ))}
      {[-2.8,-2.1,-1.4,1.4,2.1,2.8].map((ox,i) => (
        <mesh key={i} position={[ox, 0.35, 2.9]} castShadow>
          <boxGeometry args={[0.12, 0.7, 0.12]} />
          <meshStandardMaterial color="#c8a870" />
        </mesh>
      ))}
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

      {/* Pine trunks */}
      <Instances limit={55} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 7]} />
        <meshStandardMaterial color="#5c3a1e" roughness={1} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+0.8, t.z]} scale={t.s} />)}
      </Instances>
      {/* Pine canopy base */}
      <Instances limit={55} castShadow>
        <coneGeometry args={[1.7, 3.0, 8]} />
        <meshStandardMaterial color="#256325" roughness={0.9} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+2.8, t.z]} scale={t.s} />)}
      </Instances>
      {/* Pine canopy top */}
      <Instances limit={55} castShadow>
        <coneGeometry args={[1.1, 2.2, 8]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.9} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+4.4, t.z]} scale={t.s} />)}
      </Instances>

      {/* Palm trunks */}
      <Instances limit={22} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 4.0, 7]} />
        <meshStandardMaterial color="#8B6914" roughness={0.95} />
        {palms.map((t,i) => <Instance key={i} position={[t.x, t.y+2.0, t.z]} scale={[t.s*0.8, t.s, t.s*0.8]} />)}
      </Instances>
      {/* Palm fronds */}
      {palms.map((t,i) => (
        <group key={i} position={[t.x, t.y+4.1*t.s, t.z]}>
          {[0,72,144,216,288].map((deg,j) => (
            <mesh key={j} castShadow
              rotation={[0.62, 0, (deg*Math.PI)/180]}
              position={[Math.sin((deg*Math.PI)/180)*1.1*t.s, 0, Math.cos((deg*Math.PI)/180)*1.1*t.s]}>
              <coneGeometry args={[0.22*t.s, 2.2*t.s, 5]} />
              <meshStandardMaterial color="#3d8c3a" roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <mesh position={[0,-0.3,0]}>
            <sphereGeometry args={[0.22*t.s, 8, 8]} />
            <meshStandardMaterial color="#7a5230" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Rocks */}
      <Instances limit={32} castShadow receiveShadow>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#7a7060" roughness={0.95} />
        {ROCK_DATA.map((r,i) => (
          <Instance key={i} position={[r.x, r.y+0.2*r.s, r.z]} scale={[r.s*1.2, r.s*0.7, r.s]} rotation={[r.rx, r.ry, 0]} />
        ))}
      </Instances>

      {/* Flower stems */}
      <Instances limit={65}>
        <cylinderGeometry args={[0.02, 0.025, 0.28, 5]} />
        <meshStandardMaterial color="#44aa44" />
        {FLOWER_DATA.map((f,i) => <Instance key={i} position={[f.x, f.y-0.1, f.z]} scale={f.s} />)}
      </Instances>
      {/* Flower heads grouped by colour */}
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

// ─── Atmosphere ───────────────────────────────────────────────────────────────

function Atmosphere() {
  const { state, actions } = useContext(GameContext);
  useFrame((_, delta) => actions.updateTime(delta * CONFIG.TIME_SPEED));
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

function GameUI() {
  const { state, actions } = useContext(GameContext);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const fn = () => setLocked(document.pointerLockElement != null);
    document.addEventListener('pointerlockchange', fn);
    return () => document.removeEventListener('pointerlockchange', fn);
  }, []);

  if (state.ui === 'start') return (
    <div style={ST.overlay} onClick={() => { actions.setUI('play'); audio.init(); audio.playBGM(); }}>
      <div style={{ fontSize:76 }}>🏝️</div>
      <h1 style={{ fontSize:62, margin:'4px 0', textShadow:'4px 4px #ff69b4, 0 0 40px rgba(255,105,180,0.5)' }}>CANDY ISLAND</h1>
      <p style={{ fontSize:20, fontWeight:'bold', margin:'6px 0 18px', opacity:0.9 }}>THE ULTIMATE EDITION</p>
      <p style={{ fontSize:14, opacity:0.75, background:'rgba(0,0,0,0.2)', padding:'8px 20px', borderRadius:20 }}>Click to start — then click the world to enable mouse look</p>
    </div>
  );

  return (
    <>
      <div style={ST.hud}>
        <div style={ST.pill}>🔔 {state.bells.toLocaleString()}</div>
        <div style={ST.pill}>🍎 {state.inventory.fruit}</div>
        <button style={ST.btn} onClick={() => actions.toggleBoard()}>{state.activeBoard ? '🛹 ON' : '🛹 OFF'}</button>
        <div style={ST.pill}>{String(Math.floor(state.gameTime%12)||12).padStart(2,'0')}:00 {state.gameTime>=12?'PM':'AM'}</div>
      </div>
      {locked && <div style={ST.cross}>+</div>}
      {state.dialogue && (
        <div style={ST.dialogue} onClick={() => {
          const d = state.dialogue;
          if (d.step < d.texts.length-1) { actions.setDialogue({...d, step:d.step+1}); audio.sfx('talk'); }
          else actions.setDialogue(null);
        }}>
          <div style={{ background:state.dialogue.color, color:'#fff', padding:'5px 20px', display:'inline-block', borderRadius:'10px 10px 0 0', fontWeight:'bold', fontSize:15 }}>{state.dialogue.name}</div>
          <div style={ST.dText}>{state.dialogue.texts[state.dialogue.step]}</div>
          <div style={{ textAlign:'right', padding:'3px 16px 0', fontSize:12, opacity:0.4 }}>click to continue ▶</div>
        </div>
      )}
      <div style={ST.help}>{locked ? 'WASD · Move  |  SHIFT · Sprint  |  SPACE · Board  |  ESC · Unlock  |  Click NPC · Talk' : '🖱️ Click the world to enable mouse look'}</div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CandyIslandUltimate() {
  const store = useIslandStore();
  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#87ceeb' }}>
      <GameContext.Provider value={store}>
        <Canvas shadows dpr={[1,2]} camera={{ fov:46, position:[0,12,18] }}
          gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}>
          <Suspense fallback={null}>
            <Atmosphere />
            <Terrain />
            <Water />
            <WorldAssets />
            <PlayerController />
            <CameraRig />
            <NPC name="Barnaby" color={CONFIG.COLORS.barnaby} creatureType="bear"
              home={{ x:-15, y:getTerrainY(-15,-10), z:-10 }}
              dialogues={['Hey! Welcome to Candy Island!','I love exploring the forests.','Have you found all the fruit yet?']} />
            <NPC name="Luna" color={CONFIG.COLORS.luna} creatureType="cat"
              home={{ x:20, y:getTerrainY(20,10), z:10 }}
              dialogues={['Meow~ The night sky here is gorgeous.','Did you find any fruit today?','Bells grow on trees… almost literally!']} />
            <NPC name="Pip" color={CONFIG.COLORS.pip} creatureType="bunny"
              home={{ x:0, y:getTerrainY(0,22), z:22 }}
              dialogues={["I'm the fastest on the island!","Hold SHIFT to sprint!","Try the hoverboard, it's SO fast!"]} />
            <Environment preset="sunset" />
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
  overlay: { position:'absolute', inset:0, zIndex:100, cursor:'pointer', background:'linear-gradient(150deg,#87ceeb 0%,#b8e896 60%,#f4d98a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', fontFamily:FF, textAlign:'center' },
  hud:  { position:'absolute', top:22, left:22, display:'flex', gap:14, pointerEvents:'none', zIndex:10 },
  pill: { background:'rgba(255,255,255,0.92)', padding:'7px 20px', borderRadius:50, border:'4px solid #8B4513', fontWeight:'bold', fontSize:17, fontFamily:FF },
  btn:  { background:'#FF69B4', color:'white', border:'4px solid white', borderRadius:50, padding:'7px 20px', cursor:'pointer', pointerEvents:'auto', fontWeight:'bold', fontFamily:FF, fontSize:17 },
  dialogue: { position:'absolute', bottom:46, left:'50%', transform:'translateX(-50%)', width:'66%', maxWidth:840, cursor:'pointer', fontFamily:FF, zIndex:10 },
  dText: { background:'rgba(255,255,255,0.96)', padding:'22px 26px', borderRadius:'0 18px 18px 18px', border:'5px solid #333', fontSize:23, lineHeight:1.5 },
  help:  { position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', color:'white', fontSize:12, fontFamily:'Arial,sans-serif', background:'rgba(0,0,0,0.32)', padding:'5px 16px', borderRadius:20, whiteSpace:'nowrap', zIndex:10, userSelect:'none' },
  cross: { position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'white', fontSize:22, pointerEvents:'none', opacity:0.55 },
};
