/**
 * 🛸 SPRINGFIELD UNDER SIEGE (True 4-Player Co-Op)
 * FIXES:
 *  1. WASD no longer freezes - input guard only blocks when chat focused,
 *     and blur is forced on Enter/Escape so keys resume immediately.
 *  2. Replaced local socket server with Ably Realtime (free tier, no backend needed).
 *     Get a free key at https://ably.com (free: 6M msgs/month, 200 concurrent).
 *     Paste your key into ABLY_API_KEY below.
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Ably Config ──────────────────────────────────────────────────────────────
// 1. Go to https://ably.com → sign up free → create an app → copy your API key
// 2. Paste it below (the key is safe to use client-side with restricted capabilities)
const ABLY_API_KEY = '46Xc5g.G1zGDw:J-HBgtccChbl-Z-fXrlUv6X_bl-cweiSQu9_dWwfbTU';
const ROOM_ID      = 'springfield-001'; // Change this to play in different rooms

// ─── Simple Ably wrapper (no extra npm needed — loads from CDN in useEffect) ──
let ablyClient  = null;
let ablyChannel = null;

// ─── FIX: Keyboard state with chat-aware guard ────────────────────────────────
// We track whether the chat input is focused separately, so we never block
// game keys based on activeElement (which was the freeze bug).
const keyState    = {};
let   chatFocused = false; // set by the chat <input> onFocus/onBlur

const camState = { yaw: Math.PI, pitch: 0.45, yawVel: 0, pitchVel: 0 };
const prevKeys  = { e: false, q: false };

// ─── Characters ───────────────────────────────────────────────────────────────
const CHARACTERS = [
  {
    id: 'homer', name: 'Homer', emoji: '🍩',
    goal: "Moe's Tavern", goalEmoji: '🍺',
    speed: 4.8, maxHits: 4,
    shirt: '#f5f5f5', pants: '#3355cc', hair: '#1a1a1a',
    dest: new THREE.Vector3(45, 0, -28),
    startPos: new THREE.Vector3(3, 0, 3),
    ability: 'tanky', abilityLabel: 'Extra Tough (4 hits)',
    quip: "D'oh! Not the aliens again!",
  },
  {
    id: 'bart', name: 'Bart', emoji: '🛹',
    goal: 'Springfield Elementary', goalEmoji: '🏫',
    speed: 9.5, maxHits: 2,
    shirt: '#ff3333', pants: '#4455dd', hair: '#FFD90F',
    dest: new THREE.Vector3(-45, 0, 28),
    startPos: new THREE.Vector3(-3, 0, 3),
    ability: 'fast', abilityLabel: 'Super Speed',
    quip: "Ay caramba! Eat my shorts, aliens!",
  },
  {
    id: 'lisa', name: 'Lisa', emoji: '🎷',
    goal: 'Public Library', goalEmoji: '📚',
    speed: 6.2, maxHits: 2,
    shirt: '#dd1111', pants: '#dd1111', hair: '#FFD90F',
    dest: new THREE.Vector3(12, 0, -8),
    startPos: new THREE.Vector3(3, 0, -3),
    ability: 'slowtime', abilityLabel: 'Q: Slow Aliens (5s)',
    quip: "Statistically, running is optimal!",
  },
  {
    id: 'marge', name: 'Marge', emoji: '🧹',
    goal: 'Kwik-E-Mart', goalEmoji: '🏪',
    speed: 5.5, maxHits: 3,
    shirt: '#22aa44', pants: '#22aa44', hair: '#1133cc',
    dest: new THREE.Vector3(-12, 0, 8),
    startPos: new THREE.Vector3(-3, 0, -3),
    ability: 'shield', abilityLabel: 'Q: Activate Shield',
    quip: "Hmmmm… I don't like this one bit.",
  },
];

const BUILDINGS = [
  { x: 45, z:-28, w: 9, d: 7, h: 5,  color: '#7B3F00', roof: '#5a2d00', destFor: 'homer', label: "Moe's Tavern" },
  { x:-45, z: 28, w:13, d: 9, h: 9,  color: '#cc3333', roof: '#aa2222', destFor: 'bart',  label: 'Springfield Elementary' },
  { x: 12, z:-8,  w:11, d: 8, h:10,  color: '#3366cc', roof: '#224499', destFor: 'lisa',  label: 'Public Library' },
  { x:-12, z:  8, w:10, d: 7, h: 5,  color: '#22aa44', roof: '#118833', destFor: 'marge', label: 'Kwik-E-Mart' },
  { x:  0, z: 10, w: 8, d: 6, h: 8,  color: '#aaaaaa', roof: '#888888', label: 'City Hall' },
  { x: 40, z: 35, w: 6, d: 5, h:12,  color: '#ff8800', roof: '#cc6600', label: 'Nuclear Plant' },
  { x:-15, z:-10, w: 7, d: 6, h: 7,  color: '#cc8855', roof: '#aa6633', label: 'Police Dept' },
  { x:  0, z:-35, w: 8, d: 8, h: 6,  color: '#88ccaa', roof: '#66aaaa', label: 'Hospital' },
  { x: 20, z:-10, w: 4, d: 4, h: 5,  color: '#ddaa33', roof: '#bb8822', label: 'Krusty Burger' },
  { x:-20, z:-35, w: 8, d: 6, h: 5,  color: '#6688cc', roof: '#4466aa', label: 'Springfield Mall' },
  { x:-40, z:-10, w: 5, d: 5, h: 5,  color: '#886644', roof: '#664422', label: 'First Church' },
  { x: 40, z: 10, w: 5, d: 4, h: 7,  color: '#aa55cc', roof: '#883399', label: 'Springfield Coliseum' },
];

const POWERUP_SPAWNS = [
  { x:  0, z:  0, type: 'donut'  }, { x: 30, z: 30, type: 'emp'    },
  { x:-30, z: 30, type: 'speed'  }, { x: 30, z:-30, type: 'shield' },
  { x:-30, z:-30, type: 'donut'  }, { x:  0, z: 35, type: 'emp'    },
];

const POWERUP_CONFIG = {
  donut:  { emoji: '🍩', color: '#ff88bb', label: '+1 Life'     },
  emp:    { emoji: '🛸', color: '#44ffff', label: 'EMP Bomb'    },
  speed:  { emoji: '🏃', color: '#ffff44', label: 'Speed Boost' },
  shield: { emoji: '🛡️', color: '#aaaaff', label: 'Shield'      },
};

const CONFIG = {
  SPEED: 6.5, ACCEL: 12, DECEL: 15, GRAVITY: 35, JUMP_FORCE: 14,
  BOUNDS: 60, DEST_RADIUS: 4.5, PICKUP_RADIUS: 2.4, LASER_HIT_RADIUS: 2.5,
};

// ─── Store ────────────────────────────────────────────────────────────────────
const GameContext = createContext();

function useSpringfieldStore() {
  const charGroupRefs   = useRef(CHARACTERS.map(() => React.createRef()));
  const playerPosRef    = useRef(new THREE.Vector3());
  const activeMovingRef = useRef(false);
  const networkMovingRefs = useRef([false, false, false, false]);

  const initChars   = () => CHARACTERS.map(c => ({ id: c.id, hits: 0, done: false, shieldActive: false, shieldCharges: 0, speedBoostEnd: 0, slowTimeEnd: 0, hidden: false }));
  const initPowerUps= () => POWERUP_SPAWNS.map((p, i) => ({ ...p, id: i, active: true }));

  const [state, setState] = useState({
    phase: 'start', isSpectator: false, lives: 3,
    activeCharIdx: 0, chars: initChars(), powerUps: initPowerUps(),
    score: 0, alienSlowEnd: 0, chatMessages: [], quip: null, nearDoor: false,
    myPlayerId: null,
  });

  const actions = useMemo(() => ({
    setPhase: p => setState(s => ({ ...s, phase: p })),
    setMyPlayerId: id => setState(s => ({ ...s, myPlayerId: id })),
    setAssignedCharacter: charId => setState(s => {
      if (charId === 'spectator') return { ...s, isSpectator: true };
      const idx = CHARACTERS.findIndex(c => c.id === charId);
      return { ...s, activeCharIdx: idx !== -1 ? idx : s.activeCharIdx, isSpectator: false };
    }),
    setNearDoor: val => setState(s => s.nearDoor === val ? s : { ...s, nearDoor: val }),
    toggleHide: () => setState(s => {
      const chars = [...s.chars];
      chars[s.activeCharIdx] = { ...chars[s.activeCharIdx], hidden: !chars[s.activeCharIdx].hidden };
      return { ...s, chars };
    }),
    unhide: () => setState(s => {
      if (!s.chars[s.activeCharIdx].hidden) return s;
      const chars = [...s.chars];
      chars[s.activeCharIdx] = { ...chars[s.activeCharIdx], hidden: false };
      return { ...s, chars };
    }),
    charArrived: charId => setState(s => {
      const chars = s.chars.map(c => c.id === charId ? { ...c, done: true, hidden: false } : c);
      const allDone = chars.every(c => c.done);
      return { ...s, chars, score: s.score + 500, phase: allDone ? 'win' : s.phase };
    }),
    hitChar: charIdx => setState(s => {
      const char = s.chars[charIdx];
      if (!char || char.done || char.hidden) return s;
      if (char.shieldActive && char.shieldCharges > 0) {
        const chars = [...s.chars];
        chars[charIdx] = { ...char, shieldCharges: char.shieldCharges - 1, shieldActive: char.shieldCharges - 1 > 0 };
        return { ...s, chars };
      }
      const newLives = s.lives - 1;
      const chars = [...s.chars];
      chars[charIdx] = { ...char, hits: char.hits + 1 };
      return { ...s, lives: newLives, chars, phase: newLives <= 0 ? 'gameover' : s.phase };
    }),
    collectPowerUp: (id, type, charIdx) => setState(s => {
      const powerUps = s.powerUps.map(p => p.id === id ? { ...p, active: false } : p);
      const now = Date.now();
      const chars = [...s.chars];
      if (type === 'speed')  chars[charIdx] = { ...chars[charIdx], speedBoostEnd: now + 5000 };
      if (type === 'shield') chars[charIdx] = { ...chars[charIdx], shieldActive: true, shieldCharges: 1 };
      return { ...s, powerUps, chars, lives: type === 'donut' ? Math.min(s.lives + 1, 6) : s.lives, alienSlowEnd: type === 'emp' ? now + 5000 : s.alienSlowEnd };
    }),
    useAbility: charIdx => setState(s => {
      const charCfg = CHARACTERS[charIdx];
      if (!charCfg) return s;
      const chars = [...s.chars];
      const now = Date.now();
      if (charCfg.ability === 'slowtime' && now > (s.chars[charIdx].slowTimeEnd || 0)) {
        chars[charIdx] = { ...chars[charIdx], slowTimeEnd: now + 5000 };
        return { ...s, chars, alienSlowEnd: now + 5000 };
      }
      if (charCfg.ability === 'shield') {
        chars[charIdx] = { ...chars[charIdx], shieldActive: true, shieldCharges: 1 };
        return { ...s, chars };
      }
      return s;
    }),
    showQuip: text => {
      setState(s => ({ ...s, quip: text }));
      setTimeout(() => setState(s => ({ ...s, quip: null })), 3000);
    },
    addScore: n => setState(s => ({ ...s, score: s.score + n })),
    reset: () => setState(s => ({ ...s, phase: 'start', lives: 3, score: 0, chars: initChars(), powerUps: initPowerUps(), alienSlowEnd: 0, quip: null, nearDoor: false })),
    addChatMessage: m => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-7), m] })),
  }), []);

  return { state, actions, charGroupRefs, playerPosRef, activeMovingRef, networkMovingRefs };
}

// ─── Audio ───────────────────────────────────────────────────────────────────
class GameAudio {
  constructor() { this.ctx = null; this.master = null; this.bgm = false; }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.14;
    this.master.connect(this.ctx.destination);
  }
  playBGM() {
    if (this.bgm || !this.ctx) return;
    this.bgm = true;
    const BPM = 160; const B = 60 / BPM;
    const mel = [[523.25,0,1.5],[659.25,1.5,1],[739.99,2.5,1],[880.00,3.5,0.5],[783.99,4,1.5],[659.25,5.5,1],[523.25,6.5,1],[440.00,7.5,0.5],[369.99,8,0.5],[369.99,8.5,0.5],[369.99,9,0.5],[392.00,9.5,1.5],[369.99,11.5,0.5],[369.99,12,0.5],[369.99,12.5,0.5],[392.00,13,0.5],[466.16,13.5,0.5],[493.88,14,0.5],[523.25,14.5,2]];
    const note = (f, bOff, dur, t0, vol=0.04, type='square') => {
      const osc=this.ctx.createOscillator(); const env=this.ctx.createGain();
      const t=t0+bOff*B; const d=dur*B;
      osc.type=type; osc.frequency.value=f;
      env.gain.setValueAtTime(0.001,t); env.gain.linearRampToValueAtTime(vol,t+0.02);
      env.gain.exponentialRampToValueAtTime(0.0001,t+d*0.95);
      osc.connect(env); env.connect(this.master); osc.start(t); osc.stop(t+d+0.05);
    };
    const loop = t => {
      mel.forEach(([f,b,d]) => note(f,b,d,t,0.05,'square'));
      const next = t + 20*B;
      setTimeout(() => { if(this.bgm) loop(next); }, Math.max(0,(next-this.ctx.currentTime-0.5)*1000));
    };
    loop(this.ctx.currentTime + 0.1);
  }
  sfx(type) {
    if (!this.ctx) return;
    if (type === 'step') {
      const buf=this.ctx.createBuffer(1,this.ctx.sampleRate*0.05,this.ctx.sampleRate);
      const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2);
      const src=this.ctx.createBufferSource(); src.buffer=buf;
      const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=800;
      const g=this.ctx.createGain(); g.gain.value=0.25;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    }
    if (type === 'laser') {
      const osc=this.ctx.createOscillator(); const g=this.ctx.createGain();
      osc.type='sawtooth'; osc.frequency.setValueAtTime(880,this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220,this.ctx.currentTime+0.18);
      g.gain.setValueAtTime(0.08,this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+0.2);
      osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime+0.22);
    }
    if (type === 'hit') {
      [220,180,150].forEach((f,i) => {
        const osc=this.ctx.createOscillator(); const g=this.ctx.createGain();
        osc.type='square'; osc.frequency.value=f;
        const t=this.ctx.currentTime+i*0.07;
        g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
        osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t+0.14);
      });
    }
    if (type === 'hide') {
      const osc=this.ctx.createOscillator(); const g=this.ctx.createGain();
      osc.type='triangle'; osc.frequency.setValueAtTime(600,this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200,this.ctx.currentTime+0.2);
      g.gain.setValueAtTime(0.1,this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+0.2);
      osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime+0.2);
    }
    if (type === 'arrive') {
      [523,659,784,1047].forEach((f,i) => {
        const osc=this.ctx.createOscillator(); const g=this.ctx.createGain();
        osc.type='sine'; osc.frequency.value=f;
        const t=this.ctx.currentTime+i*0.1;
        g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.5);
        osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t+0.55);
      });
    }
    if (type === 'pickup') {
      const osc=this.ctx.createOscillator(); const g=this.ctx.createGain();
      osc.type='sine'; osc.frequency.setValueAtTime(440,this.ctx.currentTime);
      osc.frequency.setValueAtTime(880,this.ctx.currentTime+0.08);
      g.gain.setValueAtTime(0.08,this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+0.3);
      osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime+0.32);
    }
  }
}
const audio = new GameAudio();

// ─── Biped Animation ─────────────────────────────────────────────────────────
const matBlack      = new THREE.MeshBasicMaterial({ color: '#111' });
const matSkinYellow = new THREE.MeshStandardMaterial({ color: '#FFD90F', roughness: 0.6 });
function stdMat(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 }); }

function useHumanAnim({ npcMovingRef }) {
  const body=useRef(); const head=useRef();
  const armL=useRef(); const armR=useRef();
  const legL=useRef(); const legR=useRef();
  const walk=useRef(0);
  useFrame((_,delta) => {
    const isMoving = npcMovingRef && npcMovingRef.current;
    if(isMoving) walk.current += delta * 15;
    if(body.current) {
      body.current.position.y = 1.0 + (isMoving ? Math.abs(Math.sin(walk.current)) * 0.08 : 0);
      body.current.rotation.z = isMoving ? Math.sin(walk.current) * 0.03 : 0;
    }
    if(head.current) { head.current.rotation.y = isMoving ? -Math.sin(walk.current * 0.5) * 0.08 : 0; }
    const armSwing = Math.sin(walk.current) * 0.8;
    const legSwing = Math.sin(walk.current) * 0.7;
    if(isMoving){
      if(armL.current) armL.current.rotation.x = armSwing;
      if(armR.current) armR.current.rotation.x = -armSwing;
      if(legL.current) legL.current.rotation.x = -legSwing;
      if(legR.current) legR.current.rotation.x = legSwing;
    } else {
      [armL,armR,legL,legR].forEach(r=>{ if(r.current) r.current.rotation.x = THREE.MathUtils.lerp(r.current.rotation.x, 0, 0.1); });
    }
  });
  return { body, head, armL, armR, legL, legR };
}

function SimpsonsRig({ charCfg, npcMovingRef, isHidden }) {
  const { body, head, armL, armR, legL, legR } = useHumanAnim({ npcMovingRef });
  const shirtMat = useMemo(() => stdMat(charCfg.shirt), [charCfg.shirt]);
  const pantsMat = useMemo(() => stdMat(charCfg.pants), [charCfg.pants]);
  const hairMat  = useMemo(() => stdMat(charCfg.hair),  [charCfg.hair]);
  if (isHidden) return null;
  return (
    <group ref={body} position={[0, 1.0, 0]}>
      <mesh material={shirtMat} castShadow><boxGeometry args={[0.6, 0.8, 0.4]} /></mesh>
      <group ref={head} position={[0, 0.6, 0]}>
        <mesh material={matSkinYellow} castShadow><boxGeometry args={[0.45, 0.5, 0.45]} /></mesh>
        {charCfg.id === 'marge' ? (
          <mesh material={hairMat} position={[0, 0.7, -0.02]} castShadow><boxGeometry args={[0.35, 1.3, 0.3]} /></mesh>
        ) : charCfg.id !== 'homer' ? (
          <mesh material={hairMat} position={[0, 0.29, -0.04]} castShadow><boxGeometry args={[0.5, 0.16, 0.5]} /></mesh>
        ) : null}
        <mesh material={matBlack} position={[-0.1, 0.05, 0.23]}><boxGeometry args={[0.07,0.07,0.02]} /></mesh>
        <mesh material={matBlack} position={[ 0.1, 0.05, 0.23]}><boxGeometry args={[0.07,0.07,0.02]} /></mesh>
        {charCfg.id === 'homer' && <mesh material={hairMat} position={[0,-0.13,0.23]}><boxGeometry args={[0.18,0.03,0.02]} /></mesh>}
      </group>
      <group ref={armL} position={[-0.42, 0.28, 0]}>
        <mesh material={shirtMat} position={[0,-0.3,0]} castShadow><boxGeometry args={[0.2,0.7,0.2]} /></mesh>
        <mesh material={matSkinYellow} position={[0,-0.7,0]} castShadow><boxGeometry args={[0.15,0.15,0.15]} /></mesh>
      </group>
      <group ref={armR} position={[0.42, 0.28, 0]}>
        <mesh material={shirtMat} position={[0,-0.3,0]} castShadow><boxGeometry args={[0.2,0.7,0.2]} /></mesh>
        <mesh material={matSkinYellow} position={[0,-0.7,0]} castShadow><boxGeometry args={[0.15,0.15,0.15]} /></mesh>
      </group>
      <group ref={legL} position={[-0.18,-0.42,0]}>
        <mesh material={pantsMat} position={[0,-0.35,0]} castShadow><boxGeometry args={[0.24,0.7,0.24]} /></mesh>
        <mesh material={matBlack}  position={[0,-0.75,0.05]} castShadow><boxGeometry args={[0.24,0.14,0.34]} /></mesh>
      </group>
      <group ref={legR} position={[0.18,-0.42,0]}>
        <mesh material={pantsMat} position={[0,-0.35,0]} castShadow><boxGeometry args={[0.24,0.7,0.24]} /></mesh>
        <mesh material={matBlack}  position={[0,-0.75,0.05]} castShadow><boxGeometry args={[0.24,0.14,0.34]} /></mesh>
      </group>
    </group>
  );
}

// ─── City Map ─────────────────────────────────────────────────────────────────
function CityMap() {
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]} receiveShadow>
        <planeGeometry args={[200,200]} /><meshStandardMaterial color="#4a9e30" roughness={0.9} />
      </mesh>
      {[[0,-20,104,14],[0,20,104,14]].map(([x,z,w,d],i)=>(
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[x,0.005,z]} receiveShadow>
          <planeGeometry args={[w,d]} /><meshStandardMaterial color="#999" roughness={0.9} />
        </mesh>
      ))}
      {[[-30,0,14,54],[30,0,14,54]].map(([x,z,w,d],i)=>(
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[x,0.005,z]} receiveShadow>
          <planeGeometry args={[w,d]} /><meshStandardMaterial color="#999" roughness={0.9} />
        </mesh>
      ))}
      {[[0,-20,100,10],[0,20,100,10]].map(([x,z,w,d],i)=>(
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[x,0.01,z]} receiveShadow>
          <planeGeometry args={[w,d]} /><meshStandardMaterial color="#333" roughness={0.8} />
        </mesh>
      ))}
      {[[-30,0,10,50],[30,0,10,50]].map(([x,z,w,d],i)=>(
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[x,0.01,z]} receiveShadow>
          <planeGeometry args={[w,d]} /><meshStandardMaterial color="#333" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

const _winMat  = stdMat('#ffffaa');
const _doorMat = stdMat('#5c3a21');

function Building({ b }) {
  const wallMat = useMemo(() => stdMat(b.color), [b.color]);
  const roofMat = useMemo(() => stdMat(b.roof || '#444'), [b.roof]);
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh material={wallMat} position={[0,b.h/2,0]} castShadow receiveShadow><boxGeometry args={[b.w,b.h,b.d]} /></mesh>
      <mesh material={roofMat} position={[0,b.h+0.2,0]} castShadow><boxGeometry args={[b.w+0.2,0.4,b.d+0.2]} /></mesh>
      <mesh material={_doorMat} position={[0,1.2,b.d/2+0.05]}><boxGeometry args={[1.5,2.4,0.1]} /></mesh>
      {Array.from({length:Math.floor(b.h/2)}).map((_,wi)=>
        [-b.w*0.28,b.w*0.28].map((wx,wj)=>(
          <mesh key={`w${wi}-${wj}`} material={_winMat} position={[wx,1.2+wi*1.9,b.d/2+0.05]}>
            <boxGeometry args={[0.5,0.55,0.05]} />
          </mesh>
        ))
      )}
      <Html position={[0,b.h+1,0]} center>
        <div style={{background:'rgba(0,0,0,0.75)',color:'#fff',padding:'2px 8px',borderRadius:8,fontSize:11,fontWeight:'bold',whiteSpace:'nowrap',pointerEvents:'none',fontFamily:'Arial,sans-serif',border:b.destFor?'2px solid #FFD90F':'none'}}>
          {b.destFor?'⭐ ':''}{b.label}
        </div>
      </Html>
    </group>
  );
}

// ─── Traffic ──────────────────────────────────────────────────────────────────
function CarMesh({ color }) {
  const bodyMat = useMemo(() => stdMat(color), [color]);
  const tireMat = useMemo(() => stdMat('#222'), []);
  return (
    <group position={[0,0.5,0]}>
      <mesh material={bodyMat} position={[0,0.4,0]} castShadow><boxGeometry args={[2,0.8,4]} /></mesh>
      <mesh material={bodyMat} position={[0,1.1,-0.2]} castShadow><boxGeometry args={[1.8,0.8,2.2]} /></mesh>
      {[[-1,0,1.2],[1,0,1.2],[-1,0,-1.2],[1,0,-1.2]].map((pos,i)=>(
        <mesh key={i} material={tireMat} position={pos} rotation={[0,0,Math.PI/2]} castShadow>
          <cylinderGeometry args={[0.4,0.4,0.3,16]} />
        </mesh>
      ))}
    </group>
  );
}

function TrafficSystem() {
  const { state, actions, playerPosRef } = useContext(GameContext);
  const carData = useMemo(() => [
    { id:1, color:'#e74c3c', speed:18, dir:'+x', bounds:{xMin:-30,xMax:30,zMin:-20,zMax:20} },
    { id:2, color:'#3498db', speed:15, dir:'-x', bounds:{xMin:-30,xMax:30,zMin:-20,zMax:20} },
    { id:3, color:'#f1c40f', speed:20, dir:'+z', bounds:{xMin:-30,xMax:30,zMin:-20,zMax:20} },
  ], []);
  const initPos = [[0,0,-20],[0,0,20],[30,0,0]];
  const carRefs = useRef(carData.map(() => React.createRef()));

  useFrame((_,delta) => {
    if (state.phase !== 'play') return;
    carData.forEach((car, i) => {
      const g = carRefs.current[i].current; if (!g) return;
      if      (car.dir==='+x') { g.position.x+=car.speed*delta; g.rotation.y=Math.PI/2;  if(g.position.x>=car.bounds.xMax){g.position.x=car.bounds.xMax;car.dir='+z';} }
      else if (car.dir==='+z') { g.position.z+=car.speed*delta; g.rotation.y=0;           if(g.position.z>=car.bounds.zMax){g.position.z=car.bounds.zMax;car.dir='-x';} }
      else if (car.dir==='-x') { g.position.x-=car.speed*delta; g.rotation.y=-Math.PI/2; if(g.position.x<=car.bounds.xMin){g.position.x=car.bounds.xMin;car.dir='-z';} }
      else if (car.dir==='-z') { g.position.z-=car.speed*delta; g.rotation.y=Math.PI;    if(g.position.z<=car.bounds.zMin){g.position.z=car.bounds.zMin;car.dir='+x';} }
      if (!state.isSpectator && !state.chars[state.activeCharIdx].hidden && !state.chars[state.activeCharIdx].done) {
        if (g.position.distanceTo(playerPosRef.current) < 2.5) {
          actions.hitChar(state.activeCharIdx);
          actions.showQuip("Watch out for the cars!");
        }
      }
    });
  });

  return (
    <group>
      {carData.map((car,i) => (
        <group key={car.id} ref={carRefs.current[i]} position={initPos[i]}><CarMesh color={car.color} /></group>
      ))}
    </group>
  );
}

// ─── Destinations & Power-Ups ─────────────────────────────────────────────────
function DestinationZone({ charId, pos, done }) {
  const ring = useRef();
  const charCfg = CHARACTERS.find(c => c.id === charId);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    ring.current.rotation.y = clock.elapsedTime * 1.5;
    ring.current.scale.setScalar(done ? 1.0 : 0.85 + Math.sin(clock.elapsedTime*3)*0.15);
  });
  if (done) return null;
  return (
    <group position={[pos.x,0.1,pos.z]} ref={ring}>
      <mesh rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[CONFIG.DEST_RADIUS-0.4,CONFIG.DEST_RADIUS,32]} />
        <meshBasicMaterial color={charCfg?.shirt||'#fff'} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0,0.3,0]}><div style={{fontSize:20}}>{charCfg?.goalEmoji}</div></Html>
    </group>
  );
}

function PowerUp({ data }) {
  const ref = useRef();
  const cfg = POWERUP_CONFIG[data.type];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 1.2 + Math.sin(clock.elapsedTime*2.5+data.id)*0.3;
    ref.current.rotation.y = clock.elapsedTime*2;
  });
  if (!data.active) return null;
  return (
    <group ref={ref} position={[data.x,1.2,data.z]}>
      <mesh castShadow><octahedronGeometry args={[0.5,0]} /><meshStandardMaterial color={cfg.color} emissive={cfg.color} emissiveIntensity={0.6} /></mesh>
      <Html center position={[0,0.9,0]}><div style={{fontSize:18,pointerEvents:'none'}}>{cfg.emoji}</div></Html>
      <pointLight color={cfg.color} intensity={2} distance={5} decay={2} />
    </group>
  );
}

// ─── Alien System ─────────────────────────────────────────────────────────────
function LaserBeam({ laser, onExpire, onHit }) {
  const ref = useRef();
  const hasHit = useRef(false);
  const { state, charGroupRefs } = useContext(GameContext);
  useFrame(() => {
    const age = (Date.now() - laser.startTime) / 500;
    if (ref.current) {
      ref.current.position.lerpVectors(new THREE.Vector3(...laser.from), new THREE.Vector3(...laser.to), age);
      let hitBuilding = false;
      BUILDINGS.forEach(b => {
        if (ref.current.position.x > b.x-b.w/2 && ref.current.position.x < b.x+b.w/2 &&
            ref.current.position.z > b.z-b.d/2 && ref.current.position.z < b.z+b.d/2 &&
            ref.current.position.y < b.h+0.5) hitBuilding = true;
      });
      if (hitBuilding) { onExpire(laser.id); return; }
    }
    if (age >= 1) {
      if (!hasHit.current && !state.isSpectator) {
        hasHit.current = true;
        const targetChar = state.chars[state.activeCharIdx];
        const g = charGroupRefs.current[state.activeCharIdx]?.current;
        if (g && !targetChar.hidden) {
          if (g.position.distanceTo(new THREE.Vector3(...laser.to)) < CONFIG.LASER_HIT_RADIUS) onHit(state.activeCharIdx);
        }
      }
      onExpire(laser.id);
    }
  });
  return (
    <mesh ref={ref} position={laser.from}>
      <sphereGeometry args={[0.5,8,8]} />
      <meshBasicMaterial color={laser.color} />
      <pointLight color={laser.color} intensity={2} distance={5} />
    </mesh>
  );
}

function AlienUFO({ isSlowed }) {
  const innerRef = useRef();
  useFrame(({ clock }) => { if (innerRef.current) innerRef.current.material.emissiveIntensity = 0.5+Math.sin(clock.elapsedTime*4)*0.3; });
  const col = isSlowed ? '#888' : '#33cc44';
  return (
    <>
      <mesh castShadow><cylinderGeometry args={[3.2,3.8,0.75,18]} /><meshStandardMaterial color={col} metalness={0.8} roughness={0.2} /></mesh>
      <mesh position={[0,0.65,0]}><sphereGeometry args={[1.6,16,8,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color={isSlowed?'#aaa':'#99ffaa'} transparent opacity={0.7} /></mesh>
      <mesh ref={innerRef} position={[0,-0.3,0]}><cylinderGeometry args={[1.2,1.2,0.15,12]} /><meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={0.5} /></mesh>
      {[0,1,2,3,4,5].map(idx=>(<mesh key={idx} position={[Math.cos(idx/6*Math.PI*2)*2.2,0,Math.sin(idx/6*Math.PI*2)*2.2]}><sphereGeometry args={[0.28,8,8]} /><meshBasicMaterial color={isSlowed?'#444':'#ffff44'} /></mesh>))}
      <pointLight position={[0,-1,0]} color={isSlowed?'#334':'#00ff44'} intensity={isSlowed?1:5} distance={14} decay={2} />
    </>
  );
}

function UFOController({ ufoId, startX, startZ, activeCharGroupRef, alienSlowEndRef, scoreRef, onFire }) {
  const groupRef = useRef();
  const vel = useRef(new THREE.Vector3((ufoId%2===0?1:-1)*(0.3+ufoId*0.08),0,(ufoId%3===0?1:-1)*(0.25+ufoId*0.06)));
  const fireTimer = useRef(2.0 + ufoId*2.8);
  useFrame(({ clock }, delta) => {
    const g = groupRef.current; if (!g) return;
    const slowed = Date.now() < alienSlowEndRef.current;
    const sm = slowed ? 0.15 : 1.0;
    g.position.x += vel.current.x*delta*sm*9; g.position.z += vel.current.z*delta*sm*9;
    g.position.y = 13+Math.sin(clock.elapsedTime*0.7+ufoId*2.1)*1.8; g.rotation.y = clock.elapsedTime*0.4;
    if (Math.abs(g.position.x)>48) vel.current.x*=-1; if (Math.abs(g.position.z)>48) vel.current.z*=-1;
    fireTimer.current -= delta*sm;
    if (fireTimer.current <= 0) {
      fireTimer.current = Math.max(1.5,3.5-(scoreRef.current/500))*(0.7+Math.random()*0.6);
      if (activeCharGroupRef?.current) onFire(g.position.clone(), activeCharGroupRef.current.position.clone(), ufoId);
    }
  });
  return (<group ref={groupRef} position={[startX,13,startZ]}><AlienUFO isSlowed={false} /></group>);
}

function AlienSystem() {
  const { state, actions, charGroupRefs } = useContext(GameContext);
  const [lasers, setLasers] = useState([]);
  const alienSlowEndRef = useRef(state.alienSlowEnd);
  const scoreRef = useRef(state.score);
  useEffect(() => { alienSlowEndRef.current = state.alienSlowEnd; }, [state.alienSlowEnd]);
  useEffect(() => { scoreRef.current = state.score; }, [state.score]);
  const numUFOs = Math.min(3, 1+Math.floor(state.score/400));
  const UFO_STARTS = [[-20,-10],[22,8],[-8,24]];
  const LASER_COLS = ['#ff2200','#00ffaa','#ff00ff'];
  const handleFire = (fromPos, targetPos, ufoId) => {
    let ft = targetPos.clone();
    if (state.isSpectator) { ft.set((Math.random()-0.5)*40,0,(Math.random()-0.5)*40); }
    else { const tc = state.chars[state.activeCharIdx]; if(tc?.hidden) ft.add(new THREE.Vector3((Math.random()-0.5)*20,0,(Math.random()-0.5)*20)); else ft.add(new THREE.Vector3((Math.random()-0.5)*5,0,(Math.random()-0.5)*5)); }
    audio.sfx('laser');
    setLasers(l => [...l.slice(-12),{ id:Date.now()+ufoId*1000+Math.random(), from:[fromPos.x,fromPos.y,fromPos.z], to:[ft.x,0,ft.z], charIdx:state.activeCharIdx, color:LASER_COLS[ufoId]||'#ff2200', startTime:Date.now() }]);
  };
  return (
    <>
      {UFO_STARTS.slice(0,numUFOs).map(([sx,sz],i)=>(
        <UFOController key={i} ufoId={i} startX={sx} startZ={sz} activeCharGroupRef={charGroupRefs.current[state.activeCharIdx]} alienSlowEndRef={alienSlowEndRef} scoreRef={scoreRef} onFire={handleFire} />
      ))}
      {lasers.map(l=>(
        <LaserBeam key={l.id} laser={l} onExpire={id=>setLasers(l=>l.filter(x=>x.id!==id))} onHit={idx=>{actions.hitChar(idx);audio.sfx('hit');}} />
      ))}
    </>
  );
}

// ─── Camera ──────────────────────────────────────────────────────────────────
function CameraRig() {
  const { state, charGroupRefs } = useContext(GameContext);
  const { camera } = useThree();
  useFrame((_,delta) => {
    // FIX: Only read arrow keys from keyState — never blocked by chat focus guard
    if(keyState['arrowleft'])  camState.yawVel  +=  10*delta;
    if(keyState['arrowright']) camState.yawVel  -=  10*delta;
    if(keyState['arrowup'])    camState.pitchVel -= 10*delta;
    if(keyState['arrowdown'])  camState.pitchVel += 10*delta;
    camState.yawVel  *= 0.82; camState.pitchVel *= 0.82;
    camState.yaw     += camState.yawVel  *delta;
    camState.pitch   += camState.pitchVel*delta;
    camState.pitch    = Math.max(0.1,Math.min(1.4,camState.pitch));
    if (state.isSpectator) {
      camera.position.lerp(new THREE.Vector3(Math.sin(camState.yaw)*30*Math.cos(camState.pitch),30*Math.sin(camState.pitch)+5,Math.cos(camState.yaw)*30*Math.cos(camState.pitch)),5*delta);
      camera.lookAt(0,0,0); return;
    }
    const p = charGroupRefs.current[state.activeCharIdx]?.current; if (!p) return;
    const isHidden = state.chars[state.activeCharIdx]?.hidden;
    const targetDist = isHidden ? 8 : 14;
    camera.position.lerp(new THREE.Vector3(
      p.position.x+Math.sin(camState.yaw)*targetDist*Math.cos(camState.pitch),
      p.position.y+targetDist*Math.sin(camState.pitch)+(isHidden?4:2),
      p.position.z+Math.cos(camState.yaw)*targetDist*Math.cos(camState.pitch),
    ),5*delta);
    camera.lookAt(p.position.x,p.position.y+1.5,p.position.z);
  });
  return null;
}

// ─── Player Controller ────────────────────────────────────────────────────────
function PlayerController() {
  const { state, actions, charGroupRefs, playerPosRef, activeMovingRef } = useContext(GameContext);
  const vel       = useRef(new THREE.Vector3());
  const movingRef = useRef(false);
  const lastSend  = useRef(0);
  const { clock } = useThree();

  useFrame((_,delta) => {
    if (state.phase !== 'play') return;
    if (state.isSpectator) return;

    // FIX: Only read WASD/Q/E when chat is NOT focused
    if (!chatFocused) {
      if (keyState['q'] && !prevKeys.q) { actions.useAbility(state.activeCharIdx); audio.sfx('hide'); }
      prevKeys.q = !!keyState['q'];
    }

    const g = charGroupRefs.current[state.activeCharIdx]?.current; if (!g) return;
    const charCfg   = CHARACTERS[state.activeCharIdx];
    const charState = state.chars[state.activeCharIdx];

    const nearestDoor = BUILDINGS.find(b => Math.hypot(g.position.x - b.x, g.position.z - (b.z+b.d/2)) < 3);
    actions.setNearDoor(!!nearestDoor);

    if (!chatFocused) {
      if (nearestDoor && keyState['e'] && !prevKeys.e) { actions.toggleHide(); audio.sfx('hide'); }
      prevKeys.e = !!keyState['e'];
    }

    const mx = (!chatFocused ? ((keyState['a']?-1:0)+(keyState['d']?1:0)) : 0);
    const mz = (!chatFocused ? ((keyState['w']?-1:0)+(keyState['s']?1:0)) : 0);

    if ((mx!==0||mz!==0) && charState.hidden) { actions.unhide(); }

    if (!charState.hidden) {
      const boosted   = Date.now() < (charState.speedBoostEnd||0);
      const baseSpeed = charCfg.speed * (boosted ? 1.6 : 1.0);
      const acF = Math.min(1,CONFIG.ACCEL*delta);
      const dcF = Math.min(1,CONFIG.DECEL*delta);

      if (mx||mz) {
        const angle = Math.atan2(mx,mz)+camState.yaw;
        vel.current.x = THREE.MathUtils.lerp(vel.current.x,Math.sin(angle)*baseSpeed,acF);
        vel.current.z = THREE.MathUtils.lerp(vel.current.z,Math.cos(angle)*baseSpeed,acF);
      } else {
        vel.current.x = THREE.MathUtils.lerp(vel.current.x,0,dcF);
        vel.current.z = THREE.MathUtils.lerp(vel.current.z,0,dcF);
      }

      vel.current.y -= CONFIG.GRAVITY*delta;

      const charRadius = 0.6;
      let nextX = Math.max(-CONFIG.BOUNDS,Math.min(CONFIG.BOUNDS,g.position.x+vel.current.x*delta));
      let nextZ = Math.max(-CONFIG.BOUNDS,Math.min(CONFIG.BOUNDS,g.position.z+vel.current.z*delta));
      let hitX=false, hitZ=false;

      BUILDINGS.forEach(b => {
        const minX=b.x-b.w/2-charRadius, maxX=b.x+b.w/2+charRadius;
        const minZ=b.z-b.d/2-charRadius, maxZ=b.z+b.d/2+charRadius;
        if (nextX>minX&&nextX<maxX&&g.position.z>minZ&&g.position.z<maxZ) {
          hitX=true; g.position.x=g.position.x<b.x?minX-0.05:maxX+0.05;
        }
        if (g.position.x>minX&&g.position.x<maxX&&nextZ>minZ&&nextZ<maxZ) {
          hitZ=true; g.position.z=g.position.z<b.z?minZ-0.05:maxZ+0.05;
        }
      });

      if (!hitX) g.position.x=nextX; else vel.current.x=0;
      if (!hitZ) g.position.z=nextZ; else vel.current.z=0;

      g.position.y += vel.current.y*delta;
      if (g.position.y<=0) { g.position.y=0; vel.current.y=0; }

      // FIX: only jump when chat not focused
      if (!chatFocused && keyState[' '] && g.position.y<=0.01) vel.current.y=CONFIG.JUMP_FORCE;

      const spd2D = Math.hypot(vel.current.x,vel.current.z);
      movingRef.current = spd2D > 0.5;
      if (movingRef.current) g.rotation.y = THREE.MathUtils.lerp(g.rotation.y,Math.atan2(vel.current.x,vel.current.z),Math.min(1,15*delta));
    } else {
      vel.current.set(0,0,0); movingRef.current=false;
    }

    activeMovingRef.current = movingRef.current;
    playerPosRef.current.copy(g.position);

    if (!charState?.done && !charState.hidden) {
      if (g.position.distanceTo(charCfg.dest) < CONFIG.DEST_RADIUS) {
        actions.charArrived(charCfg.id);
        actions.showQuip(`${charCfg.emoji} ${charCfg.name} made it to ${charCfg.goal}!`);
        audio.sfx('arrive');
        g.position.copy(charCfg.dest);
        vel.current.set(0,0,0);
      }
    }

    state.powerUps.forEach(pu => {
      if (!pu.active) return;
      if (Math.hypot(g.position.x-pu.x,g.position.z-pu.z) < CONFIG.PICKUP_RADIUS) {
        actions.collectPowerUp(pu.id,pu.type,state.activeCharIdx);
        actions.showQuip(`${POWERUP_CONFIG[pu.type].emoji} ${POWERUP_CONFIG[pu.type].label}!`);
        audio.sfx('pickup');
      }
    });

    if (ablyChannel && clock.elapsedTime - lastSend.current > 0.05) {
      ablyChannel.publish('move', {
        position: { x:g.position.x, y:g.position.y, z:g.position.z },
        rotation: { y:g.rotation.y },
        isMoving: movingRef.current,
        charId: charCfg.id,
      });
      lastSend.current = clock.elapsedTime;
    }
  });
  return null;
}

// ─── Characters Render ────────────────────────────────────────────────────────
function SimpsonsCharacters() {
  const { state, charGroupRefs, activeMovingRef, networkMovingRefs } = useContext(GameContext);
  return (
    <>
      {CHARACTERS.map((charCfg,idx) => {
        const charSt  = state.chars[idx];
        const isActive = idx===state.activeCharIdx && !state.isSpectator;
        const moveRef = useRef(false);
        useFrame(()=>{ moveRef.current = isActive ? activeMovingRef.current : networkMovingRefs.current[idx]; });
        return (
          <group key={charCfg.id} ref={charGroupRefs.current[idx]} position={charCfg.startPos.toArray()}>
            {charSt?.shieldActive && !charSt?.hidden && (
              <mesh><sphereGeometry args={[1.8,16,16]} /><meshBasicMaterial color="#aaaaff" transparent opacity={0.25} side={THREE.DoubleSide} /></mesh>
            )}
            <SimpsonsRig charCfg={charCfg} npcMovingRef={moveRef} isHidden={charSt?.hidden} />
            {charSt?.hidden && (
              <Html position={[0,2,0]} center><div style={{background:'rgba(0,0,0,0.8)',color:'white',padding:'4px 10px',borderRadius:10,fontWeight:'bold',border:'2px solid yellow'}}>👀 HIDDEN!</div></Html>
            )}
            {!charSt?.hidden && (
              <Html position={[0,2.9,0]} center occlude>
                <div style={{background:isActive?charCfg.shirt:'rgba(0,0,0,0.6)',color:isActive?'#111':'#fff',padding:'2px 10px',borderRadius:12,fontSize:12,border:`3px solid ${isActive?'#FFD90F':'#555'}`,fontWeight:'bold',pointerEvents:'none',whiteSpace:'nowrap',opacity:charSt?.done?0.4:1}}>
                  {charCfg.emoji} {charCfg.name} {charSt?.done?'✅':isActive?'◀ (YOU)':''}
                </div>
              </Html>
            )}
            {!charSt?.hidden && <ContactShadows opacity={charSt?.done?0.1:0.45} scale={4} blur={2.5} position={[0,0.02,0]} />}
          </group>
        );
      })}
    </>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function GameUI() {
  const { state, actions } = useContext(GameContext);
  const [chatText, setChatText] = useState('');
  const [ablyStatus, setAblyStatus] = useState('disconnected');

  const startGame = () => { audio.init(); audio.playBGM(); actions.setPhase('play'); };

  // Ably connection setup
  useEffect(() => {
    if (ABLY_API_KEY === 'YOUR_ABLY_API_KEY_HERE') {
      setAblyStatus('no_key');
      return;
    }
    // Dynamically load Ably SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.ably.com/lib/ably.min-2.js';
    script.onload = () => {
      try {
        const playerId = 'player_' + Math.random().toString(36).slice(2, 8);
        actions.setMyPlayerId(playerId);

        ablyClient = new window.Ably.Realtime({ key: ABLY_API_KEY, clientId: playerId });
        ablyChannel = ablyClient.channels.get(`springfield:${ROOM_ID}`);

        ablyClient.connection.on('connected', () => {
          setAblyStatus('connected');
          // Assign self a character slot based on presence
          ablyChannel.presence.enter({ playerId });
          ablyChannel.presence.get((err, members) => {
            if (err) return;
            const count = members.length;
            if (count > 4) {
              actions.setAssignedCharacter('spectator');
              actions.addChatMessage({ name: 'SYSTEM', text: 'Room full — joined as spectator.' });
            } else {
              const charId = CHARACTERS[count - 1]?.id;
              if (charId) {
                actions.setAssignedCharacter(charId);
                actions.addChatMessage({ name: 'SYSTEM', text: `You are playing as ${CHARACTERS[count-1].name}!` });
              }
            }
          });
        });

        ablyClient.connection.on('disconnected', () => setAblyStatus('disconnected'));
        ablyClient.connection.on('failed',       () => setAblyStatus('error'));

        // Other players moving
        ablyChannel.subscribe('move', (msg) => {
          const data = msg.data;
          if (msg.clientId === playerId) return; // ignore own messages
          const idx = CHARACTERS.findIndex(c => c.id === data.charId);
          if (idx !== -1) {
            // We store network position in a separate ref updated each frame
            const el = document.getElementById(`__netpos_${data.charId}`);
            if (el) {
              el.dataset.x = data.position.x;
              el.dataset.y = data.position.y;
              el.dataset.z = data.position.z;
              el.dataset.ry = data.rotation.y;
              el.dataset.moving = data.isMoving ? '1' : '0';
            }
          }
        });

        // Chat
        ablyChannel.subscribe('chat', (msg) => {
          if (msg.clientId === playerId) return;
          actions.addChatMessage({ name: msg.clientId, text: msg.data });
        });

        // Presence leave — show message
        ablyChannel.presence.subscribe('leave', (member) => {
          actions.addChatMessage({ name: 'SYSTEM', text: `${member.clientId} left.` });
        });

      } catch (e) {
        console.error('Ably init failed:', e);
        setAblyStatus('error');
      }
    };
    document.head.appendChild(script);
    return () => { ablyClient?.close(); };
  }, []);

  if (state.phase === 'start') return (
    <div style={ST.overlay}>
      <div style={ST.modal}>
        <div style={{fontSize:52,marginBottom:6}}>🛸</div>
        <h1 style={{fontFamily:'Impact, Arial Black',fontSize:38,margin:'0 0 4px',color:'#FFD90F',textShadow:'3px 3px 0 #ff0000, 5px 5px 0 #111',letterSpacing:2}}>
          SPRINGFIELD UNDER SIEGE
        </h1>
        <p style={{color:'#555',marginBottom:12,fontSize:15,fontFamily:'Arial, sans-serif'}}>
          Up to 4 players — each saves a different Springfield resident!
        </p>

        {/* Ably status */}
        <div style={{background: ablyStatus==='connected'?'#e8ffe8':ablyStatus==='no_key'?'#fff3cd':'#fff0f0', border:`2px solid ${ablyStatus==='connected'?'#22aa44':ablyStatus==='no_key'?'#cc8800':'#cc4444'}`, borderRadius:10, padding:'8px 14px', marginBottom:14, fontSize:13, fontFamily:'Arial,sans-serif', textAlign:'left'}}>
          {ablyStatus==='connected' && <><b>🟢 Network:</b> Connected to room <b>{ROOM_ID}</b></>}
          {ablyStatus==='disconnected' && <><b>🔴 Network:</b> Connecting…</>}
          {ablyStatus==='error' && <><b>🔴 Network:</b> Connection error — check your API key.</>}
          {ablyStatus==='no_key' && <>
            <b>⚠️ Multiplayer:</b> Add your free Ably API key to enable multiplayer.<br/>
            <span style={{color:'#666'}}>Get one free at <b>ably.com</b> — paste into <code>ABLY_API_KEY</code> at top of file.</span>
          </>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
          {CHARACTERS.map(c=>(
            <div key={c.id} style={{background:'#fffbe6',border:'2px solid #FFD90F',borderRadius:12,padding:'8px 12px',textAlign:'left',fontFamily:'Arial,sans-serif'}}>
              <b style={{fontSize:15}}>{c.emoji} {c.name}</b>
              <div style={{fontSize:12,color:'#666',marginTop:2}}>{c.goalEmoji} {c.goal}</div>
              <div style={{fontSize:11,color:'#999',marginTop:1}}>⚡ {c.abilityLabel}</div>
            </div>
          ))}
        </div>
        <div style={{background:'#f0f0ff',borderRadius:12,padding:'10px 16px',fontSize:13,color:'#556',marginBottom:18,fontFamily:'Arial, sans-serif',textAlign:'left'}}>
          <b>Controls:</b> WASD move · Space jump · Q use ability<br/>
          Arrow keys rotate camera · <b>E</b> near building door to hide
        </div>
        <button style={ST.startBtn} onClick={startGame}>🛸 START THE SIMULATION</button>
      </div>
    </div>
  );

  if (state.phase === 'win') return (
    <div style={ST.overlay}>
      <div style={ST.modal}>
        <div style={{fontSize:60}}>🎉</div>
        <h1 style={{fontFamily:'Impact',fontSize:40,color:'#22aa44'}}>SPRINGFIELD SAVED!</h1>
        <p style={{fontSize:20}}>Score: <b>{state.score}</b></p>
        <button style={ST.startBtn} onClick={()=>{ actions.reset(); }}>Play Again</button>
      </div>
    </div>
  );

  if (state.phase === 'gameover') return (
    <div style={ST.overlay}>
      <div style={ST.modal}>
        <div style={{fontSize:60}}>💀</div>
        <h1 style={{fontFamily:'Impact',fontSize:40,color:'#cc2222'}}>GAME OVER</h1>
        <p style={{fontSize:20}}>Score: <b>{state.score}</b></p>
        <button style={ST.startBtn} onClick={()=>{ actions.reset(); }}>Try Again</button>
      </div>
    </div>
  );

  const completedCount = state.chars.filter(c => c.done).length;
  return (
    <>
      {/* Hidden DOM nodes for network position passing (avoids React state thrash on 20Hz updates) */}
      {CHARACTERS.map(c => <div key={c.id} id={`__netpos_${c.id}`} style={{display:'none'}} data-x="0" data-y="0" data-z="0" data-ry="0" data-moving="0" />)}

      {state.quip && <div style={ST.quip}>{state.quip}</div>}

      {state.nearDoor && !state.isSpectator && !state.chars[state.activeCharIdx].hidden && (
        <div style={{position:'absolute',top:'60%',left:'50%',transform:'translateX(-50%)',background:'rgba(255,255,255,0.9)',padding:'10px 20px',borderRadius:10,border:'3px solid #7B3F00',fontWeight:'bold',fontSize:18,zIndex:60}}>
          Press <kbd style={ST.kbd}>E</kbd> to Hide in Building
        </div>
      )}

      {state.isSpectator && (
        <div style={{position:'absolute',top:'10%',left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,0.8)',color:'white',padding:'10px 20px',borderRadius:10,border:'2px solid red',fontWeight:'bold',fontSize:18,zIndex:60}}>
          👀 SPECTATOR MODE
        </div>
      )}

      {!state.isSpectator && (
        <div style={ST.topLeft}>
          <div style={{fontSize:22,letterSpacing:3}}>{'❤️'.repeat(state.lives)}{'🖤'.repeat(Math.max(0,3-state.lives))}</div>
          <div style={{fontSize:13,color:'#666',marginTop:2,fontFamily:'Arial,sans-serif'}}>Score: <b>{state.score}</b></div>
        </div>
      )}

      <div style={ST.topRight}>
        <div style={{fontSize:12,fontWeight:'bold',marginBottom:4,color:'#555',fontFamily:'Arial Black'}}>ROSTER STATUS</div>
        {CHARACTERS.map((c,i)=>{
          const cs = state.chars[i]; const isAct = i===state.activeCharIdx && !state.isSpectator;
          return (
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 8px',borderRadius:8,marginBottom:3,background:isAct?'#fffbe6':'rgba(255,255,255,0.4)',border:`2px solid ${isAct?'#FFD90F':'transparent'}`,opacity:cs?.done?0.4:1,fontFamily:'Arial, sans-serif',fontSize:13}}>
              <span>{c.emoji}</span><span style={{fontWeight:isAct?'bold':'normal'}}>{c.name}</span>
              {cs?.done&&<span style={{color:'#27ae60'}}>✅</span>}
              {isAct&&!cs?.done&&<span>(You)</span>}
              {cs?.shieldActive&&<span>🛡️</span>}
            </div>
          );
        })}
      </div>

      <div style={ST.goalBox}>
        <span style={{fontWeight:'bold',fontFamily:'Arial Black'}}>🎯 {completedCount}/4 safe</span>
        {!state.isSpectator && state.activeCharIdx < CHARACTERS.length && (
          <span style={{marginLeft:12,color:'#555',fontFamily:'Arial,sans-serif',fontSize:13}}>
            Your Goal: {CHARACTERS[state.activeCharIdx].goalEmoji} {CHARACTERS[state.activeCharIdx].goal}
          </span>
        )}
      </div>

      {/* FIX: Chat uses chatFocused flag instead of document.activeElement checks */}
      <div style={ST.chatArea}>
        <div style={ST.chatLog}>
          {state.chatMessages.map((m,i)=>(<div key={i}><b style={{color:m.name==='SYSTEM'?'#ff4444':'#FFD90F'}}>{m.name}:</b> {m.text}</div>))}
        </div>
        <input
          style={ST.chatInput}
          placeholder="Chat (Enter to send)…"
          value={chatText}
          onFocus={() => { chatFocused = true; }}
          onBlur={()  => { chatFocused = false; }}
          onChange={e => setChatText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && chatText.trim()) {
              actions.addChatMessage({ name: 'You', text: chatText });
              if (ablyChannel) ablyChannel.publish('chat', chatText);
              setChatText('');
              e.target.blur(); // FIX: release focus so WASD resumes immediately
            }
            if (e.key === 'Escape') {
              e.target.blur(); // FIX: Escape also releases focus
            }
          }}
        />
      </div>
    </>
  );
}

// ─── Network Position Sync (reads hidden DOM nodes, updates Three.js refs) ───
function NetworkSync() {
  const { state, charGroupRefs, networkMovingRefs } = useContext(GameContext);
  useFrame(() => {
    if (state.phase !== 'play') return;
    CHARACTERS.forEach((c, idx) => {
      if (idx === state.activeCharIdx && !state.isSpectator) return; // skip own char
      const el = document.getElementById(`__netpos_${c.id}`);
      if (!el) return;
      const g = charGroupRefs.current[idx]?.current;
      if (!g) return;
      const tx = parseFloat(el.dataset.x||0);
      const ty = parseFloat(el.dataset.y||0);
      const tz = parseFloat(el.dataset.z||0);
      const ry = parseFloat(el.dataset.ry||0);
      // Smooth interpolation toward network position
      g.position.x = THREE.MathUtils.lerp(g.position.x, tx, 0.2);
      g.position.y = THREE.MathUtils.lerp(g.position.y, ty, 0.2);
      g.position.z = THREE.MathUtils.lerp(g.position.z, tz, 0.2);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, ry, 0.2);
      networkMovingRefs.current[idx] = el.dataset.moving === '1';
    });
  });
  return null;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function SpringfieldUnderSiege() {
  const store = useSpringfieldStore();

  useEffect(() => {
    // FIX: Keyboard handler no longer checks document.activeElement at all.
    // Chat input uses onFocus/onBlur to set chatFocused, which gates WASD in useFrame.
    // This means keys can NEVER get "stuck" due to focus state being wrong.
    const onDown = e => {
      const k = e.key.toLowerCase();
      keyState[k] = true;
      if (!chatFocused && [' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
        e.preventDefault();
      }
    };
    const onUp = e => {
      keyState[e.key.toLowerCase()] = false;
    };
    // FIX: Also clear ALL keys on window blur (tab switch etc.) to prevent stuck keys
    const onWindowBlur = () => { Object.keys(keyState).forEach(k => { keyState[k] = false; }); };

    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup',   onUp);
    window.addEventListener('blur',    onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
      window.removeEventListener('blur',    onWindowBlur);
    };
  }, []);

  return (
    <div style={{width:'100vw',height:'100vh',position:'relative',background:'#87ceeb'}}>
      <GameContext.Provider value={store}>
        <Canvas shadows dpr={[1,2]} camera={{fov:46,position:[0,12,18]}} gl={{antialias:true,toneMapping:THREE.ACESFilmicToneMapping}}>
          <Suspense fallback={<Html center><div style={{color:'white'}}>Loading…</div></Html>}>
            <Sky sunPosition={[80,40,20]} turbidity={0.4} rayleigh={0.6} mieCoefficient={0.003} />
            <ambientLight intensity={0.5} color="#cceeff" />
            <directionalLight position={[80,60,20]} intensity={1.8} castShadow shadow-mapSize={[2048,2048]} />
            <CityMap />
            {BUILDINGS.map((b,i) => <Building key={i} b={b} />)}
            {CHARACTERS.map((c,i) => <DestinationZone key={c.id} charId={c.id} pos={c.dest} done={store.state.chars[i]?.done} />)}
            {store.state.powerUps.map(pu => <PowerUp key={pu.id} data={pu} />)}
            <SimpsonsCharacters />
            {store.state.phase==='play' && <PlayerController />}
            {store.state.phase==='play' && <AlienSystem />}
            {store.state.phase==='play' && <TrafficSystem />}
            {store.state.phase==='play' && <NetworkSync />}
            <CameraRig />
          </Suspense>
        </Canvas>
        <GameUI />
      </GameContext.Provider>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ST = {
  overlay:   {position:'absolute',inset:0,zIndex:100,background:'linear-gradient(150deg,#0a0a0a,#1a1a1a 50%,#003300)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Arial,sans-serif'},
  modal:     {background:'#fff',padding:36,borderRadius:24,width:'min(92vw,500px)',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'},
  startBtn:  {width:'100%',background:'linear-gradient(135deg,#FFD90F,#ff8800)',color:'#111',border:'none',padding:'16px',borderRadius:16,fontSize:18,fontWeight:900,cursor:'pointer',fontFamily:'Impact, Arial Black',letterSpacing:2,boxShadow:'0 6px 0 #a05500',marginTop:4},
  topLeft:   {position:'absolute',top:20,left:20,background:'rgba(255,255,255,0.9)',padding:'10px 16px',borderRadius:14,border:'3px solid #FFD90F',zIndex:50,boxShadow:'0 4px 10px rgba(0,0,0,0.2)'},
  topRight:  {position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.93)',padding:'10px 14px',borderRadius:14,border:'3px solid #FFD90F',zIndex:50,minWidth:240,boxShadow:'0 4px 10px rgba(0,0,0,0.2)'},
  goalBox:   {position:'absolute',bottom:80,left:'50%',transform:'translateX(-50%)',background:'rgba(255,255,255,0.92)',padding:'8px 20px',borderRadius:20,border:'3px solid #FFD90F',zIndex:50,whiteSpace:'nowrap',boxShadow:'0 4px 10px rgba(0,0,0,0.2)'},
  quip:      {position:'absolute',top:'42%',left:'50%',transform:'translate(-50%,-50%)',background:'rgba(255,220,0,0.95)',color:'#111',padding:'12px 28px',borderRadius:20,fontWeight:'bold',fontSize:18,fontFamily:'Arial Black,sans-serif',zIndex:70,pointerEvents:'none',boxShadow:'0 4px 20px rgba(0,0,0,0.3)',whiteSpace:'nowrap',border:'3px solid #ff8800'},
  chatArea:  {position:'absolute',bottom:20,left:20,zIndex:50,width:280,fontFamily:'Arial,sans-serif',pointerEvents:'auto'},
  chatLog:   {background:'rgba(0,0,0,0.65)',color:'#fff',padding:12,borderRadius:12,height:120,overflowY:'auto',marginBottom:8,fontSize:13,backdropFilter:'blur(8px)'},
  chatInput: {width:'100%',background:'rgba(255,255,255,0.95)',border:'2px solid #ccc',padding:10,borderRadius:10,boxSizing:'border-box',outline:'none',fontFamily:'Arial,sans-serif',color:'#333',fontSize:15},
  kbd:       {background:'#333',color:'#fff',borderRadius:5,padding:'1px 6px',fontFamily:'monospace',fontSize:11},
};
