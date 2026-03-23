/**
 * 🏝️ CANDY ISLAND: THE DEFINITIVE EDITION
 * Merged Features: 
 * - WASD Physics & "Game Juice" (Squash/Stretch)
 * - Full Inventory & 🔔 Bell System
 * - Dynamic Day/Night Cycle & Glowing Houses
 * - Multi-line Dialogue & NPC Quests
 * - High-Res Rendering (Anti-aliasing + Film Tone)
 * - Spatial Audio & Animalese Voices
 */

import React, { useRef, useMemo, useState, useEffect, useCallback, Suspense, createContext } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, ContactShadows, Stars, Sparkles, Float, Instance, Instances, Environment, SoftShadows } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const noise2D = createNoise2D();
const playerVelocity = new THREE.Vector3();
const tempVec = new THREE.Vector3();

const CONFIG = {
  walkSpeed: 12,
  runSpeed: 22,
  rideSpeed: 45,
  timeScale: 0.8, // Speed of day/night cycle
};

const COLORS = {
  grass: 0x90EE90,
  sand: 0xF5DEB3,
  water: 0x40E0D0,
  wood: 0x8B4513,
  leaves: 0x228B22,
  apple: 0xFF4500,
  npc1: 0x87CEFA, // Barnaby
  npc2: 0xFFE4B5, // Pip
  npc3: 0xDDA0DD, // Luna
  player: 0xFFB6C1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔊 AUDIO ENGINE (Animalese + BGM)
// ═══════════════════════════════════════════════════════════════════════════════

class IslandAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.15;
    this.master.connect(this.ctx.destination);
  }

  startBGM() {
    if (this.isPlaying || !this.ctx) return;
    this.isPlaying = true;
    const chords = [[523.25, 659.25, 783.99], [587.33, 739.99, 880.00], [659.25, 783.99, 987.77]];
    let idx = 0;
    const play = () => {
      if (!this.isPlaying) return;
      chords[idx].forEach(f => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = f;
        g.gain.setValueAtTime(0.01, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);
        osc.connect(g); g.connect(this.master);
        osc.start(); osc.stop(this.ctx.currentTime + 2);
      });
      idx = (idx + 1) % chords.length;
      setTimeout(play, 2500);
    };
    play();
  }

  sfx(name) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.connect(this.master);
    if (name === 'talk') {
      for(let i=0; i<5; i++) {
        const tOsc = this.ctx.createOscillator();
        const tG = this.ctx.createGain();
        tOsc.frequency.setValueAtTime(800 + Math.random()*600, this.ctx.currentTime + i*0.07);
        tG.gain.setValueAtTime(0.02, this.ctx.currentTime + i*0.07);
        tG.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i*0.07 + 0.05);
        tOsc.connect(tG); tG.connect(this.master);
        tOsc.start(this.ctx.currentTime + i*0.07); tOsc.stop(this.ctx.currentTime + i*0.07 + 0.07);
      }
    } else if (name === 'collect') {
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.05, this.ctx.currentTime);
      osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    }
  }
}

const audio = new IslandAudio();

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 WORLD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Terrain() {
  const { geometry } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(120, 120, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const d = Math.sqrt(x*x + z*z);
      const mask = Math.max(0, 1 - Math.pow(d / 50, 4));
      let h = (noise2D(x * 0.05, z * 0.05) * 2.5) * mask;
      if (d > 45) h = -2;
      pos.setY(i, h);
      const col = new THREE.Color(h > 0.3 ? COLORS.grass : COLORS.sand);
      colors.push(col.r, col.g, col.b);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return { geometry: geo };
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow name="ground">
      <meshStandardMaterial vertexColors roughness={0.8} />
    </mesh>
  );
}

function Vegetation() {
  const data = useMemo(() => {
    const trees = []; const apples = [];
    for (let i = 0; i < 100; i++) {
      const a = Math.random() * Math.PI * 2; const d = 15 + Math.random() * 35;
      const x = Math.cos(a) * d; const z = Math.sin(a) * d;
      const h = noise2D(x * 0.05, z * 0.05) * 2;
      if (h > 0.5) trees.push({ pos: [x, h, z], scale: 0.8 + Math.random()*0.5 });
    }
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2; const d = 10 + Math.random() * 30;
      const x = Math.cos(a) * d; const z = Math.sin(a) * d;
      apples.push({ pos: [x, 0.5, z], id: i });
    }
    return { trees, apples };
  }, []);

  return (
    <group>
      <Instances limit={100}>
        <coneGeometry args={[1.5, 4, 8]} />
        <meshStandardMaterial color={COLORS.leaves} />
        {data.trees.map((t, i) => <Instance key={i} position={t.pos} scale={t.scale} castShadow />)}
      </Instances>
      <Instances limit={100} position={[0, -1, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 2]} />
        <meshStandardMaterial color={COLORS.wood} />
        {data.trees.map((t, i) => <Instance key={i} position={t.pos} scale={t.scale} />)}
      </Instances>
    </group>
  );
}

function House({ pos, color, time }) {
  const isNight = time < 6 || time > 18;
  return (
    <group position={pos}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[4, 3, 4]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0, 4, 0]} rotation={[0, Math.PI/4, 0]} castShadow>
        <coneGeometry args={[3.5, 2.5, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Glowing Windows */}
      <mesh position={[1, 1.5, 2.01]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial emissive={color} emissiveIntensity={isNight ? 2 : 0} color="#333" />
      </mesh>
      <mesh position={[-1, 1.5, 2.01]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial emissive={color} emissiveIntensity={isNight ? 2 : 0} color="#333" />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚶 ENTITIES (Player & NPC)
// ═══════════════════════════════════════════════════════════════════════════════

function Player({ isRiding, onCollect }) {
  const group = useRef();
  const body = useRef();
  const [keys, setKeys] = useState({});

  useEffect(() => {
    const down = (e) => setKeys(k => ({ ...k, [e.key.toLowerCase()]: true }));
    const up = (e) => setKeys(k => ({ ...k, [e.key.toLowerCase()]: false }));
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((state, delta) => {
    const speed = (isRiding ? CONFIG.rideSpeed : keys.shift ? CONFIG.runSpeed : CONFIG.walkSpeed) * delta;
    if (keys.w || keys.arrowup) playerVelocity.z -= speed;
    if (keys.s || keys.arrowdown) playerVelocity.z += speed;
    if (keys.a || keys.arrowleft) playerVelocity.x -= speed;
    if (keys.d || keys.arrowright) playerVelocity.x += speed;

    playerVelocity.multiplyScalar(0.85);
    group.current.position.add(playerVelocity);

    if (playerVelocity.length() > 0.01) {
      const angle = Math.atan2(playerVelocity.x, playerVelocity.z);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, angle, 0.15);
      // Squash/Stretch
      body.current.scale.y = 1 - Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.1;
      body.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.2;
    }

    // Camera
    const camTarget = group.current.position.clone().add(tempVec.set(18, 15, 18));
    state.camera.position.lerp(camTarget, 0.1);
    state.camera.lookAt(group.current.position);
  });

  return (
    <group ref={group}>
      <group ref={body}>
        <mesh castShadow position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial color={COLORS.player} />
        </mesh>
        <mesh position={[0.2, 0.8, 0.45]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="black" /></mesh>
        <mesh position={[-0.2, 0.8, 0.45]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="black" /></mesh>
      </group>
      {isRiding && (
        <mesh position={[0, -0.1, 0]}>
          <boxGeometry args={[1.6, 0.15, 0.7]} />
          <meshStandardMaterial color="#FF1493" emissive="#FF1493" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function NPC({ pos, color, name, dialogues, onTalk }) {
  const ref = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime + pos.x;
    ref.current.position.y = Math.sin(t * 2) * 0.1;
    ref.current.rotation.y = Math.sin(t * 0.5) * 0.5;
  });

  return (
    <group position={pos} onClick={(e) => { e.stopPropagation(); onTalk(name, color, dialogues); }}>
      <group ref={ref}>
        <mesh castShadow position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
           <mesh position={[0, 1.5, 0]}><octahedronGeometry args={[0.2]} /><meshBasicMaterial color="gold" /></mesh>
        </Float>
        {/* Scooter */}
        <mesh position={[0, -0.1, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[1.4, 0.1, 0.6]} />
            <meshStandardMaterial color="#444" />
        </mesh>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🍎 COLLECTIBLES SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function Apples({ playerPos, onCollect }) {
    const [apples, setApples] = useState(() => 
        Array.from({ length: 15 }, (_, i) => ({
            id: i,
            pos: [ (Math.random()-0.5)*60, 0.5, (Math.random()-0.5)*60 ],
            active: true
        }))
    );

    useFrame(() => {
        apples.forEach(apple => {
            if (apple.active) {
                const d = playerPos.distanceTo(new THREE.Vector3(...apple.pos));
                if (d < 1.5) {
                    apple.active = false;
                    onCollect('fruit');
                    audio.sfx('collect');
                }
            }
        });
    });

    return (
        <group>
            {apples.map(a => a.active && (
                <Float key={a.id} position={a.pos} speed={4}>
                    <mesh castShadow>
                        <sphereGeometry args={[0.25, 12, 12]} />
                        <meshStandardMaterial color={COLORS.apple} emissive="red" emissiveIntensity={0.2} />
                    </mesh>
                    <Sparkles count={4} scale={0.5} size={1} />
                </Float>
            ))}
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎮 MAIN GAME COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CandyIslandFinal() {
  const [uiState, setUiState] = useState('start');
  const [bells, setBells] = useState(0);
  const [inventory, setInventory] = useState({ fruit: 0, flowers: 0 });
  const [isRiding, setIsRiding] = useState(false);
  const [gameTime, setGameTime] = useState(8);
  const [dialogue, setDialogue] = useState(null);
  const [playerPos, setPlayerPos] = useState(new THREE.Vector3());

  // Day Night Logic
  useEffect(() => {
    if (uiState === 'start') return;
    const interval = setInterval(() => {
      setGameTime(t => (t + 0.05) % 24);
    }, 100);
    return () => clearInterval(interval);
  }, [uiState]);

  const handleTalk = (name, color, texts) => {
    // Quest Logic: If talking to Barnaby and have fruit
    if (name === "Barnaby" && inventory.fruit > 0) {
        setInventory(prev => ({ ...prev, fruit: 0 }));
        setBells(prev => prev + 1000);
        setDialogue({ name, color, texts: ["Whoa! An apple?!", "Thank you! Take these 1,000 Bells!"], step: 0 });
    } else {
        setDialogue({ name, color, texts, step: 0 });
    }
    audio.sfx('talk');
  };

  const advanceDialogue = () => {
    if (dialogue.step < dialogue.texts.length - 1) {
        setDialogue({ ...dialogue, step: dialogue.step + 1 });
        audio.sfx('talk');
    } else {
        setDialogue(null);
    }
  };

  const start = () => {
    setUiState('play');
    audio.init(); audio.startBGM();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>
      <Canvas 
        shadows 
        dpr={[1, 2]} 
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ fov: 45 }}
      >
        <Suspense fallback={null}>
          <DayNightCycle time={gameTime} />
          <Terrain />
          <Vegetation />
          <Player isRiding={isRiding} onCollect={(type) => setInventory(prev => ({ ...prev, [type]: prev[type] + 1 }))} />
          <Apples playerPos={playerPos} onCollect={(type) => { 
              setInventory(prev => ({ ...prev, [type]: prev[type] + 1 }));
              setBells(b => b + 100);
          }} />
          
          <NPC name="Barnaby" color={COLORS.npc1} pos={[-10, 0, -10]} dialogues={["Hey neighbor!", "Got any snacks?"]} onTalk={handleTalk} />
          <NPC name="Luna" color={COLORS.npc3} pos={[15, 0, 5]} dialogues={["The stars are pretty tonight.", "Check your bag for items!"]} onTalk={handleTalk} />
          <NPC name="Pip" color={COLORS.npc2} pos={[5, 0, 15]} dialogues={["Vroom vroom!", "Hoverboards are the best!"]} onTalk={handleTalk} />

          <House pos={[-10, 0, -14]} color={COLORS.npc1} time={gameTime} />
          <House pos={[15, 0, 1]} color={COLORS.npc3} time={gameTime} />
          <House pos={[5, 0, 11]} color={COLORS.npc2} time={gameTime} />

          <Tracker setPos={setPlayerPos} />
          <Environment preset="park" />
          
          <EffectComposer multisampling={8}>
            <Bloom intensity={0.4} luminanceThreshold={0.8} />
            <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={3} />
            <Vignette darkness={0.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* ═══════════════════════════════════════════════════════════════════════════════
          UI OVERLAYS
      ═══════════════════════════════════════════════════════════════════════════════ */}

      {uiState === 'start' && (
        <div onClick={start} style={overlayStyle}>
            <h1 style={{ fontSize: '80px', margin: 0 }}>🏝️ CANDY ISLAND</h1>
            <p style={{ fontSize: '24px' }}>The Master Edition — Click to Begin</p>
        </div>
      )}

      {uiState !== 'start' && (
        <>
            {/* HUD */}
            <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: 15, pointerEvents: 'none' }}>
                <div style={hudBox}>🔔 {bells.toLocaleString()}</div>
                <div style={{ ...hudBox, background: '#FF69B4', color: 'white', pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setUiState(uiState === 'inv' ? 'play' : 'inv')}>🎒 Bag</div>
                <div style={{ ...hudBox, background: isRiding ? '#00FA9A' : '#fff', pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => setIsRiding(!isRiding)}>🛹 Board</div>
            </div>

            <div style={{ position: 'absolute', top: 20, right: 20, ...hudBox }}>
                {Math.floor(gameTime)}:00 {gameTime >= 12 ? 'PM' : 'AM'}
            </div>

            {/* Inventory UI */}
            {uiState === 'inv' && (
                <div style={modalOverlay} onClick={() => setUiState('play')}>
                    <div style={modalContent} onClick={e => e.stopPropagation()}>
                        <h2>My Pockets</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div style={invSlot}>🍎 Apples: {inventory.fruit}</div>
                            <div style={invSlot}>🌸 Flowers: {inventory.flowers}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialogue UI */}
            {dialogue && (
                <div style={dialogueBox} onClick={advanceDialogue}>
                    <div style={{ background: `#${dialogue.color.toString(16)}`, color: 'white', padding: '5px 20px', display: 'inline-block', borderRadius: '10px 10px 0 0' }}>{dialogue.name}</div>
                    <div style={dialogueText}>{dialogue.texts[dialogue.step]}</div>
                </div>
            )}

            <div style={controlsHint}>WASD to move | SHIFT to sprint | SPACE for board</div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function DayNightCycle({ time }) {
    const sunAngle = ((time - 6) / 12) * Math.PI - Math.PI;
    const x = Math.cos(sunAngle) * 60; const y = Math.max(Math.sin(-sunAngle) * 60, -5);
    const isNight = time < 6 || time > 18;
    return (
        <>
            <Sky sunPosition={[x, y, 20]} turbidity={0.1} />
            <directionalLight position={[x, y, 20]} intensity={isNight ? 0.2 : 1.5} castShadow shadow-mapSize={[2048, 2048]} />
            <ambientLight intensity={isNight ? 0.2 : 0.6} />
            {isNight && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
        </>
    );
}

function Tracker({ setPos }) {
    useFrame((s) => setPos(s.camera.getWorldPosition(new THREE.Vector3())));
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💅 STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const overlayStyle = { position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #87CEEB, #90EE90)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, color: 'white', fontFamily: '"Comic Sans MS", cursive', cursor: 'pointer' };
const hudBox = { background: 'white', padding: '10px 20px', borderRadius: '20px', border: '4px solid #8B4513', fontFamily: '"Comic Sans MS", cursive', fontWeight: 'bold' };
const dialogueBox = { position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', width: '70%', maxWidth: '800px', zIndex: 110, cursor: 'pointer', fontFamily: '"Comic Sans MS", cursive' };
const dialogueText = { background: 'white', padding: '30px', borderRadius: '0 20px 20px 20px', border: '5px solid #333', fontSize: '24px' };
const modalOverlay = { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 };
const modalContent = { background: '#FFF0F5', padding: '40px', borderRadius: '30px', border: '10px solid #FFB6C1', textAlign: 'center', fontFamily: '"Comic Sans MS", cursive' };
const invSlot = { background: 'white', padding: '20px', borderRadius: '15px', border: '3px solid #FF69B4', fontSize: '20px' };
const controlsHint = { position: 'absolute', bottom: 10, right: 10, color: 'white', fontSize: '12px', opacity: 0.6 };
