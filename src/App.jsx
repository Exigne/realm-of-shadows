/**
 * 🎤 TAKE THAT: THE SEARCH FOR ROBBIE - MULTIPLAYER EDITION
 * - Human Bipedal Rig (No more running on all fours!)
 * - Choose your band member
 * - Dynamic Robbie Williams Hide & Seek mechanic
 * - Real-Time Multiplayer Sync
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
import { io } from 'socket.io-client';

// ─── Multiplayer Config ───────────────────────────────────────────────────────
const SOCKET_URL = "http://192.168.1.129:3001"; // <--- REPLACE THIS WITH YOUR CODESPACE URL
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

const camState = { yaw: Math.PI, pitch: 0.4, yawVel: 0, pitchVel: 0 };
const keyState = { prevE: false };

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  SPEED: 6.5, // Boybands run fast             
  ACCEL: 12,               
  DECEL: 15,               
  GRAVITY: 35,             
  JUMP_FORCE: 14,          
  COLORS: {
    fan1: '#ff8fab', fan2: '#6ecfb5', fan3: '#c07ed4', robbie: '#ff2222'
  }
};

// ─── Store ────────────────────────────────────────────────────────────────────

const GameContext = createContext();

const useIslandStore = () => {
  const playerPosRef   = useRef(new THREE.Vector3(0, 1, 0));
  const playerGroupRef = useRef();

  const [state, setState] = useState({
    bells: 0,
    inventory: { hitRecords: 0 },
    gameTime: 14.0, // Afternoon lighting
    dialogue: null,
    ui: 'start',
    playerConfig: { 
      name: '', 
      member: 'Gary',
      colors: { jacket: '#333333', pants: '#111111' }
    },
    onlinePlayers: {},
    chatMessages: [],
  });

  const actions = useMemo(() => ({
    setUI:           (v)  => setState(s => ({ ...s, ui: v })),
    addBells:        (n)  => setState(s => ({ ...s, bells: s.bells + n })),
    addItem:         (t, n=1) => setState(s => ({ ...s, inventory: { ...s.inventory, [t]: (s.inventory[t]||0) + n } })),
    setDialogue:     (d)  => setState(s => ({ ...s, dialogue: d })),
    tickTime:        ()   => setState(s => ({ ...s, gameTime: (s.gameTime + 0.05) % 24 })),
    setPlayerConfig: (cfg) => setState(s => ({ ...s, playerConfig: { ...s.playerConfig, ...cfg } })),
    setOnlinePlayers:(p)  => setState(s => ({ ...s, onlinePlayers: p })),
    addChatMessage:  (m)  => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-8), m] })),
  }), []);

  return { state, actions, playerPosRef, playerGroupRef };
};

// ─── Audio ────────────────────────────────────────────────────────────────────
// Keeping the same audio engine for footsteps and chat blips
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
    const reverb = this.ctx.createConvolver(); reverb.buffer = convBuf;
    const reverbGain = this.ctx.createGain(); reverbGain.gain.value = 0.22;
    reverb.connect(reverbGain); reverbGain.connect(this.master);

    const BPM = 110; const BEAT = 60 / BPM;
    const phrase = [[523.25, 0, 0.9], [587.33, 1, 0.9], [659.25, 2, 0.9], [523.25, 3, 0.9]];
    const bass = [[130.81, 0, 1.6], [174.61, 4, 1.6]];

    const playNote = (freq, beatOffset, durBeats, startTime, vol = 0.06, type = 'sine') => {
      const osc = this.ctx.createOscillator(); const env = this.ctx.createGain();
      const t0 = startTime + beatOffset * BEAT; const dur = durBeats * BEAT;
      osc.type = type; osc.frequency.value = freq;
      env.gain.setValueAtTime(0.001, t0); env.gain.linearRampToValueAtTime(vol, t0 + 0.018);
      env.gain.exponentialRampToValueAtTime(vol * 0.4, t0 + dur * 0.35); env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.95);
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
      const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1000;
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
      osc.type = 'square'; osc.frequency.value = 400 + Math.random() * 200;
      g.gain.setValueAtTime(0.025, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
      osc.connect(g); g.connect(this.master);
      osc.start(); osc.stop(this.ctx.currentTime + 0.07);
    }
    if (type === 'win') {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.1, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      osc.connect(g); g.connect(this.master);
      osc.start(); osc.stop(this.ctx.currentTime + 0.5);
    }
  }
}
const audio = new GameAudio();

// ═══════════════════════════════════════════════════════════════════════════════
//  HUMAN BIPED ANIMATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const matSkin  = new THREE.MeshStandardMaterial({ color: '#ffcdb2', roughness: 0.6 });
const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });

function stdMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
}

function useHumanAnim({ velRef, isSwimmingRef, isNPC, npcMovingRef }) {
  const body = useRef(); const head = useRef(); 
  const armL = useRef(); const armR = useRef(); 
  const legL = useRef(); const legR = useRef();
  const walk = useRef(0);

  useFrame((_, delta) => {
    let isMoving = false;
    let isSwimming = false;

    if (isNPC && npcMovingRef) {
      isMoving = npcMovingRef.current;
    } else if (velRef && isSwimmingRef) {
      isMoving = Math.sqrt(velRef.current.x**2 + velRef.current.z**2) > 0.5;
      isSwimming = isSwimmingRef.current;
    }

    if (isMoving) walk.current += delta * (isSwimming ? 5 : 14);
    
    // Human running: upright, no pitching forward like the animals
    if (body.current) {
      body.current.position.y = isSwimming ? -0.2 : 1.0;
      if (isMoving && !isSwimming) {
        body.current.position.y += Math.abs(Math.sin(walk.current * 2)) * 0.08;
      }
    }
    
    // Head bob
    if (head.current) {
      head.current.rotation.y = isMoving ? Math.sin(walk.current) * 0.1 : 0;
    }
    
    // Human arm and leg swings (opposites)
    const s = Math.sin(walk.current) * 1.2; 
    
    if (isSwimming) {
      if (armL.current) armL.current.rotation.x = -1.5 + Math.sin(walk.current)*0.5;
      if (armR.current) armR.current.rotation.x = -1.5 - Math.sin(walk.current)*0.5;
      if (legL.current) legL.current.rotation.x =  0.5 - Math.sin(walk.current)*0.5;
      if (legR.current) legR.current.rotation.x =  0.5 + Math.sin(walk.current)*0.5;
    } else if (isMoving) {
      if (armL.current) armL.current.rotation.x = s;
      if (armR.current) armR.current.rotation.x = -s;
      if (legL.current) legL.current.rotation.x = -s;
      if (legR.current) legR.current.rotation.x = s;
    } else {
      // Idle
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, 0, 0.1);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, 0, 0.1);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.1);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.1);
    }
  });

  return { body, head, armL, armR, legL, legR };
}

function BoybandRig(props) {
  const { body, head, armL, armR, legL, legR } = useHumanAnim(props);
  
  const cJacket = props.colors?.jacket || '#333';
  const cPants  = props.colors?.pants || '#111';
  
  const jacketMat = useMemo(() => stdMat(cJacket), [cJacket]);
  const pantsMat  = useMemo(() => stdMat(cPants), [cPants]);

  return (
    <group ref={body} position={[0, 1.0, 0]}>
      {/* Torso */}
      <mesh material={jacketMat} castShadow><boxGeometry args={[0.6, 0.8, 0.4]} /></mesh>
      
      {/* Head */}
      <group ref={head} position={[0, 0.6, 0]}>
        <mesh material={matSkin} castShadow><boxGeometry args={[0.45, 0.5, 0.45]} /></mesh>
        {/* Hair block */}
        <mesh material={jacketMat} position={[0, 0.28, -0.05]} castShadow><boxGeometry args={[0.5, 0.15, 0.5]} /></mesh>
        {/* Eyes */}
        <mesh material={matBlack} position={[-0.1, 0.05, 0.23]}><boxGeometry args={[0.06, 0.06, 0.02]} /></mesh>
        <mesh material={matBlack} position={[0.1, 0.05, 0.23]}><boxGeometry args={[0.06, 0.06, 0.02]} /></mesh>
      </group>

      {/* Arms */}
      <group ref={armL} position={[-0.4, 0.3, 0]}>
        <mesh material={jacketMat} position={[0, -0.3, 0]} castShadow><boxGeometry args={[0.2, 0.7, 0.2]} /></mesh>
        <mesh material={matSkin} position={[0, -0.7, 0]} castShadow><boxGeometry args={[0.15, 0.15, 0.15]} /></mesh>
      </group>
      <group ref={armR} position={[0.4, 0.3, 0]}>
        <mesh material={jacketMat} position={[0, -0.3, 0]} castShadow><boxGeometry args={[0.2, 0.7, 0.2]} /></mesh>
        <mesh material={matSkin} position={[0, -0.7, 0]} castShadow><boxGeometry args={[0.15, 0.15, 0.15]} /></mesh>
      </group>

      {/* Legs */}
      <group ref={legL} position={[-0.18, -0.4, 0]}>
        <mesh material={pantsMat} position={[0, -0.35, 0]} castShadow><boxGeometry args={[0.25, 0.7, 0.25]} /></mesh>
        <mesh material={matBlack} position={[0, -0.75, 0.05]} castShadow><boxGeometry args={[0.25, 0.15, 0.35]} /></mesh>
      </group>
      <group ref={legR} position={[0.18, -0.4, 0]}>
        <mesh material={pantsMat} position={[0, -0.35, 0]} castShadow><boxGeometry args={[0.25, 0.7, 0.25]} /></mesh>
        <mesh material={matBlack} position={[0, -0.75, 0.05]} castShadow><boxGeometry args={[0.25, 0.15, 0.35]} /></mesh>
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
  const c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d');
  ctx.fillStyle = '#78b050'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2800; i++) {
    const x = Math.random() * S, y = Math.random() * S; const r = 4 + Math.random() * 16;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(140,200,85,${0.1 + Math.random() * 0.16})` : `rgba(55,105,25,${0.1  + Math.random() * 0.16})`;
    ctx.fill();
  }
  applyNoise(ctx, S, 12); 
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); return t;
}

function makeSandTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8ccaa'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * S, y = Math.random() * S; const r = 1 + Math.random() * 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${175+Math.random()*45},${145+Math.random()*30},${85+Math.random()*30},0.22)`;
    ctx.fill();
  }
  applyNoise(ctx, S, 8);  
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}

function Terrain() {
  const grassTex = useMemo(() => makeGroundTexture(), []);
  const sandTex  = useMemo(() => makeSandTexture(),   []);

  const { geoBase, geoGrass } = useMemo(() => {
    const build = () => {
      const g = new THREE.PlaneGeometry(150, 150, 128, 128); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, getTerrainY(pos.getX(i), pos.getZ(i)));
      g.computeVertexNormals(); return g;
    };
    return { geoBase: build(), geoGrass: build() };
  }, []);

  return (
    <group>
      <mesh geometry={geoBase} receiveShadow name="ground"><meshStandardMaterial map={sandTex} bumpMap={sandTex} bumpScale={0.02} roughness={0.95} metalness={0} /></mesh>
      <mesh geometry={geoGrass} receiveShadow position={[0, 0.002, 0]}>
        <meshStandardMaterial map={grassTex} bumpMap={grassTex} bumpScale={0.05} roughness={0.88} metalness={0} transparent alphaTest={0.01}
          onBeforeCompile={(shader) => {
            shader.vertexShader = 'attribute float grassMask;\nvarying float vGrassMask;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrassMask = grassMask;');
            shader.fragmentShader = 'varying float vGrassMask;\n' + shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'if(vGrassMask < 0.5) discard;\nvec4 diffuseColor = vec4( diffuse, opacity );');
          }} />
      </mesh>
    </group>
  );
}

function Water() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#38b4e8" transparent opacity={0.8} metalness={0.8} roughness={0.1} />
    </mesh>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function CameraRig() {
  const { playerGroupRef } = useContext(GameContext);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (keyState['arrowleft'])  camState.yawVel += 10.0 * delta;
    if (keyState['arrowright']) camState.yawVel -= 10.0 * delta;
    if (keyState['arrowup'])    camState.pitchVel -= 10.0 * delta;
    if (keyState['arrowdown'])  camState.pitchVel += 10.0 * delta;

    camState.yawVel *= 0.82; camState.pitchVel *= 0.82;
    camState.yaw += camState.yawVel * delta;
    camState.pitch += camState.pitchVel * delta;
    camState.pitch = Math.max(0.1, Math.min(1.4, camState.pitch));

    const p = playerGroupRef.current;
    if (!p) return;
    
    const dist = 14;
    camera.position.set(
      p.position.x + Math.sin(camState.yaw) * dist * Math.cos(camState.pitch),
      p.position.y + dist * Math.sin(camState.pitch) + 2,
      p.position.z + Math.cos(camState.yaw) * dist * Math.cos(camState.pitch)
    );
    camera.lookAt(p.position.x, p.position.y + 1.5, p.position.z);
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
        // If they found Robbie!
        if (closestNPC.userData.name === "Robbie") audio.sfx('win');
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
        const SWIM_FLOAT_Y = -1.0; 

        if (floorHeight < SWIM_FLOAT_Y) {
           floorHeight = SWIM_FLOAT_Y;
           isSwimming = true;
        }

        const snapDist = 0.3; 
        if (g.position.y <= floorHeight + snapDist && vel.current.y <= 0) {
          g.position.y = floorHeight;
          isGrounded = true;
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

    if (movingRef.current) {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), Math.min(1, 15 * delta));
      lastStep.current += (spd2D * delta);
      if (lastStep.current > (isSwimming ? 1.5 : 1.4)) {
        audio.sfx(isSwimming ? 'splash' : 'step');
        lastStep.current = 0;
      }
    } else {
      lastStep.current = 0;
    }

    playerPosRef.current.copy(g.position);

    if (socket && clock.elapsedTime - lastSend.current > 0.05) {
      socket.emit('move', {
        position: g.position,
        rotation: { y: g.rotation.y },
        isMoving: movingRef.current,
        isSwimming: isSwimming
      });
      lastSend.current = clock.elapsedTime;
    }
  });

  return (
    <group ref={playerGroupRef} position={[0, 1, 0]}>
      <BoybandRig colors={state.playerConfig.colors} velRef={vel} isSwimmingRef={isSwimmingRef} />
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

  return (
    <group ref={ref}>
      <BoybandRig colors={data.colors} isNPC={true} npcMovingRef={movingRef} isSwimmingRef={isSwimmingRef} />
      <Html position={[0, 2.8, 0]} center>
        <div style={{ background:'rgba(0,0,0,0.6)', color:'white', padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:'bold', border:`2px solid ${data.colors?.jacket || '#fff'}`, whiteSpace:'nowrap' }}>
          {data.name} ({data.member})
        </div>
      </Html>
    </group>
  );
}

// ─── NPC ─────────────────────────────────────────────────────────────────────

function NPC({ name, color, home, dialogues }) {
  const { state } = useContext(GameContext);
  const ref       = useRef();
  const modeRef   = useRef('idle');
  const target    = useRef(new THREE.Vector3(home.x, home.y, home.z));
  const movingRef = useRef(false);

  useFrame(({ clock }, delta) => {
    if (!ref.current || state.dialogue?.name === name) {
      movingRef.current = false;
      return;
    }
    const t = clock.elapsedTime + home.x;
    
    // NPCs randomly walk
    if (Math.floor(t) % 10 === 0 && modeRef.current === 'idle') {
      modeRef.current = 'walk';
      target.current.set(home.x + (Math.random()-0.5)*12, ref.current.position.y, home.z + (Math.random()-0.5)*12);
    }
    
    if (modeRef.current === 'walk') {
      const dir = target.current.clone().sub(ref.current.position).normalize();
      ref.current.position.add(dir.multiplyScalar(delta * 2.0));
      ref.current.lookAt(target.current.x, ref.current.position.y, target.current.z);
      movingRef.current = true;
      if (ref.current.position.distanceTo(target.current) < 0.5) { 
        modeRef.current = 'idle'; 
        movingRef.current = false; 
      }
    } else {
      movingRef.current = false;
    }
  });

  return (
    <group ref={ref} position={[home.x, home.y, home.z]} userData={{ isNPC: true, name, color, dialogues }}>
      <BoybandRig colors={{ jacket: color, pants: '#222' }} isNPC={true} npcMovingRef={movingRef} />
      <Html position={[0, 2.8, 0]} center occlude>
        <div style={{ background:'white', padding:'2px 10px', borderRadius:10, fontSize:12, border:`2px solid ${color}`, fontWeight:'bold', pointerEvents:'none', whiteSpace:'nowrap', color:'#333' }}>
          {name}
        </div>
      </Html>
      <ContactShadows opacity={0.35} scale={3} blur={2} position={[0, 0.02, 0]} />
    </group>
  );
}

// ─── World Data ───────────────────────────────────────────────────────────────

function seededRand(seed) {
  let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const BLOCKED = [[-15,-15],[20,5],[0,25],[0,0]];
const isClear = (x, z, r=8) => BLOCKED.every(([bx,bz]) => Math.hypot(x-bx, z-bz) > r);

const TREE_DATA = (() => {
  const rng = seededRand(42); const out = []; let att = 0;
  while (out.length < 65 && att++ < 600) {
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

// ROBBIE HIDING SPOTS
const ROBBIE_SPAWNS = [
  { x: -38, z: -35 }, { x: 42, z: -15 }, { x: -25, z: 40 }, 
  { x: 30, z: 35 }, { x: 0, z: -45 }, { x: 45, z: 45 }
];

// ─── StaticWorld ──────────────────────────────────────────────────────────────

function StaticWorld() {
  const pines = TREE_DATA.filter(t => t.type === 'pine');
  const palms = TREE_DATA.filter(t => t.type === 'palm');

  return (
    <group>
      <Instances limit={65} castShadow>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 7]} />
        <meshStandardMaterial color="#5c3a1e" roughness={1} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+0.8, t.z]} scale={t.s} />)}
      </Instances>
      <Instances limit={65} castShadow>
        <coneGeometry args={[1.7, 3.0, 8]} />
        <meshStandardMaterial color="#256325" roughness={0.9} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+2.8, t.z]} scale={t.s} />)}
      </Instances>
      
      <Instances limit={32} castShadow receiveShadow>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#7a7060" roughness={0.95} />
        {ROCK_DATA.map((r,i) => <Instance key={i} position={[r.x, r.y+0.2*r.s, r.z]} scale={[r.s*1.2, r.s*0.7, r.s]} rotation={[r.rx, r.ry, 0]} />)}
      </Instances>
    </group>
  );
}

// ─── Atmosphere & Lighting ────────────────────────────────────────────────────

function Atmosphere() {
  const { state, actions } = useContext(GameContext);
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

function GameUI() {
  const { state, actions } = useContext(GameContext);
  const [chatText, setChatText] = useState("");

  const connectToGame = () => {
    if (!state.playerConfig.name) return alert("Enter your popstar name!");
    socket = io(SOCKET_URL);
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
       <div style={{...ST.modal, maxWidth: 500}}>
          <h1 style={{ fontSize: 42, margin: '4px 0', textShadow: '2px 2px #ff69b4', color: '#fff', textTransform: 'uppercase' }}>🎤 Take That</h1>
          <p style={{ fontWeight: 'bold', color: '#333', fontSize: 18 }}>THE SEARCH FOR ROBBIE</p>
          
          <input style={ST.input} placeholder="Your Player Name..." maxLength={10} onChange={e => actions.setPlayerConfig({ name: e.target.value })} />
          
          <p style={{ margin: '10px 0', fontWeight: 'bold', color: '#555' }}>Choose your Member:</p>
          <div style={ST.row}>
            {['Gary', 'Mark', 'Howard', 'Jason'].map(t => (
              <button key={t} onClick={() => actions.setPlayerConfig({ member: t })} 
                style={{...ST.btn, fontSize: 16, padding: '10px 20px', border: state.playerConfig.member === t ? '4px solid #ff8fab' : '4px solid transparent'}}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, textAlign: 'left' }}>
            <div style={ST.colorRow}><b>Jacket:</b> <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.jacket} onChange={e => actions.setPlayerConfig({ colors: {...state.playerConfig.colors, jacket: e.target.value}})} /></div>
            <div style={ST.colorRow}><b>Pants:</b> <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.pants} onChange={e => actions.setPlayerConfig({ colors: {...state.playerConfig.colors, pants: e.target.value}})} /></div>
          </div>
          
          <button style={ST.startBtn} onClick={connectToGame}>START TOUR!</button>
       </div>
    </div>
  );

  const d = state.dialogue;
  const currentNode = d ? d.nodes[d.step] : null;

  return (
    <>
      {d && currentNode && (
        <div style={ST.dialogueBox}>
          <h2 style={{ margin: '0 0 10px 0', color: d.color, textTransform: 'uppercase' }}>{d.name}</h2>
          <p style={{ fontSize: 18, margin: '0 0 20px 0', color: '#444' }}>{currentNode.text}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            {currentNode.options ? (
              currentNode.options.map((opt, i) => (
                <button key={i} style={ST.dialogueBtn} onClick={() => { actions.setDialogue({ ...d, step: opt.next }); audio.sfx('talk'); }}>{opt.label}</button>
              ))
            ) : (
              <button style={{...ST.dialogueBtn, background: d.color, color: '#fff'}} onClick={() => { actions.setDialogue(null); }}>
                {currentNode.next ? 'Next ▶' : 'Bye 👋'}
              </button>
            )}
          </div>
        </div>
      )}

      <div style={ST.chatArea}>
        <div style={ST.chatLog}>
          {state.chatMessages.map((m, i) => <div key={i}><b style={{ color: m.color }}>{m.name}:</b> {m.text}</div>)}
        </div>
        <input style={ST.chatInput} placeholder="Chat with other bandmates..." value={chatText} onChange={e => setChatText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && chatText.trim()) {
              const msg = { name: state.playerConfig.name, color: state.playerConfig.colors.jacket, text: chatText };
              actions.addChatMessage(msg);
              if (socket) socket.emit('chat', chatText);
              setChatText("");
            }
          }} />
      </div>

      <div style={ST.goalBox}>
        <h3 style={{ margin: 0, fontSize: 16 }}>🎯 Goal:</h3>
        <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>Find Robbie Williams!</p>
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CandyIslandUltimate() {
  const store = useIslandStore();
  
  // Randomly pick Robbie's location for this session
  const robbieLoc = useMemo(() => {
    const loc = ROBBIE_SPAWNS[Math.floor(Math.random() * ROBBIE_SPAWNS.length)];
    return { x: loc.x, y: getTerrainY(loc.x, loc.z), z: loc.z };
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      const k = e.key.toLowerCase(); keyState[k] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    const onUp = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      keyState[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onDown, { passive: false }); window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#87ceeb' }}>
      <GameContext.Provider value={store}>
        <Canvas shadows dpr={[1,2]} camera={{ fov:46, position:[0,12,18] }}
          gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}>
          <Suspense fallback={<Html center><div style={{fontFamily:'sans-serif', color:'white', background:'rgba(0,0,0,0.5)', padding:'10px 20px', borderRadius:20}}>Loading Tour...</div></Html>}>
            <Atmosphere />
            <Terrain />
            <Water />
            <StaticWorld />
            
            <PlayerController />
            {Object.values(store.state.onlinePlayers).map(p => socket && p.id !== socket.id && <NetworkPlayer key={p.id} data={p} />)}
            
            <CameraRig />

            {/* ROBBIE WILLIAMS (Hidden) */}
            <NPC name="Robbie" color={CONFIG.COLORS.robbie}
              home={robbieLoc}
              dialogues={[
                { text: "LET ME ENTERTAIN YOU! You found me!", options: [
                    { label: "We need you for the reunion!", next: 1 }
                ]},
                { text: "Alright, alright. I'll get my coat.", next: 'end' }
              ]} />

            {/* SUPERFANS */}
            <NPC name="Superfan Sarah" color={CONFIG.COLORS.fan1}
              home={{ x:-15, y:getTerrainY(-15,-10), z:-10 }}
              dialogues={[{ text: "OMG! Have you found Robbie yet? I heard he was hiding somewhere near the edges of the island!", next: 'end' }]} />

            <NPC name="Superfan Dave" color={CONFIG.COLORS.fan2}
              home={{ x:20, y:getTerrainY(20,10), z:10 }}
              dialogues={[{ text: "I've checked everywhere around here. Maybe he's swimming?", next: 'end' }]} />

            <NPC name="Superfan Emma" color={CONFIG.COLORS.fan3}
              home={{ x:0, y:getTerrainY(0,22), z:22 }}
              dialogues={[{ text: 'Gary? Is that you? I am your biggest fan!', next: 'end' }]} />

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

const FF = '"Arial", sans-serif';
const ST = {
  overlay:     { position:'absolute', inset:0, zIndex:100, cursor:'pointer', background:'linear-gradient(150deg,#0a0a0a 0%,#333333 60%,#0055ff 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', fontFamily:FF, textAlign:'center' },
  modal:       { background: 'white', padding: 40, borderRadius: 30, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' },
  input:       { width: '100%', padding: '15px', marginBottom: 20, borderRadius: 15, border: '2px solid #eee', fontSize: 18, boxSizing: 'border-box', outline: 'none', fontFamily: FF, color: '#333' },
  row:         { display: 'flex', justifyContent: 'space-around', marginBottom: 20 },
  btn:         { background: '#fcfcfc', border: 'none', cursor: 'pointer', borderRadius: 10, transition: '0.2s', fontWeight: 'bold' },
  colorRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f8f8', padding: '5px 15px', borderRadius: 15, color: '#555' },
  colorPicker: { width: 45, height: 45, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'transparent' },
  startBtn:    { width: '100%', background: '#ff2222', color: 'white', border: 'none', padding: '18px', borderRadius: 20, fontSize: 20, fontWeight: 'bold', cursor: 'pointer', fontFamily: FF, marginTop: 10 },
  
  goalBox:     { position:'absolute', top:25, right:25, background:'rgba(255,255,255,0.9)', padding:15, borderRadius:15, border:'4px solid #ff2222', boxShadow:'0 4px 10px rgba(0,0,0,0.3)', fontFamily:FF, zIndex:50, color: '#333' },
  
  dialogueBox: { position:'absolute', bottom:40, left:'50%', transform:'translateX(-50%)', width:'60%', minWidth:320, background:'rgba(255,255,255,0.95)', padding:24, borderRadius:20, border:'5px solid #ff2222', boxShadow:'0 10px 30px rgba(0,0,0,0.3)', fontFamily:FF, textAlign:'center', zIndex:60, pointerEvents: 'auto' },
  dialogueBtn: { background:'#e0e0e0', border:'none', padding:'12px 24px', borderRadius:12, color:'#333', fontWeight:'bold', cursor:'pointer', fontSize:16, fontFamily:FF, boxShadow:'0 4px 0 rgba(0,0,0,0.1)', transition:'transform 0.1s' },
  
  chatArea:    { position: 'absolute', bottom: 20, left: 20, zIndex: 5, width: 300, fontFamily: FF, pointerEvents: 'auto' },
  chatLog:     { background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 15, borderRadius: 15, height: 160, overflowY: 'auto', marginBottom: 10, fontSize: 14, backdropFilter: 'blur(10px)', textShadow: '1px 1px 2px rgba(0,0,0,1)' },
  chatInput:   { width: '100%', background: 'rgba(255,255,255,0.95)', border: 'none', padding: 12, borderRadius: 10, boxSizing: 'border-box', outline: 'none', fontFamily: FF, color: '#333', fontSize: 16 }
};
