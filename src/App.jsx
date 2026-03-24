/**
 * 🎤 WHERE'S ROBBIE? — Cartoon Edition
 *
 * Changes from original:
 *  - Cartoon / Cel-shading via MeshToonMaterial + BackSide outlines
 *  - Robbie Williams RUNS from you (flee AI with speed boost)
 *  - Concert Stage landmark (towers, backdrop, coloured spotlights)
 *  - Gig Finale overlay when you finally catch him
 *  - "ROBBIE SPOTTED! 👀" pulse warning HUD
 *  - Proximity radar in corner
 *  - Brighter pop-art colour palette
 *  - Multiplayer removed (no server needed)
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, ContactShadows, Stars, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { io } from 'socket.io-client';

// ─── Multiplayer Config ───────────────────────────────────────────────────────
const SOCKET_URL = "http://192.168.1.129:3001"; // <-- Replace with your NAS IP/hostname
let socket;

// ─── Inject fonts & keyframes ─────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@700;900&display=swap');

  @keyframes spotSweepL {
    0%,100% { transform: rotate(-25deg); opacity: 0.7; }
    50%      { transform: rotate(10deg);  opacity: 1; }
  }
  @keyframes spotSweepR {
    0%,100% { transform: rotate(25deg);  opacity: 0.7; }
    50%      { transform: rotate(-10deg); opacity: 1; }
  }
  @keyframes crowdBob {
    0%,100% { transform: translateY(0) scaleY(1); }
    50%      { transform: translateY(-14px) scaleY(0.9); }
  }
  @keyframes confettiFall {
    0%   { transform: translateY(-60px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  @keyframes gigPulse {
    0%,100% { text-shadow: 0 0 20px #ff00ff, 0 0 40px #ff00ff; }
    50%      { text-shadow: 0 0 60px #ff00ff, 0 0 120px #ff00ff, 0 0 4px #fff; }
  }
  @keyframes spottedPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,30,30,0.9); }
    50%      { box-shadow: 0 0 0 18px rgba(255,30,30,0); }
  }
  @keyframes radarSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes slideUp {
    from { transform: translateY(60px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
`;

// ─── Toon material system ─────────────────────────────────────────────────────

const toonGrad = (() => {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 1;
  const ctx = c.getContext('2d');
  // 4 stepped bands: deep shadow → shadow → base → highlight
  ['#333', '#777', '#ccc', '#fff'].forEach((col, i) => {
    ctx.fillStyle = col; ctx.fillRect(i, 0, 1, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
})();

const _matCache = {};
function toonMat(col) {
  if (!_matCache[col]) {
    _matCache[col] = new THREE.MeshToonMaterial({ color: col, gradientMap: toonGrad });
  }
  return _matCache[col];
}

const matSkin  = toonMat('#ffcdb2');
const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });
const matOutline = new THREE.MeshBasicMaterial({ color: '#1a0800', side: THREE.BackSide });

// Box with cartoon outline (BackSide trick)
function ToonBox({ args, color, castShadow, position, rotation, scale, outlineScale = 1.12 }) {
  const mat = toonMat(color);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh material={mat} castShadow={castShadow}>
        <boxGeometry args={args} />
      </mesh>
      <mesh scale={outlineScale} material={matOutline}>
        <boxGeometry args={args} />
      </mesh>
    </group>
  );
}

// ─── Terrain ─────────────────────────────────────────────────────────────────

function getTerrainY(x, z) {
  const d = Math.sqrt(x * x + z * z);
  if (d > 55) return -2.5;
  const h = (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.0) +
            (Math.sin(x * 0.05 + z * 0.04) * 1.5) +
            (Math.cos(x * 0.2 + z * 0.2) * 0.5);
  return h * Math.max(0, 1 - Math.pow(d / 60, 4));
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  SPEED: 6.5, ACCEL: 12, DECEL: 15, GRAVITY: 35, JUMP_FORCE: 14,
  ROBBIE_DETECT_DIST: 16,   // Robbie sees player at this range
  ROBBIE_FLEE_SPEED:  8.5,  // Much faster than player when fleeing
  ROBBIE_WANDER_SPEED: 1.8,
  ROBBIE_SAFE_DIST:   22,   // Robbie relaxes once this far away
  COLORS: {
    gary: '#2c2c54', mark: '#ff6b6b', howard: '#26de81', jason: '#fd9644',
    robbie: '#e74c3c', fan1: '#ff8fab', fan2: '#6ecfb5', fan3: '#c07ed4',
  }
};

const ROBBIE_SPAWNS = [
  { x: -38, z: -35 }, { x: 42, z: -15 }, { x: -25, z: 40 },
  { x: 30, z: 35  }, { x: 0,  z: -45 }, { x: 45,  z: 45 },
];

const camState = { yaw: Math.PI, pitch: 0.4, yawVel: 0, pitchVel: 0 };
const keyState  = { prevE: false };

// ─── Store ────────────────────────────────────────────────────────────────────

const GameContext = createContext();

function useIslandStore() {
  const playerPosRef   = useRef(new THREE.Vector3(0, 1, 0));
  const playerGroupRef = useRef();
  const robbieDistRef  = useRef(999); // updated each frame by RobbieNPC

  const [state, setState] = useState({
    bells: 0,
    gameTime: 14.0,
    dialogue: null,
    ui: 'start',
    robbieSpotted: false,
    robbieFound: false,
    playerConfig: {
      name: '', member: 'Gary',
      colors: { jacket: CONFIG.COLORS.gary, pants: '#111' },
    },
  });

  const actions = useMemo(() => ({
    setUI:           v   => setState(s => ({ ...s, ui: v })),
    setDialogue:     d   => setState(s => ({ ...s, dialogue: d })),
    tickTime:        ()  => setState(s => ({ ...s, gameTime: (s.gameTime + 0.05) % 24 })),
    setPlayerConfig: cfg => setState(s => ({ ...s, playerConfig: { ...s.playerConfig, ...cfg } })),
    setRobbieSpotted: v  => setState(s => ({ ...s, robbieSpotted: v })),
    setRobbieFound:   v  => setState(s => ({ ...s, robbieFound: v })),
    setOnlinePlayers: p  => setState(s => ({ ...s, onlinePlayers: p })),
    addChatMessage:   m  => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-8), m] })),
  }), []);

  return { state, actions, playerPosRef, playerGroupRef, robbieDistRef };
}

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
    const BPM = 118; const BEAT = 60 / BPM;
    const phrase = [[523.25,0,0.9],[587.33,1,0.9],[659.25,2,0.9],[523.25,3,0.9],[698.46,4,1.8]];
    const bass   = [[130.81,0,1.8],[174.61,4,1.8]];
    const playNote = (freq, bOff, durB, t0, vol=0.05, type='sine') => {
      const osc = this.ctx.createOscillator(); const env = this.ctx.createGain();
      const t = t0 + bOff * BEAT; const d = durB * BEAT;
      osc.type = type; osc.frequency.value = freq;
      env.gain.setValueAtTime(0.001, t); env.gain.linearRampToValueAtTime(vol, t + 0.018);
      env.gain.exponentialRampToValueAtTime(vol * 0.3, t + d * 0.5);
      env.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95);
      osc.connect(env); env.connect(this.master);
      osc.start(t); osc.stop(t + d + 0.05);
    };
    const loop = (start) => {
      phrase.forEach(([f,b,d]) => playNote(f,b,d,start,0.055,'sine'));
      bass.forEach(([f,b,d])   => playNote(f,b,d,start,0.04,'triangle'));
      const next = start + 16 * BEAT;
      setTimeout(() => { if (this.bgm) loop(next); }, Math.max(0,(next - this.ctx.currentTime - 0.5)*1000));
    };
    loop(this.ctx.currentTime + 0.1);
  }
  sfx(type) {
    if (!this.ctx) return;
    if (type === 'step') {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 2);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = this.ctx.createGain(); g.gain.value = 0.35;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    }
    if (type === 'talk') {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 380 + Math.random()*200;
      g.gain.setValueAtTime(0.025, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.07);
      osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime + 0.07);
    }
    if (type === 'win') {
      // Triumphant ascending fanfare
      [[440,0],[550,0.12],[660,0.24],[880,0.38],[1100,0.55]].forEach(([freq, t]) => {
        const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        const start = this.ctx.currentTime + t;
        g.gain.setValueAtTime(0.12, start); g.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
        osc.connect(g); g.connect(this.master); osc.start(start); osc.stop(start + 0.65);
      });
    }
    if (type === 'spotted') {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 220;
      g.gain.setValueAtTime(0.08, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime + 0.25);
    }
  }
}
const audio = new GameAudio();

// ═══════════════════════════════════════════════════════════════════════════════
//  BIPED CHARACTER RIG — Toon Materials + Outline
// ═══════════════════════════════════════════════════════════════════════════════

function useHumanAnim({ velRef, isSwimmingRef, isNPC, npcMovingRef }) {
  const body = useRef(); const head = useRef();
  const armL = useRef(); const armR = useRef();
  const legL = useRef(); const legR = useRef();
  const walk = useRef(0);

  useFrame((_, delta) => {
    let moving = false, swimming = false;
    if (isNPC && npcMovingRef) {
      moving = npcMovingRef.current;
    } else if (velRef && isSwimmingRef) {
      moving   = Math.hypot(velRef.current.x, velRef.current.z) > 0.5;
      swimming = isSwimmingRef.current;
    }
    if (moving) walk.current += delta * (swimming ? 5 : 14);
    if (body.current) {
      body.current.position.y = swimming ? -0.2 : 1.0;
      if (moving && !swimming) body.current.position.y += Math.abs(Math.sin(walk.current * 2)) * 0.08;
    }
    if (head.current) head.current.rotation.y = moving ? Math.sin(walk.current) * 0.12 : 0;
    const s = Math.sin(walk.current) * 1.2;
    if (swimming) {
      if (armL.current) armL.current.rotation.x = -1.5 + Math.sin(walk.current)*0.5;
      if (armR.current) armR.current.rotation.x = -1.5 - Math.sin(walk.current)*0.5;
      if (legL.current) legL.current.rotation.x =  0.5 - Math.sin(walk.current)*0.5;
      if (legR.current) legR.current.rotation.x =  0.5 + Math.sin(walk.current)*0.5;
    } else if (moving) {
      if (armL.current) armL.current.rotation.x = s;
      if (armR.current) armR.current.rotation.x = -s;
      if (legL.current) legL.current.rotation.x = -s;
      if (legR.current) legR.current.rotation.x = s;
    } else {
      const lerp = (r) => r && (r.rotation.x = THREE.MathUtils.lerp(r.rotation.x, 0, 0.12));
      [armL, armR, legL, legR].forEach(lerp);
    }
  });
  return { body, head, armL, armR, legL, legR };
}

function BoybandRig(props) {
  const { body, head, armL, armR, legL, legR } = useHumanAnim(props);
  const cJ = props.colors?.jacket || '#333';
  const cP = props.colors?.pants  || '#111';
  const jMat = useMemo(() => toonMat(cJ), [cJ]);
  const pMat = useMemo(() => toonMat(cP), [cP]);

  return (
    <group ref={body} position={[0, 1.0, 0]}>
      {/* Torso */}
      <mesh material={jMat} castShadow><boxGeometry args={[0.6, 0.8, 0.4]} /></mesh>
      <mesh scale={1.1} material={matOutline}><boxGeometry args={[0.6, 0.8, 0.4]} /></mesh>

      {/* Head */}
      <group ref={head} position={[0, 0.62, 0]}>
        <mesh material={matSkin} castShadow><boxGeometry args={[0.45, 0.5, 0.45]} /></mesh>
        <mesh scale={1.1} material={matOutline}><boxGeometry args={[0.45, 0.5, 0.45]} /></mesh>
        {/* Hair */}
        <mesh material={jMat} position={[0, 0.28, -0.04]} castShadow>
          <boxGeometry args={[0.48, 0.16, 0.48]} />
        </mesh>
        {/* Eyes */}
        <mesh material={matBlack} position={[-0.1, 0.05, 0.225]}><boxGeometry args={[0.07, 0.07, 0.02]} /></mesh>
        <mesh material={matBlack} position={[ 0.1, 0.05, 0.225]}><boxGeometry args={[0.07, 0.07, 0.02]} /></mesh>
        {/* Smile */}
        <mesh material={matBlack} position={[0, -0.08, 0.225]}><boxGeometry args={[0.16, 0.04, 0.02]} /></mesh>
      </group>

      {/* Arms */}
      <group ref={armL} position={[-0.42, 0.25, 0]}>
        <mesh material={jMat}   position={[0,-0.3,0]} castShadow><boxGeometry args={[0.2, 0.7, 0.2]} /></mesh>
        <mesh material={matSkin} position={[0,-0.7,0]} castShadow><boxGeometry args={[0.15,0.15,0.15]} /></mesh>
      </group>
      <group ref={armR} position={[0.42, 0.25, 0]}>
        <mesh material={jMat}   position={[0,-0.3,0]} castShadow><boxGeometry args={[0.2, 0.7, 0.2]} /></mesh>
        <mesh material={matSkin} position={[0,-0.7,0]} castShadow><boxGeometry args={[0.15,0.15,0.15]} /></mesh>
      </group>

      {/* Legs */}
      <group ref={legL} position={[-0.18,-0.42,0]}>
        <mesh material={pMat}   position={[0,-0.35,0]} castShadow><boxGeometry args={[0.24,0.7,0.24]} /></mesh>
        <mesh material={matBlack} position={[0,-0.75,0.06]} castShadow><boxGeometry args={[0.24,0.14,0.34]} /></mesh>
      </group>
      <group ref={legR} position={[0.18,-0.42,0]}>
        <mesh material={pMat}   position={[0,-0.35,0]} castShadow><boxGeometry args={[0.24,0.7,0.24]} /></mesh>
        <mesh material={matBlack} position={[0,-0.75,0.06]} castShadow><boxGeometry args={[0.24,0.14,0.34]} /></mesh>
      </group>
    </group>
  );
}

// ─── Terrain ─────────────────────────────────────────────────────────────────

function makeGroundTexture() {
  const S = 512; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#78c44a'; ctx.fillRect(0,0,S,S);
  for (let i = 0; i < 2000; i++) {
    const x = Math.random()*S, y = Math.random()*S, r = 5+Math.random()*18;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = Math.random()>0.5 ? `rgba(155,215,80,0.18)` : `rgba(50,110,20,0.18)`;
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14,14); return t;
}
function makeSandTexture() {
  const S = 256; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#f5d990'; ctx.fillRect(0,0,S,S);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random()*S, y = Math.random()*S, r = 2+Math.random()*5;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = `rgba(210,170,90,0.2)`; ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10,10); return t;
}

function Terrain() {
  const gTex = useMemo(makeGroundTexture, []);
  const sTex = useMemo(makeSandTexture,   []);
  const geo  = useMemo(() => {
    const g = new THREE.PlaneGeometry(150,150,128,128); g.rotateX(-Math.PI/2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, getTerrainY(pos.getX(i),pos.getZ(i)));
    g.computeVertexNormals(); return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} receiveShadow name="ground">
        <meshToonMaterial map={sTex} gradientMap={toonGrad} roughness={0.95} />
      </mesh>
      <mesh geometry={geo} receiveShadow position={[0,0.003,0]}>
        <meshToonMaterial map={gTex} gradientMap={toonGrad} roughness={0.88} transparent alphaTest={0.01}
          onBeforeCompile={s => {
            s.vertexShader = s.vertexShader.replace('#include <begin_vertex>',
              '#include <begin_vertex>');
          }} />
      </mesh>
    </group>
  );
}

function Water() {
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.2,0]}>
      <planeGeometry args={[400,400]} />
      <meshToonMaterial color="#1ec8f0" gradientMap={toonGrad} transparent opacity={0.82} />
    </mesh>
  );
}

// ─── Concert Stage ────────────────────────────────────────────────────────────

const STAGE_X = 0;
const STAGE_Z = 18;
const STAGE_Y = getTerrainY(STAGE_X, STAGE_Z);

function ConcertStage() {
  const neonRef = useRef();
  useFrame(({ clock }) => {
    if (neonRef.current) {
      const t = clock.elapsedTime;
      neonRef.current.children.forEach((c, i) => {
        c.material.color.setHSL((t * 0.3 + i * 0.15) % 1, 1, 0.55);
      });
    }
  });

  const greyTower = toonMat('#555');
  const blackStage = toonMat('#1a1a2e');
  const darkGrey   = toonMat('#222');
  const goldMat    = toonMat('#ffd700');
  const redMat     = toonMat('#e74c3c');

  const y = STAGE_Y;

  return (
    <group position={[STAGE_X, y, STAGE_Z]}>

      {/* ── Stage Platform ── */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={blackStage}>
        <boxGeometry args={[22, 0.9, 12]} />
      </mesh>
      {/* Stage edge highlight strip */}
      <mesh position={[0, 0.9, 6]} material={goldMat} castShadow>
        <boxGeometry args={[22, 0.08, 0.12]} />
      </mesh>

      {/* ── Catwalk runway toward player ── */}
      <mesh position={[0, 0.42, 13]} castShadow receiveShadow material={darkGrey}>
        <boxGeometry args={[4, 0.75, 14]} />
      </mesh>

      {/* ── Backdrop screen ── */}
      <mesh position={[0, 6.5, -5.2]} castShadow material={toonMat('#0a0a1a')}>
        <boxGeometry args={[22, 13, 0.4]} />
      </mesh>
      {/* Screen border */}
      <mesh position={[0, 6.5, -4.95]} material={redMat}>
        <boxGeometry args={[22.6, 13.6, 0.12]} />
      </mesh>

      {/* ── TAKE THAT HTML sign ── */}
      <Html position={[0, 11, -4.8]} center>
        <div style={{
          fontFamily: "'Fredoka One', Impact, sans-serif",
          fontSize: 44, fontWeight: 900, color: '#fff', letterSpacing: 6,
          textShadow: '0 0 15px #ff00ff, 0 0 35px #ff00ff',
          whiteSpace: 'nowrap', pointerEvents: 'none',
          animation: 'gigPulse 2s ease-in-out infinite',
        }}>★ TAKE THAT ★</div>
      </Html>
      <Html position={[0, 8.4, -4.8]} center>
        <div style={{
          fontFamily: "'Fredoka One', Impact, sans-serif",
          fontSize: 20, color: '#ffdd44', letterSpacing: 3,
          textShadow: '0 0 10px #ffdd44', pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>THE REUNION TOUR</div>
      </Html>

      {/* ── Left Tower ── */}
      <group position={[-11, 0, -3]}>
        <mesh material={greyTower} castShadow><boxGeometry args={[0.55, 16, 0.55]} /></mesh>
        {/* Cross braces */}
        {[0, 4, 8].map(yy => (
          <mesh key={yy} material={toonMat('#444')} position={[0, yy, 0]} rotation={[0, 0, Math.PI/4]} castShadow>
            <boxGeometry args={[2.5, 0.25, 0.25]} />
          </mesh>
        ))}
        {/* Light box on top */}
        <mesh material={toonMat('#ff44ff')} position={[0, 8.4, 1]}>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
        </mesh>
        <mesh material={new THREE.MeshBasicMaterial({ color: '#ff44ff' })} position={[0, 8.4, 1]}>
          <boxGeometry args={[0.7, 0.3, 0.7]} />
        </mesh>
      </group>

      {/* ── Right Tower ── */}
      <group position={[11, 0, -3]}>
        <mesh material={greyTower} castShadow><boxGeometry args={[0.55, 16, 0.55]} /></mesh>
        {[0, 4, 8].map(yy => (
          <mesh key={yy} material={toonMat('#444')} position={[0, yy, 0]} rotation={[0, 0, -Math.PI/4]} castShadow>
            <boxGeometry args={[2.5, 0.25, 0.25]} />
          </mesh>
        ))}
        <mesh material={toonMat('#44ffff')} position={[0, 8.4, 1]}>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
        </mesh>
        <mesh material={new THREE.MeshBasicMaterial({ color: '#44ffff' })} position={[0, 8.4, 1]}>
          <boxGeometry args={[0.7, 0.3, 0.7]} />
        </mesh>
      </group>

      {/* ── Neon colour bars (top of backdrop) ── */}
      <group ref={neonRef} position={[0, 13.5, -4.9]}>
        {[-8,-4,0,4,8].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[2.5, 0.3, 0.1]} />
            <meshBasicMaterial color="#ff00ff" />
          </mesh>
        ))}
      </group>

      {/* ── Coloured stage lights (dynamic) ── */}
      <pointLight position={[-10, 10, -2]} color="#ff44ff" intensity={6} distance={28} decay={2} />
      <pointLight position={[ 10, 10, -2]} color="#44ccff" intensity={6} distance={28} decay={2} />
      <pointLight position={[  0,  8,  6]} color="#ffff44" intensity={5} distance={22} decay={2} />
      <pointLight position={[  0, 12, -5]} color="#ff4466" intensity={4} distance={20} decay={2} />

    </group>
  );
}

// ─── Static World (Trees, Rocks) ──────────────────────────────────────────────

function seededRand(seed) {
  let s = seed; return () => { s = (s*16807)%2147483647; return (s-1)/2147483646; };
}
const BLOCKED = [[-15,-15],[20,5],[0,25],[0,0],[STAGE_X, STAGE_Z]];
const isClear  = (x, z, r=9) => BLOCKED.every(([bx,bz]) => Math.hypot(x-bx, z-bz) > r);

const TREE_DATA = (() => {
  const rng = seededRand(42); const out = []; let att = 0;
  while (out.length < 65 && att++ < 600) {
    const a = rng()*Math.PI*2, r = 10+rng()*42;
    const x = Math.cos(a)*r, z = Math.sin(a)*r, y = getTerrainY(x,z);
    if (y > 0.2 && isClear(x,z)) out.push({ x,y,z, s:0.65+rng()*0.75, type:rng()>0.3?'pine':'palm' });
  }
  return out;
})();

const ROCK_DATA = (() => {
  const rng = seededRand(77); const out = []; let att = 0;
  while (out.length < 28 && att++ < 400) {
    const a = rng()*Math.PI*2, r = 5+rng()*50;
    const x = Math.cos(a)*r, z = Math.sin(a)*r, y = getTerrainY(x,z);
    if (y > -0.3 && isClear(x,z,4)) out.push({ x,y,z, s:0.3+rng()*0.9, rx:rng()*Math.PI, ry:rng()*Math.PI });
  }
  return out;
})();

function StaticWorld() {
  const pines = TREE_DATA.filter(t => t.type === 'pine');
  const palms = TREE_DATA.filter(t => t.type === 'palm');
  return (
    <group>
      {/* Pine trunks */}
      <Instances limit={65} castShadow>
        <cylinderGeometry args={[0.18,0.28,1.6,7]} />
        <meshToonMaterial color="#5c3a1e" gradientMap={toonGrad} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+0.8, t.z]} scale={t.s} />)}
      </Instances>
      {/* Pine canopy */}
      <Instances limit={65} castShadow>
        <coneGeometry args={[1.8,3.2,7]} />
        <meshToonMaterial color="#2ecc40" gradientMap={toonGrad} />
        {pines.map((t,i) => <Instance key={i} position={[t.x, t.y+2.9, t.z]} scale={t.s} />)}
      </Instances>
      {/* Palm trunks */}
      <Instances limit={32} castShadow>
        <cylinderGeometry args={[0.14,0.22,2.2,6]} />
        <meshToonMaterial color="#8B6914" gradientMap={toonGrad} />
        {palms.map((t,i) => <Instance key={i} position={[t.x, t.y+1.1, t.z]} scale={t.s} />)}
      </Instances>
      {/* Palm tops */}
      <Instances limit={32} castShadow>
        <sphereGeometry args={[1.1,7,5]} />
        <meshToonMaterial color="#27ae60" gradientMap={toonGrad} />
        {palms.map((t,i) => <Instance key={i} position={[t.x, t.y+2.9, t.z]} scale={[t.s*1.2, t.s*0.7, t.s*1.2]} />)}
      </Instances>
      {/* Rocks */}
      <Instances limit={32} castShadow receiveShadow>
        <icosahedronGeometry args={[0.5,0]} />
        <meshToonMaterial color="#8c8070" gradientMap={toonGrad} />
        {ROCK_DATA.map((r,i) => <Instance key={i} position={[r.x, r.y+0.15*r.s, r.z]} scale={[r.s*1.2,r.s*0.7,r.s]} rotation={[r.rx,r.ry,0]} />)}
      </Instances>
    </group>
  );
}

// ─── Atmosphere ───────────────────────────────────────────────────────────────

function Atmosphere() {
  const { state, actions } = useContext(GameContext);
  useEffect(() => {
    const id = setInterval(() => actions.tickTime(), 1000);
    return () => clearInterval(id);
  }, [actions]);
  const sunAngle = ((state.gameTime - 6) / 12) * Math.PI - Math.PI;
  const sunPos   = [Math.cos(sunAngle)*80, Math.max(Math.sin(-sunAngle)*80, -10), 20];
  const isNight  = state.gameTime < 6 || state.gameTime > 18;
  const dusk     = state.gameTime > 16 && state.gameTime < 20;
  return (
    <>
      <Sky sunPosition={sunPos} turbidity={dusk?5:0.3} rayleigh={dusk?3.5:0.8} mieCoefficient={0.003} />
      <directionalLight position={sunPos} intensity={isNight?0.12:dusk?0.9:2.0} castShadow
        shadow-mapSize={[2048,2048]} color={dusk?'#ffaa55':'#fff8f0'} />
      <ambientLight intensity={isNight?0.1:0.45} color={isNight?'#334':'#ffffff'} />
      {isNight && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />}
    </>
  );
}

// ─── Camera ───────────────────────────────────────────────────────────────────

function CameraRig() {
  const { playerGroupRef } = useContext(GameContext);
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (keyState['arrowleft'])  camState.yawVel +=  10*delta;
    if (keyState['arrowright']) camState.yawVel -=  10*delta;
    if (keyState['arrowup'])    camState.pitchVel -= 10*delta;
    if (keyState['arrowdown'])  camState.pitchVel += 10*delta;
    camState.yawVel *= 0.82; camState.pitchVel *= 0.82;
    camState.yaw   += camState.yawVel   * delta;
    camState.pitch += camState.pitchVel * delta;
    camState.pitch  = Math.max(0.1, Math.min(1.4, camState.pitch));
    const p = playerGroupRef.current; if (!p) return;
    const dist = 14;
    camera.position.set(
      p.position.x + Math.sin(camState.yaw)*dist*Math.cos(camState.pitch),
      p.position.y + dist*Math.sin(camState.pitch) + 2,
      p.position.z + Math.cos(camState.yaw)*dist*Math.cos(camState.pitch),
    );
    camera.lookAt(p.position.x, p.position.y+1.5, p.position.z);
  });
  return null;
}

// ─── Player Controller ────────────────────────────────────────────────────────

function PlayerController() {
  const { state, actions, playerPosRef, playerGroupRef } = useContext(GameContext);
  const vel        = useRef(new THREE.Vector3());
  const movingRef  = useRef(false);
  const swimRef    = useRef(false);
  const raycaster  = useMemo(() => new THREE.Raycaster(), []);
  const downVec    = useMemo(() => new THREE.Vector3(0,-1,0), []);
  const { scene }  = useThree();
  const lastStep   = useRef(0);

  useFrame((_, delta) => {
    const g = playerGroupRef.current;
    if (!g || state.ui !== 'play') return;

    // Interact
    if (keyState['e'] && !keyState.prevE) {
      let closest = null, minD = 4.0;
      scene.traverse(child => {
        if (child.userData?.isNPC) {
          const d = child.getWorldPosition(new THREE.Vector3()).distanceTo(g.position);
          if (d < minD) { minD = d; closest = child; }
        }
      });
      if (closest && !state.dialogue) {
        actions.setDialogue({ name: closest.userData.name, color: closest.userData.color,
          nodes: closest.userData.dialogues, step: 0 });
        audio.sfx('talk');
        if (closest.userData.name === 'Robbie') {
          audio.sfx('win');
          actions.setRobbieFound(true);
        }
      }
    }
    keyState.prevE = keyState['e'];
    if (state.dialogue) return;

    const mx = (keyState['a']?-1:0) + (keyState['d']?1:0);
    const mz = (keyState['w']?-1:0) + (keyState['s']?1:0);
    const acF = Math.min(1, CONFIG.ACCEL * delta);
    const dcF = Math.min(1, CONFIG.DECEL * delta);
    const tSpd = swimRef.current ? CONFIG.SPEED * 0.45 : CONFIG.SPEED;

    if (mx || mz) {
      const angle = Math.atan2(mx, mz) + camState.yaw;
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, Math.sin(angle)*tSpd, acF);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, Math.cos(angle)*tSpd, acF);
    } else {
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, 0, dcF);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, 0, dcF);
    }
    vel.current.y -= CONFIG.GRAVITY * delta;

    g.position.x = Math.max(-56, Math.min(56, g.position.x + vel.current.x * delta));
    g.position.z = Math.max(-56, Math.min(56, g.position.z + vel.current.z * delta));
    g.position.y += vel.current.y * delta;

    raycaster.set(new THREE.Vector3(g.position.x, 20, g.position.z), downVec);
    const ground = scene.getObjectByName('ground');
    let grounded = false, swimming = false;
    if (ground) {
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0) {
        let fH = hits[0].point.y + 0.05;
        if (fH < -1.0) { fH = -1.0; swimming = true; }
        if (g.position.y <= fH + 0.3 && vel.current.y <= 0) {
          g.position.y = fH; grounded = true; vel.current.y = 0;
        }
      }
    }
    swimRef.current = swimming;
    if (keyState[' '] && grounded && !swimming) { vel.current.y = CONFIG.JUMP_FORCE; }

    const spd2D = Math.hypot(vel.current.x, vel.current.z);
    movingRef.current = spd2D > 0.5;
    if (movingRef.current) {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), Math.min(1, 15*delta));
      lastStep.current += spd2D * delta;
      if (lastStep.current > 1.4) { audio.sfx('step'); lastStep.current = 0; }
    }
    playerPosRef.current.copy(g.position);
  });

  return (
    <group ref={playerGroupRef} position={[0, 1, 0]}>
      <BoybandRig colors={state.playerConfig.colors} velRef={vel} isSwimmingRef={swimRef} />
      <ContactShadows opacity={0.5} scale={4} blur={2.5} position={[0, 0.02, 0]} />
    </group>
  );
}

// ─── Regular NPC ─────────────────────────────────────────────────────────────

function NPC({ name, color, home, dialogues }) {
  const { state } = useContext(GameContext);
  const ref = useRef(); const modeRef = useRef('idle');
  const target = useRef(new THREE.Vector3(home.x, home.y, home.z));
  const movingRef = useRef(false);

  useFrame(({ clock }, delta) => {
    if (!ref.current || state.dialogue?.name === name) { movingRef.current = false; return; }
    const t = clock.elapsedTime + home.x;
    if (Math.floor(t) % 10 === 0 && modeRef.current === 'idle') {
      modeRef.current = 'walk';
      target.current.set(home.x+(Math.random()-.5)*12, ref.current.position.y, home.z+(Math.random()-.5)*12);
    }
    if (modeRef.current === 'walk') {
      const dir = target.current.clone().sub(ref.current.position).normalize();
      ref.current.position.add(dir.multiplyScalar(delta * 2.0));
      ref.current.lookAt(target.current.x, ref.current.position.y, target.current.z);
      movingRef.current = true;
      if (ref.current.position.distanceTo(target.current) < 0.5) { modeRef.current = 'idle'; movingRef.current = false; }
    } else { movingRef.current = false; }
  });

  return (
    <group ref={ref} position={[home.x, home.y, home.z]} userData={{ isNPC:true, name, color, dialogues }}>
      <BoybandRig colors={{ jacket: color, pants: '#222' }} isNPC npcMovingRef={movingRef} />
      <Html position={[0, 2.8, 0]} center occlude>
        <div style={{ background:'white', padding:'2px 10px', borderRadius:12, fontSize:12, border:`3px solid ${color}`, fontWeight:'bold', pointerEvents:'none', whiteSpace:'nowrap', color:'#222', fontFamily:"'Fredoka One', sans-serif" }}>
          {name}
        </div>
      </Html>
      <ContactShadows opacity={0.35} scale={3} blur={2} position={[0,0.02,0]} />
    </group>
  );
}

// ─── Robbie NPC (Flee AI) ─────────────────────────────────────────────────────

function RobbieNPC({ spawnLoc }) {
  const { state, actions, playerPosRef, robbieDistRef } = useContext(GameContext);
  const ref        = useRef();
  const targetRef  = useRef(new THREE.Vector3(spawnLoc.x, spawnLoc.y, spawnLoc.z));
  const movingRef  = useRef(false);
  const isFleeRef  = useRef(false);
  const spottedRef = useRef(false);
  const wanderTimer = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    if (state.dialogue?.name === 'Robbie') { movingRef.current = false; return; }
    if (state.robbieFound) { movingRef.current = false; return; }

    const pos = ref.current.position;
    const pPos = playerPosRef.current;
    const dist = pos.distanceTo(pPos);

    // Update shared dist ref so HUD can read it
    robbieDistRef.current = dist;

    // ── Flee logic ──
    if (dist < CONFIG.ROBBIE_DETECT_DIST) {
      if (!isFleeRef.current) {
        isFleeRef.current = true;
        if (!spottedRef.current) {
          spottedRef.current = true;
          actions.setRobbieSpotted(true);
          audio.sfx('spotted');
        }
      }
      // Flee direction = away from player, with slight random jink
      const jink  = (Math.random() - 0.5) * 0.4;
      const dx    = pos.x - pPos.x + jink;
      const dz    = pos.z - pPos.z + jink;
      const len   = Math.hypot(dx, dz) || 1;
      const nx = dx/len, nz = dz/len;
      targetRef.current.set(
        Math.max(-52, Math.min(52, pos.x + nx * 30)),
        0,
        Math.max(-52, Math.min(52, pos.z + nz * 30)),
      );
      targetRef.current.y = getTerrainY(targetRef.current.x, targetRef.current.z) + 0.05;
    } else if (dist > CONFIG.ROBBIE_SAFE_DIST) {
      if (isFleeRef.current) {
        isFleeRef.current = false;
        spottedRef.current = false;
        actions.setRobbieSpotted(false);
      }
    }

    const speed = isFleeRef.current ? CONFIG.ROBBIE_FLEE_SPEED : CONFIG.ROBBIE_WANDER_SPEED;

    // ── Move toward target ──
    const distToTarget = pos.distanceTo(targetRef.current);
    if (distToTarget > 0.6) {
      const dir = targetRef.current.clone().sub(pos).normalize();
      pos.x += dir.x * speed * delta;
      pos.z += dir.z * speed * delta;
      pos.y  = getTerrainY(pos.x, pos.z) + 0.05;
      ref.current.lookAt(targetRef.current.x, pos.y, targetRef.current.z);
      movingRef.current = true;
    } else {
      movingRef.current = false;
      // ── Wander when calm ──
      if (!isFleeRef.current) {
        wanderTimer.current -= delta;
        if (wanderTimer.current <= 0) {
          wanderTimer.current = 3 + Math.random() * 5;
          const angle = Math.random() * Math.PI * 2;
          const wanderR = 4 + Math.random() * 8;
          targetRef.current.set(
            Math.max(-52, Math.min(52, spawnLoc.x + Math.cos(angle)*wanderR)),
            0,
            Math.max(-52, Math.min(52, spawnLoc.z + Math.sin(angle)*wanderR)),
          );
          targetRef.current.y = getTerrainY(targetRef.current.x, targetRef.current.z) + 0.05;
        }
      }
    }
  });

  const ROBBIE_DIALOGUES = [
    {
      text: "BLIMEY! You actually found me! 🎤",
      options: [{ label: "Get back on stage, Robbie!", next: 1 }]
    },
    {
      text: "Alright, ALRIGHT. I'll do the reunion. But I'm keeping my rider — three bowls of M&Ms, no brown ones!",
      options: [{ label: "Deal! Let's put on a show!", next: 2 }]
    },
    {
      text: "LET ME ENTERTAIN YOU! 🎶 Take That are BACK!",
      options: [{ label: "⭐ TO THE STAGE! ⭐", next: 'gig' }]
    },
  ];

  return (
    <group ref={ref} position={[spawnLoc.x, spawnLoc.y, spawnLoc.z]}
      userData={{ isNPC:true, name:'Robbie', color: CONFIG.COLORS.robbie, dialogues: ROBBIE_DIALOGUES }}>
      <BoybandRig colors={{ jacket: CONFIG.COLORS.robbie, pants: '#222' }} isNPC npcMovingRef={movingRef} />
      {/* Robbie label with question marks when fleeing */}
      <Html position={[0, 2.9, 0]} center occlude>
        <div style={{
          background: '#e74c3c', color: '#fff',
          padding: '3px 12px', borderRadius: 12,
          fontSize: 13, fontWeight: 'bold', border: '3px solid #fff',
          pointerEvents: 'none', whiteSpace: 'nowrap',
          fontFamily: "'Fredoka One', sans-serif",
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          ??? 
        </div>
      </Html>
      <ContactShadows opacity={0.4} scale={3} blur={2} position={[0,0.02,0]} />
    </group>
  );
}

// ─── HUD Components ───────────────────────────────────────────────────────────

function SpottedWarning() {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'rgba(231,76,60,0.9)',
      color: '#fff', padding: '14px 36px',
      borderRadius: 20, fontFamily: "'Fredoka One', sans-serif",
      fontSize: 28, fontWeight: 900, border: '4px solid #fff',
      animation: 'spottedPulse 0.6s ease-in-out infinite, slideUp 0.3s ease-out',
      zIndex: 80, pointerEvents: 'none', letterSpacing: 2,
      textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    }}>
      👀 ROBBIE SPOTTED — He's running!
    </div>
  );
}

function ProximityRadar({ distRef }) {
  const canvasRef = useRef();
  useEffect(() => {
    const id = setInterval(() => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2, R = W/2 - 4;
      ctx.clearRect(0,0,W,H);
      // Background
      ctx.fillStyle = 'rgba(0,20,40,0.85)'; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
      // Rings
      [0.33,0.66,1].forEach(f => {
        ctx.strokeStyle = `rgba(0,255,128,${0.2+f*0.2})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx,cy,R*f,0,Math.PI*2); ctx.stroke();
      });
      // Crosshairs
      ctx.strokeStyle = 'rgba(0,255,128,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx-R,cy); ctx.lineTo(cx+R,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy-R); ctx.lineTo(cx,cy+R); ctx.stroke();
      // Player dot (centre)
      ctx.fillStyle = '#44ffff';
      ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();
      // Robbie blip (position estimated from dist + a rotating angle sim)
      const dist = distRef.current;
      if (dist < 120) {
        const t = Date.now() / 1000;
        const angle = t * 0.8;
        const mapDist = Math.min(dist, 80) / 80 * R * 0.9;
        const bx = cx + Math.cos(angle)*mapDist;
        const by = cy + Math.sin(angle)*mapDist;
        const pulse = 0.5 + 0.5*Math.sin(t*6);
        ctx.fillStyle = `rgba(231,76,60,${0.7+pulse*0.3})`;
        ctx.beginPath(); ctx.arc(bx,by,5+pulse*3,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx,by,8+pulse*4,0,Math.PI*2); ctx.stroke();
      }
      // Sweep line
      const sweep = (Date.now()/1000*1.5) % (Math.PI*2);
      const grad = ctx.createLinearGradient(cx,cy,cx+Math.cos(sweep)*R,cy+Math.sin(sweep)*R);
      grad.addColorStop(0,'rgba(0,255,128,0.4)');
      grad.addColorStop(1,'rgba(0,255,128,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(sweep)*R, cy+Math.sin(sweep)*R); ctx.stroke();
      // Border
      ctx.strokeStyle = 'rgba(0,255,128,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
    }, 50);
    return () => clearInterval(id);
  }, [distRef]);
  return (
    <div style={{ position:'absolute', bottom:20, right:20, zIndex:50 }}>
      <canvas ref={canvasRef} width={130} height={130} style={{ display:'block', borderRadius:'50%', boxShadow:'0 0 20px rgba(0,255,128,0.4)' }} />
      <div style={{ textAlign:'center', marginTop:4, color:'rgba(0,255,128,0.8)', fontSize:11, fontFamily:"'Fredoka One', monospace", letterSpacing:1 }}>ROBBIE RADAR</div>
    </div>
  );
}

// ─── Gig Finale Overlay ───────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#ff44ff','#44ffff','#ffdd44','#ff4466','#44ff88','#ff8844'];
const confettiPieces  = Array.from({ length: 60 }, (_, i) => ({
  left: `${Math.random()*100}%`,
  delay: `${Math.random()*2}s`,
  duration: `${2+Math.random()*2}s`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: `${8+Math.random()*12}px`,
  rotate: `${Math.random()*360}deg`,
}));

function GigFinale() {
  const crowdPeople = Array.from({ length: 28 });
  return (
    <div style={{
      position:'absolute', inset:0, zIndex:200,
      background:'linear-gradient(180deg, #0a0015 0%, #1a004a 40%, #2a0060 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      fontFamily:"'Fredoka One', Impact, sans-serif", overflow:'hidden',
    }}>
      {/* Confetti */}
      {confettiPieces.map((p,i) => (
        <div key={i} style={{
          position:'absolute', top:0, left:p.left,
          width:p.size, height:p.size, background:p.color,
          borderRadius: i%3===0 ? '50%' : '2px',
          transform: `rotate(${p.rotate})`,
          animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}

      {/* Spotlights */}
      <div style={{ position:'absolute', top:0, left:'20%', width:4, height:'70%',
        background:'linear-gradient(180deg, rgba(255,100,255,0.8) 0%, rgba(255,100,255,0) 100%)',
        transformOrigin:'top center', animation:'spotSweepL 3s ease-in-out infinite', borderRadius:4 }} />
      <div style={{ position:'absolute', top:0, right:'20%', width:4, height:'70%',
        background:'linear-gradient(180deg, rgba(100,200,255,0.8) 0%, rgba(100,200,255,0) 100%)',
        transformOrigin:'top center', animation:'spotSweepR 3s ease-in-out infinite 0.5s', borderRadius:4 }} />
      <div style={{ position:'absolute', top:0, left:'50%', width:4, height:'70%',
        background:'linear-gradient(180deg, rgba(255,220,50,0.7) 0%, rgba(255,220,50,0) 100%)',
        transformOrigin:'top center', animation:'spotSweepL 4s ease-in-out infinite 1s', borderRadius:4 }} />

      {/* Stage neon bars */}
      <div style={{ position:'absolute', bottom:140, left:0, right:0, display:'flex', justifyContent:'center', gap:16 }}>
        {CONFETTI_COLORS.map((c,i) => (
          <div key={i} style={{
            width:60, height:8, background:c, borderRadius:4,
            boxShadow:`0 0 12px ${c}, 0 0 24px ${c}`,
            animation:`crowdBob ${0.8+i*0.1}s ease-in-out infinite alternate`,
          }} />
        ))}
      </div>

      {/* Title */}
      <div style={{ textAlign:'center', marginBottom:16, zIndex:10 }}>
        <div style={{ fontSize:72, animation:'gigPulse 1.5s ease-in-out infinite', marginBottom:4 }}>🎤</div>
        <h1 style={{ fontSize:clamp(24,7,56), margin:'0 0 6px', color:'#fff', letterSpacing:4,
          textShadow:'0 0 20px #ff00ff, 0 0 50px #ff00ff, 0 0 3px #fff',
          animation:'gigPulse 2s ease-in-out infinite' }}>
          TAKE THAT LIVE
        </h1>
        <h2 style={{ fontSize:clamp(14,4,28), margin:'0 0 20px', color:'#ffdd44', letterSpacing:3,
          textShadow:'0 0 10px #ffdd44' }}>
          THE REUNION TOUR — YOU DID IT!
        </h2>
        <p style={{ fontSize:clamp(12,3.5,22), color:'#ccc', margin:'0 0 6px', fontFamily:'Nunito, sans-serif' }}>
          You found Robbie Williams!
        </p>
        <p style={{ fontSize:clamp(10,2.5,18), color:'rgba(200,200,200,0.7)', fontFamily:'Nunito, sans-serif' }}>
          🎵 Now performing: Back For Good, Shine, Never Forget 🎵
        </p>
      </div>

      {/* Crowd */}
      <div style={{ display:'flex', gap:4, marginBottom:24, zIndex:10 }}>
        {crowdPeople.map((_,i) => (
          <div key={i} style={{
            fontSize: clamp(14,2.5,20), lineHeight:1,
            animation: `crowdBob ${0.6+Math.random()*0.6}s ease-in-out ${i*0.08}s infinite`,
            filter:`hue-rotate(${i*13}deg)`,
          }}>🙋</div>
        ))}
      </div>

      <button
        onClick={() => window.location.reload()}
        style={{
          background:'linear-gradient(135deg, #ff4466, #ff00ff)',
          border:'none', color:'#fff', padding:'16px 48px',
          borderRadius:50, fontSize:22, fontWeight:900,
          cursor:'pointer', fontFamily:"'Fredoka One', sans-serif",
          boxShadow:'0 8px 20px rgba(255,0,255,0.5)',
          letterSpacing:2, zIndex:10,
          transition:'transform 0.15s',
        }}
        onMouseEnter={e => e.target.style.transform='scale(1.08)'}
        onMouseLeave={e => e.target.style.transform='scale(1)'}
      >
        🔄 PLAY AGAIN
      </button>
    </div>
  );
}

function clamp(min, vw, max) {
  return `clamp(${min}px, ${vw}vw, ${max}px)`;
}

// ─── Main UI ──────────────────────────────────────────────────────────────────

function GameUI() {
  const { state, actions, robbieDistRef } = useContext(GameContext);

  // Start screen
  if (state.ui === 'start') return (
    <div style={ST.overlay}>
      <div style={ST.modal}>
        <div style={{ fontSize:52, marginBottom:4 }}>🎤</div>
        <h1 style={{ fontFamily:"'Fredoka One', Impact", fontSize:clamp(28,6,52), margin:'0 0 4px', color:'#e74c3c', letterSpacing:2, textShadow:'3px 3px 0 #111' }}>
          WHERE'S ROBBIE?
        </h1>
        <p style={{ fontFamily:'Nunito, sans-serif', color:'#555', marginBottom:22, fontSize:16 }}>
          Find Robbie Williams before he runs away — <b>again!</b>
        </p>

        <input style={ST.input} placeholder="Your name..." maxLength={10}
          onChange={e => actions.setPlayerConfig({ name: e.target.value })} />

        <p style={ST.label}>Choose your band member:</p>
        <div style={ST.row}>
          {[['Gary','#2c2c54'],['Mark','#e84393'],['Howard','#26de81'],['Jason','#fd9644']].map(([t, col]) => (
            <button key={t} onClick={() => actions.setPlayerConfig({ member: t, colors: { jacket: col, pants: '#111' } })}
              style={{ ...ST.memberBtn, borderColor: state.playerConfig.member===t ? col : '#ddd',
                background: state.playerConfig.member===t ? col+'22' : '#f8f8f8' }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:22 }}>
          <label style={ST.colorRow}>
            <span>🧥 Jacket</span>
            <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.jacket}
              onChange={e => actions.setPlayerConfig({ colors:{...state.playerConfig.colors, jacket:e.target.value} })} />
          </label>
          <label style={ST.colorRow}>
            <span>👖 Pants</span>
            <input type="color" style={ST.colorPicker} value={state.playerConfig.colors.pants}
              onChange={e => actions.setPlayerConfig({ colors:{...state.playerConfig.colors, pants:e.target.value} })} />
          </label>
        </div>

        <div style={ST.controls}>
          <b>Controls:</b> WASD move · Space jump · Arrow keys = camera · E interact
        </div>

        <button style={ST.startBtn} onClick={() => {
          if (!state.playerConfig.name) return alert('Enter your name first!');

          // ── Multiplayer connect ──────────────────────────────
          socket = io(SOCKET_URL);
          socket.emit('join', state.playerConfig);
          socket.on('currentPlayers', p  => actions.setOnlinePlayers(p));
          socket.on('stateUpdate',    p  => actions.setOnlinePlayers(p));
          socket.on('chatMessage',    m  => actions.addChatMessage(m));
          socket.on('playerLeft',     id => {
            actions.setOnlinePlayers(prev => {
              const n = { ...prev }; delete n[id]; return n;
            });
          });
          // ────────────────────────────────────────────────────

          audio.init(); audio.playBGM(); actions.setUI('play');
        }}>
          🎶 START THE TOUR!
        </button>
      </div>
    </div>
  );

  // Gig finale
  if (state.ui === 'gig') return <GigFinale />;

  // HUD
  const d = state.dialogue;
  const currentNode = d ? d.nodes[d.step] : null;
  const isTextOnly = currentNode && !currentNode.options;

  return (
    <>
      {/* Dialogue */}
      {d && currentNode && (
        <div style={ST.dialogueBox}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:12, height:12, borderRadius:'50%', background: d.color, boxShadow:`0 0 8px ${d.color}` }} />
            <h2 style={{ margin:0, color:d.color, fontFamily:"'Fredoka One', sans-serif", fontSize:22, textTransform:'uppercase' }}>{d.name}</h2>
          </div>
          <p style={{ fontSize:17, margin:'0 0 18px', color:'#333', fontFamily:'Nunito, sans-serif', lineHeight:1.5 }}>{currentNode.text}</p>
          <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap' }}>
            {currentNode.options ? (
              currentNode.options.map((opt, i) => (
                <button key={i} style={ST.dialogueBtn}
                  onClick={() => {
                    if (opt.next === 'gig') { actions.setDialogue(null); actions.setUI('gig'); return; }
                    actions.setDialogue({ ...d, step: opt.next }); audio.sfx('talk');
                  }}>{opt.label}</button>
              ))
            ) : (
              <button style={{ ...ST.dialogueBtn, background:d.color, color:'#fff' }}
                onClick={() => {
                  if (currentNode.next === 'gig') { actions.setDialogue(null); actions.setUI('gig'); return; }
                  currentNode.next ? actions.setDialogue({ ...d, step: currentNode.next }) : actions.setDialogue(null);
                }}>
                {currentNode.next ? 'Next ▶' : 'Bye! 👋'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spotted warning */}
      {state.robbieSpotted && !state.robbieFound && !d && <SpottedWarning />}

      {/* Radar */}
      <ProximityRadar distRef={robbieDistRef} />

      {/* Goal box */}
      <div style={ST.goalBox}>
        <div style={{ fontSize:18, fontFamily:"'Fredoka One', sans-serif", color:'#e74c3c', marginBottom:2 }}>🎯 MISSION</div>
        {state.robbieFound
          ? <div style={{ color:'#27ae60', fontWeight:'bold', fontSize:14 }}>✅ Robbie Found! Complete the chat!</div>
          : <div style={{ color:'#333', fontSize:14, fontFamily:'Nunito,sans-serif' }}>Find <b>Robbie Williams</b> and get him back on stage!</div>
        }
        <div style={{ marginTop:6, fontSize:12, color:'#888', fontFamily:'Nunito,sans-serif' }}>
          Press <kbd style={ST.kbd}>E</kbd> near an NPC to talk
        </div>
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function WhereIsRobbie() {
  const store = useIslandStore();

  // Inject global CSS
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const robbieLoc = useMemo(() => {
    const loc = ROBBIE_SPAWNS[Math.floor(Math.random()*ROBBIE_SPAWNS.length)];
    return { x: loc.x, y: Math.max(0.1, getTerrainY(loc.x, loc.z)) + 0.05, z: loc.z };
  }, []);

  useEffect(() => {
    const onDown = e => {
      if (document.activeElement?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase(); keyState[k] = true;
      if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
    };
    const onUp = e => { keyState[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onDown, { passive:false });
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#87ceeb', overflow:'hidden' }}>
      <GameContext.Provider value={store}>
        <Canvas shadows dpr={[1,2]} camera={{ fov:46, position:[0,12,18] }}
          gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.15 }}>
          <Suspense fallback={
            <Html center>
              <div style={{ fontFamily:'sans-serif', color:'white', background:'rgba(0,0,0,0.6)', padding:'12px 24px', borderRadius:20 }}>
                🎤 Loading the Tour...
              </div>
            </Html>
          }>
            <Atmosphere />
            <Terrain />
            <Water />
            <StaticWorld />
            <ConcertStage />

            {store.state.ui === 'play' || store.state.ui === 'gig' ? <PlayerController /> : null}

            {/* Robbie (the fugitive) */}
            <RobbieNPC spawnLoc={robbieLoc} />

            {/* Superfans with clues */}
            <NPC name="Superfan Sarah" color={CONFIG.COLORS.fan1}
              home={{ x:-15, y:Math.max(0,getTerrainY(-15,-10))+0.05, z:-10 }}
              dialogues={[{ text:"I spotted Robbie heading toward the EDGES of the island — he's trying to avoid the fans! Check the far corners!", next:'end' }]} />

            <NPC name="Superfan Dave" color={CONFIG.COLORS.fan2}
              home={{ x:20, y:Math.max(0,getTerrainY(20,10))+0.05, z:10 }}
              dialogues={[{ text:"Robbie ran past me squealing! He moves FAST when he's scared. Try sneaking up on him slowly — don't get too close or he'll bolt again!", next:'end' }]} />

            <NPC name="Superfan Emma" color={CONFIG.COLORS.fan3}
              home={{ x:0, y:Math.max(0,getTerrainY(0,22))+0.05, z:22 }}
              dialogues={[{ text:"Oh! The stage looks amazing doesn't it? The band set it all up but Robbie disappeared before soundcheck. Classic Robbie! 🙈", next:'end' }]} />

            <CameraRig />
            <EffectComposer multisampling={4}>
              <Bloom intensity={0.5} luminanceThreshold={0.85} luminanceSmoothing={0.5} />
              <Vignette darkness={0.35} offset={0.4} />
            </EffectComposer>
          </Suspense>
        </Canvas>
        <GameUI />
      </GameContext.Provider>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FF = "'Fredoka One', Impact, sans-serif";
const ST = {
  overlay:    { position:'absolute', inset:0, zIndex:100, background:'linear-gradient(150deg,#0a0a1a,#1a0050 50%,#2a0066)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:FF },
  modal:      { background:'#fff', padding:36, borderRadius:28, width:'min(90vw,440px)', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' },
  input:      { width:'100%', padding:'13px 18px', marginBottom:16, borderRadius:14, border:'3px solid #eee', fontSize:17, boxSizing:'border-box', outline:'none', fontFamily:'Nunito, sans-serif', color:'#333' },
  label:      { margin:'0 0 10px', fontWeight:'bold', color:'#555', fontSize:14, fontFamily:'Nunito, sans-serif' },
  row:        { display:'flex', justifyContent:'center', gap:8, marginBottom:18 },
  memberBtn:  { fontFamily:FF, fontSize:16, padding:'10px 18px', borderRadius:12, border:'3px solid #ddd', cursor:'pointer', background:'#f8f8f8', transition:'all 0.15s' },
  colorRow:   { display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f5f5f5', padding:'8px 14px', borderRadius:12, color:'#555', fontFamily:'Nunito, sans-serif', cursor:'pointer' },
  colorPicker:{ width:42, height:42, border:'none', borderRadius:8, cursor:'pointer', background:'transparent' },
  controls:   { background:'#f0f0ff', borderRadius:12, padding:'10px 16px', fontSize:13, color:'#556', marginBottom:18, fontFamily:'Nunito, sans-serif' },
  startBtn:   { width:'100%', background:'linear-gradient(135deg,#e74c3c,#ff0055)', color:'#fff', border:'none', padding:'16px', borderRadius:18, fontSize:20, fontWeight:900, cursor:'pointer', fontFamily:FF, letterSpacing:2, boxShadow:'0 6px 0 #a00', transition:'transform 0.1s, box-shadow 0.1s' },
  goalBox:    { position:'absolute', top:20, right:160, background:'rgba(255,255,255,0.93)', padding:'12px 18px', borderRadius:16, border:'3px solid #e74c3c', zIndex:50, minWidth:200, boxShadow:'0 4px 12px rgba(0,0,0,0.2)', fontFamily:FF },
  dialogueBox:{ position:'absolute', bottom:30, left:'50%', transform:'translateX(-50%)', width:'min(90vw,520px)', background:'rgba(255,255,255,0.97)', padding:24, borderRadius:22, border:'4px solid #e74c3c', boxShadow:'0 12px 40px rgba(0,0,0,0.3)', zIndex:60, pointerEvents:'auto' },
  dialogueBtn:{ background:'#f0f0f0', border:'3px solid #ddd', padding:'11px 22px', borderRadius:12, color:'#333', fontWeight:900, cursor:'pointer', fontSize:15, fontFamily:FF, transition:'transform 0.1s', boxShadow:'0 4px 0 rgba(0,0,0,0.1)' },
  kbd:        { background:'#333', color:'#fff', borderRadius:5, padding:'1px 6px', fontFamily:'monospace', fontSize:12 },
};
