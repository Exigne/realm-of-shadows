/**
 * 🏝️ CANDY ISLAND: MULTIPLAYER EDITION
 * - Real-time Socket.io Syncing
 * - Avatar Selection (Cat, Bear, Bunny)
 * - Custom Color & Name Picker
 * - Global Chat (Press Enter to talk)
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Stars, Sparkles,
  Float, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { io } from 'socket.io-client';

// ─── Networking Logic ────────────────────────────────────────────────────────
// PASTE YOUR CODESPACE PORT 3001 URL HERE:
const SOCKET_URL = "https://ominous-garbanzo-pjggqprv4xrqf7pp9-3001.app.github.dev/"; 
let socket;

const GameContext = createContext();

// ─── Terrain Math ────────────────────────────────────────────────────────────
function getTerrainY(x, z) {
  const d = Math.sqrt(x * x + z * z);
  if (d > 55) return -2.5;
  let h = (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.0) + 
          (Math.sin(x * 0.05 + z * 0.04) * 1.5) + 
          (Math.cos(x * 0.2 + z * 0.2) * 0.5);
  return h * Math.max(0, 1 - Math.pow(d / 60, 4));
}

const camState = { yaw: Math.PI, pitch: 0.4, yawVel: 0, pitchVel: 0 };
const keyState = {};

// ─── Store ────────────────────────────────────────────────────────────────────
const useIslandStore = () => {
  const playerPosRef = useRef(new THREE.Vector3(0, 1, 0));
  const playerGroupRef = useRef();

  const [state, setState] = useState({
    ui: 'start',
    gameTime: 9.0,
    playerConfig: { name: '', color: '#ffb3cc', creatureType: 'cat' },
    onlinePlayers: {},
    chatMessages: [],
  });

  const actions = useMemo(() => ({
    setUI: (v) => setState(s => ({ ...s, ui: v })),
    setOnlinePlayers: (players) => setState(s => ({ ...s, onlinePlayers: players })),
    addChatMessage: (msg) => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-10), msg] })),
    setPlayerConfig: (cfg) => setState(s => ({ ...s, playerConfig: { ...s.playerConfig, ...cfg } })),
    tickTime: () => setState(s => ({ ...s, gameTime: (s.gameTime + 0.02) % 24 })),
  }), []);

  return { state, actions, playerPosRef, playerGroupRef };
};

// ─── Creature Meshes ──────────────────────────────────────────────────────────
const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });

function CatCreature({ color, isSwimming }) {
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), [color]);
  return (
    <group rotation={[isSwimming ? -0.6 : 0, 0, 0]}>
      <mesh castShadow position={[0, 0.5, 0]} material={bodyMat}><sphereGeometry args={[0.5, 16, 16]} /></mesh>
      <mesh castShadow position={[0, 1.1, 0]} material={bodyMat}><sphereGeometry args={[0.35, 16, 16]} /></mesh>
      <mesh position={[-0.2, 1.4, 0]} material={bodyMat}><coneGeometry args={[0.08, 0.2, 4]} /></mesh>
      <mesh position={[0.2, 1.4, 0]} material={bodyMat}><coneGeometry args={[0.08, 0.2, 4]} /></mesh>
      <mesh position={[-0.12, 1.2, 0.3]} material={matBlack}><sphereGeometry args={[0.05, 8, 8]} /></mesh>
      <mesh position={[0.12, 1.2, 0.3]} material={matBlack}><sphereGeometry args={[0.05, 8, 8]} /></mesh>
    </group>
  );
}

function BearCreature({ color, isSwimming }) {
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), [color]);
  return (
    <group rotation={[isSwimming ? -0.6 : 0, 0, 0]}>
      <mesh castShadow position={[0, 0.6, 0]} material={bodyMat}><sphereGeometry args={[0.6, 16, 16]} /></mesh>
      <mesh castShadow position={[0, 1.3, 0]} material={bodyMat}><sphereGeometry args={[0.45, 16, 16]} /></mesh>
      <mesh position={[-0.3, 1.6, 0]} material={bodyMat}><sphereGeometry args={[0.15, 8, 8]} /></mesh>
      <mesh position={[0.3, 1.6, 0]} material={bodyMat}><sphereGeometry args={[0.15, 8, 8]} /></mesh>
    </group>
  );
}

function BunnyCreature({ color, isSwimming }) {
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), [color]);
  return (
    <group rotation={[isSwimming ? -0.6 : 0, 0, 0]}>
      <mesh castShadow position={[0, 0.5, 0]} material={bodyMat}><sphereGeometry args={[0.5, 16, 16]} /></mesh>
      <mesh castShadow position={[0, 1.1, 0]} material={bodyMat}><sphereGeometry args={[0.35, 16, 16]} /></mesh>
      <mesh position={[-0.15, 1.6, 0]} material={bodyMat}><capsuleGeometry args={[0.06, 0.4, 4, 8]} /></mesh>
      <mesh position={[0.15, 1.6, 0]} material={bodyMat}><capsuleGeometry args={[0.06, 0.4, 4, 8]} /></mesh>
    </group>
  );
}

// ─── Network Player (The Other Kids) ──────────────────────────────────────────
function NetworkPlayer({ data }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(data.position.x, data.position.y, data.position.z), 10 * delta);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, data.rotation.y, 10 * delta);
  });

  const Creature = data.creatureType === 'bear' ? BearCreature : data.creatureType === 'bunny' ? BunnyCreature : CatCreature;

  return (
    <group ref={ref}>
      <Creature color={data.color} isSwimming={data.isSwimming} />
      <Html position={[0, 2, 0]} center>
        <div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {data.name}
        </div>
      </Html>
    </group>
  );
}

// ─── Local Player Controller ──────────────────────────────────────────────────
function PlayerController() {
  const { state, playerPosRef, playerGroupRef } = useContext(GameContext);
  const vel = useRef(new THREE.Vector3());
  const lastSend = useRef(0);

  useFrame(({ clock }, delta) => {
    const g = playerGroupRef.current;
    if (!g || state.ui !== 'play') return;

    const moveX = (keyState['a'] ? -1 : 0) + (keyState['d'] ? 1 : 0);
    const moveZ = (keyState['w'] ? -1 : 0) + (keyState['s'] ? 1 : 0);
    
    if (moveX !== 0 || moveZ !== 0) {
      const angle = Math.atan2(moveX, moveZ) + camState.yaw;
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, Math.sin(angle) * 6, 10 * delta);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, Math.cos(angle) * 6, 10 * delta);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, Math.atan2(vel.current.x, vel.current.z), 10 * delta);
    } else {
      vel.current.x *= 0.8; vel.current.z *= 0.8;
    }

    g.position.x += vel.current.x * delta;
    g.position.z += vel.current.z * delta;

    let floorY = getTerrainY(g.position.x, g.position.z);
    let isSwimming = false;
    if (floorY < -1.4) { floorY = -1.4; isSwimming = true; }
    g.position.y = floorY + (isSwimming ? Math.sin(clock.elapsedTime * 2) * 0.05 : 0);

    playerPosRef.current.copy(g.position);

    if (socket && clock.elapsedTime - lastSend.current > 0.05) {
      socket.emit('move', {
        position: g.position,
        rotation: { y: g.rotation.y },
        isMoving: Math.abs(vel.current.x) + Math.abs(vel.current.z) > 0.1,
        isSwimming: isSwimming
      });
      lastSend.current = clock.elapsedTime;
    }
  });

  const Creature = state.playerConfig.creatureType === 'bear' ? BearCreature : state.playerConfig.creatureType === 'bunny' ? BunnyCreature : CatCreature;
  return (
    <group ref={playerGroupRef}>
      <Creature color={state.playerConfig.color} isSwimming={false} />
      <ContactShadows opacity={0.4} scale={5} blur={2.4} />
    </group>
  );
}

// ─── Main Game Component ──────────────────────────────────────────────────────
export default function MultiplayerIsland() {
  const store = useIslandStore();
  const [chatText, setChatText] = useState("");

  const connectToGame = () => {
    if (!store.state.playerConfig.name) return alert("Please enter a name!");
    socket = io(SOCKET_URL);
    socket.emit('join', store.state.playerConfig);
    socket.on('currentPlayers', (players) => store.actions.setOnlinePlayers(players));
    socket.on('stateUpdate', (players) => store.actions.setOnlinePlayers(players));
    socket.on('chatMessage', (msg) => store.actions.addChatMessage(msg));
    socket.on('playerLeft', (id) => {
        store.actions.setOnlinePlayers(prev => {
            const next = {...prev};
            delete next[id];
            return next;
        });
    });
    store.actions.setUI('play');
  };

  useEffect(() => {
    const down = (e) => { keyState[e.key.toLowerCase()] = true; };
    const up = (e) => { keyState[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      <GameContext.Provider value={store}>
        
        {store.state.ui === 'start' && (
          <div style={ST.overlay}>
            <div style={ST.modal}>
              <h1>🏝️ Candy Island</h1>
              <input style={ST.input} placeholder="Character Name" maxLength={10}
                onChange={e => store.actions.setPlayerConfig({ name: e.target.value })} />
              
              <div style={ST.row}>
                {['cat', 'bear', 'bunny'].map(type => (
                  <button key={type} onClick={() => store.actions.setPlayerConfig({ creatureType: type })}
                    style={{...ST.btn, border: store.state.playerConfig.creatureType === type ? '3px solid #ff8fab' : '3px solid transparent'}}>
                    {type === 'cat' ? '🐱' : type === 'bear' ? '🐻' : '🐰'}
                  </button>
                ))}
              </div>

              <input type="color" style={{ width: '100%', height: 40, margin: '10px 0', cursor: 'pointer' }}
                value={store.state.playerConfig.color}
                onChange={e => store.actions.setPlayerConfig({ color: e.target.value })} />

              <button style={ST.startBtn} onClick={connectToGame}>ENTER ISLAND</button>
            </div>
          </div>
        )}

        {store.state.ui === 'play' && (
          <div style={ST.chatArea}>
            <div style={ST.chatLog}>
              {store.state.chatMessages.map((m, i) => (
                <div key={i}><b style={{ color: m.color }}>{m.name}:</b> {m.text}</div>
              ))}
            </div>
            <input style={ST.chatInput} placeholder="Press Enter to chat..."
              value={chatText} onChange={e => setChatText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && chatText.trim()) {
                  socket.emit('chat', chatText);
                  setChatText("");
                }
              }} />
          </div>
        )}

        <Canvas shadows camera={{ fov: 45, position: [0, 10, 15] }}>
          <Suspense fallback={null}>
            <Atmosphere />
            <Terrain />
            <Water />
            <PlayerController />
            {Object.values(store.state.onlinePlayers).map(p => (
              socket && p.id !== socket.id && <NetworkPlayer key={p.id} data={p} />
            ))}
            <CameraRig />
          </Suspense>
        </Canvas>
      </GameContext.Provider>
    </div>
  );
}

// ─── World Components ─────────────────────────────────────────────────────────
function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(120, 120, 64, 64); g.rotateX(-Math.PI / 2);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const x = g.attributes.position.getX(i), z = g.attributes.position.getZ(i);
      g.attributes.position.setY(i, getTerrainY(x, z));
    }
    g.computeVertexNormals(); return g;
  }, []);
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial color="#b8e896" roughness={0.8} /></mesh>;
}

function Water() {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
    <planeGeometry args={[300, 300]} /><meshStandardMaterial color="#5bc8f0" transparent opacity={0.6} />
  </mesh>;
}

function Atmosphere() {
  return <><Sky sunPosition={[100, 20, 100]} /><ambientLight intensity={0.4} /><directionalLight position={[10, 20, 10]} intensity={1.5} castShadow /></>;
}

function CameraRig() {
  const { playerGroupRef } = useContext(GameContext);
  const { camera } = useThree();
  useFrame((_, delta) => {
    if (keyState['arrowleft']) camState.yawVel += 25 * delta;
    if (keyState['arrowright']) camState.yawVel -= 25 * delta;
    camState.yawVel *= 0.8; camState.yaw += camState.yawVel * delta;
    const p = playerGroupRef.current;
    if (!p) return;
    camera.position.set(p.position.x + Math.sin(camState.yaw) * 15, p.position.y + 10, p.position.z + Math.cos(camState.yaw) * 15);
    camera.lookAt(p.position.x, p.position.y + 1, p.position.z);
  });
  return null;
}

const ST = {
  overlay: { position: 'absolute', inset: 0, zIndex: 10, background: 'linear-gradient(135deg, #87ceeb 0%, #ffb3cc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'white', padding: 30, borderRadius: 30, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', width: 320 },
  input: { width: '100%', padding: '15px', marginBottom: 20, borderRadius: 15, border: '2px solid #eee', fontSize: 18, boxSizing: 'border-box', outline: 'none' },
  row: { display: 'flex', justifyContent: 'space-around', marginBottom: 20 },
  btn: { fontSize: 35, background: '#f8f8f8', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 20, transition: '0.2s' },
  startBtn: { width: '100%', background: '#ff8fab', color: 'white', border: 'none', padding: '18px', borderRadius: 20, fontSize: 20, fontWeight: 'bold', cursor: 'pointer' },
  chatArea: { position: 'absolute', bottom: 20, left: 20, zIndex: 5, width: 280 },
  chatLog: { background: 'rgba(0,0,0,0.5)', color: 'white', padding: 15, borderRadius: 15, height: 160, overflowY: 'auto', marginBottom: 10, fontSize: 14, backdropFilter: 'blur(5px)' },
  chatInput: { width: '100%', background: 'rgba(255,255,255,0.9)', border: 'none', padding: 12, borderRadius: 10, boxSizing: 'border-box', outline: 'none' }
};
