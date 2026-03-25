/**
 * 🍩 SPRINGFIELD SURVIVAL - MULTIPLAYER EDITION
 * - Core engine, movement, and multiplayer intact.
 * - Simpsons characters (Homer, Bart, Lisa, Marge) with unique traits.
 * - Real-Time Switching (Keys 1, 2, 3, 4).
 * - Kang & Kodos Alien Laser Attacks.
 * - Individual Goals/Destinations.
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Stars, Html, Instance, Instances,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { io } from 'socket.io-client';

// ─── Multiplayer Config ───────────────────────────────────────────────────────
const SOCKET_URL = "http://192.168.1.129:3001";
let socket;

// ─── Math & Config ────────────────────────────────────────────────────────────

function getTerrainY(x, z) {
  const d = Math.sqrt(x * x + z * z);
  if (d > 55) return -2.5;
  let h = (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.0) + 
          (Math.sin(x * 0.05 + z * 0.04) * 1.5) + 
          (Math.cos(x * 0.2 + z * 0.2) * 0.5);
  return h * Math.max(0, 1 - Math.pow(d / 60, 4));
}

const camState = { yaw: Math.PI, pitch: 0.4, yawVel: 0, pitchVel: 0 };
const keyState = { prevE: false, prevQ: false };

const SQUAD_DATA = {
  Homer: { id: 'Homer', num: 1, color: { jacket: '#ffffff', pants: '#3366ff' }, speed: 0.85, trait: 'Tanky (+1 Hit)', target: "Moe's Tavern" },
  Bart:  { id: 'Bart',  num: 2, color: { jacket: '#ff4400', pants: '#0000ff' }, speed: 1.35, trait: 'Fast Movement', target: "School" },
  Lisa:  { id: 'Lisa',  num: 3, color: { jacket: '#ff0000', pants: '#ff0000' }, speed: 1.0,  trait: 'Time Slow (Press Q)', target: "Library" },
  Marge: { id: 'Marge', num: 4, color: { jacket: '#00ff00', pants: '#0000ff' }, speed: 1.0,  trait: 'Shielded (Blocks 1)', target: "Kwik-E-Mart" }
};

const DESTINATIONS = {
  Homer: { x: -30, z: -30, color: '#ff4444' }, // Moe's
  Bart:  { x: 30,  z: -30, color: '#ffee00' }, // School
  Lisa:  { x: -30, z: 30,  color: '#4444ff' }, // Library
  Marge: { x: 30,  z: 30,  color: '#44ff44' }  // Kwik-E-Mart
};

const CONFIG = {
  SPEED: 6.5, ACCEL: 12, DECEL: 15, GRAVITY: 35, JUMP_FORCE: 14,
};

// ─── Store ────────────────────────────────────────────────────────────────────

const GameContext = createContext();

const useIslandStore = () => {
  const playerPosRef   = useRef(new THREE.Vector3(0, 1, 0));
  const playerGroupRef = useRef();

  // Shared refs for the physics engine to read without triggering re-renders
  const squadPosRef = useRef({
    Homer: new THREE.Vector3(-4, 1, 0),
    Bart:  new THREE.Vector3(-1.5, 1, 0),
    Lisa:  new THREE.Vector3(1.5, 1, 0),
    Marge: new THREE.Vector3(4, 1, 0),
  });

  const [state, setState] = useState({
    ui: 'start',
    gameTime: 14.0,
    playerName: '',
    lives: 3,
    alienLevel: 1,
    timeSlowed: 0,
    activeChar: 'Homer',
    squadStatus: {
      Homer: { safe: false, armor: 1 },
      Bart:  { safe: false, armor: 0 },
      Lisa:  { safe: false, armor: 0 },
      Marge: { safe: false, armor: 1 } // Marge's shield
    },
    onlinePlayers: {},
    chatMessages: [],
  });

  const actions = useMemo(() => ({
    setUI:           (v) => setState(s => ({ ...s, ui: v })),
    setPlayerName:   (n) => setState(s => ({ ...s, playerName: n })),
    tickTime:        ()  => setState(s => ({ ...s, gameTime: (s.gameTime + 0.05) % 24 })),
    setActiveChar:   (c) => setState(s => ({ ...s, activeChar: c })),
    setOnlinePlayers:(p) => setState(s => ({ ...s, onlinePlayers: p })),
    addChatMessage:  (m) => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-8), m] })),
    
    // Gameplay Actions
    hitCharacter: (charId) => setState(s => {
      if (s.squadStatus[charId].safe) return s; // Ignore safe characters
      const st = { ...s.squadStatus[charId] };
      if (st.armor > 0) {
        st.armor -= 1;
        return { ...s, squadStatus: { ...s.squadStatus, [charId]: st } };
      }
      return { ...s, lives: Math.max(0, s.lives - 1) };
    }),
    markSafe: (charId) => setState(s => ({
      ...s, squadStatus: { ...s.squadStatus, [charId]: { ...s.squadStatus[charId], safe: true } }
    })),
    triggerTimeSlow: () => setState(s => ({ ...s, timeSlowed: Date.now() + 4000 })),
    increaseDifficulty: () => setState(s => ({ ...s, alienLevel: s.alienLevel + 0.5 }))
  }), []);

  return { state, actions, playerPosRef, playerGroupRef, squadPosRef };
};

// ─── Audio ────────────────────────────────────────────────────────────────────
class GameAudio {
  constructor() { this.ctx = null; this.master = null; }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.15;
    this.master.connect(this.ctx.destination);
  }
  sfx(type) {
    if (!this.ctx) return;
    if (type === 'step') {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
      const d = buf.getChannelData(0); for(let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800;
      const g = this.ctx.createGain(); g.gain.value = 0.3;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    }
    if (type === 'laser') {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0.2, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
      osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime + 0.3);
    }
    if (type === 'safe') {
      const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, this.ctx.currentTime); osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.1, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
      osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime + 0.5);
    }
  }
}
const audio = new GameAudio();

// ═══════════════════════════════════════════════════════════════════════════════
//  BIPED ANIMATION ENGINE (Simpsons Theme)
// ═══════════════════════════════════════════════════════════════════════════════

const matSkin  = new THREE.MeshStandardMaterial({ color: '#ffd90f', roughness: 0.6 }); // Simpsons Yellow
const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });

function stdMat(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 }); }

function useHumanAnim({ velRef, isSwimmingRef, isNPC, npcMovingRef }) {
  const body = useRef(); const head = useRef(); 
  const armL = useRef(); const armR = useRef(); 
  const legL = useRef(); const legR = useRef();
  const walk = useRef(0);

  useFrame((_, delta) => {
    let moving = false, swimming = false;
    if (isNPC && npcMovingRef) { moving = npcMovingRef.current; } 
    else if (velRef && isSwimmingRef) {
      moving = Math.sqrt(velRef.current.x**2 + velRef.current.z**2) > 0.5;
      swimming = isSwimmingRef.current;
    }

    if (moving) walk.current += delta * (swimming ? 5 : 14);
    
    if (body.current) {
      body.current.position.y = swimming ? -0.2 : 1.0;
      if (moving && !swimming) body.current.position.y += Math.abs(Math.sin(walk.current * 2)) * 0.08;
    }
    if (head.current) head.current.rotation.y = moving ? Math.sin(walk.current) * 0.1 : 0;
    
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
      if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, 0, 0.1);
      if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, 0, 0.1);
      if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, 0, 0.1);
      if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, 0, 0.1);
    }
  });
  return { body, head, armL, armR, legL, legR };
}

function SimpsonRig(props) {
  const { body, head, armL, armR, legL, legR } = useHumanAnim(props);
  const jacketMat = useMemo(() => stdMat(props.colors?.jacket || '#333'), [props.colors]);
  const pantsMat  = useMemo(() => stdMat(props.colors?.pants || '#111'), [props.colors]);

  return (
    <group ref={body} position={[0, 1.0, 0]} opacity={props.opacity} transparent={props.opacity < 1}>
      <mesh material={jacketMat} castShadow><boxGeometry args={[0.6, 0.8, 0.4]} /></mesh>
      <group ref={head} position={[0, 0.6, 0]}>
        <mesh material={matSkin} castShadow><boxGeometry args={[0.45, 0.5, 0.45]} /></mesh>
        <mesh material={jacketMat} position={[0, 0.28, -0.05]} castShadow><boxGeometry args={[0.5, 0.15, 0.5]} /></mesh>
        <mesh material={matBlack} position={[-0.1, 0.05, 0.23]}><boxGeometry args={[0.06, 0.06, 0.02]} /></mesh>
        <mesh material={matBlack} position={[0.1, 0.05, 0.23]}><boxGeometry args={[0.06, 0.06, 0.02]} /></mesh>
      </group>
      <group ref={armL} position={[-0.4, 0.3, 0]}>
        <mesh material={jacketMat} position={[0, -0.3, 0]} castShadow><boxGeometry args={[0.2, 0.7, 0.2]} /></mesh>
        <mesh material={matSkin} position={[0, -0.7, 0]} castShadow><boxGeometry args={[0.15, 0.15, 0.15]} /></mesh>
      </group>
      <group ref={armR} position={[0.4, 0.3, 0]}>
        <mesh material={jacketMat} position={[0, -0.3, 0]} castShadow><boxGeometry args={[0.2, 0.7, 0.2]} /></mesh>
        <mesh material={matSkin} position={[0, -0.7, 0]} castShadow><boxGeometry args={[0.15, 0.15, 0.15]} /></mesh>
      </group>
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

// ─── Terrain & Environment ────────────────────────────────────────────────────

function makeSandTexture() {
  const S = 256; const c = document.createElement('canvas'); c.width = c.height = S; const ctx = c.getContext('2d');
  ctx.fillStyle = '#6ab04c'; ctx.fillRect(0, 0, S, S); // Green grass base
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 1 + Math.random() * 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,0.05)`; ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
}

function Terrain() {
  const sandTex = useMemo(() => makeSandTexture(), []);
  const geoBase = useMemo(() => {
    const g = new THREE.PlaneGeometry(150, 150, 128, 128); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, getTerrainY(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals(); return g;
  }, []);

  return (
    <group>
      <mesh geometry={geoBase} receiveShadow name="ground">
        <meshStandardMaterial map={sandTex} roughness={0.9} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.18, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#38b4e8" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// ─── Kang & Kodos Alien Attack ────────────────────────────────────────────────

function AlienAttacks() {
  const { state, actions, squadPosRef } = useContext(GameContext);
  const [lasers, setLasers] = useState([]);
  
  // Difficulty Scaling
  useEffect(() => {
    if (state.ui !== 'play' || state.lives <= 0) return;
    const diffTimer = setInterval(() => actions.increaseDifficulty(), 15000);
    return () => clearInterval(diffTimer);
  }, [state.ui, state.lives]);

  // Spawner
  useFrame(({ clock }) => {
    if (state.ui !== 'play' || state.lives <= 0) return;
    
    // Lisa's trait: Slows down spawn rate
    const isSlowed = Date.now() < state.timeSlowed;
    const baseRate = Math.max(0.5, 3.0 - (state.alienLevel * 0.3)); // Gets faster
    const spawnRate = isSlowed ? baseRate * 3 : baseRate; 

    if (clock.elapsedTime % spawnRate < 0.05) {
      // Pick a random vulnerable character to target near
      const vulnerable = Object.keys(state.squadStatus).filter(k => !state.squadStatus[k].safe);
      if (vulnerable.length === 0) return; // You won!

      const targetId = vulnerable[Math.floor(Math.random() * vulnerable.length)];
      const charPos = squadPosRef.current[targetId];
      
      const lx = charPos.x + (Math.random() - 0.5) * 10;
      const lz = charPos.z + (Math.random() - 0.5) * 10;
      const ly = getTerrainY(lx, lz);

      const id = Math.random();
      setLasers(prev => [...prev, { id, x: lx, y: ly, z: lz, time: clock.elapsedTime, fired: false }]);
    }

    // Laser hit detection
    setLasers(prev => prev.map(l => {
      if (!l.fired && clock.elapsedTime - l.time > 1.5) {
        // BOOM
        audio.sfx('laser');
        
        // Check all characters in radius
        const blastRadius = 3.5;
        ['Homer', 'Bart', 'Lisa', 'Marge'].forEach(charId => {
          if (state.squadStatus[charId].safe) return;
          const pos = squadPosRef.current[charId];
          const dist = Math.sqrt((pos.x - l.x)**2 + (pos.z - l.z)**2);
          if (dist < blastRadius) {
            actions.hitCharacter(charId);
          }
        });

        return { ...l, fired: true };
      }
      return l;
    }).filter(l => clock.elapsedTime - l.time < 2.0)); // Remove after 2s
  });

  return (
    <group>
      {lasers.map(l => (
        <group key={l.id} position={[l.x, l.y, l.z]}>
          {!l.fired && (
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 0]}>
              <ringGeometry args={[0, 3.5, 32]} />
              <meshBasicMaterial color="red" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
          )}
          {l.fired && (
            <mesh position={[0, 10, 0]}>
              <cylinderGeometry args={[0.5, 3.5, 20, 16]} />
              <meshBasicMaterial color="#00ff00" transparent opacity={0.8} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Map Destinations ─────────────────────────────────────────────────────────

function DestinationZones() {
  const { state } = useContext(GameContext);
  
  return (
    <group>
      {Object.entries(DESTINATIONS).map(([char, data]) => {
        const y = getTerrainY(data.x, data.z);
        const isSafe = state.squadStatus[char].safe;
        return (
          <group key={char} position={[data.x, y, data.z]}>
            <mesh position={[0, 2, 0]}>
              <boxGeometry args={[4, 4, 4]} />
              <meshStandardMaterial color={isSafe ? '#ffffff' : data.color} transparent opacity={isSafe ? 0.2 : 0.6} />
            </mesh>
            <Html position={[0, 5, 0]} center>
              <div style={{ background: data.color, padding: '4px 8px', borderRadius: 8, color: 'white', fontWeight: 'bold', fontSize: 14, border: '2px solid white' }}>
                {isSafe ? '✔️ SECURED' : SQUAD_DATA[char].target}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
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

// ─── Local Player Controller (Real-Time Switching) ────────────────────────────

function PlayerController() {
  const { state, actions, playerPosRef, playerGroupRef, squadPosRef } = useContext(GameContext);
  const vel       = useRef(new THREE.Vector3());
  const movingRef = useRef(false);
  const isSwimmingRef = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const downVec   = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const { scene } = useThree();
  const lastSend  = useRef(0);
  const lastActive = useRef(state.activeChar);

  // Instant Character Switch Logic
  useEffect(() => {
    if (lastActive.current !== state.activeChar) {
      // 1. Save outgoing character's position
      squadPosRef.current[lastActive.current].copy(playerGroupRef.current.position);
      
      // 2. Teleport the controller to the incoming character's position
      const newPos = squadPosRef.current[state.activeChar];
      playerGroupRef.current.position.copy(newPos);
      
      // 3. Reset velocity
      vel.current.set(0,0,0);
      lastActive.current = state.activeChar;
    }
  }, [state.activeChar]);

  useFrame(({ clock }, delta) => {
    const g = playerGroupRef.current;
    if (!g || state.ui !== 'play' || state.lives <= 0) return;

    // Lisa Trait: Q for Time Slow
    if (state.activeChar === 'Lisa' && keyState['q'] && !keyState.prevQ && Date.now() > state.timeSlowed) {
      actions.triggerTimeSlow();
    }
    keyState.prevQ = keyState['q'];

    const activeData = SQUAD_DATA[state.activeChar];
    const mx = (keyState['a'] ? -1 : 0) + (keyState['d'] ? 1 : 0);
    const mz = (keyState['w'] ? -1 : 0) + (keyState['s'] ? 1 : 0);

    const accelFactor = Math.min(1, CONFIG.ACCEL * delta);
    const decelFactor = Math.min(1, CONFIG.DECEL * delta);
    
    // Apply Character Trait Speed Multiplier
    const targetSpeed = (isSwimmingRef.current ? CONFIG.SPEED * 0.45 : CONFIG.SPEED) * activeData.speed;

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
    let isGrounded = false, isSwimming = false;
    
    if (ground) {
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0) {
        let floorHeight = hits[0].point.y + 0.05;
        if (floorHeight < -1.0) { floorHeight = -1.0; isSwimming = true; }
        if (g.position.y <= floorHeight + 0.3 && vel.current.y <= 0) {
          g.position.y = floorHeight; isGrounded = true; vel.current.y = 0;
        }
      }
    }

    isSwimmingRef.current = isSwimming;

    if (keyState[' '] && isGrounded && !isSwimming) vel.current.y = CONFIG.JUMP_FORCE;

    const spd2D = Math.sqrt(vel.current.x ** 2 + vel.current.z ** 2);
    movingRef.current = spd2D > 0.5 && isGrounded; 

    if (movingRef.current) {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), Math.min(1, 15 * delta));
    }

    // Keep refs updated for Alien Targeting
    playerPosRef.current.copy(g.position);
    squadPosRef.current[state.activeChar].copy(g.position);

    // Goal Checking
    if (!state.squadStatus[state.activeChar].safe) {
      const dest = DESTINATIONS[state.activeChar];
      const distToGoal = Math.sqrt((g.position.x - dest.x)**2 + (g.position.z - dest.z)**2);
      if (distToGoal < 4) {
        actions.markSafe(state.activeChar);
        audio.sfx('safe');
      }
    }

    // Network Sync
    if (socket && clock.elapsedTime - lastSend.current > 0.05) {
      socket.emit('move', {
        name: state.playerName,
        member: state.activeChar,
        colors: activeData.color,
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
      <SimpsonRig colors={SQUAD_DATA[state.activeChar].color} velRef={vel} isSwimmingRef={isSwimmingRef} />
      <ContactShadows opacity={0.45} scale={4} blur={2.5} position={[0, 0.02, 0]} />
      {state.squadStatus[state.activeChar].safe && (
        <Html position={[0, 3, 0]} center><div style={{fontSize: 24}}>⭐</div></Html>
      )}
    </group>
  );
}

// ─── Idle Squad Renderer (The Vulnerable Characters) ──────────────────────────

function IdleSquad() {
  const { state, squadPosRef } = useContext(GameContext);
  
  return (
    <group>
      {Object.keys(SQUAD_DATA).map(charId => {
        // Don't render the active character here (PlayerController handles them)
        if (charId === state.activeChar) return null;
        
        const pos = squadPosRef.current[charId];
        const isSafe = state.squadStatus[charId].safe;
        
        return (
          <group key={charId} position={[pos.x, pos.y, pos.z]}>
            <SimpsonRig colors={SQUAD_DATA[charId].color} opacity={isSafe ? 0.3 : 1} />
            <Html position={[0, 2.8, 0]} center>
              <div style={{ background: isSafe ? 'green' : 'black', color:'white', padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:'bold', border:`2px solid ${SQUAD_DATA[charId].color.jacket}` }}>
                {charId} {isSafe ? '✔️' : '⚠️'}
              </div>
            </Html>
            {!isSafe && <ContactShadows opacity={0.45} scale={4} blur={2.5} position={[0, 0.02, 0]} />}
          </group>
        );
      })}
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
      <SimpsonRig colors={data.colors} isNPC={true} npcMovingRef={movingRef} isSwimmingRef={isSwimmingRef} />
      <Html position={[0, 2.8, 0]} center>
        <div style={{ background:'rgba(0,0,0,0.6)', color:'white', padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:'bold', border:`2px solid ${data.colors?.jacket || '#fff'}`, whiteSpace:'nowrap' }}>
          {data.name} ({data.member})
        </div>
      </Html>
    </group>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function GameUI() {
  const { state, actions } = useContext(GameContext);
  const [chatText, setChatText] = useState("");

  const connectToGame = () => {
    if (!state.playerName) return alert("Enter your player name!");
    socket = io(SOCKET_URL);
    
    // We emit the start with whoever they are defaulted to
    socket.emit('join', { name: state.playerName, member: state.activeChar, colors: SQUAD_DATA[state.activeChar].color });
    socket.on('currentPlayers', (p) => actions.setOnlinePlayers(p));
    socket.on('stateUpdate', (p) => actions.setOnlinePlayers(p));
    socket.on('chatMessage', (m) => actions.addChatMessage(m));
    socket.on('playerLeft', (id) => actions.setOnlinePlayers(prev => { const n = {...prev}; delete n[id]; return n; }));
    
    audio.init(); 
    actions.setUI('play');

    // Register 1,2,3,4 keys for switching
    window.addEventListener('keydown', (e) => {
      const charArray = ['Homer', 'Bart', 'Lisa', 'Marge'];
      const num = parseInt(e.key);
      if (num >= 1 && num <= 4) actions.setActiveChar(charArray[num - 1]);
    });
  };

  const isWin = Object.values(state.squadStatus).every(s => s.safe);
  const isLoss = state.lives <= 0;

  if (state.ui === 'start') return (
    <div style={ST.overlay}>
       <div style={{...ST.modal, maxWidth: 500}}>
          <h1 style={{ fontSize: 42, margin: '4px 0', textShadow: '2px 2px #ff4400', color: '#ffd90f', textTransform: 'uppercase', WebkitTextStroke: '2px black' }}>🍩 Springfield Survival</h1>
          <p style={{ fontWeight: 'bold', color: '#333', fontSize: 16 }}>Protect the family from Kang & Kodos!</p>
          
          <input style={ST.input} placeholder="Your Player Name..." maxLength={10} onChange={e => actions.setPlayerName(e.target.value)} />
          
          <div style={{ textAlign: 'left', background: '#f8f8f8', padding: 15, borderRadius: 10, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 10px 0' }}>How to play:</h3>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#444' }}>
              <li>Press <b>1, 2, 3, 4</b> to switch characters instantly.</li>
              <li>Get everyone to their specific destinations!</li>
              <li>Avoid the Red Laser spots from the sky.</li>
              <li><b>Warning:</b> Characters you aren't controlling are vulnerable!</li>
            </ul>
          </div>
          
          <button style={ST.startBtn} onClick={connectToGame}>START LEVEL</button>
       </div>
    </div>
  );

  if (isWin || isLoss) return (
    <div style={ST.overlay}>
       <div style={{...ST.modal, maxWidth: 500}}>
          <h1 style={{ fontSize: 42, margin: '4px 0', color: isWin ? 'green' : 'red' }}>
            {isWin ? "YOU SURVIVED!" : "GAME OVER"}
          </h1>
          <p>{isWin ? "Everyone made it safely!" : "The aliens abducted the family."}</p>
          <button style={ST.startBtn} onClick={() => window.location.reload()}>PLAY AGAIN</button>
       </div>
    </div>
  );

  return (
    <>
      {/* HUD: Squad Selector */}
      <div style={ST.squadBox}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>SWITCH CHARACTER (1-4)</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          {['Homer', 'Bart', 'Lisa', 'Marge'].map(char => {
            const data = SQUAD_DATA[char];
            const status = state.squadStatus[char];
            const isActive = state.activeChar === char;
            
            return (
              <div key={char} onClick={() => actions.setActiveChar(char)}
                   style={{
                     ...ST.charCard, 
                     border: isActive ? `3px solid ${data.color.jacket}` : '3px solid transparent',
                     opacity: status.safe ? 0.5 : 1,
                     background: status.safe ? '#d4ffd4' : '#fff'
                   }}>
                <b style={{ color: data.color.jacket }}>{data.num}. {char}</b>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{data.trait}</div>
                {status.armor > 0 && <div style={{ fontSize: 10, color: 'blue' }}>🛡️ Armor: {status.armor}</div>}
                {status.safe && <div style={{ fontSize: 12, color: 'green', fontWeight: 'bold' }}>SAFE</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Goal Box */}
      <div style={ST.goalBox}>
        <h3 style={{ margin: 0, fontSize: 16 }}>🎯 Current Goal:</h3>
        <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: DESTINATIONS[state.activeChar].color }}>
          Get {state.activeChar} to the {SQUAD_DATA[state.activeChar].target}!
        </p>
      </div>

      {/* Lives / Stats */}
      <div style={{ position: 'absolute', top: 25, left: 25, background: 'rgba(255,255,255,0.9)', padding: 15, borderRadius: 15, border: '4px solid #ffaa00', fontFamily: FF }}>
        <div style={{ fontSize: 24 }}>
          Lives: {Array(state.lives).fill('🍩').join('')}
        </div>
        <div style={{ fontSize: 14, color: 'red', fontWeight: 'bold', marginTop: 5 }}>
          Alien Threat Level: {Math.floor(state.alienLevel)}
        </div>
        {Date.now() < state.timeSlowed && (
          <div style={{ fontSize: 14, color: 'blue', fontWeight: 'bold', marginTop: 5 }}>⏱️ TIME SLOWED!</div>
        )}
      </div>

      {/* Chat */}
      <div style={ST.chatArea}>
        <div style={ST.chatLog}>
          {state.chatMessages.map((m, i) => <div key={i}><b style={{ color: m.color }}>{m.name}:</b> {m.text}</div>)}
        </div>
        <input style={ST.chatInput} placeholder="Chat..." value={chatText} onChange={e => setChatText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && chatText.trim()) {
              const msg = { name: state.playerName, color: SQUAD_DATA[state.activeChar].color.jacket, text: chatText };
              actions.addChatMessage(msg);
              if (socket) socket.emit('chat', chatText);
              setChatText("");
            }
          }} />
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function SpringfieldSurvival() {
  const store = useIslandStore();

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
          <Suspense fallback={<Html center><div style={{fontFamily:'sans-serif', color:'white', background:'rgba(0,0,0,0.5)', padding:'10px 20px', borderRadius:20}}>Loading Springfield...</div></Html>}>
            
            <Sky sunPosition={[80, 20, 20]} turbidity={0.4} rayleigh={1.5} mieCoefficient={0.005} />
            <directionalLight position={[80, 20, 20]} intensity={1.6} castShadow shadow-mapSize={[2048,2048]} color={'#fff8f0'} />
            <ambientLight intensity={0.4} color={'#fff'} />
            
            <Terrain />
            
            <PlayerController />
            <IdleSquad />
            <AlienAttacks />
            <DestinationZones />

            {/* Networked Players */}
            {Object.values(store.state.onlinePlayers).map(p => socket && p.id !== socket.id && <NetworkPlayer key={p.id} data={p} />)}
            
            <CameraRig />

            <EffectComposer multisampling={4}>
              <Bloom intensity={0.2} luminanceThreshold={0.88} luminanceSmoothing={0.4} />
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
  overlay:     { position:'absolute', inset:0, zIndex:100, background:'linear-gradient(150deg,#0a0a0a 0%,#333333 60%,#0055ff 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', fontFamily:FF, textAlign:'center' },
  modal:       { background: 'white', padding: 40, borderRadius: 30, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' },
  input:       { width: '100%', padding: '15px', marginBottom: 20, borderRadius: 15, border: '2px solid #eee', fontSize: 18, boxSizing: 'border-box', outline: 'none', fontFamily: FF, color: '#333' },
  startBtn:    { width: '100%', background: '#ff4400', color: 'white', border: 'none', padding: '18px', borderRadius: 20, fontSize: 20, fontWeight: 'bold', cursor: 'pointer', fontFamily: FF, marginTop: 10 },
  
  squadBox:    { position:'absolute', bottom:25, left:'50%', transform:'translateX(-50%)', background:'rgba(255,255,255,0.9)', padding:15, borderRadius:15, boxShadow:'0 4px 10px rgba(0,0,0,0.3)', fontFamily:FF, zIndex:50, color: '#333' },
  charCard:    { padding: 10, borderRadius: 10, background: '#fff', cursor: 'pointer', textAlign: 'center', minWidth: 80, transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },

  goalBox:     { position:'absolute', top:25, right:25, background:'rgba(255,255,255,0.9)', padding:15, borderRadius:15, border:'4px solid #333', boxShadow:'0 4px 10px rgba(0,0,0,0.3)', fontFamily:FF, zIndex:50, color: '#333' },
  
  chatArea:    { position: 'absolute', bottom: 20, left: 20, zIndex: 5, width: 250, fontFamily: FF, pointerEvents: 'auto' },
  chatLog:     { background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 15, borderRadius: 15, height: 160, overflowY: 'auto', marginBottom: 10, fontSize: 14, backdropFilter: 'blur(10px)' },
  chatInput:   { width: '100%', background: 'rgba(255,255,255,0.95)', border: 'none', padding: 12, borderRadius: 10, boxSizing: 'border-box', outline: 'none', fontFamily: FF, color: '#333', fontSize: 16 }
};
