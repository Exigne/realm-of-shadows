/**
 * 🏝️ CANDY ISLAND: ULTIMATE MULTIPLAYER
 * - Full 3D World (Trees, Flowers, Rocks, Water)
 * - Real-time Socket.io Syncing
 * - Avatar Selection & Customization
 * - Global Chat
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Stars, Sparkles,
  Float, Html, Instances, Instance,
} from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client';

// ─── Networking Config ────────────────────────────────────────────────────────
// IMPORTANT: Replace this with your Public Codespace URL for port 3001!
const SOCKET_URL = "https://ominous-garbanzo-pjggqprv4xrqf7pp9-3001.app.github.dev/"; 
let socket;

const GameContext = createContext();

// ─── World Generation Math ───────────────────────────────────────────────────
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
    playerConfig: { name: '', color: '#ff8fab', creatureType: 'cat' },
    onlinePlayers: {},
    chatMessages: [],
  });

  const actions = useMemo(() => ({
    setUI: (v) => setState(s => ({ ...s, ui: v })),
    setOnlinePlayers: (players) => setState(s => ({ ...s, onlinePlayers: players })),
    addChatMessage: (msg) => setState(s => ({ ...s, chatMessages: [...s.chatMessages.slice(-10), msg] })),
    setPlayerConfig: (cfg) => setState(s => ({ ...s, playerConfig: { ...s.playerConfig, ...cfg } })),
    tickTime: () => setState(s => ({ ...s, gameTime: (state.gameTime + 0.02) % 24 })),
  }), [state.gameTime]);

  return { state, actions, playerPosRef, playerGroupRef };
};

// ─── Character Models ─────────────────────────────────────────────────────────
const matBlack = new THREE.MeshBasicMaterial({ color: '#111' });

function CharacterModel({ color, type, isSwimming }) {
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), [color]);
  return (
    <group rotation={[isSwimming ? -0.6 : 0, 0, 0]}>
      <mesh castShadow position={[0, 0.5, 0]} material={bodyMat}><sphereGeometry args={[0.5, 16, 16]} /></mesh>
      <mesh castShadow position={[0, 1.1, 0]} material={bodyMat}><sphereGeometry args={[0.38, 16, 16]} /></mesh>
      <mesh position={[-0.12, 1.2, 0.3]} material={matBlack}><sphereGeometry args={[0.05, 8, 8]} /></mesh>
      <mesh position={[0.12, 1.2, 0.3]} material={matBlack}><sphereGeometry args={[0.05, 8, 8]} /></mesh>
      {type === 'cat' && <>
        <mesh position={[-0.2, 1.4, 0]} material={bodyMat}><coneGeometry args={[0.08, 0.2, 4]} /></mesh>
        <mesh position={[0.2, 1.4, 0]} material={bodyMat}><coneGeometry args={[0.08, 0.2, 4]} /></mesh>
      </>}
      {type === 'bear' && <>
        <mesh position={[-0.3, 1.5, 0]} material={bodyMat}><sphereGeometry args={[0.12, 8, 8]} /></mesh>
        <mesh position={[0.3, 1.5, 0]} material={bodyMat}><sphereGeometry args={[0.12, 8, 8]} /></mesh>
      </>}
      {type === 'bunny' && <>
        <mesh position={[-0.15, 1.6, 0]} material={bodyMat}><capsuleGeometry args={[0.06, 0.4, 4, 8]} /></mesh>
        <mesh position={[0.15, 1.6, 0]} material={bodyMat}><capsuleGeometry args={[0.06, 0.4, 4, 8]} /></mesh>
      </>}
    </group>
  );
}

// ─── Players ──────────────────────────────────────────────────────────────────
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
      vel.current.x = THREE.MathUtils.lerp(vel.current.x, Math.sin(angle) * 7, 8 * delta);
      vel.current.z = THREE.MathUtils.lerp(vel.current.z, Math.cos(angle) * 7, 8 * delta);
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

  return (
    <group ref={playerGroupRef}>
      <CharacterModel color={state.playerConfig.color} type={state.playerConfig.creatureType} isSwimming={false} />
      <ContactShadows opacity={0.4} scale={5} blur={2.4} />
    </group>
  );
}

function NetworkPlayer({ data }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(data.position.x, data.position.y, data.position.z), 10 * delta);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, data.rotation.y, 10 * delta);
  });
  return (
    <group ref={ref}>
      <CharacterModel color={data.color} type={data.creatureType} isSwimming={data.isSwimming} />
      <Html position={[0, 2.2, 0]} center>
        <div style={ST.nameTag}>{data.name}</div>
      </Html>
    </group>
  );
}

// ─── Decorations ──────────────────────────────────────────────────────────────
function Trees() {
  const treeData = useMemo(() => {
    const pts = [];
    for(let i=0; i<30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 35;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = getTerrainY(x, z);
      if (y > 0.2) pts.push({ x, y, z, s: 0.8 + Math.random() * 0.5 });
    }
    return pts;
  }, []);

  return (
    <group>
      {treeData.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]} scale={t.s}>
          <mesh position={[0, 1.5, 0]} castShadow><cylinderGeometry args={[0.2, 0.3, 3]} /><meshStandardMaterial color="#8B4513" /></mesh>
          <mesh position={[0, 3.5, 0]} castShadow><sphereGeometry args={[1.5, 8, 8]} /><meshStandardMaterial color="#2e7d32" /></mesh>
        </group>
      ))}
    </group>
  );
}

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(150, 150, 80, 80); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, getTerrainY(pos.getX(i), pos.getZ(i)));
    }
    g.computeVertexNormals(); return g;
  }, []);
  return <mesh geometry={geo} receiveShadow><meshStandardMaterial color="#98fb98" roughness={0.8} /></mesh>;
}

function Water() {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]}>
    <planeGeometry args={[400, 400]} /><meshStandardMaterial color="#00bfff" transparent opacity={0.5} />
  </mesh>;
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
    camera.position.set(p.position.x + Math.sin(camState.yaw) * 18, p.position.y + 12, p.position.z + Math.cos(camState.yaw) * 18);
    camera.lookAt(p.position.x, p.position.y + 1.5, p.position.z);
  });
  return null;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function UltimateMultiplayerIsland() {
  const store = useIslandStore();
  const [chatText, setChatText] = useState("");

  const connectToGame = () => {
    if (!store.state.playerConfig.name) return alert("Please enter a name!");
    socket = io(SOCKET_URL);
    socket.emit('join', store.state.playerConfig);
    socket.on('currentPlayers', (p) => store.actions.setOnlinePlayers(p));
    socket.on('stateUpdate', (p) => store.actions.setOnlinePlayers(p));
    socket.on('chatMessage', (m) => store.actions.addChatMessage(m));
    socket.on('playerLeft', (id) => {
        store.actions.setOnlinePlayers(prev => { const n = {...prev}; delete n[id]; return n; });
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
    <div style={{ width: '100vw', height: '100vh', background: '#87ceeb', overflow: 'hidden', fontFamily: '"Comic Sans MS", cursive' }}>
      <GameContext.Provider value={store}>
        
        {store.state.ui === 'start' && (
          <div style={ST.overlay}>
            <div style={ST.modal}>
              <h1 style={{ color: '#ff8fab' }}>🏝️ Candy Island</h1>
              <input style={ST.input} placeholder="Nickname" maxLength={10}
                onChange={e => store.actions.setPlayerConfig({ name: e.target.value })} />
              <div style={ST.row}>
                {['cat', 'bear', 'bunny'].map(type => (
                  <button key={type} onClick={() => store.actions.setPlayerConfig({ creatureType: type })}
                    style={{...ST.btn, border: store.state.playerConfig.creatureType === type ? '4px solid #ff8fab' : '4px solid transparent'}}>
                    {type === 'cat' ? '🐱' : type === 'bear' ? '🐻' : '🐰'}
                  </button>
                ))}
              </div>
              <input type="color" style={ST.colorPicker} value={store.state.playerConfig.color}
                onChange={e => store.actions.setPlayerConfig({ color: e.target.value })} />
              <button style={ST.startBtn} onClick={connectToGame}>ENTER WORLD</button>
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
            <input style={ST.chatInput} placeholder="Hit Enter to chat..."
              value={chatText} onChange={e => setChatText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && chatText.trim()) {
                  socket.emit('chat', chatText);
                  setChatText("");
                }
              }} />
          </div>
        )}

        <Canvas shadows camera={{ fov: 45, position: [0, 10, 20] }}>
          <Suspense fallback={null}>
            <Sky sunPosition={[100, 20, 100]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
            <Terrain />
            <Water />
            <Trees />
            <PlayerController />
            {Object.values(store.state.onlinePlayers).map(p => (
              socket && p.id !== socket.id && <NetworkPlayer key={p.id} data={p} />
            ))}
            <CameraRig />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          </Suspense>
        </Canvas>
      </GameContext.Provider>
    </div>
  );
}

const ST = {
  overlay: { position: 'absolute', inset: 0, zIndex: 10, background: 'linear-gradient(135deg, #87ceeb 0%, #ffb3cc 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'white', padding: 40, borderRadius: 30, textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', width: 340 },
  input: { width: '100%', padding: '15px', marginBottom: 20, borderRadius: 15, border: '2px solid #eee', fontSize: 18, boxSizing: 'border-box', outline: 'none' },
  row: { display: 'flex', justifyContent: 'space-around', marginBottom: 20 },
  btn: { fontSize: 40, background: '#fcfcfc', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 20, transition: '0.2s' },
  colorPicker: { width: '100%', height: 45, marginBottom: 20, border: 'none', borderRadius: 10, cursor: 'pointer' },
  startBtn: { width: '100%', background: '#ff8fab', color: 'white', border: 'none', padding: '18px', borderRadius: 20, fontSize: 20, fontWeight: 'bold', cursor: 'pointer' },
  chatArea: { position: 'absolute', bottom: 20, left: 20, zIndex: 5, width: 300 },
  chatLog: { background: 'rgba(0,0,0,0.3)', color: 'white', padding: 15, borderRadius: 15, height: 160, overflowY: 'auto', marginBottom: 10, fontSize: 14, backdropFilter: 'blur(10px)' },
  chatInput: { width: '100%', background: 'rgba(255,255,255,0.9)', border: 'none', padding: 12, borderRadius: 10, boxSizing: 'border-box', outline: 'none' },
  nameTag: { color: 'white', background: 'rgba(0,0,0,0.4)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 'bold', backdropFilter: 'blur(5px)', whiteSpace: 'nowrap' }
};
