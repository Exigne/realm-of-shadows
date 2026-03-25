/**
 * 🛸 SPRINGFIELD UNDER SIEGE (Full Version)
 * Features: Traffic, Hiding in Buildings, Full UI, Chat, Aliens
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Instance, Instances, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { io } from 'socket.io-client';

// ─── Multiplayer Config ───────────────────────────────────────────────────────
const SOCKET_URL = "http://192.168.1.129:3001"; // <--- your NAS IP:port
let socket;

const camState = { yaw: Math.PI, pitch: 0.45, yawVel: 0, pitchVel: 0 };
const keyState  = { prevE: false, prevTab: false, prevQ: false };

// ─── Characters ───────────────────────────────────────────────────────────────
const CHARACTERS = [
  {
    id: 'homer', name: 'Homer', emoji: '🍩',
    goal: "Moe's Tavern",           goalEmoji: '🍺',
    speed: 4.8,  maxHits: 4,        
    shirt: '#f5f5f5', pants: '#3355cc', hair: '#1a1a1a',
    dest: new THREE.Vector3(38, 0, 24),
    startPos: new THREE.Vector3(3, 0, 3),
    ability: 'tanky', abilityLabel: 'Extra Tough (4 hits)',
    quip: "D'oh! Not the aliens again!",
  },
  {
    id: 'bart', name: 'Bart', emoji: '🛹',
    goal: 'Springfield Elementary', goalEmoji: '🏫',
    speed: 9.5,  maxHits: 2,        
    shirt: '#ff3333', pants: '#4455dd', hair: '#FFD90F',
    dest: new THREE.Vector3(-38, 0, -28),
    startPos: new THREE.Vector3(-3, 0, 3),
    ability: 'fast', abilityLabel: 'Super Speed',
    quip: "Ay caramba! Eat my shorts, aliens!",
  },
  {
    id: 'lisa', name: 'Lisa', emoji: '🎷',
    goal: 'Public Library',         goalEmoji: '📚',
    speed: 6.2,  maxHits: 2,        
    shirt: '#dd1111', pants: '#dd1111', hair: '#FFD90F',
    dest: new THREE.Vector3(34, 0, -30),
    startPos: new THREE.Vector3(3, 0, -3),
    ability: 'slowtime', abilityLabel: 'Q: Slow Aliens (5s)',
    quip: "Statistically, running is optimal!",
  },
  {
    id: 'marge', name: 'Marge', emoji: '🧹',
    goal: 'Kwik-E-Mart',            goalEmoji: '🏪',
    speed: 5.5,  maxHits: 3,        
    shirt: '#22aa44', pants: '#22aa44', hair: '#1133cc',
    dest: new THREE.Vector3(-34, 0, 28),
    startPos: new THREE.Vector3(-3, 0, -3),
    ability: 'shield', abilityLabel: 'Q: Activate Shield',
    quip: "Hmmmm… I don't like this one bit.",
  },
];

// ─── Springfield Buildings ────────────────────────────────────────────────────
const BUILDINGS = [
  { x: 38, z: 24,  w: 9,  d: 7,  h: 5,  color: '#7B3F00', roof: '#5a2d00', destFor: 'homer', label: "Moe's Tavern"         },
  { x:-38, z:-28,  w:13,  d: 9,  h: 9,  color: '#cc3333', roof: '#aa2222', destFor: 'bart',  label: 'Springfield Elementary' },
  { x: 34, z:-30,  w:11,  d: 8,  h:10,  color: '#3366cc', roof: '#224499', destFor: 'lisa',  label: 'Public Library'         },
  { x:-34, z: 28,  w:10,  d: 7,  h: 5,  color: '#22aa44', roof: '#118833', destFor: 'marge', label: 'Kwik-E-Mart'            },
  { x: 0,  z:-20,  w: 8,  d: 6,  h: 8,  color: '#aaaaaa', roof: '#888888', label: 'City Hall'            },
  { x: 16, z: 10,  w: 6,  d: 5,  h:12,  color: '#ff8800', roof: '#cc6600', label: 'Nuclear Plant'        },
  { x:-15, z: 5,   w: 7,  d: 6,  h: 7,  color: '#cc8855', roof: '#aa6633', label: 'Police Dept'          },
  { x: 6,  z: 18,  w: 5,  d: 5,  h: 5,  color: '#88ccaa', roof: '#66aaaa', label: 'Hospital'             },
  { x:-8,  z:-8,   w: 4,  d: 4,  h: 5,  color: '#ddaa33', roof: '#bb8822', label: 'Krusty Burger'        },
  { x: 12, z:-8,   w: 4,  d: 4,  h: 4,  color: '#dd3333', roof: '#bb1111', label: "Android's Dungeon"    },
  { x:-20, z:-18,  w: 5,  d: 4,  h: 6,  color: '#6688cc', roof: '#4466aa', label: 'Springfield Mall'     },
  { x: 20, z:-12,  w: 5,  d: 5,  h: 5,  color: '#886644', roof: '#664422', label: 'First Church'         },
  { x:-25, z: 0,   w: 6,  d: 4,  h: 4,  color: '#ccaa55', roof: '#aa8833', label: 'Springfield DMV'      },
  { x: 25, z: 5,   w: 5,  d: 4,  h: 7,  color: '#aa55cc', roof: '#883399', label: 'Springfield Coliseum' },
];

const POWERUP_SPAWNS = [
  { x:  0,  z:  0,  type: 'donut'  }, { x: 12,  z: 12,  type: 'emp'    },
  { x:-12,  z: 12,  type: 'speed'  }, { x: 12,  z:-12,  type: 'shield' },
  { x:-12,  z:-12,  type: 'donut'  }, { x:  0,  z: 18,  type: 'emp'    },
  { x:  0,  z:-18,  type: 'speed'  }, { x: 22,  z:  0,  type: 'shield' },
  { x:-22,  z:  0,  type: 'donut'  }, { x: 18,  z:-18,  type: 'speed'  },
  { x:-18,  z: 18,  type: 'emp'    },
];

const POWERUP_CONFIG = {
  donut:  { emoji: '🍩', color: '#ff88bb', label: '+1 Life'     },
  emp:    { emoji: '🛸', color: '#44ffff', label: 'EMP Bomb'    },
  speed:  { emoji: '🏃', color: '#ffff44', label: 'Speed Boost' },
  shield: { emoji: '🛡️', color: '#aaaaff', label: 'Shield'      },
};

const CONFIG = {
  SPEED: 6.5, ACCEL: 12, DECEL: 15, GRAVITY: 35, JUMP_FORCE: 14,
  BOUNDS: 54, DEST_RADIUS: 4.5, PICKUP_RADIUS: 2.4, LASER_HIT_RADIUS: 2.5,
};

// ─── Store ────────────────────────────────────────────────────────────────────
const GameContext = createContext();

function useSpringfieldStore() {
  const charGroupRefs = useRef(CHARACTERS.map(() => React.createRef()));
  const playerPosRef  = useRef(new THREE.Vector3());

  const initChars = () => CHARACTERS.map(c => ({
    id: c.id, hits: 0, done: false,
    shieldActive: false, shieldCharges: 0,
    speedBoostEnd: 0, slowTimeEnd: 0, hidden: false,
  }));
  const initPowerUps = () => POWERUP_SPAWNS.map((p, i) => ({ ...p, id: i, active: true }));

  const [state, setState] = useState({
    phase: 'start', 
    lives: 3,
    activeCharIdx: 0,
    chars: initChars(),
    powerUps: initPowerUps(),
    score: 0,
    alienSlowEnd: 0,
    onlinePlayers: {},
    chatMessages: [],
    quip: null,
    nearDoor: false,
  });

  const actions = useMemo(() => ({
    setPhase: p => setState(s => ({ ...s, phase: p })),
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
    nextChar: () => setState(s => {
      for (let i = 1; i <= CHARACTERS.length; i++) {
        const idx = (s.activeCharIdx + i) % CHARACTERS.length;
        if (!s.chars[idx].done) {
          const chars = [...s.chars];
          chars[s.activeCharIdx] = { ...chars[s.activeCharIdx], hidden: false }; 
          return { ...s, activeCharIdx: idx, chars };
        }
      }
      return s;
    }),
    switchChar: idx => setState(s => {
      if (s.chars[idx]?.done) return s;
      const chars = [...s.chars];
      chars[s.activeCharIdx] = { ...chars[s.activeCharIdx], hidden: false };
      return { ...s, activeCharIdx: idx, chars };
    }),
    charArrived: charId => setState(s => {
      const chars = s.chars.map(c => c.id === charId ? { ...c, done: true, hidden: false } : c);
      const allDone = chars.every(c => c.done);
      let nextIdx = s.activeCharIdx;
      if (!allDone) {
        const cur = CHARACTERS.findIndex(c => c.id === charId);
        for (let i = 1; i <= CHARACTERS.length; i++) {
          const idx = (cur + i) % CHARACTERS.length;
          if (!chars[idx].done) { nextIdx = idx; break; }
        }
      }
      return { ...s, chars, activeCharIdx: nextIdx, score: s.score + 500, phase: allDone ? 'win' : s.phase };
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
      return {
        ...s, powerUps, chars,
        lives:          type === 'donut'  ? Math.min(s.lives + 1, 6) : s.lives,
        alienSlowEnd:   type === 'emp'    ? now + 5000 : s.alienSlowEnd,
      };
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
    reset: () => setState(s => ({
      ...s, phase: 'start', lives: 3, activeCharIdx: 0, score: 0,
      chars: initChars(), powerUps: initPowerUps(), alienSlowEnd: 0, quip: null, nearDoor: false
    })),
    setOnlinePlayers: p => setState(s => ({ ...s, onlinePlayers: p })),
    addChatMessage:   m => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-7), m] })),
  }), []);

  return { state, actions, charGroupRefs, playerPosRef };
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
    const mel = [
      [261.63, 0, 1], [329.63, 1.5, 1], [369.99, 2.5, 1], [440.00, 3.5, 1.5],
      [392.00, 5, 1], [329.63, 6.5, 1], [261.63, 7.5, 1], [220.00, 8.5, 1],
      [185.00, 9.5, 0.5], [185.00, 10, 0.5], [185.00, 10.5, 0.5], [196.00, 11, 2],
    ];
    const note = (f, bOff, dur, t0, vol=0.05, type='sine') => {
      const osc=this.ctx.createOscillator(); const env=this.ctx.createGain();
      const t=t0+bOff*B; const d=dur*B;
      osc.type=type; osc.frequency.value=f;
      env.gain.setValueAtTime(0.001,t); env.gain.linearRampToValueAtTime(vol,t+0.02);
      env.gain.exponentialRampToValueAtTime(0.0001,t+d*0.95);
      osc.connect(env); env.connect(this.master); osc.start(t); osc.stop(t+d+0.05);
    };
    const loop = t => {
      mel.forEach(([f,b,d]) => note(f,b,d,t,0.06,'square')); 
      const next = t + 16*B;
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
      const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900;
      const g=this.ctx.createGain(); g.gain.value=0.2;
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

// ═══════════════════════════════════════════════════════════════════════════════
//  IMPROVED BIPED ANIMATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });
const matSkinYellow = new THREE.MeshStandardMaterial({ color: '#FFD90F', roughness: 0.6 });

function stdMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
}

function useHumanAnim({ velRef, isNPC, npcMovingRef }) {
  const body=useRef(); const head=useRef();
  const armL=useRef(); const armR=useRef();
  const legL=useRef(); const legR=useRef();
  const walk=useRef(0);

  useFrame((_,delta) => {
    let isMoving=false;
    if(isNPC && npcMovingRef) { isMoving=npcMovingRef.current; }
    else if(velRef) { isMoving = Math.hypot(velRef.current.x,velRef.current.z) > 0.5; }

    if(isMoving) walk.current += delta * 15;

    if(body.current) {
      body.current.position.y = 1.0 + (isMoving ? Math.abs(Math.sin(walk.current)) * 0.06 : 0);
      body.current.rotation.z = isMoving ? Math.sin(walk.current) * 0.03 : 0;
      body.current.rotation.y = isMoving ? Math.sin(walk.current * 0.5) * 0.08 : 0;
    }
    if(head.current) {
      head.current.rotation.y = isMoving ? -Math.sin(walk.current * 0.5) * 0.08 : 0;
      head.current.rotation.x = isMoving ? Math.sin(walk.current * 2) * 0.02 : 0;
    }

    const armSwing = Math.sin(walk.current) * 0.7;
    const legSwing = Math.sin(walk.current) * 0.6;

    if(isMoving){
      if(armL.current) { armL.current.rotation.x = armSwing; armL.current.rotation.z = 0.1; }
      if(armR.current) { armR.current.rotation.x = -armSwing; armR.current.rotation.z = -0.1; }
      if(legL.current) legL.current.rotation.x = -legSwing;
      if(legR.current) legR.current.rotation.x = legSwing;
    } else {
      [armL,armR,legL,legR].forEach(r=>{ if(r.current) {
        r.current.rotation.x = THREE.MathUtils.lerp(r.current.rotation.x, 0, 0.1);
        r.current.rotation.z = THREE.MathUtils.lerp(r.current.rotation.z, 0, 0.1);
      }});
    }
  });
  return { body, head, armL, armR, legL, legR };
}

function SimpsonsRig({ charCfg, velRef, isNPC, npcMovingRef, isHidden }) {
  const { body, head, armL, armR, legL, legR } = useHumanAnim({ velRef, isNPC, npcMovingRef });
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

// ─── Environment & Buildings ──────────────────────────────────────────────────

function makeRoadTexture() {
  const S=1024; const c=document.createElement('canvas'); c.width=c.height=S;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#555555'; ctx.fillRect(0,0,S,S);
  for(let i=0;i<8000;i++){
    const x=Math.random()*S, y=Math.random()*S;
    ctx.fillStyle=`rgba(${Math.random()>0.5?80:40},${Math.random()>0.5?80:40},${Math.random()>0.5?80:40},0.08)`;
    ctx.fillRect(x,y,2,2);
  }
  ctx.strokeStyle='rgba(255,220,0,0.55)'; ctx.lineWidth=3; ctx.setLineDash([30,18]);
  for(let i=64;i<S;i+=64){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,S); ctx.stroke(); }
  for(let i=64;i<S;i+=64){ ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(S,i); ctx.stroke(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(8,8); return t;
}

function Terrain() {
  const roadTex = useMemo(makeRoadTexture, []);
  return (
    <mesh name="ground" rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow>
      <planeGeometry args={[160,160,1,1]} />
      <meshStandardMaterial map={roadTex} roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

const _winMat = stdMat('#ffffaa');
const _doorMat = stdMat('#5c3a21');

function Building({ b }) {
  const wallMat = useMemo(() => stdMat(b.color), [b.color]);
  const roofMat = useMemo(() => stdMat(b.roof || '#444'), [b.roof]);
  return (
    <group position={[b.x, 0, b.z]}>
      <mesh material={wallMat} position={[0, b.h/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[b.w, b.h, b.d]} />
      </mesh>
      <mesh material={roofMat} position={[0, b.h+0.2, 0]} castShadow>
        <boxGeometry args={[b.w+0.2, 0.4, b.d+0.2]} />
      </mesh>
      
      <mesh material={_doorMat} position={[0, 1.2, b.d/2 + 0.05]}>
        <boxGeometry args={[1.5, 2.4, 0.1]} />
      </mesh>

      {Array.from({ length: Math.floor(b.h/2) }).map((_, wi) =>
        [-b.w*0.28, b.w*0.28].map((wx, wj) => (
          <mesh key={`w${wi}-${wj}`} material={_winMat} position={[wx, 1.2+wi*1.9, b.d/2+0.05]}>
            <boxGeometry args={[0.5, 0.55, 0.05]} />
          </mesh>
        ))
      )}
      <Html position={[0, b.h+1, 0]} center>
        <div style={{ background:'rgba(0,0,0,0.75)', color:'#fff', padding:'2px 8px', borderRadius:8, fontSize:11, fontWeight:'bold', whiteSpace:'nowrap', pointerEvents:'none', fontFamily:'Arial,sans-serif', border: b.destFor ? '2px solid #FFD90F' : 'none' }}>
          {b.destFor ? '⭐ ' : ''}{b.label}
        </div>
      </Html>
    </group>
  );
}

// ─── Traffic System (NPC Cars) ────────────────────────────────────────────────

function CarMesh({ color }) {
  const bodyMat = useMemo(() => stdMat(color), [color]);
  const tireMat = useMemo(() => stdMat('#222'), []);
  return (
    <group position={[0, 0.5, 0]}>
      <mesh material={bodyMat} position={[0, 0.4, 0]} castShadow><boxGeometry args={[2, 0.8, 4]} /></mesh>
      <mesh material={bodyMat} position={[0, 1.1, -0.2]} castShadow><boxGeometry args={[1.8, 0.8, 2.2]} /></mesh>
      {[[-1, 0, 1.2], [1, 0, 1.2], [-1, 0, -1.2], [1, 0, -1.2]].map((pos, i) => (
        <mesh key={i} material={tireMat} position={pos} rotation={[0, 0, Math.PI/2]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
        </mesh>
      ))}
    </group>
  );
}

function TrafficSystem() {
  const { state, actions, playerPosRef } = useContext(GameContext);
  
  const carData = useMemo(() => [
    { id: 1, color: '#e74c3c', speed: 12, bounds: { xMin: -30, xMax: 30, zMin: -16, zMax: 16 }, dir: 'x', pos: [0, 0, 16] },
    { id: 2, color: '#3498db', speed: 10, bounds: { xMin: -45, xMax: 45, zMin: -35, zMax: 35 }, dir: '-z', pos: [45, 0, 0] },
    { id: 3, color: '#f1c40f', speed: 15, bounds: { xMin: -25, xMax: 25, zMin: -25, zMax: 25 }, dir: '-x', pos: [0, 0, -25] }
  ], []);

  const carRefs = useRef(carData.map(() => React.createRef()));

  useFrame((_, delta) => {
    if (state.phase !== 'play') return;
    carData.forEach((car, i) => {
      const g = carRefs.current[i].current;
      if (!g) return;
      if (car.dir === 'x') { g.position.x += car.speed * delta; g.rotation.y = Math.PI/2; if (g.position.x > car.bounds.xMax) { car.dir = 'z'; g.position.x = car.bounds.xMax; } }
      else if (car.dir === 'z') { g.position.z += car.speed * delta; g.rotation.y = 0; if (g.position.z > car.bounds.zMax) { car.dir = '-x'; g.position.z = car.bounds.zMax; } }
      else if (car.dir === '-x') { g.position.x -= car.speed * delta; g.rotation.y = -Math.PI/2; if (g.position.x < car.bounds.xMin) { car.dir = '-z'; g.position.x = car.bounds.xMin; } }
      else if (car.dir === '-z') { g.position.z -= car.speed * delta; g.rotation.y = Math.PI; if (g.position.z < car.bounds.zMin) { car.dir = 'x'; g.position.z = car.bounds.zMin; } }

      if (!state.chars[state.activeCharIdx].hidden && !state.chars[state.activeCharIdx].done) {
        if (g.position.distanceTo(playerPosRef.current) < 2.5) {
          actions.hitChar(state.activeCharIdx);
          actions.showQuip("Watch out for the cars!");
        }
      }
    });
  });

  return (
    <group>
      {carData.map((car, i) => (
        <group key={car.id} ref={carRefs.current[i]} position={car.pos}><CarMesh color={car.color} /></group>
      ))}
    </group>
  );
}

// ─── Destination Zones & Power-Ups ──────────────────────────────────────────

function DestinationZone({ charId, pos, done }) {
  const ring = useRef();
  const charCfg = CHARACTERS.find(c => c.id === charId);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    ring.current.rotation.y = clock.elapsedTime * 1.5;
    ring.current.scale.setScalar(done ? 1.0 : 0.85 + Math.sin(clock.elapsedTime * 3) * 0.15);
  });
  if (done) return null;
  return (
    <group position={[pos.x, 0.1, pos.z]} ref={ring}>
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[CONFIG.DEST_RADIUS - 0.4, CONFIG.DEST_RADIUS, 32]} />
        <meshBasicMaterial color={charCfg?.shirt || '#fff'} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0, 0.3, 0]}><div style={{ fontSize:20 }}>{charCfg?.goalEmoji}</div></Html>
    </group>
  );
}

function PowerUp({ data }) {
  const ref = useRef();
  const cfg = POWERUP_CONFIG[data.type];
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 1.2 + Math.sin(clock.elapsedTime * 2.5 + data.id) * 0.3;
    ref.current.rotation.y = clock.elapsedTime * 2;
  });
  if (!data.active) return null;
  return (
    <group ref={ref} position={[data.x, 1.2, data.z]}>
      <mesh castShadow>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={cfg.color} emissive={cfg.color} emissiveIntensity={0.6} />
      </mesh>
      <Html center position={[0, 0.9, 0]}><div style={{ fontSize:18, pointerEvents:'none' }}>{cfg.emoji}</div></Html>
      <pointLight color={cfg.color} intensity={2} distance={5} decay={2} />
    </group>
  );
}

// ─── Alien UFO & Lasers ───────────────────────────────────────────────────────

function LaserBeam({ laser, onExpire, onHit }) {
  const ref = useRef();
  const hasHit = useRef(false);
  const { state, charGroupRefs } = useContext(GameContext);

  useFrame(() => {
    const age = (Date.now() - laser.startTime) / 500; 
    if (age >= 1) {
      if (!hasHit.current) {
        hasHit.current = true;
        const targetChar = state.chars[state.activeCharIdx];
        const g = charGroupRefs.current[state.activeCharIdx]?.current;
        if (g && !targetChar.hidden) {
          const dist = g.position.distanceTo(new THREE.Vector3(...laser.to));
          if (dist < CONFIG.LASER_HIT_RADIUS) onHit(state.activeCharIdx);
        }
      }
      onExpire(laser.id);
    } else if (ref.current) {
      ref.current.position.lerpVectors(new THREE.Vector3(...laser.from), new THREE.Vector3(...laser.to), age);
    }
  });

  return (
    <mesh ref={ref} position={laser.from}>
      <sphereGeometry args={[0.5, 8, 8]} />
      <meshBasicMaterial color={laser.color} />
      <pointLight color={laser.color} intensity={2} distance={5} />
    </mesh>
  );
}

function AlienUFO({ isSlowed }) {
  const innerRef = useRef();
  useFrame(({ clock }) => { if (innerRef.current) innerRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.3; });
  const col = isSlowed ? '#888' : '#33cc44';
  const domCol = isSlowed ? '#aaa' : '#99ffaa';
  return (
    <>
      <mesh castShadow><cylinderGeometry args={[3.2, 3.8, 0.75, 18]} /><meshStandardMaterial color={col} metalness={0.8} roughness={0.2} /></mesh>
      <mesh position={[0, 0.65, 0]}><sphereGeometry args={[1.6, 16, 8, 0, Math.PI*2, 0, Math.PI/2]} /><meshStandardMaterial color={domCol} transparent opacity={0.7} /></mesh>
      <mesh ref={innerRef} position={[0,-0.3,0]}><cylinderGeometry args={[1.2, 1.2, 0.15, 12]} /><meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={0.5} /></mesh>
      {[0,1,2,3,4,5].map(idx => (<mesh key={idx} position={[Math.cos(idx/6*Math.PI*2)*2.2, 0, Math.sin(idx/6*Math.PI*2)*2.2]}><sphereGeometry args={[0.28, 8, 8]} /><meshBasicMaterial color={isSlowed ? '#444' : '#ffff44'} /></mesh>))}
      <pointLight position={[0,-1,0]} color={isSlowed ? '#334' : '#00ff44'} intensity={isSlowed ? 1 : 5} distance={14} decay={2} />
    </>
  );
}

function UFOController({ ufoId, startX, startZ, activeCharGroupRef, alienSlowEndRef, scoreRef, onFire }) {
  const groupRef = useRef();
  const vel = useRef(new THREE.Vector3((ufoId % 2 === 0 ? 1 : -1) * (0.3 + ufoId * 0.08), 0, (ufoId % 3 === 0 ? 1 : -1) * (0.25 + ufoId * 0.06)));
  const fireTimer = useRef(2.0 + ufoId * 2.8);

  useFrame(({ clock }, delta) => {
    const g = groupRef.current; if (!g) return;
    const slowed = Date.now() < alienSlowEndRef.current;
    const speedMul = slowed ? 0.15 : 1.0;
    g.position.x += vel.current.x * delta * speedMul * 9; g.position.z += vel.current.z * delta * speedMul * 9;
    g.position.y  = 13 + Math.sin(clock.elapsedTime * 0.7 + ufoId * 2.1) * 1.8; g.rotation.y  = clock.elapsedTime * 0.4;
    if (Math.abs(g.position.x) > 48) vel.current.x *= -1; if (Math.abs(g.position.z) > 48) vel.current.z *= -1;

    fireTimer.current -= delta * speedMul;
    if (fireTimer.current <= 0) {
      fireTimer.current = Math.max(1.5, 3.5 - (scoreRef.current / 500)) * (0.7 + Math.random() * 0.6);
      if (activeCharGroupRef?.current) onFire(g.position.clone(), activeCharGroupRef.current.position.clone(), ufoId);
    }
  });
  return (<group ref={groupRef} position={[startX, 13, startZ]}><AlienUFO isSlowed={false} /></group>);
}

function AlienSystem() {
  const { state, actions, charGroupRefs } = useContext(GameContext);
  const [lasers, setLasers]     = useState([]);
  const alienSlowEndRef         = useRef(state.alienSlowEnd);
  const scoreRef                = useRef(state.score);

  useEffect(() => { alienSlowEndRef.current = state.alienSlowEnd; }, [state.alienSlowEnd]);
  useEffect(() => { scoreRef.current = state.score; }, [state.score]);

  const numUFOs = Math.min(3, 1 + Math.floor(state.score / 400));
  const UFO_STARTS = [[-20, -10], [22, 8], [-8, 24]];
  const LASER_COLS = ['#ff2200', '#00ffaa', '#ff00ff'];

  const handleFire = (fromPos, targetPos, ufoId) => {
    const targetChar = state.chars[state.activeCharIdx];
    let finalTarget = targetPos.clone();
    
    if (targetChar.hidden) {
      finalTarget.set(finalTarget.x + (Math.random()-0.5)*20, 0, finalTarget.z + (Math.random()-0.5)*20);
    } else {
      finalTarget.add(new THREE.Vector3((Math.random()-0.5)*5, 0, (Math.random()-0.5)*5));
    }
    audio.sfx('laser');
    setLasers(l => [...l.slice(-12), {
      id: Date.now() + ufoId * 1000 + Math.random(),
      from: [fromPos.x, fromPos.y, fromPos.z], to: [finalTarget.x, 0, finalTarget.z],
      charIdx: state.activeCharIdx, color: LASER_COLS[ufoId] || '#ff2200', startTime: Date.now() 
    }]);
  };

  return (
    <>
      {UFO_STARTS.slice(0, numUFOs).map(([sx, sz], i) => (
        <UFOController key={i} ufoId={i} startX={sx} startZ={sz} activeCharGroupRef={charGroupRefs.current[state.activeCharIdx]} alienSlowEndRef={alienSlowEndRef} scoreRef={scoreRef} onFire={handleFire} />
      ))}
      {lasers.map(l => (
        <LaserBeam key={l.id} laser={l} onExpire={id => setLasers(l => l.filter(x => x.id !== id))} onHit={idx => { actions.hitChar(idx); audio.sfx('hit'); }} />
      ))}
    </>
  );
}

// ─── Camera ──────────────────────────────────────────────────────────────────

function CameraRig() {
  const { state, charGroupRefs } = useContext(GameContext);
  const { camera } = useThree();

  useFrame((_,delta) => {
    if(keyState['arrowleft'])  camState.yawVel  +=  10*delta;
    if(keyState['arrowright']) camState.yawVel  -=  10*delta;
    if(keyState['arrowup'])    camState.pitchVel -= 10*delta;
    if(keyState['arrowdown'])  camState.pitchVel += 10*delta;
    camState.yawVel  *= 0.82; camState.pitchVel *= 0.82;
    camState.yaw     += camState.yawVel   * delta;
    camState.pitch   += camState.pitchVel * delta;
    camState.pitch    = Math.max(0.1, Math.min(1.4, camState.pitch));
    
    const p = charGroupRefs.current[state.activeCharIdx]?.current;
    if (!p) return;
    
    const isHidden = state.chars[state.activeCharIdx]?.hidden;
    const targetDist = isHidden ? 8 : 14;
    
    camera.position.lerp(new THREE.Vector3(
      p.position.x + Math.sin(camState.yaw)*targetDist*Math.cos(camState.pitch),
      p.position.y + targetDist*Math.sin(camState.pitch) + (isHidden ? 4 : 2),
      p.position.z + Math.cos(camState.yaw)*targetDist*Math.cos(camState.pitch),
    ), 5 * delta);
    
    camera.lookAt(p.position.x, p.position.y+1.5, p.position.z);
  });
  return null;
}

// ─── Player Controller ───────────────────────────────────────────────────────

function PlayerController() {
  const { state, actions, charGroupRefs, playerPosRef } = useContext(GameContext);
  const vel          = useRef(new THREE.Vector3());
  const movingRef    = useRef(false);
  const lastSend     = useRef(0);
  const { clock }    = useThree();

  useFrame(({clock}, delta) => {
    if (state.phase !== 'play') return;

    if (keyState['tab'] && !keyState.prevTab) { actions.nextChar(); vel.current.set(0, 0, 0); }
    keyState.prevTab = keyState['tab'];

    if (keyState['q'] && !keyState.prevQ) { actions.useAbility(state.activeCharIdx); audio.sfx('emp'); }
    keyState.prevQ = keyState['q'];

    const g = charGroupRefs.current[state.activeCharIdx]?.current;
    if (!g) return;

    const charCfg   = CHARACTERS[state.activeCharIdx];
    const charState = state.chars[state.activeCharIdx];

    const nearestDoor = BUILDINGS.find(b => Math.hypot(g.position.x - b.x, g.position.z - (b.z + b.d/2)) < 3);
    actions.setNearDoor(!!nearestDoor);

    if (nearestDoor && keyState['e'] && !keyState.prevE) {
      actions.toggleHide();
      audio.sfx('hide');
    }
    keyState.prevE = keyState['e'];

    const mx = (keyState['a']?-1:0) + (keyState['d']?1:0);
    const mz = (keyState['w']?-1:0) + (keyState['s']?1:0);

    if ((mx !== 0 || mz !== 0) && charState.hidden) { actions.unhide(); }

    if (!charState.hidden) {
      const boosted   = Date.now() < (charState.speedBoostEnd || 0);
      const baseSpeed = charCfg.speed * (boosted ? 1.6 : 1.0);
      const acF = Math.min(1, CONFIG.ACCEL * delta);
      const dcF = Math.min(1, CONFIG.DECEL * delta);

      if (mx || mz) {
        const angle = Math.atan2(mx, mz) + camState.yaw;
        vel.current.x = THREE.MathUtils.lerp(vel.current.x, Math.sin(angle)*baseSpeed, acF);
        vel.current.z = THREE.MathUtils.lerp(vel.current.z, Math.cos(angle)*baseSpeed, acF);
      } else {
        vel.current.x = THREE.MathUtils.lerp(vel.current.x, 0, dcF);
        vel.current.z = THREE.MathUtils.lerp(vel.current.z, 0, dcF);
      }

      vel.current.y -= CONFIG.GRAVITY * delta;
      g.position.x = Math.max(-CONFIG.BOUNDS, Math.min(CONFIG.BOUNDS, g.position.x + vel.current.x * delta));
      g.position.z = Math.max(-CONFIG.BOUNDS, Math.min(CONFIG.BOUNDS, g.position.z + vel.current.z * delta));
      g.position.y += vel.current.y * delta;
      if (g.position.y <= 0) { g.position.y = 0; vel.current.y = 0; }
      if (keyState[' '] && g.position.y <= 0.01) vel.current.y = CONFIG.JUMP_FORCE;

      const spd2D = Math.hypot(vel.current.x, vel.current.z);
      movingRef.current = spd2D > 0.5;
      if (movingRef.current) g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), Math.min(1, 15*delta));
    } else {
      vel.current.set(0,0,0);
      movingRef.current = false;
    }

    playerPosRef.current.copy(g.position);

    if (!charState?.done && !charState.hidden) {
      if (g.position.distanceTo(charCfg.dest) < CONFIG.DEST_RADIUS) {
        actions.charArrived(charCfg.id);
        actions.showQuip(`${charCfg.emoji} ${charCfg.name} made it to ${charCfg.goal}!`);
        audio.sfx('arrive');
        g.position.copy(charCfg.dest);
        vel.current.set(0, 0, 0);
      }
    }

    state.powerUps.forEach(pu => {
      if (!pu.active) return;
      if (Math.hypot(g.position.x - pu.x, g.position.z - pu.z) < CONFIG.PICKUP_RADIUS) {
        actions.collectPowerUp(pu.id, pu.type, state.activeCharIdx);
        actions.showQuip(`${POWERUP_CONFIG[pu.type].emoji} ${POWERUP_CONFIG[pu.type].label}!`);
        audio.sfx('pickup');
      }
    });

    if (socket && clock.elapsedTime - lastSend.current > 0.05) {
      socket.emit('move', { position: g.position, rotation: { y: g.rotation.y }, isMoving: movingRef.current, charId: charCfg.id });
      lastSend.current = clock.elapsedTime;
    }
  });
  return null;
}

// ─── Render Simpsons Characters ───────────────────────────────────────────────

function SimpsonsCharacters() {
  const { state, charGroupRefs } = useContext(GameContext);

  return (
    <>
      {CHARACTERS.map((charCfg, idx) => {
        const charSt  = state.chars[idx];
        const isActive = idx === state.activeCharIdx;
        
        if (!isActive && !charSt?.done) return null;

        return (
          <group key={charCfg.id} ref={charGroupRefs.current[idx]} position={charCfg.startPos.toArray()}>
            {charSt?.shieldActive && !charSt?.hidden && (
              <mesh><sphereGeometry args={[1.8, 16, 16]} /><meshBasicMaterial color="#aaaaff" transparent opacity={0.25} side={THREE.DoubleSide} /></mesh>
            )}
            
            <SimpsonsRig charCfg={charCfg} isNPC={!isActive || state.phase !== 'play'} npcMovingRef={{ current: false }} isHidden={charSt?.hidden} />
            
            {charSt?.hidden && (
               <Html position={[0, 2, 0]} center><div style={{ background:'rgba(0,0,0,0.8)', color:'white', padding:'4px 10px', borderRadius:10, fontWeight:'bold', border:'2px solid yellow' }}>👀 HIDDEN!</div></Html>
            )}

            {!charSt?.hidden && (
              <Html position={[0, 2.9, 0]} center occlude>
                <div style={{ background: isActive ? charCfg.shirt : 'rgba(0,0,0,0.6)', color: isActive ? '#111' : '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12, border: `3px solid ${isActive ? '#FFD90F' : '#555'}`, fontWeight: 'bold', pointerEvents: 'none', whiteSpace: 'nowrap', opacity: charSt?.done ? 0.4 : 1 }}>
                  {charCfg.emoji} {charCfg.name} {charSt?.done ? '✅' : isActive ? '◀' : ''}
                </div>
              </Html>
            )}
            {!charSt?.hidden && <ContactShadows opacity={charSt?.done ? 0.1 : 0.45} scale={4} blur={2.5} position={[0,0.02,0]} />}
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

  const startGame = () => { audio.init(); audio.playBGM(); actions.setPhase('play'); };

  if (state.phase === 'start') return (
    <div style={ST.overlay}>
      <div style={ST.modal}>
        <div style={{ fontSize: 52, marginBottom: 6 }}>🛸</div>
        <h1 style={{ fontFamily:'Impact, Arial Black', fontSize: 38, margin: '0 0 4px', color: '#FFD90F', textShadow: '3px 3px 0 #ff0000, 5px 5px 0 #111', letterSpacing: 2 }}>
          SPRINGFIELD UNDER SIEGE
        </h1>
        <p style={{ color: '#555', marginBottom: 20, fontSize: 15, fontFamily: 'Arial, sans-serif' }}>
          Help the Simpsons reach their destinations — before Kang & Kodos blast them!
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
          {CHARACTERS.map(c => (
            <div key={c.id} style={{ background:'#fffbe6', border:'2px solid #FFD90F', borderRadius:12, padding:'8px 12px', textAlign:'left', fontFamily:'Arial,sans-serif' }}>
              <b style={{ fontSize:15 }}>{c.emoji} {c.name}</b>
              <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{c.goalEmoji} {c.goal}</div>
              <div style={{ fontSize:11, color:'#999', marginTop:1 }}>⚡ {c.abilityLabel}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#f0f0ff', borderRadius:12, padding:'10px 16px', fontSize:13, color:'#556', marginBottom:18, fontFamily:'Arial, sans-serif', textAlign:'left' }}>
          <b>Controls:</b> WASD move · Space jump · <b>Tab switch character</b> · Q use ability<br/>
          Arrow keys rotate camera · <b>E</b> to hide in buildings · Collect power-ups!
        </div>

        <button style={ST.startBtn} onClick={startGame}>🛸 START — SAVE THE SIMPSONS!</button>
      </div>
    </div>
  );

  if (state.phase === 'win') return (
    <div style={ST.overlay}>
      <div style={{ ...ST.modal, maxWidth: 440 }}>
        <div style={{ fontSize: 60 }}>🏆</div>
        <h1 style={{ fontFamily:'Impact, Arial Black', fontSize:38, color:'#FFD90F', textShadow:'2px 2px 0 #ff8800', margin:'8px 0' }}>EXCELLENT!</h1>
        <p style={{ fontFamily:'Arial,sans-serif', color:'#333', fontSize:18 }}>All Simpsons reached safety!</p>
        <p style={{ fontFamily:'Arial,sans-serif', fontSize:22, fontWeight:'bold', color:'#e74c3c' }}>Score: {state.score}</p>
        <button style={ST.startBtn} onClick={() => { actions.reset(); setTimeout(() => actions.setPhase('play'), 100); }}>🔄 Play Again</button>
      </div>
    </div>
  );

  if (state.phase === 'gameover') return (
    <div style={{ ...ST.overlay, background:'linear-gradient(180deg,#1a0000,#330000)' }}>
      <div style={{ ...ST.modal, maxWidth: 420, border:'4px solid #ff0000' }}>
        <div style={{ fontSize:60 }}>💀</div>
        <h1 style={{ fontFamily:'Impact, Arial Black', fontSize:40, color:'#ff2222', textShadow:'2px 2px 0 #000', margin:'8px 0' }}>D'OH!</h1>
        <p style={{ fontFamily:'Arial,sans-serif', color:'#555', fontSize:16 }}>The aliens got the Simpsons!</p>
        <p style={{ fontFamily:'Arial,sans-serif', fontSize:20, fontWeight:'bold', color:'#333' }}>Final Score: {state.score}</p>
        <button style={{ ...ST.startBtn, background:'#cc0000' }} onClick={() => { actions.reset(); setTimeout(() => actions.setPhase('play'), 100); }}>🔄 Try Again</button>
      </div>
    </div>
  );

  const completedCount = state.chars.filter(c => c.done).length;

  return (
    <>
      {state.quip && <div style={ST.quip}>{state.quip}</div>}
      
      {state.nearDoor && !state.chars[state.activeCharIdx].hidden && (
         <div style={{ position:'absolute', top:'60%', left:'50%', transform:'translateX(-50%)', background:'rgba(255,255,255,0.9)', padding:'10px 20px', borderRadius:10, border:'3px solid #7B3F00', fontWeight:'bold', fontSize:18, zIndex: 60 }}>
           Press <kbd style={ST.kbd}>E</kbd> to Hide in Building
         </div>
      )}

      <div style={ST.topLeft}>
        <div style={{ fontSize:22, letterSpacing:3 }}>{'❤️'.repeat(state.lives)}{'🖤'.repeat(Math.max(0, 3-state.lives))}</div>
        <div style={{ fontSize:13, color:'#666', marginTop:2, fontFamily:'Arial,sans-serif' }}>Score: <b>{state.score}</b></div>
      </div>

      <div style={ST.topRight}>
        <div style={{ fontSize:12, fontWeight:'bold', marginBottom:4, color:'#555', fontFamily:'Arial Black' }}>SPRINGFIELD FAMILY</div>
        {CHARACTERS.map((c, i) => {
          const cs   = state.chars[i];
          const isAct = i === state.activeCharIdx;
          const speedOn = Date.now() < (cs?.speedBoostEnd || 0);
          const slowOn  = Date.now() < (cs?.slowTimeEnd   || 0);
          return (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 8px', borderRadius:8, marginBottom:3, background: isAct ? '#fffbe6' : 'rgba(255,255,255,0.4)', border: isAct ? '2px solid #FFD90F' : '2px solid transparent', opacity: cs?.done ? 0.4 : 1, fontFamily: 'Arial, sans-serif', fontSize: 13, cursor: 'pointer' }} onClick={() => actions.switchChar(i)}>
              <span>{c.emoji}</span>
              <span style={{ fontWeight: isAct ? 'bold' : 'normal' }}>{c.name}</span>
              {cs?.done && <span style={{ color:'#27ae60' }}>✅</span>}
              {isAct && !cs?.done && <span>▶</span>}
              {cs?.shieldActive && <span title="Shield active">🛡️</span>}
              {speedOn && <span title="Speed boost">🏃</span>}
              {slowOn  && <span title="Slow time active">🕐</span>}
              <span style={{ marginLeft:'auto', color:'#999', fontSize:11 }}>{c.goalEmoji} {c.goal.split(' ')[0]}...</span>
            </div>
          );
        })}
        <div style={{ marginTop:4, fontSize:11, color:'#888', fontFamily:'Arial,sans-serif' }}><kbd style={ST.kbd}>Tab</kbd> switch · <kbd style={ST.kbd}>Q</kbd> ability</div>
      </div>

      <div style={ST.goalBox}>
        <span style={{ fontWeight:'bold', fontFamily:'Arial Black' }}>🎯 {completedCount}/4 safe</span>
        {state.activeCharIdx < CHARACTERS.length && (
          <span style={{ marginLeft:12, color:'#555', fontFamily:'Arial,sans-serif', fontSize:13 }}>
            {CHARACTERS[state.activeCharIdx].emoji} {CHARACTERS[state.activeCharIdx].name} → {CHARACTERS[state.activeCharIdx].goalEmoji} {CHARACTERS[state.activeCharIdx].goal}
          </span>
        )}
      </div>

      <div style={ST.chatArea}>
        <div style={ST.chatLog}>
          {state.chatMessages.map((m,i) => (<div key={i}><b style={{ color: '#FFD90F' }}>{m.name}:</b> {m.text}</div>))}
        </div>
        <input style={ST.chatInput} placeholder="Chat..." value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter' && chatText.trim()) {
            actions.addChatMessage({ name: 'You', text: chatText });
            if (socket) socket.emit('chat', chatText);
            setChatText('');
          }
        }} />
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function SpringfieldUnderSiege() {
  const store = useSpringfieldStore();

  useEffect(() => {
    const onDown = e => {
      if (document.activeElement?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase(); keyState[k] = true;
      if ([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k)) e.preventDefault();
    };
    const onUp = e => { keyState[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onDown, { passive: false }); window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#87ceeb' }}>
      <GameContext.Provider value={store}>
        <Canvas shadows dpr={[1,2]} camera={{ fov:46, position:[0,12,18] }} gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping }}>
          <Suspense fallback={<Html center><div style={{ color:'white' }}>Loading...</div></Html>}>
            <Sky sunPosition={[80, 40, 20]} turbidity={0.4} rayleigh={0.6} mieCoefficient={0.003} />
            <ambientLight intensity={0.5} color="#cceeff" />
            <directionalLight position={[80, 60, 20]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} />
            
            <Terrain />
            {BUILDINGS.map((b, i) => <Building key={i} b={b} />)}
            {CHARACTERS.map((c, i) => <DestinationZone key={c.id} charId={c.id} pos={c.dest} done={store.state.chars[i]?.done} />)}
            {store.state.powerUps.map(pu => <PowerUp key={pu.id} data={pu} />)}
            
            <SimpsonsCharacters />
            {store.state.phase === 'play' && <PlayerController />}
            {store.state.phase === 'play' && <AlienSystem />}
            {store.state.phase === 'play' && <TrafficSystem />}
            
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
  overlay:   { position:'absolute', inset:0, zIndex:100, background:'linear-gradient(150deg,#0a0a0a,#1a1a1a 50%,#003300)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Arial,sans-serif' },
  modal:     { background:'#fff', padding:36, borderRadius:24, width:'min(92vw,500px)', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' },
  startBtn:  { width:'100%', background:'linear-gradient(135deg,#FFD90F,#ff8800)', color:'#111', border:'none', padding:'16px', borderRadius:16, fontSize:18, fontWeight:900, cursor:'pointer', fontFamily:'Impact, Arial Black', letterSpacing:2, boxShadow:'0 6px 0 #a05500', marginTop:4 },
  topLeft:   { position:'absolute', top:20, left:20, background:'rgba(255,255,255,0.9)', padding:'10px 16px', borderRadius:14, border:'3px solid #FFD90F', zIndex:50, boxShadow:'0 4px 10px rgba(0,0,0,0.2)' },
  topRight:  { position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.93)', padding:'10px 14px', borderRadius:14, border:'3px solid #FFD90F', zIndex:50, minWidth:240, boxShadow:'0 4px 10px rgba(0,0,0,0.2)' },
  goalBox:   { position:'absolute', bottom:80, left:'50%', transform:'translateX(-50%)', background:'rgba(255,255,255,0.92)', padding:'8px 20px', borderRadius:20, border:'3px solid #FFD90F', zIndex:50, whiteSpace:'nowrap', boxShadow:'0 4px 10px rgba(0,0,0,0.2)' },
  quip:      { position:'absolute', top:'42%', left:'50%', transform:'translate(-50%,-50%)', background:'rgba(255,220,0,0.95)', color:'#111', padding:'12px 28px', borderRadius:20, fontWeight:'bold', fontSize:18, fontFamily:'Arial Black,sans-serif', zIndex:70, pointerEvents:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', whiteSpace:'nowrap', border:'3px solid #ff8800' },
  chatArea:  { position:'absolute', bottom:20, left:20, zIndex:5, width:280, fontFamily:'Arial,sans-serif', pointerEvents:'auto' },
  chatLog:   { background:'rgba(0,0,0,0.65)', color:'#fff', padding:12, borderRadius:12, height:120, overflowY:'auto', marginBottom:8, fontSize:13, backdropFilter:'blur(8px)' },
  chatInput: { width:'100%', background:'rgba(255,255,255,0.95)', border:'none', padding:10, borderRadius:10, boxSizing:'border-box', outline:'none', fontFamily:'Arial,sans-serif', color:'#333', fontSize:15 },
  kbd:       { background:'#333', color:'#fff', borderRadius:5, padding:'1px 6px', fontFamily:'monospace', fontSize:11 },
};
