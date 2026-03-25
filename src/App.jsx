/**
 * 🛸 SPRINGFIELD UNDER SIEGE
 * Help the Simpsons reach their destinations while Kang & Kodos attack!
 *
 * ENGINE: identical to Take That (movement, physics, camera, biped rig, audio)
 * CHANGED: theme, map, characters, alien enemies, lives, destinations, power-ups
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Stars,
  Instance, Instances, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import * as Ably from 'ably';

// ─── Multiplayer Config ───────────────────────────────────────────────────────
const ABLY_API_KEY = "46Xc5g.G1zGDw:J-HBgtccChbl-Z-fXrlUv6X_bl-cweiSQu9_dWwfbTU"; 
let ablyClient;
let ablyChannel;

// ─── Springfield is FLAT (city, not island) ───────────────────────────────────
function getTerrainY() { return 0; }

// ─── Camera & key state (identical to original) ──────────────────────────────
const camState = { yaw: Math.PI, pitch: 0.45, yawVel: 0, pitchVel: 0 };
const keyState  = { prevE: false, prevTab: false, prevQ: false };

// ─── Characters ───────────────────────────────────────────────────────────────
const CHARACTERS = [
  {
    id: 'homer', name: 'Homer', emoji: '🍩',
    goal: "Moe's Tavern",           goalEmoji: '🍺',
    speed: 4.8,  maxHits: 4,        // tanky — takes 4 hits
    shirt: '#f5f5f5', pants: '#3355cc', hair: '#1a1a1a',
    dest: new THREE.Vector3(38, 0, 24),
    startPos: new THREE.Vector3(3, 0, 3),
    ability: 'tanky',
    abilityLabel: 'Extra Tough (4 hits)',
    quip: "D'oh! Not the aliens again!",
  },
  {
    id: 'bart', name: 'Bart', emoji: '🛹',
    goal: 'Springfield Elementary', goalEmoji: '🏫',
    speed: 9.5,  maxHits: 2,        // fast
    shirt: '#ff3333', pants: '#4455dd', hair: '#FFD90F',
    dest: new THREE.Vector3(-38, 0, -28),
    startPos: new THREE.Vector3(-3, 0, 3),
    ability: 'fast',
    abilityLabel: 'Super Speed',
    quip: "Ay caramba! Eat my shorts, aliens!",
  },
  {
    id: 'lisa', name: 'Lisa', emoji: '🎷',
    goal: 'Public Library',         goalEmoji: '📚',
    speed: 6.2,  maxHits: 2,        // Q = slow time
    shirt: '#dd1111', pants: '#dd1111', hair: '#FFD90F',
    dest: new THREE.Vector3(34, 0, -30),
    startPos: new THREE.Vector3(3, 0, -3),
    ability: 'slowtime',
    abilityLabel: 'Q: Slow Aliens (5s)',
    quip: "Statistically, running is optimal!",
  },
  {
    id: 'marge', name: 'Marge', emoji: '🧹',
    goal: 'Kwik-E-Mart',            goalEmoji: '🏪',
    speed: 5.5,  maxHits: 3,        // Q = shield
    shirt: '#22aa44', pants: '#22aa44', hair: '#1133cc',
    dest: new THREE.Vector3(-34, 0, 28),
    startPos: new THREE.Vector3(-3, 0, -3),
    ability: 'shield',
    abilityLabel: 'Q: Activate Shield',
    quip: "Hmmmm… I don't like this one bit.",
  },
];

// ─── Springfield Buildings ────────────────────────────────────────────────────
const BUILDINGS = [
  // ── Destinations ──
  { x: 38, z: 24,  w: 9,  d: 7,  h: 5,  color: '#7B3F00', roof: '#5a2d00', destFor: 'homer', label: "Moe's Tavern"          },
  { x:-38, z:-28,  w:13,  d: 9,  h: 9,  color: '#cc3333', roof: '#aa2222', destFor: 'bart',  label: 'Springfield Elementary' },
  { x: 34, z:-30,  w:11,  d: 8,  h:10,  color: '#3366cc', roof: '#224499', destFor: 'lisa',  label: 'Public Library'         },
  { x:-34, z: 28,  w:10,  d: 7,  h: 5,  color: '#22aa44', roof: '#118833', destFor: 'marge', label: 'Kwik-E-Mart'            },
  // ── Generic Springfield ──
  { x: 0,  z:-20,  w: 8,  d: 6,  h: 8,  color: '#aaaaaa', roof: '#888888', label: 'City Hall'           },
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
  { x:  0,  z:  0,  type: 'donut'  },
  { x: 12,  z: 12,  type: 'emp'    },
  { x:-12,  z: 12,  type: 'speed'  },
  { x: 12,  z:-12,  type: 'shield' },
  { x:-12,  z:-12,  type: 'donut'  },
  { x:  0,  z: 18,  type: 'emp'    },
  { x:  0,  z:-18,  type: 'speed'  },
  { x: 22,  z:  0,  type: 'shield' },
  { x:-22,  z:  0,  type: 'donut'  },
  { x: 18,  z:-18,  type: 'speed'  },
  { x:-18,  z: 18,  type: 'emp'    },
];

const POWERUP_CONFIG = {
  donut:  { emoji: '🍩', color: '#ff88bb', label: '+1 Life'     },
  emp:    { emoji: '🛸', color: '#44ffff', label: 'EMP Bomb'    },
  speed:  { emoji: '🏃', color: '#ffff44', label: 'Speed Boost' },
  shield: { emoji: '🛡️', color: '#aaaaff', label: 'Shield'      },
};

// ─── Config (physics identical to original) ───────────────────────────────────
const CONFIG = {
  SPEED: 6.5,
  ACCEL: 12,
  DECEL: 15,
  GRAVITY: 35,
  JUMP_FORCE: 14,
  BOUNDS: 54,
  DEST_RADIUS: 4.5,
  PICKUP_RADIUS: 2.4,
  LASER_HIT_RADIUS: 1.6,
};

// ─── Store ────────────────────────────────────────────────────────────────────
const GameContext = createContext();

function useSpringfieldStore() {
  const charGroupRefs = useRef(CHARACTERS.map(() => React.createRef()));
  const playerPosRef  = useRef(new THREE.Vector3());

  const initChars = () => CHARACTERS.map(c => ({
    id: c.id, hits: 0, done: false,
    shieldActive: false, shieldCharges: 0,
    speedBoostEnd: 0, slowTimeEnd: 0,
  }));

  const initPowerUps = () => POWERUP_SPAWNS.map((p, i) => ({ ...p, id: i, active: true }));

  const [state, setState] = useState({
    phase: 'start',          // start | play | win | gameover
    lives: 3,
    activeCharIdx: 0,
    chars: initChars(),
    powerUps: initPowerUps(),
    score: 0,
    alienSlowEnd: 0,
    onlinePlayers: {},
    chatMessages: [],
    quip: null,
  });

  const actions = useMemo(() => ({
    setPhase: p => setState(s => ({ ...s, phase: p })),

    nextChar: () => setState(s => {
      for (let i = 1; i <= CHARACTERS.length; i++) {
        const idx = (s.activeCharIdx + i) % CHARACTERS.length;
        if (!s.chars[idx].done) return { ...s, activeCharIdx: idx };
      }
      return s;
    }),

    switchChar: idx => setState(s =>
      s.chars[idx]?.done ? s : { ...s, activeCharIdx: idx }
    ),

    charArrived: charId => setState(s => {
      const chars = s.chars.map(c => c.id === charId ? { ...c, done: true } : c);
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
      if (!char || char.done) return s;
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
      chars: initChars(), powerUps: initPowerUps(), alienSlowEnd: 0, quip: null,
    })),

    setOnlinePlayers: updateFn => setState(s => ({ 
  ...s, 
    onlinePlayers: typeof updateFn === 'function' ? updateFn(s.onlinePlayers) : updateFn 
})),
    addChatMessage:   m => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-7), m] })),
  }), []);

  return { state, actions, charGroupRefs, playerPosRef };
}

// ─── Audio (identical engine, new sfx) ───────────────────────────────────────
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
    const BPM = 126; const B = 60 / BPM;
    const mel  = [[392,0,0.9],[440,1,0.9],[523,2,0.9],[392,3,0.9],[349,4,1.8]];
    const bass = [[130.81,0,1.8],[174.61,4,1.8]];
    const note = (f, bOff, dur, t0, vol=0.05, type='sine') => {
      const osc=this.ctx.createOscillator(); const env=this.ctx.createGain();
      const t=t0+bOff*B; const d=dur*B;
      osc.type=type; osc.frequency.value=f;
      env.gain.setValueAtTime(0.001,t); env.gain.linearRampToValueAtTime(vol,t+0.02);
      env.gain.exponentialRampToValueAtTime(0.0001,t+d*0.95);
      osc.connect(env); env.connect(this.master); osc.start(t); osc.stop(t+d+0.05);
    };
    const loop = t => {
      mel.forEach(([f,b,d]) => note(f,b,d,t,0.05,'sine'));
      bass.forEach(([f,b,d]) => note(f,b,d,t,0.04,'triangle'));
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
      const g=this.ctx.createGain(); g.gain.value=0.35;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    }
    if (type === 'laser') {
      const osc=this.ctx.createOscillator(); const g=this.ctx.createGain();
      osc.type='sawtooth'; osc.frequency.setValueAtTime(880,this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220,this.ctx.currentTime+0.18);
      g.gain.setValueAtTime(0.08,this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+0.2);
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
    if (type === 'emp') {
      for(let i=0;i<5;i++){
        const osc=this.ctx.createOscillator(); const g=this.ctx.createGain();
        osc.type='square'; osc.frequency.value=400-i*60;
        const t=this.ctx.currentTime+i*0.06;
        g.gain.setValueAtTime(0.06,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
        osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t+0.28);
      }
    }
  }
}
const audio = new GameAudio();

// ═══════════════════════════════════════════════════════════════════════════════
//  BIPED ANIMATION ENGINE (identical to original)
// ═══════════════════════════════════════════════════════════════════════════════

const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });
const matSkinYellow = new THREE.MeshStandardMaterial({ color: '#FFD90F', roughness: 0.6 });

function stdMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
}

// identical to original useHumanAnim
function useHumanAnim({ velRef, isSwimmingRef, isNPC, npcMovingRef }) {
  const body=useRef(); const head=useRef();
  const armL=useRef(); const armR=useRef();
  const legL=useRef(); const legR=useRef();
  const walk=useRef(0);

  useFrame((_,delta) => {
    let isMoving=false, isSwimming=false;
    if(isNPC && npcMovingRef)    { isMoving=npcMovingRef.current; }
    else if(velRef&&isSwimmingRef){ isMoving=Math.hypot(velRef.current.x,velRef.current.z)>0.5; isSwimming=isSwimmingRef.current; }

    if(isMoving) walk.current+=delta*(isSwimming?5:14);
    if(body.current){
      body.current.position.y=isSwimming?-0.2:1.0;
      if(isMoving&&!isSwimming) body.current.position.y+=Math.abs(Math.sin(walk.current*2))*0.08;
    }
    if(head.current) head.current.rotation.y=isMoving?Math.sin(walk.current)*0.1:0;
    const s=Math.sin(walk.current)*1.2;
    if(isSwimming){
      if(armL.current) armL.current.rotation.x=-1.5+Math.sin(walk.current)*0.5;
      if(armR.current) armR.current.rotation.x=-1.5-Math.sin(walk.current)*0.5;
      if(legL.current) legL.current.rotation.x= 0.5-Math.sin(walk.current)*0.5;
      if(legR.current) legR.current.rotation.x= 0.5+Math.sin(walk.current)*0.5;
    } else if(isMoving){
      if(armL.current) armL.current.rotation.x= s;
      if(armR.current) armR.current.rotation.x=-s;
      if(legL.current) legL.current.rotation.x=-s;
      if(legR.current) legR.current.rotation.x= s;
    } else {
      [armL,armR,legL,legR].forEach(r=>{ if(r.current) r.current.rotation.x=THREE.MathUtils.lerp(r.current.rotation.x,0,0.1); });
    }
  });
  return { body, head, armL, armR, legL, legR };
}

// Simpsons character rig — yellow skin, character-specific outfit & hair
function SimpsonsRig({ charCfg, velRef, isSwimmingRef, isNPC, npcMovingRef }) {
  const { body, head, armL, armR, legL, legR } = useHumanAnim({ velRef, isSwimmingRef, isNPC, npcMovingRef });
  const shirtMat = useMemo(() => stdMat(charCfg.shirt), [charCfg.shirt]);
  const pantsMat = useMemo(() => stdMat(charCfg.pants), [charCfg.pants]);
  const hairMat  = useMemo(() => stdMat(charCfg.hair),  [charCfg.hair]);
  const isMarge  = charCfg.id === 'marge';
  const isHomer  = charCfg.id === 'homer';

  return (
    <group ref={body} position={[0, 1.0, 0]}>
      {/* Torso */}
      <mesh material={shirtMat} castShadow><boxGeometry args={[0.6, 0.8, 0.4]} /></mesh>

      {/* Head */}
      <group ref={head} position={[0, 0.6, 0]}>
        <mesh material={matSkinYellow} castShadow><boxGeometry args={[0.45, 0.5, 0.45]} /></mesh>
        {/* Hair — Marge gets a tall stack */}
        {isMarge ? (
          <mesh material={hairMat} position={[0, 0.7, -0.02]} castShadow>
            <boxGeometry args={[0.35, 1.3, 0.3]} />
          </mesh>
        ) : isHomer ? null /* bald */ : (
          <mesh material={hairMat} position={[0, 0.29, -0.04]} castShadow>
            <boxGeometry args={[0.5, 0.16, 0.5]} />
          </mesh>
        )}
        {/* Eyes */}
        <mesh material={matBlack} position={[-0.1, 0.05, 0.23]}><boxGeometry args={[0.07,0.07,0.02]} /></mesh>
        <mesh material={matBlack} position={[ 0.1, 0.05, 0.23]}><boxGeometry args={[0.07,0.07,0.02]} /></mesh>
        {/* Homer stubble */}
        {isHomer && <mesh material={hairMat} position={[0,-0.13,0.23]}><boxGeometry args={[0.18,0.03,0.02]} /></mesh>}
      </group>

      {/* Arms */}
      <group ref={armL} position={[-0.42, 0.28, 0]}>
        <mesh material={shirtMat} position={[0,-0.3,0]} castShadow><boxGeometry args={[0.2,0.7,0.2]} /></mesh>
        <mesh material={matSkinYellow} position={[0,-0.7,0]} castShadow><boxGeometry args={[0.15,0.15,0.15]} /></mesh>
      </group>
      <group ref={armR} position={[0.42, 0.28, 0]}>
        <mesh material={shirtMat} position={[0,-0.3,0]} castShadow><boxGeometry args={[0.2,0.7,0.2]} /></mesh>
        <mesh material={matSkinYellow} position={[0,-0.7,0]} castShadow><boxGeometry args={[0.15,0.15,0.15]} /></mesh>
      </group>

      {/* Legs */}
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

// ─── Springfield City Map ────────────────────────────────────────────────────
//
//  Layered geometry approach (no single-texture hack):
//   y=0      tan/cream base (entire 160×160 ground)
//   y=0.01   cream sidewalk strips alongside every road
//   y=0.02   dark asphalt road strips
//   y=0.025  bright green grass blocks between roads
//   y=0.03   road centre-line markings (canvas texture planes)
//
//  Road grid  –  4 N-S + 4 E-W roads, width 7 units each
//  Road centres: -32, -12, 12, 32   (both axes)
//

const ROAD_HW  = 3.5;        // road half-width
const ROAD_CENTRES = [-32, -12, 12, 32];
const MAP_EXT  = 64;         // half-extent of base ground

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRoadMarkingTex() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  // centre dashes
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth   = 6;
  ctx.setLineDash([38, 22]);
  ctx.beginPath(); ctx.moveTo(S/2, 0); ctx.lineTo(S/2, S); ctx.stroke();
  ctx.setLineDash([]);
  // crosswalk stripes at each end
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let row = 0; row < 5; row++) {
    ctx.fillRect(0,      row*14,    S*0.42, 10);
    ctx.fillRect(S*0.58, row*14,    S*0.42, 10);
    ctx.fillRect(0,    S-row*14-10, S*0.42, 10);
    ctx.fillRect(S*0.58,S-row*14-10,S*0.42, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 6);
  return t;
}

// Material singletons so hooks aren't needed inside loops
const _mats = {};
function cachedMat(col) {
  if (!_mats[col]) _mats[col] = new THREE.MeshStandardMaterial({ color: col, roughness: 0.88, metalness: 0.0 });
  return _mats[col];
}

// ── Ground layers ─────────────────────────────────────────────────────────────

function Terrain() {
  const markTex = useMemo(makeRoadMarkingTex, []);

  // Grass block layout – fill every "interior" between adjacent road bands
  const grassBlocks = useMemo(() => {
    const bands  = [-MAP_EXT, ...ROAD_CENTRES.flatMap(r => [r-ROAD_HW, r+ROAD_HW]), MAP_EXT];
    const blocks = [];
    // even indices = grass bands, odd = road bands
    for (let xi = 0; xi < bands.length - 1; xi += 2) {
      for (let zi = 0; zi < bands.length - 1; zi += 2) {
        const x0 = bands[xi], x1 = bands[xi+1];
        const z0 = bands[zi], z1 = bands[zi+1];
        const w = x1 - x0, d = z1 - z0;
        if (w > 0.5 && d > 0.5) blocks.push({ x:(x0+x1)/2, z:(z0+z1)/2, w, d });
      }
    }
    return blocks;
  }, []);

  // Sidewalk strips: thin planes just inside every road edge
  const sidewalks = useMemo(() => {
    const strips = [];
    const sidW = 1.4, sidLen = MAP_EXT*2;
    ROAD_CENTRES.forEach(r => {
      // Both sides of each road, both orientations
      [-1,1].forEach(side => {
        const offset = side * (ROAD_HW + sidW*0.5);
        // N-S road  →  sidewalk runs in Z
        strips.push({ x: r+offset, z: 0, w: sidW, d: sidLen, ry: 0   });
        // E-W road  →  sidewalk runs in X
        strips.push({ x: 0, z: r+offset, w: sidLen, d: sidW, ry: 0   });
      });
    });
    return strips;
  }, []);

  return (
    <group>
      {/* Base ground – warm tan */}
      <mesh name="ground" rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[MAP_EXT*2, MAP_EXT*2, 1, 1]} />
        <meshStandardMaterial color="#cbbf9a" roughness={0.96} />
      </mesh>

      {/* Sidewalks – cream */}
      {sidewalks.map((s, i) => (
        <mesh key={`sw${i}`} rotation={[-Math.PI/2,0,0]} position={[s.x, 0.012, s.z]} receiveShadow>
          <planeGeometry args={[s.w, s.d]} />
          <meshStandardMaterial color="#d8d0b8" roughness={0.95} />
        </mesh>
      ))}

      {/* Roads – dark asphalt */}
      {ROAD_CENTRES.flatMap((r, ri) => [
        // N-S road
        <mesh key={`nsR${ri}`} rotation={[-Math.PI/2,0,0]} position={[r, 0.02, 0]} receiveShadow>
          <planeGeometry args={[ROAD_HW*2, MAP_EXT*2]} />
          <meshStandardMaterial color="#4a4840" roughness={0.93} />
        </mesh>,
        // E-W road
        <mesh key={`ewR${ri}`} rotation={[-Math.PI/2,0,0]} position={[0, 0.02, r]} receiveShadow>
          <planeGeometry args={[MAP_EXT*2, ROAD_HW*2]} />
          <meshStandardMaterial color="#4a4840" roughness={0.93} />
        </mesh>,
      ])}

      {/* Road lane markings */}
      {ROAD_CENTRES.flatMap((r, ri) => [
        <mesh key={`nsM${ri}`} rotation={[-Math.PI/2,0,0]} position={[r, 0.025, 0]}>
          <planeGeometry args={[ROAD_HW*2, MAP_EXT*2]} />
          <meshBasicMaterial map={markTex} transparent alphaTest={0.05} />
        </mesh>,
        <mesh key={`ewM${ri}`} rotation={[-Math.PI/2,Math.PI/2,0]} position={[0, 0.025, r]}>
          <planeGeometry args={[ROAD_HW*2, MAP_EXT*2]} />
          <meshBasicMaterial map={markTex} transparent alphaTest={0.05} />
        </mesh>,
      ])}

      {/* Grass plots – bright Springfield green */}
      {grassBlocks.map((b, i) => (
        <mesh key={`gr${i}`} rotation={[-Math.PI/2,0,0]} position={[b.x, 0.03, b.z]} receiveShadow>
          <planeGeometry args={[b.w, b.d]} />
          <meshStandardMaterial color="#5ab830" roughness={0.92} />
        </mesh>
      ))}

      {/* Intersection fill – matching road colour */}
      {ROAD_CENTRES.flatMap((rx, ri) => ROAD_CENTRES.map((rz, zi) => (
        <mesh key={`ix${ri}-${zi}`} rotation={[-Math.PI/2,0,0]} position={[rx, 0.022, rz]}>
          <planeGeometry args={[ROAD_HW*2, ROAD_HW*2]} />
          <meshStandardMaterial color="#4a4840" roughness={0.93} />
        </mesh>
      )))}
    </group>
  );
}

// ── Street trees ──────────────────────────────────────────────────────────────

const STREET_TREES = (() => {
  const rng = (() => { let s = 91; return () => { s=(s*16807)%2147483647; return (s-1)/2147483646; }; })();
  const out = [];
  const avoid = [
    [38,24],[-38,-28],[34,-30],[-34,28],
    [0,-20],[16,10],[-15,5],[6,18],[-8,-8],[12,-8],[-20,-18],[20,-12],[-25,0],[25,5],
  ];
  const clear = (x,z) => avoid.every(([ax,az]) => Math.hypot(x-ax,z-az) > 7);
  let att = 0;
  while (out.length < 55 && att++ < 600) {
    const bandPick = () => {
      const bands = [[-64, -32-ROAD_HW], [-12-ROAD_HW+1, 12-ROAD_HW-1], [12+ROAD_HW+1, 32-ROAD_HW-1], [32+ROAD_HW, 64]];
      const b = bands[Math.floor(rng()*bands.length)];
      return b[0] + rng()*(b[1]-b[0]);
    };
    const x = bandPick(), z = bandPick();
    if (Math.abs(x) < 62 && Math.abs(z) < 62 && clear(x,z)) {
      out.push({ x, z, scale: 0.7+rng()*0.55, variety: rng() });
    }
  }
  return out;
})();

function StreetTrees() {
  return (
    <group>
      {/* Trunks */}
      <Instances limit={60} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 1.6, 7]} />
        <meshStandardMaterial color="#6b4226" roughness={1} />
        {STREET_TREES.map((t,i) => <Instance key={i} position={[t.x, 0.8, t.z]} scale={t.scale} />)}
      </Instances>
      {/* Round canopy – dark green inner */}
      <Instances limit={60} castShadow>
        <sphereGeometry args={[1.35, 10, 8]} />
        <meshStandardMaterial color="#2e7d22" roughness={0.85} />
        {STREET_TREES.map((t,i) => <Instance key={i} position={[t.x, 2.5+t.scale*0.5, t.z]} scale={t.scale} />)}
      </Instances>
      {/* Canopy highlight – lighter top */}
      <Instances limit={60} castShadow>
        <sphereGeometry args={[1.05, 8, 7]} />
        <meshStandardMaterial color="#47b535" roughness={0.8} />
        {STREET_TREES.map((t,i) => <Instance key={i} position={[t.x, 3.1+t.scale*0.5, t.z]} scale={t.scale*0.82} />)}
      </Instances>
    </group>
  );
}

// ── Parked cars ───────────────────────────────────────────────────────────────

const PARKED_CARS = [
  { x: 9,   z: -20,  ry: 0,    color: '#cc2222' },
  { x:-9,   z: -22,  ry: 0,    color: '#2244cc' },
  { x: 9,   z:  14,  ry: 0,    color: '#22aa44' },
  { x:-9,   z:  18,  ry: 0,    color: '#ddaa22' },
  { x:-22,  z:  9,   ry:Math.PI/2, color: '#885522' },
  { x:-20,  z: -9,   ry:Math.PI/2, color: '#cc6688' },
  { x: 22,  z:  9,   ry:Math.PI/2, color: '#228899' },
  { x: 24,  z: -9,   ry:Math.PI/2, color: '#776699' },
  { x: 9,   z:  26,  ry: 0,    color: '#aabbcc' },
  { x:-9,   z: -26,  ry: 0,    color: '#dd8822' },
  { x: 36,  z:  9,   ry:Math.PI/2, color: '#882222' },
  { x:-36,  z: -9,   ry:Math.PI/2, color: '#446688' },
];

function ParkCar({ x, z, ry, color }) {
  const bodyM  = useMemo(()=>cachedMat(color), [color]);
  const glassM = useMemo(()=>new THREE.MeshStandardMaterial({ color:'#99ccff', roughness:0.1, metalness:0.5, transparent:true, opacity:0.7 }), []);
  const tyreM  = useMemo(()=>cachedMat('#1a1a1a'), []);
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* Body */}
      <mesh material={bodyM} position={[0, 0.55, 0]} castShadow><boxGeometry args={[3.8, 1.1, 1.9]} /></mesh>
      {/* Cab */}
      <mesh material={bodyM} position={[0.3, 1.18, 0]} castShadow><boxGeometry args={[2.0, 0.75, 1.7]} /></mesh>
      {/* Windscreen */}
      <mesh material={glassM} position={[1.18, 1.22, 0]} rotation={[0,0, 0.35]}><boxGeometry args={[0.08, 0.6, 1.5]} /></mesh>
      {/* Rear screen */}
      <mesh material={glassM} position={[-0.58, 1.22, 0]} rotation={[0,0,-0.25]}><boxGeometry args={[0.08, 0.55, 1.5]} /></mesh>
      {/* Wheels */}
      {[[-1.2,0.28,-0.95],[1.2,0.28,-0.95],[-1.2,0.28,0.95],[1.2,0.28,0.95]].map(([wx,wy,wz],j) => (
        <mesh key={j} material={tyreM} position={[wx,wy,wz]} rotation={[Math.PI/2,0,0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.25, 10]} />
        </mesh>
      ))}
      {/* Headlights */}
      <mesh position={[1.92, 0.55, 0.55]} castShadow><boxGeometry args={[0.06, 0.22, 0.4]} /><meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={0.3} /></mesh>
      <mesh position={[1.92, 0.55,-0.55]} castShadow><boxGeometry args={[0.06, 0.22, 0.4]} /><meshStandardMaterial color="#ffffcc" emissive="#ffffcc" emissiveIntensity={0.3} /></mesh>
    </group>
  );
}

// ── Street lamps ──────────────────────────────────────────────────────────────

const LAMP_POSTS = [
  [-15.5, -20], [15.5, -20], [-15.5, 20], [15.5, 20],
  [-20, -15.5], [-20, 15.5], [20, -15.5], [20, 15.5],
  [-35.5,-8], [-35.5, 8], [35.5,-8], [35.5, 8],
  [-8,-35.5], [8,-35.5], [-8,35.5], [8,35.5],
];

function StreetLamps() {
  const poleMat = useMemo(()=>cachedMat('#888880'), []);
  const headMat = useMemo(()=>cachedMat('#ddddcc'), []);
  return (
    <group>
      {LAMP_POSTS.map(([x,z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={poleMat} position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 5, 7]} />
          </mesh>
          <mesh material={poleMat} position={[0.55, 5.1, 0]}>
            <boxGeometry args={[1.1, 0.1, 0.1]} />
          </mesh>
          <mesh material={headMat} position={[1.0, 5.0, 0]} castShadow>
            <boxGeometry args={[0.5, 0.22, 0.35]} />
          </mesh>
          <pointLight position={[1.0, 4.8, 0]} color="#ffe8aa" intensity={1.8} distance={14} decay={2} />
        </group>
      ))}
    </group>
  );
}

// ── Building material helper ──────────────────────────────────────────────────

function matS(col) { return new THREE.MeshStandardMaterial({ color:col, roughness:0.82 }); }

// ── Window helper (small yellow lit rectangle on a face) ─────────────────────
function Win({ x, y, z, w=0.65, h=0.7, rot=0 }) {
  return (
    <mesh position={[x,y,z]} rotation={[0,rot,0]}>
      <boxGeometry args={[w, h, 0.05]} />
      <meshStandardMaterial color="#ffe88a" emissive="#ffe88a" emissiveIntensity={0.45} />
    </mesh>
  );
}

// ── Landmark building components ──────────────────────────────────────────────

// Moe's Tavern — Homer's destination
function MoesTavern({ pos, destFor }) {
  return (
    <group position={pos}>
      {/* Dark weathered main building */}
      <mesh castShadow receiveShadow position={[0,3,0]}>
        <boxGeometry args={[10,6,8]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.95} />
      </mesh>
      {/* Brick texture overlay strip */}
      <mesh position={[0,2,-4.05]}>
        <boxGeometry args={[10,4,0.05]} />
        <meshStandardMaterial color="#6b4525" roughness={0.98} />
      </mesh>
      {/* Flat roof cap */}
      <mesh castShadow position={[0,6.3,0]}>
        <boxGeometry args={[10.4,0.6,8.4]} />
        <meshStandardMaterial color="#3d2710" roughness={1} />
      </mesh>
      {/* Roof parapet detail */}
      {[-4,-1.5,1.5,4].map((x,i)=>(
        <mesh key={i} castShadow position={[x,6.9,0]}>
          <boxGeometry args={[1.5,1.2,8.4]} />
          <meshStandardMaterial color="#4a2e12" roughness={1} />
        </mesh>
      ))}
      {/* Sign */}
      <mesh position={[0,7.5,-4.1]} castShadow>
        <boxGeometry args={[7,1.5,0.25]} />
        <meshStandardMaterial color="#cc2200" roughness={0.7} />
      </mesh>
      <Html position={[0,7.5,-4.4]} center>
        <div style={{fontFamily:'Impact,Arial Black',fontSize:16,color:'#FFD700',fontWeight:900,
          textShadow:'1px 1px 0 #000',whiteSpace:'nowrap',pointerEvents:'none',
          letterSpacing:2, border: destFor ? '2px solid #FFD90F' : 'none', padding:'0 4px', borderRadius:4}}>
          {destFor ? '⭐ ' : ''}MOE'S TAVERN</div>
      </Html>
      {/* Neon beer sign glow */}
      <pointLight position={[0,5,-5]} color="#ff8800" intensity={2.5} distance={12} decay={2} />
      {/* Door */}
      <mesh position={[0,1.2,-4.1]}>
        <boxGeometry args={[1.4,2.4,0.1]} />
        <meshStandardMaterial color="#2a1508" roughness={1} />
      </mesh>
      {/* Windows */}
      <Win x={-3} y={3} z={-4.1} /><Win x={3} y={3} z={-4.1} />
      {/* Awning */}
      <mesh position={[0,3.8,-4.5]} rotation={[0.4,0,0]}>
        <boxGeometry args={[9,0.2,2.5]} />
        <meshStandardMaterial color="#991100" roughness={0.9} />
      </mesh>
    </group>
  );
}

// Krusty Burger — classic arched roof, red/white
function KrustyBurger({ pos, destFor }) {
  return (
    <group position={pos}>
      {/* Main body — white/cream */}
      <mesh castShadow receiveShadow position={[0,2.5,0]}>
        <boxGeometry args={[9,5,7]} />
        <meshStandardMaterial color="#f8f0e0" roughness={0.85} />
      </mesh>
      {/* Red stripe band */}
      <mesh position={[0,1.5,3.55]}>
        <boxGeometry args={[9,1,0.06]} />
        <meshStandardMaterial color="#cc1111" roughness={0.8} />
      </mesh>
      {/* Arched roof front piece */}
      <mesh castShadow position={[0,5.8,0]}>
        <boxGeometry args={[9.2,1.8,7.2]} />
        <meshStandardMaterial color="#cc1111" roughness={0.8} />
      </mesh>
      {/* Roof arch (simulated with cylinder half) */}
      <mesh castShadow position={[0,6.5,0]} rotation={[0,0,0]}>
        <cylinderGeometry args={[4.8,4.8,7.2,12,1,false,0,Math.PI]} />
        <meshStandardMaterial color="#ee2222" roughness={0.75} side={THREE.DoubleSide}/>
      </mesh>
      {/* Big K sign on top */}
      <mesh position={[0,8.4,0]} castShadow>
        <boxGeometry args={[3.5,2.5,0.3]} />
        <meshStandardMaterial color="#FFD700" roughness={0.6} />
      </mesh>
      <Html position={[0,8.6,0.3]} center>
        <div style={{fontFamily:'Impact',fontSize:22,color:'#cc0000',fontWeight:900,
          textShadow:'1px 1px 0 #000',pointerEvents:'none'}}>K</div>
      </Html>
      {/* Sign board */}
      <Html position={[0,6.2,3.7]} center>
        <div style={{fontFamily:'Impact,Arial Black',fontSize:13,color:'#fff',fontWeight:900,
          background:'rgba(204,17,17,0.9)',padding:'2px 10px',borderRadius:4,
          whiteSpace:'nowrap',pointerEvents:'none',letterSpacing:1,
          border: destFor ? '2px solid #FFD90F' : 'none'}}>
          {destFor?'⭐ ':''}KRUSTY BURGER
        </div>
      </Html>
      {/* Windows */}
      <Win x={-2.5} y={2.5} z={3.55} /><Win x={0} y={2.5} z={3.55} /><Win x={2.5} y={2.5} z={3.55} />
      {/* Drive-thru awning */}
      <mesh position={[4.8,3,0]} rotation={[0,0,-0.15]} castShadow>
        <boxGeometry args={[0.15,0.15,5]} />
        <meshStandardMaterial color="#cc1111" />
      </mesh>
      <mesh position={[5.6,2.6,0]} castShadow>
        <boxGeometry args={[2.2,0.15,5.2]} />
        <meshStandardMaterial color="#ee3333" roughness={0.8} />
      </mesh>
      <pointLight position={[0,3,4]} color="#ffee88" intensity={1.5} distance={10} decay={2} />
    </group>
  );
}

// Kwik-E-Mart — Marge's destination, iconic slanted roof
function KwikEMart({ pos, destFor }) {
  return (
    <group position={pos}>
      {/* Body — light teal/seafoam */}
      <mesh castShadow receiveShadow position={[0,3,0]}>
        <boxGeometry args={[10,6,8]} />
        <meshStandardMaterial color="#4ab89a" roughness={0.85} />
      </mesh>
      {/* Slant roof front-to-back */}
      <mesh castShadow position={[0,6.7,-0.5]} rotation={[-0.18,0,0]}>
        <boxGeometry args={[10.4,0.6,8.8]} />
        <meshStandardMaterial color="#2e8a70" roughness={0.9} />
      </mesh>
      {/* Raised front fascia */}
      <mesh castShadow position={[0,7.8,3.8]}>
        <boxGeometry args={[10.4,2.2,0.4]} />
        <meshStandardMaterial color="#2e8a70" roughness={0.9} />
      </mesh>
      {/* Sign */}
      <mesh position={[0,7.8,4.1]}>
        <boxGeometry args={[8.5,1.6,0.15]} />
        <meshStandardMaterial color="#1a6650" roughness={0.8} />
      </mesh>
      <Html position={[0,7.8,4.3]} center>
        <div style={{fontFamily:'Impact,Arial Black',fontSize:15,color:'#FFD700',fontWeight:900,
          textShadow:'1px 1px 0 #000',whiteSpace:'nowrap',pointerEvents:'none',
          border: destFor ? '2px solid #FFD90F' : 'none',padding:'0 6px'}}>
          {destFor?'⭐ ':''}KWIK-E-MART
        </div>
      </Html>
      {/* Door */}
      <mesh position={[0,1.3,4.1]}>
        <boxGeometry args={[1.8,2.6,0.1]} />
        <meshStandardMaterial color="#1a3a2a" roughness={1} />
      </mesh>
      {/* Windows */}
      <Win x={-3} y={2.5} z={4.1} w={1.8} h={2.2} />
      <Win x={ 3} y={2.5} z={4.1} w={1.8} h={2.2} />
      {/* Awning */}
      <mesh position={[0,4.2,4.8]} rotation={[0.4,0,0]} castShadow>
        <boxGeometry args={[10,0.2,2.5]} />
        <meshStandardMaterial color="#e8aa22" roughness={0.85} />
      </mesh>
      <pointLight position={[0,4,5]} color="#ffee88" intensity={1.5} distance={9} decay={2} />
    </group>
  );
}

// Springfield Elementary — Bart's destination, red brick school
function SpringfieldElementary({ pos, destFor }) {
  return (
    <group position={pos}>
      {/* Main wing */}
      <mesh castShadow receiveShadow position={[0,4.5,0]}>
        <boxGeometry args={[14,9,9]} />
        <meshStandardMaterial color="#b84444" roughness={0.9} />
      </mesh>
      {/* Side wing left */}
      <mesh castShadow receiveShadow position={[-9,3.5,0]}>
        <boxGeometry args={[4,7,8]} />
        <meshStandardMaterial color="#b84444" roughness={0.9} />
      </mesh>
      {/* Side wing right */}
      <mesh castShadow receiveShadow position={[9,3.5,0]}>
        <boxGeometry args={[4,7,8]} />
        <meshStandardMaterial color="#b84444" roughness={0.9} />
      </mesh>
      {/* Flat roofs */}
      <mesh castShadow position={[0,9.3,0]}>
        <boxGeometry args={[14.4,0.6,9.4]} />
        <meshStandardMaterial color="#883333" roughness={1} />
      </mesh>
      <mesh castShadow position={[-9,7.3,0]}>
        <boxGeometry args={[4.4,0.5,8.4]} />
        <meshStandardMaterial color="#883333" roughness={1} />
      </mesh>
      <mesh castShadow position={[9,7.3,0]}>
        <boxGeometry args={[4.4,0.5,8.4]} />
        <meshStandardMaterial color="#883333" roughness={1} />
      </mesh>
      {/* Central entrance portico */}
      <mesh castShadow position={[0,5,-4.8]}>
        <boxGeometry args={[5,4,1.5]} />
        <meshStandardMaterial color="#d4ccb8" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0,7.1,-4.8]}>
        <boxGeometry args={[5.4,0.5,1.8]} />
        <meshStandardMaterial color="#aa9988" roughness={0.9} />
      </mesh>
      {/* Columns */}
      {[-1.5,0,1.5].map((cx,i) => (
        <mesh key={i} castShadow position={[cx,4,-5.5]}>
          <cylinderGeometry args={[0.2,0.22,4,8]} />
          <meshStandardMaterial color="#e8e0d0" roughness={0.85} />
        </mesh>
      ))}
      {/* Sign */}
      <Html position={[0,10.5,0]} center>
        <div style={{fontFamily:'Arial Black',fontSize:13,color:'#fff',fontWeight:900,
          background:'rgba(150,40,40,0.9)',padding:'2px 10px',borderRadius:6,
          whiteSpace:'nowrap',pointerEvents:'none',
          border: destFor ? '2px solid #FFD90F' : 'none'}}>
          {destFor?'⭐ ':''}SPRINGFIELD ELEMENTARY
        </div>
      </Html>
      {/* Windows — grid */}
      {[-4,-1.5,1.5,4].map((wx,i) => [2,5.5].map((wy,j) => (
        <Win key={`${i}-${j}`} x={wx} y={wy} z={-4.55} w={1.2} h={1.8} />
      )))}
      {/* Flag pole */}
      <mesh position={[7,9,0]} castShadow>
        <cylinderGeometry args={[0.07,0.09,7,6]} />
        <meshStandardMaterial color="#aaaaaa" />
      </mesh>
      <mesh position={[7,12.5,0.8]}>
        <boxGeometry args={[0.05,1.5,2.5]} />
        <meshStandardMaterial color="#cc2222" />
      </mesh>
    </group>
  );
}

// Springfield Public Library — Lisa's destination, classical columns
function PublicLibrary({ pos, destFor }) {
  return (
    <group position={pos}>
      {/* Body — white classical */}
      <mesh castShadow receiveShadow position={[0,4,0]}>
        <boxGeometry args={[12,8,9]} />
        <meshStandardMaterial color="#e8e4d8" roughness={0.82} />
      </mesh>
      {/* Stepped plinth */}
      <mesh receiveShadow position={[0,0.4,0]}>
        <boxGeometry args={[13,0.8,10]} />
        <meshStandardMaterial color="#d8d4c8" roughness={0.85} />
      </mesh>
      <mesh receiveShadow position={[0,0.9,0]}>
        <boxGeometry args={[12.5,0.6,9.5]} />
        <meshStandardMaterial color="#d8d4c8" roughness={0.85} />
      </mesh>
      {/* Triangular pediment */}
      <mesh castShadow position={[0,9.5,-0.5]}>
        <boxGeometry args={[12.5,0.5,9.5]} />
        <meshStandardMaterial color="#ccc8bc" roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0,10.4,-1]} rotation={[0.35,0,0]}>
        <boxGeometry args={[12.2,0.5,5]} />
        <meshStandardMaterial color="#d4d0c4" roughness={0.88} />
      </mesh>
      {/* Columns front */}
      {[-4.5,-1.5,1.5,4.5].map((cx,i) => (
        <mesh key={i} castShadow position={[cx,4.5,-4.6]}>
          <cylinderGeometry args={[0.35,0.38,8,10]} />
          <meshStandardMaterial color="#f0ece4" roughness={0.8} />
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[0,2,-4.62]}>
        <boxGeometry args={[2,4,0.1]} />
        <meshStandardMaterial color="#5c3a1a" roughness={1} />
      </mesh>
      {/* Sign */}
      <Html position={[0,11,0]} center>
        <div style={{fontFamily:'Georgia,serif',fontSize:12,color:'#333',fontWeight:900,
          background:'rgba(232,228,216,0.95)',padding:'3px 10px',borderRadius:4,
          whiteSpace:'nowrap',pointerEvents:'none',border: destFor ? '2px solid #FFD90F' : '2px solid #8a7a60'}}>
          {destFor?'⭐ ':''} PUBLIC LIBRARY
        </div>
      </Html>
      <pointLight position={[0,5,-5]} color="#ffe8cc" intensity={1.2} distance={9} decay={2} />
    </group>
  );
}

// Nuclear Power Plant — cooling towers
function NuclearPlant({ pos }) {
  return (
    <group position={pos}>
      {/* Main building */}
      <mesh castShadow receiveShadow position={[0,4,0]}>
        <boxGeometry args={[8,8,6]} />
        <meshStandardMaterial color="#c8b89a" roughness={0.9} />
      </mesh>
      {/* Roof */}
      <mesh castShadow position={[0,8.3,0]}>
        <boxGeometry args={[8.3,0.6,6.3]} />
        <meshStandardMaterial color="#a09080" roughness={1} />
      </mesh>
      {/* Two cooling towers */}
      {[-4, 4].map((ox,i) => (
        <group key={i} position={[ox, 0, -2]}>
          <mesh castShadow>
            <cylinderGeometry args={[2.2, 2.8, 11, 14, 1]} />
            <meshStandardMaterial color="#d4c8b4" roughness={0.9} />
          </mesh>
          {/* Top lip */}
          <mesh castShadow position={[0, 5.7, 0]}>
            <torusGeometry args={[2.2, 0.2, 8, 20]} />
            <meshStandardMaterial color="#bbb0a0" roughness={0.9} />
          </mesh>
          {/* Steam */}
          <mesh position={[0, 7, 0]}>
            <sphereGeometry args={[1.8, 8, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={0.45} />
          </mesh>
          <mesh position={[ox>0?0.8:-0.8, 9, 0]}>
            <sphereGeometry args={[1.4, 8, 6]} />
            <meshStandardMaterial color="#ffffff" roughness={1} transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
      {/* Warning stripes */}
      {[1,3,5,7].map((y,i) => (
        <mesh key={i} position={[0,y,-3.05]}>
          <boxGeometry args={[7.9,0.4,0.06]} />
          <meshStandardMaterial color={i%2===0?"#cc2200":"#ffee00"} />
        </mesh>
      ))}
      <Html position={[0,9.5,0]} center>
        <div style={{fontFamily:'Arial Black',fontSize:11,color:'#cc2200',fontWeight:900,
          background:'rgba(255,255,220,0.9)',padding:'2px 8px',borderRadius:4,
          whiteSpace:'nowrap',pointerEvents:'none',border:'2px solid #cc2200'}}>
          ⚠️ NUCLEAR PLANT
        </div>
      </Html>
      <pointLight position={[0,3,4]} color="#aaff44" intensity={2} distance={12} decay={2} />
    </group>
  );
}

// City Hall — grand, columned
function CityHall({ pos }) {
  return (
    <group position={pos}>
      <mesh castShadow receiveShadow position={[0,4,0]}>
        <boxGeometry args={[10,8,8]} />
        <meshStandardMaterial color="#d4cfc0" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0,8.3,0]}>
        <boxGeometry args={[10.4,0.6,8.4]} />
        <meshStandardMaterial color="#b8b4a8" roughness={0.9} />
      </mesh>
      {/* Dome */}
      <mesh castShadow position={[0,10,0]}>
        <sphereGeometry args={[2.2,12,8,0,Math.PI*2,0,Math.PI/2]} />
        <meshStandardMaterial color="#888880" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh castShadow position={[0,9.3,0]}>
        <cylinderGeometry args={[2.3,2.5,1.5,12]} />
        <meshStandardMaterial color="#aaa89e" roughness={0.88} />
      </mesh>
      {/* Columns */}
      {[-3.5,-1.2,1.2,3.5].map((cx,i) => (
        <mesh key={i} castShadow position={[cx,4,-4.1]}>
          <cylinderGeometry args={[0.28,0.3,8,10]} />
          <meshStandardMaterial color="#e8e4da" roughness={0.82} />
        </mesh>
      ))}
      {/* Pediment */}
      <mesh castShadow position={[0,8.8,-3.9]} rotation={[-0.32,0,0]}>
        <boxGeometry args={[10,0.4,3]} />
        <meshStandardMaterial color="#c8c4b8" roughness={0.88} />
      </mesh>
      <Html position={[0,12,0]} center>
        <div style={{fontFamily:'Georgia,serif',fontSize:12,color:'#333',fontWeight:900,
          background:'rgba(220,215,200,0.95)',padding:'2px 10px',borderRadius:4,
          whiteSpace:'nowrap',pointerEvents:'none',border:'2px solid #888'}}>
          🏛️ CITY HALL
        </div>
      </Html>
    </group>
  );
}

// First Church of Springfield — white with pointed steeple
function FirstChurch({ pos }) {
  return (
    <group position={pos}>
      <mesh castShadow receiveShadow position={[0,3.5,0]}>
        <boxGeometry args={[7,7,6]} />
        <meshStandardMaterial color="#f5f2ea" roughness={0.82} />
      </mesh>
      {/* Pitched roof */}
      <mesh castShadow position={[0,8,0]} rotation={[0,0,Math.PI/6]}>
        <cylinderGeometry args={[0.1,4.5,5,4,1]} />
        <meshStandardMaterial color="#cc6633" roughness={0.85} />
      </mesh>
      {/* Bell tower base */}
      <mesh castShadow position={[0,10,0]}>
        <boxGeometry args={[2.5,5,2.5]} />
        <meshStandardMaterial color="#f0ece4" roughness={0.82} />
      </mesh>
      {/* Steeple */}
      <mesh castShadow position={[0,14.5,0]}>
        <coneGeometry args={[1.4,5,4]} />
        <meshStandardMaterial color="#cc6633" roughness={0.85} />
      </mesh>
      {/* Cross */}
      <mesh position={[0,17.5,0]}>
        <boxGeometry args={[0.15,1.5,0.15]} />
        <meshStandardMaterial color="#888" metalness={0.5} />
      </mesh>
      <mesh position={[0,17.2,0]}>
        <boxGeometry args={[0.8,0.15,0.15]} />
        <meshStandardMaterial color="#888" metalness={0.5} />
      </mesh>
      {/* Arched window front */}
      <mesh position={[0,5,-3.06]}>
        <boxGeometry args={[1.2,2.5,0.08]} />
        <meshStandardMaterial color="#aaddff" emissive="#aaddff" emissiveIntensity={0.3} />
      </mesh>
      <Html position={[0,7.5,-3.5]} center>
        <div style={{fontFamily:'Georgia,serif',fontSize:10,color:'#553300',fontWeight:900,
          background:'rgba(245,242,234,0.95)',padding:'2px 8px',borderRadius:4,
          whiteSpace:'nowrap',pointerEvents:'none',border:'1px solid #aaa'}}>
          FIRST CHURCH OF SPRINGFIELD
        </div>
      </Html>
    </group>
  );
}

// Lard Lad Donuts — round building with giant donut
function LardLad({ pos }) {
  return (
    <group position={pos}>
      {/* Round building */}
      <mesh castShadow receiveShadow position={[0,3,0]}>
        <cylinderGeometry args={[4.5,4.5,6,16]} />
        <meshStandardMaterial color="#f5e8c0" roughness={0.85} />
      </mesh>
      {/* Roof */}
      <mesh castShadow position={[0,6.2,0]}>
        <cylinderGeometry args={[4.8,4.5,0.5,16]} />
        <meshStandardMaterial color="#dd8822" roughness={0.85} />
      </mesh>
      {/* Giant donut statue */}
      <mesh castShadow position={[0,9.5,0]} rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[2.2,0.75,10,20]} />
        <meshStandardMaterial color="#d4824a" roughness={0.7} />
      </mesh>
      {/* Donut icing */}
      <mesh castShadow position={[0,9.5,0.4]} rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[2.2,0.42,8,20]} />
        <meshStandardMaterial color="#ff88aa" roughness={0.6} emissive="#ff88aa" emissiveIntensity={0.15} />
      </mesh>
      {/* Sign */}
      <Html position={[0,7,4.9]} center>
        <div style={{fontFamily:'Impact,Arial Black',fontSize:13,color:'#cc6600',fontWeight:900,
          background:'rgba(245,232,192,0.95)',padding:'2px 8px',borderRadius:6,
          whiteSpace:'nowrap',pointerEvents:'none',border:'2px solid #dd8822'}}>
          🍩 LARD LAD DONUTS
        </div>
      </Html>
      <pointLight position={[0,7,0]} color="#ffdd88" intensity={2} distance={10} decay={2} />
    </group>
  );
}

// Springfield Police Dept
function PoliceDept({ pos }) {
  return (
    <group position={pos}>
      <mesh castShadow receiveShadow position={[0,3.5,0]}>
        <boxGeometry args={[8,7,7]} />
        <meshStandardMaterial color="#8899bb" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0,7.3,0]}>
        <boxGeometry args={[8.4,0.6,7.4]} />
        <meshStandardMaterial color="#667799" roughness={0.9} />
      </mesh>
      {/* Parapet */}
      {[-3,-1,1,3].map((x,i) => (
        <mesh key={i} castShadow position={[x,7.9,0]}>
          <boxGeometry args={[1.2,1,7.4]} />
          <meshStandardMaterial color="#556688" roughness={1} />
        </mesh>
      ))}
      <Win x={-2} y={3} z={3.55} /><Win x={2} y={3} z={3.55} />
      <mesh position={[0,1.3,3.56]}>
        <boxGeometry args={[1.4,2.6,0.08]} />
        <meshStandardMaterial color="#334466" roughness={1} />
      </mesh>
      <Html position={[0,8.5,0]} center>
        <div style={{fontFamily:'Arial Black',fontSize:11,color:'#fff',fontWeight:900,
          background:'rgba(80,100,160,0.9)',padding:'2px 8px',borderRadius:5,
          whiteSpace:'nowrap',pointerEvents:'none',border:'1px solid #aabbdd'}}>
          🚔 SPRINGFIELD PD
        </div>
      </Html>
    </group>
  );
}

// Generic styled building for remaining spots
function GenBuilding({ b }) {
  const wallM = useMemo(()=>cachedMat(b.color), [b.color]);
  const roofM = useMemo(()=>cachedMat(b.roof||'#555'), [b.roof]);
  const winM  = useMemo(()=>new THREE.MeshStandardMaterial({color:'#ffe88a',emissive:'#ffe88a',emissiveIntensity:0.4}), []);
  const rows  = Math.max(1, Math.floor(b.h/2.2));
  const cols  = Math.max(1, Math.floor(b.w/2.5));
  return (
    <group position={[b.x, 0, b.z]}>
      {/* Main body */}
      <mesh material={wallM} position={[0,b.h/2,0]} castShadow receiveShadow>
        <boxGeometry args={[b.w,b.h,b.d]} />
      </mesh>
      {/* Roof cap */}
      <mesh material={roofM} position={[0,b.h+0.35,0]} castShadow>
        <boxGeometry args={[b.w+0.3,0.7,b.d+0.3]} />
      </mesh>
      {/* Roof edge lip */}
      <mesh material={roofM} position={[0,b.h+0.05,b.d/2+0.18]} castShadow>
        <boxGeometry args={[b.w+0.3,0.2,0.4]} />
      </mesh>
      {/* Awning over front */}
      <mesh position={[0,b.h*0.45,b.d/2+0.55]} rotation={[-0.3,0,0]} castShadow>
        <boxGeometry args={[b.w*0.7,0.18,1.5]} />
        <meshStandardMaterial color={b.roof||'#555'} roughness={0.9} />
      </mesh>
      {/* Windows front face */}
      {Array.from({length:rows}).map((_,ri) =>
        Array.from({length:cols}).map((_,ci) => {
          const wx = (ci-(cols-1)/2) * (b.w/(cols)) * 0.7;
          const wy = 1.2 + ri*2.1;
          return (
            <mesh key={`${ri}-${ci}`} material={winM} position={[wx,wy,b.d/2+0.04]}>
              <boxGeometry args={[0.6,0.75,0.05]} />
            </mesh>
          );
        })
      )}
      {/* Door */}
      <mesh position={[0,1.1,b.d/2+0.04]}>
        <boxGeometry args={[0.9,2.2,0.05]} />
        <meshStandardMaterial color="#2a1a0a" roughness={1} />
      </mesh>
      {/* Label */}
      <Html position={[0,b.h+1.5,0]} center>
        <div style={{fontFamily:'Arial Black,Arial',fontSize:11,fontWeight:900,
          color: b.destFor?'#111':'#fff',
          background: b.destFor?'rgba(255,217,15,0.95)':'rgba(0,0,0,0.72)',
          padding:'2px 9px',borderRadius:7,
          whiteSpace:'nowrap',pointerEvents:'none',
          border: b.destFor?'2px solid #ff8800':'none'}}>
          {b.destFor?'⭐ ':''}{b.label}
        </div>
      </Html>
    </group>
  );
}

// ── Landmark routing ──────────────────────────────────────────────────────────

function SpringfieldBuildings() {
  const moesPos      = useMemo(()=>[38, 0, 24],   []);
  const krustyPos    = useMemo(()=>[-8, 0, -8],   []);
  const kwikEPos     = useMemo(()=>[-34, 0, 28],  []);
  const elemPos      = useMemo(()=>[-38, 0, -28], []);
  const libPos       = useMemo(()=>[34, 0, -30],  []);
  const nuclearPos   = useMemo(()=>[16, 0, 10],   []);
  const cityHallPos  = useMemo(()=>[0, 0, -20],   []);
  const churchPos    = useMemo(()=>[20, 0, -12],  []);
  const lardPos      = useMemo(()=>[0, 0, 18],    []);
  const policePos    = useMemo(()=>[-15, 0, 5],   []);

  // Generic buildings for remaining spots
  const generics = [
    { x:-20, z:-18, w:7, d:5, h:7,  color:'#6688cc', roof:'#4466aa', label:'Springfield Mall'     },
    { x:-25, z:  0, w:6, d:4, h:4,  color:'#ccaa55', roof:'#aa8833', label:'Springfield DMV'      },
    { x: 25, z:  5, w:6, d:5, h:8,  color:'#aa55cc', roof:'#883399', label:'Springfield Coliseum' },
    { x:  6, z: 18, w:5, d:5, h:5,  color:'#88ccaa', roof:'#66aaaa', label:'Hospital'             },
    { x: 12, z: -8, w:5, d:4, h:5,  color:'#dd3333', roof:'#bb1111', label:"Android's Dungeon"    },
  ];

  return (
    <group>
      <MoesTavern    pos={moesPos}   destFor="homer" />
      <KrustyBurger  pos={krustyPos} />
      <KwikEMart     pos={kwikEPos}  destFor="marge" />
      <SpringfieldElementary pos={elemPos} destFor="bart" />
      <PublicLibrary pos={libPos}    destFor="lisa" />
      <NuclearPlant  pos={nuclearPos} />
      <CityHall      pos={cityHallPos} />
      <FirstChurch   pos={churchPos} />
      <LardLad       pos={lardPos}   />
      <PoliceDept    pos={policePos} />
      {generics.map((b,i) => <GenBuilding key={i} b={b} />)}
    </group>
  );
}


// ─── Destination Zones (glowing rings) ───────────────────────────────────────

function DestinationZone({ charId, pos, done }) {
  const ring = useRef();
  const charCfg = CHARACTERS.find(c => c.id === charId);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    ring.current.rotation.y = clock.elapsedTime * 1.5;
    const s = done ? 1.0 : 0.85 + Math.sin(clock.elapsedTime * 3) * 0.15;
    ring.current.scale.setScalar(s);
  });
  if (done) return null;
  return (
    <group position={[pos.x, 0.1, pos.z]} ref={ring}>
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[CONFIG.DEST_RADIUS - 0.4, CONFIG.DEST_RADIUS, 32]} />
        <meshBasicMaterial color={charCfg?.shirt || '#fff'} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <Html center position={[0, 0.3, 0]}>
        <div style={{ fontSize:20, pointerEvents:'none', textShadow:'0 0 8px #fff' }}>
          {charCfg?.goalEmoji}
        </div>
      </Html>
      <pointLight color={charCfg?.shirt || '#fff'} intensity={3} distance={8} decay={2} />
    </group>
  );
}

// ─── Power-Ups ────────────────────────────────────────────────────────────────

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
      <Html center position={[0, 0.9, 0]}>
        <div style={{ fontSize:18, pointerEvents:'none' }}>{cfg.emoji}</div>
      </Html>
      <pointLight color={cfg.color} intensity={2} distance={5} decay={2} />
    </group>
  );
}

// ─── Alien UFO ────────────────────────────────────────────────────────────────

// ─── UFO visual component ────────────────────────────────────────────────────

function AlienUFO({ isSlowed }) {
  const innerRef = useRef();
  useFrame(({ clock }) => {
    if (innerRef.current)
      innerRef.current.material.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 4) * 0.3;
  });
  const col = isSlowed ? '#888' : '#33cc44';
  const domCol = isSlowed ? '#aaa' : '#99ffaa';
  return (
    <>
      <mesh castShadow>
        <cylinderGeometry args={[3.2, 3.8, 0.75, 18]} />
        <meshStandardMaterial color={col} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <sphereGeometry args={[1.6, 16, 8, 0, Math.PI*2, 0, Math.PI/2]} />
        <meshStandardMaterial color={domCol} transparent opacity={0.7} />
      </mesh>
      <mesh ref={innerRef} position={[0,-0.3,0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.15, 12]} />
        <meshStandardMaterial color="#00ff66" emissive="#00ff66" emissiveIntensity={0.5} />
      </mesh>
      {[0,1,2,3,4,5].map(idx => (
        <mesh key={idx} position={[Math.cos(idx/6*Math.PI*2)*2.2, 0, Math.sin(idx/6*Math.PI*2)*2.2]}>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshBasicMaterial color={isSlowed ? '#444' : '#ffff44'} />
        </mesh>
      ))}
      <pointLight position={[0,-1,0]} color={isSlowed ? '#334' : '#00ff44'} intensity={isSlowed ? 1 : 5} distance={14} decay={2} />
    </>
  );
}

// ─── Single UFO controller (self-managing movement + firing) ─────────────────

function UFOController({ ufoId, startX, startZ, activeCharGroupRef, alienSlowEndRef, scoreRef, onFire }) {
  const groupRef = useRef();
  const vel      = useRef(new THREE.Vector3(
    (ufoId % 2 === 0 ? 1 : -1) * (0.3 + ufoId * 0.08),
    0,
    (ufoId % 3 === 0 ? 1 : -1) * (0.25 + ufoId * 0.06)
  ));
  const fireTimer = useRef(2.0 + ufoId * 2.8);

  useFrame(({ clock }, delta) => {
    const g = groupRef.current; if (!g) return;
    const slowed   = Date.now() < alienSlowEndRef.current;
    const speedMul = slowed ? 0.15 : 1.0;

    g.position.x += vel.current.x * delta * speedMul * 9;
    g.position.z += vel.current.z * delta * speedMul * 9;
    g.position.y  = 13 + Math.sin(clock.elapsedTime * 0.7 + ufoId * 2.1) * 1.8;
    g.rotation.y  = clock.elapsedTime * 0.4;

    if (Math.abs(g.position.x) > 48) vel.current.x *= -1;
    if (Math.abs(g.position.z) > 48) vel.current.z *= -1;

    fireTimer.current -= delta * speedMul;
    if (fireTimer.current <= 0) {
      const baseInterval = Math.max(1.5, 3.5 - (scoreRef.current / 500));
      fireTimer.current = baseInterval * (0.7 + Math.random() * 0.6);
      const target = activeCharGroupRef?.current;
      if (target) onFire(g.position.clone(), target.position.clone(), ufoId);
    }
  });

  const slowed = false; // visual-only, updated separately
  return (
    <group ref={groupRef} position={[startX, 13, startZ]}>
      <AlienUFO isSlowed={slowed} />
    </group>
  );
}

// ─── Alien System (orchestrates UFOs + lasers) ────────────────────────────────

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
    const jitter = new THREE.Vector3((Math.random()-0.5)*5, 0, (Math.random()-0.5)*5);
    const to = targetPos.clone().add(jitter);
    audio.sfx('laser');
    setLasers(l => [...l.slice(-12), {
      id: Date.now() + ufoId * 1000 + Math.random(),
      from:    [fromPos.x, fromPos.y, fromPos.z],
      to:      [to.x, 0, to.z],
      target:  [targetPos.x, targetPos.y, targetPos.z],
      charIdx: state.activeCharIdx,
      color:   LASER_COLS[ufoId] || '#ff2200',
    }]);
  };

  const expireLaser = id => setLasers(l => l.filter(x => x.id !== id));
  const hitChar     = charIdx => { actions.hitChar(charIdx); audio.sfx('hit'); };

  return (
    <>
      {UFO_STARTS.slice(0, numUFOs).map(([sx, sz], i) => (
        <UFOController
          key={i} ufoId={i} startX={sx} startZ={sz}
          activeCharGroupRef={charGroupRefs.current[state.activeCharIdx]}
          alienSlowEndRef={alienSlowEndRef}
          scoreRef={scoreRef}
          onFire={handleFire}
        />
      ))}
      {lasers.map(l => (
        <LaserBeam key={l.id} laser={l} onExpire={expireLaser} onHit={hitChar} />
      ))}
    </>
  );
}

function Atmosphere() {
  return (
    <>
      <Sky sunPosition={[80, 40, 20]} turbidity={0.4} rayleigh={0.6} mieCoefficient={0.003} />
      <directionalLight position={[80, 60, 20]} intensity={1.8} castShadow
        shadow-mapSize={[2048, 2048]} color="#fff8f0"
        shadow-camera-near={0.5} shadow-camera-far={200}
        shadow-camera-left={-80} shadow-camera-right={80}
        shadow-camera-top={80}   shadow-camera-bottom={-80} />
      <ambientLight intensity={0.5} color="#cceeff" />
      <hemisphereLight skyColor="#87ceeb" groundColor="#557755" intensity={0.4} />
    </>
  );
}

// ─── Camera (identical logic, follows active character) ──────────────────────

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

// ─── Player Controller (identical physics, Tab to switch, Q for ability) ──────

function PlayerController() {
  const { state, actions, charGroupRefs, playerPosRef } = useContext(GameContext);
  const vel          = useRef(new THREE.Vector3());
  const isSwimmingRef = useRef(false);
  const movingRef    = useRef(false);
  const lastStep     = useRef(0);
  const lastSend     = useRef(0);
  const { clock }    = useThree();

  useFrame(({clock}, delta) => {
    if (state.phase !== 'play') return;

    // ── Tab: switch character ──
    if (keyState['tab'] && !keyState.prevTab) {
      actions.nextChar();
      vel.current.set(0, 0, 0);
    }
    keyState.prevTab = keyState['tab'];

    // ── Q: use ability ──
    if (keyState['q'] && !keyState.prevQ) {
      actions.useAbility(state.activeCharIdx);
      audio.sfx('emp');
    }
    keyState.prevQ = keyState['q'];

    const g = charGroupRefs.current[state.activeCharIdx]?.current;
    if (!g) return;

    const charCfg   = CHARACTERS[state.activeCharIdx];
    const charState = state.chars[state.activeCharIdx];
    const boosted   = Date.now() < (charState?.speedBoostEnd || 0);
    const baseSpeed = charCfg.speed * (boosted ? 1.6 : 1.0);
    const acF = Math.min(1, CONFIG.ACCEL * delta);
    const dcF = Math.min(1, CONFIG.DECEL * delta);

    const mx = (keyState['a']?-1:0) + (keyState['d']?1:0);
    const mz = (keyState['w']?-1:0) + (keyState['s']?1:0);

    if (mx || mz) {
      const angle = Math.atan2(mx, mz) + camState.yaw;
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, Math.sin(angle)*baseSpeed, acF);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, Math.cos(angle)*baseSpeed, acF);
    } else {
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, 0, dcF);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, 0, dcF);
    }

    // Gravity
    vel.current.y -= CONFIG.GRAVITY * delta;

    g.position.x = Math.max(-CONFIG.BOUNDS, Math.min(CONFIG.BOUNDS, g.position.x + vel.current.x * delta));
    g.position.z = Math.max(-CONFIG.BOUNDS, Math.min(CONFIG.BOUNDS, g.position.z + vel.current.z * delta));
    g.position.y += vel.current.y * delta;

    // Flat ground snap
    if (g.position.y <= 0) { g.position.y = 0; vel.current.y = 0; }
    const isGrounded = g.position.y <= 0.01;

    isSwimmingRef.current = false;

    if (keyState[' '] && isGrounded) vel.current.y = CONFIG.JUMP_FORCE;

    const spd2D = Math.hypot(vel.current.x, vel.current.z);
    movingRef.current = spd2D > 0.5;

    if (movingRef.current) {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), Math.min(1, 15*delta));
      lastStep.current += spd2D * delta;
      if (lastStep.current > 1.3) { audio.sfx('step'); lastStep.current = 0; }
    }

    playerPosRef.current.copy(g.position);

    // ── Check arrival at destination ──
    const charDef  = charCfg;
    const charSt   = state.chars[state.activeCharIdx];
    if (!charSt?.done) {
      const dist = g.position.distanceTo(charDef.dest);
      if (dist < CONFIG.DEST_RADIUS) {
        actions.charArrived(charDef.id);
        actions.showQuip(`${charDef.emoji} ${charDef.name} made it to ${charDef.goal}!`);
        audio.sfx('arrive');
        g.position.copy(charDef.dest);
        vel.current.set(0, 0, 0);
      }
    }

    // ── Check power-up pickup ──
    state.powerUps.forEach(pu => {
      if (!pu.active) return;
      const dx = g.position.x - pu.x, dz = g.position.z - pu.z;
      if (Math.hypot(dx, dz) < CONFIG.PICKUP_RADIUS) {
        actions.collectPowerUp(pu.id, pu.type, state.activeCharIdx);
        actions.showQuip(`${POWERUP_CONFIG[pu.type].emoji} ${POWERUP_CONFIG[pu.type].label}!`);
        audio.sfx('pickup');
      }
    });

    // ── Multiplayer sync ──
      if (ablyChannel && clock.elapsedTime - lastSend.current > 0.05) {
       ablyChannel.publish('move', { position: g.position, rotation: { y: g.rotation.y }, isMoving: movingRef.current, charId: charDef.id });
       lastSend.current = clock.elapsedTime;
      }
  });

  return null;
}

// ─── All four Simpsons characters ────────────────────────────────────────────

function SimpsonsCharacters() {
  const { state, charGroupRefs } = useContext(GameContext);

  return (
    <>
      {CHARACTERS.map((charCfg, idx) => {
        const charSt  = state.chars[idx];
        const isActive = idx === state.activeCharIdx;
        const isDone   = charSt?.done;
        const isShielded = charSt?.shieldActive;

        return (
          <group
            key={charCfg.id}
            ref={charGroupRefs.current[idx]}
            position={charCfg.startPos.toArray()}
          >
            {/* Shield bubble */}
            {isShielded && (
              <mesh>
                <sphereGeometry args={[1.8, 16, 16]} />
                <meshBasicMaterial color="#aaaaff" transparent opacity={0.25} side={THREE.DoubleSide} />
              </mesh>
            )}
            <SimpsonsRig
              charCfg={charCfg}
              isNPC={!isActive || state.phase !== 'play'}
              npcMovingRef={{ current: false }}
            />
            {/* Nametag */}
            <Html position={[0, 2.9, 0]} center occlude>
              <div style={{
                background: isActive ? charCfg.shirt : 'rgba(0,0,0,0.6)',
                color: isActive ? '#111' : '#fff',
                padding: '2px 10px', borderRadius: 12, fontSize: 12,
                border: `3px solid ${isActive ? '#FFD90F' : '#555'}`,
                fontWeight: 'bold', pointerEvents: 'none', whiteSpace: 'nowrap',
                fontFamily: 'Arial Black, Arial, sans-serif',
                opacity: isDone ? 0.4 : 1,
              }}>
                {charCfg.emoji} {charCfg.name} {isDone ? '✅' : isActive ? '◀' : ''}
              </div>
            </Html>
            <ContactShadows opacity={isDone ? 0.1 : 0.45} scale={4} blur={2.5} position={[0,0.02,0]} />
          </group>
        );
      })}
    </>
  );
}

// ─── Network Players ──────────────────────────────────────────────────────────

function NetworkPlayer({ data }) {
  const ref = useRef();
  const movingRef = useRef(false);
  useFrame((_,delta) => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(data.position.x, data.position.y, data.position.z), 10*delta);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, data.rotation.y, 10*delta);
    movingRef.current = data.isMoving;
  });
  const charCfg = CHARACTERS.find(c => c.id === data.charId) || CHARACTERS[0];
  return (
    <group ref={ref}>
      <SimpsonsRig charCfg={charCfg} isNPC npcMovingRef={movingRef} />
      <Html position={[0,2.8,0]} center>
        <div style={{ background:'rgba(0,0,0,0.6)', color:'#FFD90F', padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:'bold', border:'2px solid #FFD90F', whiteSpace:'nowrap' }}>
          {data.name} ({charCfg.name})
        </div>
      </Html>
    </group>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function GameUI() {
  const { state, actions } = useContext(GameContext);
  const [chatText, setChatText] = useState('');

  const startGame = () => {
    if (socket) {
      socket.emit('join', { name: 'Player', charId: 'homer' });
    }
    audio.init(); audio.playBGM();
    actions.setPhase('play');
    // Reposition character groups to start positions
    // (done via default position in SimpsonsCharacters)
  };

const connectToServer = async (name) => {
  if (ablyClient) return;
  // Initialize Ably
  ablyClient = new Ably.Realtime({ key: ABLY_API_KEY, clientId: name });
  ablyChannel = ablyClient.channels.get('springfield-siege');

  // Subscribe to movement
  ablyChannel.subscribe('move', (msg) => {
    if (msg.clientId === name) return;
    actions.setOnlinePlayers(prev => ({ ...prev, [msg.clientId]: msg.data }));
  });

  // Subscribe to chat
  ablyChannel.subscribe('chat', (msg) => {
    actions.addChatMessage({ name: msg.clientId, text: msg.data });
  });

  // Handle players leaving via Presence
  ablyChannel.presence.subscribe('leave', (m) => {
    actions.setOnlinePlayers(prev => {
      const n = {...prev};
      delete n[m.clientId];
      return n;
    });
  });

  await ablyChannel.presence.enter({ charId: 'homer' });
};

const startGame = () => {
  audio.init(); 
  audio.playBGM();
  // Generate a random ID for now or use a prompt
  connectToServer("Player_" + Math.floor(Math.random()*1000)); 
  actions.setPhase('play');
};

  // ── Start Screen ──
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
          Arrow keys rotate camera · Walk to destination ring to complete · Collect power-ups!
        </div>

        <button style={ST.startBtn} onClick={startGame}>
          🛸 START — SAVE THE SIMPSONS!
        </button>
      </div>
    </div>
  );

  // ── Win Screen ──
  if (state.phase === 'win') return (
    <div style={ST.overlay}>
      <div style={{ ...ST.modal, maxWidth: 440 }}>
        <div style={{ fontSize: 60 }}>🏆</div>
        <h1 style={{ fontFamily:'Impact, Arial Black', fontSize:38, color:'#FFD90F', textShadow:'2px 2px 0 #ff8800', margin:'8px 0' }}>
          EXCELLENT!
        </h1>
        <p style={{ fontFamily:'Arial,sans-serif', color:'#333', fontSize:18 }}>All Simpsons reached safety!</p>
        <p style={{ fontFamily:'Arial,sans-serif', fontSize:22, fontWeight:'bold', color:'#e74c3c' }}>Score: {state.score}</p>
        <button style={ST.startBtn} onClick={() => { actions.reset(); setTimeout(() => actions.setPhase('play'), 100); }}>
          🔄 Play Again
        </button>
      </div>
    </div>
  );

  // ── Game Over Screen ──
  if (state.phase === 'gameover') return (
    <div style={{ ...ST.overlay, background:'linear-gradient(180deg,#1a0000,#330000)' }}>
      <div style={{ ...ST.modal, maxWidth: 420, border:'4px solid #ff0000' }}>
        <div style={{ fontSize:60 }}>💀</div>
        <h1 style={{ fontFamily:'Impact, Arial Black', fontSize:40, color:'#ff2222', textShadow:'2px 2px 0 #000', margin:'8px 0' }}>
          D'OH!
        </h1>
        <p style={{ fontFamily:'Arial,sans-serif', color:'#555', fontSize:16 }}>The aliens got the Simpsons!</p>
        <p style={{ fontFamily:'Arial,sans-serif', fontSize:20, fontWeight:'bold', color:'#333' }}>Final Score: {state.score}</p>
        <button style={{ ...ST.startBtn, background:'#cc0000' }} onClick={() => { actions.reset(); setTimeout(() => actions.setPhase('play'), 100); }}>
          🔄 Try Again
        </button>
      </div>
    </div>
  );

  // ── In-Game HUD ──
  const completedCount = state.chars.filter(c => c.done).length;

  return (
    <>
      {/* Quip notification */}
      {state.quip && (
        <div style={ST.quip}>{state.quip}</div>
      )}

      {/* Top-left: lives + score */}
      <div style={ST.topLeft}>
        <div style={{ fontSize:22, letterSpacing:3 }}>
          {'❤️'.repeat(state.lives)}{'🖤'.repeat(Math.max(0, 3-state.lives))}
        </div>
        <div style={{ fontSize:13, color:'#666', marginTop:2, fontFamily:'Arial,sans-serif' }}>
          Score: <b>{state.score}</b>
        </div>
      </div>

      {/* Top-right: character status */}
      <div style={ST.topRight}>
        <div style={{ fontSize:12, fontWeight:'bold', marginBottom:4, color:'#555', fontFamily:'Arial Black' }}>SPRINGFIELD FAMILY</div>
        {CHARACTERS.map((c, i) => {
          const cs   = state.chars[i];
          const isAct = i === state.activeCharIdx;
          const speedOn = Date.now() < (cs?.speedBoostEnd || 0);
          const slowOn  = Date.now() < (cs?.slowTimeEnd   || 0);
          return (
            <div key={c.id} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'4px 8px', borderRadius:8, marginBottom:3,
              background: isAct ? '#fffbe6' : 'rgba(255,255,255,0.4)',
              border: isAct ? '2px solid #FFD90F' : '2px solid transparent',
              opacity: cs?.done ? 0.4 : 1,
              fontFamily: 'Arial, sans-serif', fontSize: 13,
              cursor: 'pointer',
            }} onClick={() => actions.switchChar(i)}>
              <span>{c.emoji}</span>
              <span style={{ fontWeight: isAct ? 'bold' : 'normal' }}>{c.name}</span>
              {cs?.done && <span style={{ color:'#27ae60' }}>✅</span>}
              {isAct && !cs?.done && <span>▶</span>}
              {cs?.shieldActive && <span title="Shield active">🛡️</span>}
              {speedOn && <span title="Speed boost">🏃</span>}
              {slowOn  && <span title="Slow time active">🕐</span>}
              <span style={{ marginLeft:'auto', color:'#999', fontSize:11 }}>
                {c.goalEmoji} {c.goal.split(' ')[0]}...
              </span>
            </div>
          );
        })}
        <div style={{ marginTop:4, fontSize:11, color:'#888', fontFamily:'Arial,sans-serif' }}>
          <kbd style={ST.kbd}>Tab</kbd> switch · <kbd style={ST.kbd}>Q</kbd> ability
        </div>
      </div>

      {/* Bottom: mission status */}
      <div style={ST.goalBox}>
        <span style={{ fontWeight:'bold', fontFamily:'Arial Black' }}>
          🎯 {completedCount}/4 safe
        </span>
        {state.activeCharIdx < CHARACTERS.length && (
          <span style={{ marginLeft:12, color:'#555', fontFamily:'Arial,sans-serif', fontSize:13 }}>
            {CHARACTERS[state.activeCharIdx].emoji} {CHARACTERS[state.activeCharIdx].name} → {CHARACTERS[state.activeCharIdx].goalEmoji} {CHARACTERS[state.activeCharIdx].goal}
          </span>
        )}
      </div>

      {/* Chat */}
      <div style={ST.chatArea}>
        <div style={ST.chatLog}>
          {state.chatMessages.map((m,i) => (
            <div key={i}><b style={{ color: '#FFD90F' }}>{m.name}:</b> {m.text}</div>
          ))}
        </div>
        <input style={ST.chatInput} placeholder="Chat..." value={chatText}
          onChange={e => setChatText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && chatText.trim()) {
              actions.addChatMessage({ name: 'You', text: chatText });
              if (socket) ablyChannel?.publish('chat',
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
      const k = e.key.toLowerCase();
      keyState[k] = true;
      if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
      if (k === 'tab') e.preventDefault();
    };
    const onUp = e => { keyState[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', onDown, { passive: false });
    window.addEventListener('keyup',   onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  return (
    <div style={{ width:'100vw', height:'100vh', position:'relative', background:'#87ceeb' }}>
      <GameContext.Provider value={store}>
        <Canvas shadows dpr={[1,2]} camera={{ fov:46, position:[0,12,18] }}
          gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping, toneMappingExposure:1.1 }}>
          <Suspense fallback={
            <Html center>
              <div style={{ fontFamily:'Arial', color:'white', background:'rgba(0,0,0,0.6)', padding:'12px 24px', borderRadius:20 }}>
                🛸 Loading Springfield...
              </div>
            </Html>
          }>
            <Atmosphere />
            <Terrain />
            <StreetTrees />
            <StreetLamps />
            {PARKED_CARS.map((c,i) => <ParkCar key={i} {...c} />)}
            <SpringfieldBuildings />

            {/* Destination rings */}
            {CHARACTERS.map((c, i) => (
              <DestinationZone
                key={c.id} charId={c.id} pos={c.dest}
                done={store.state.chars[i]?.done}
              />
            ))}

            {/* Power-ups */}
            {store.state.powerUps.map(pu => <PowerUp key={pu.id} data={pu} />)}

            {/* All four Simpsons */}
            <SimpsonsCharacters />

            {/* Network players */}
            {Object.entries(store.state.onlinePlayers).map(([id, p]) => 
            ablyClient?.auth.clientId !== id && <NetworkPlayer key={id} data={{...p, name: id}} />
)}

            {/* Player physics controller */}
            {store.state.phase === 'play' && <PlayerController />}

            {/* Alien attack system */}
            {store.state.phase === 'play' && <AlienSystem />}

            <CameraRig />

            <EffectComposer multisampling={4}>
              <Bloom intensity={0.45} luminanceThreshold={0.85} luminanceSmoothing={0.4} />
              <Vignette darkness={0.35} offset={0.45} />
            </EffectComposer>
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
