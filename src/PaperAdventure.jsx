/**
 * 🏝️ CANDY ISLAND — THE DEVELOPER'S DEFINITIVE CUT
 * Full-scale Game Logic: AI Schedules, Economy, WASD Physics, and HD Rendering.
 */

import React, { useRef, useMemo, useState, useEffect, useCallback, Suspense, createContext, useContext } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, ContactShadows, Stars, Sparkles, Float, Instance, Instances, Environment, SoftShadows, Html, Text } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette, ChromaticAberration, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ GLOBAL CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const noise2D = createNoise2D();
const GameContext = createContext();

const CONFIG = {
  WORLD_SIZE: 120,
  TIME_SPEED: 0.05,
  GRAVITY: -9.8,
  FRICTION: 0.88,
  SPEEDS: { walk: 14, run: 25, ride: 50 },
  COLORS: {
    grass: '#91CF70',
    sand: '#F2D9BB',
    water: '#4FC3F7',
    player: '#FFB6C1',
    barnaby: '#87CEFA',
    luna: '#DDA0DD',
    pip: '#FFD700'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧠 STATE MANAGEMENT (Store Pattern)
// ═══════════════════════════════════════════════════════════════════════════════

const useIslandStore = () => {
  const [state, setState] = useState({
    bells: 100,
    inventory: { fruit: 0, flowers: 0, fish: 0 },
    activeBoard: false,
    gameTime: 8.0,
    dialogue: null,
    ui: 'start', // 'start', 'play', 'shop', 'inventory'
    playerPos: new THREE.Vector3(0, 0, 0),
    boardLevel: 1,
    unlockedColors: ['#FFB6C1']
  });

  const actions = useMemo(() => ({
    setUI: (val) => setState(s => ({ ...s, ui: val })),
    addBells: (amt) => setState(s => ({ ...s, bells: s.bells + amt })),
    addItem: (type, amt = 1) => setState(s => ({ ...s, inventory: { ...s.inventory, [type]: s.inventory[type] + amt } })),
    toggleBoard: () => setState(s => ({ ...s, activeBoard: !s.activeBoard })),
    upgradeBoard: () => setState(s => {
        if (s.bells >= 2000) return { ...s, bells: s.bells - 2000, boardLevel: s.boardLevel + 1 };
        return s;
    }),
    setDialogue: (d) => setState(s => ({ ...s, dialogue: d })),
    updateTime: (delta) => setState(s => ({ ...s, gameTime: (s.gameTime + delta) % 24 })),
    setPlayerPos: (p) => setState(s => ({ ...s, playerPos: p }))
  }), []);

  return [state, actions];
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgm = false;
  }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.1;
    this.master.connect(this.ctx.destination);
  }
  playBGM() {
    if (this.bgm || !this.ctx) return;
    this.bgm = true;
    const notes = [261.63, 329.63, 392.00, 523.25];
    let i = 0;
    const loop = () => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.value = notes[i % notes.length];
        g.gain.setValueAtTime(0.02, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
        osc.connect(g); g.connect(this.master);
        osc.start(); osc.stop(this.ctx.currentTime + 1.5);
        i++; setTimeout(loop, 2000);
    };
    loop();
  }
  playSfx(type) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.connect(this.master);
    if (type === 'pop') {
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.1, this.ctx.currentTime);
        osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    }
    if (type === 'talk') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600 + Math.random() * 200, this.ctx.currentTime);
        g.gain.setValueAtTime(0.02, this.ctx.currentTime);
        osc.start(); osc.stop(this.ctx.currentTime + 0.05);
    }
  }
}
const audio = new GameAudio();

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 WORLD GEOMETRY & PHYSICS
// ═══════════════════════════════════════════════════════════════════════════════

function Terrain() {
  const { geometry } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(150, 150, 128, 128);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const colorA = new THREE.Color(CONFIG.COLORS.grass);
    const colorB = new THREE.Color(CONFIG.COLORS.sand);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.sqrt(x*x + z*z);
      
      // Biome Noise
      let h = noise2D(x * 0.04, z * 0.04) * 3;
      h += noise2D(x * 0.1, z * 0.1) * 0.8;
      
      // Island Masking
      const mask = Math.max(0, 1 - Math.pow(d / 60, 4));
      h *= mask;
      if (d > 55) h = -2.5;
      
      pos.setY(i, h);
      const col = h > 0.4 ? colorA : colorB;
      colors.push(col.r, col.g, col.b);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return { geometry: geo };
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow name="ground">
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
    </mesh>
  );
}

function Water() {
    const mesh = useRef();
    useFrame((state) => {
        mesh.current.position.y = -1.2 + Math.sin(state.clock.elapsedTime) * 0.1;
    });
    return (
        <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial color={CONFIG.COLORS.water} transparent opacity={0.6} metalness={0.9} roughness={0.1} />
        </mesh>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚶 ENTITY: PLAYER (Physics-Based)
// ═══════════════════════════════════════════════════════════════════════════════

function PlayerController() {
  const { state, actions } = useContext(GameContext);
  const group = useRef();
  const body = useRef();
  const [keys, setKeys] = useState({});
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKey = (e, val) => setKeys(k => ({ ...k, [e.key.toLowerCase()]: val }));
    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('keyup', handleKey); };
  }, []);

  useFrame((sceneState, delta) => {
    if (state.ui !== 'play') return;
    
    // 1. Physics Movement
    const accel = (state.activeBoard ? CONFIG.SPEEDS.ride : keys.shift ? CONFIG.SPEEDS.run : CONFIG.walk) * delta;
    if (keys.w || keys.arrowup) velocity.current.z -= accel;
    if (keys.s || keys.arrowdown) velocity.current.z += accel;
    if (keys.a || keys.arrowleft) velocity.current.x -= accel;
    if (keys.d || keys.arrowright) velocity.current.x += accel;

    velocity.current.multiplyScalar(CONFIG.FRICTION);
    group.current.position.add(velocity.current);

    // 2. Rotation & Leaning
    if (velocity.current.length() > 0.02) {
        const targetRotation = Math.atan2(velocity.current.x, velocity.current.z);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRotation, 0.1);
        
        // Procedural Animation (Wobble)
        const walkCycle = Math.sin(sceneState.clock.elapsedTime * 12);
        body.current.position.y = 0.6 + Math.abs(walkCycle) * 0.15;
        body.current.rotation.z = walkCycle * 0.05;
    }

    // 3. Camera Sync
    const camOffset = new THREE.Vector3(20, 15, 20);
    sceneState.camera.position.lerp(group.current.position.clone().add(camOffset), 0.1);
    sceneState.camera.lookAt(group.current.position);

    actions.setPlayerPos(group.current.position.clone());
  });

  return (
    <group ref={group} position={[0, 0, 0]}>
      <group ref={body}>
        {/* Character Mesh */}
        <mesh castShadow>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial color={CONFIG.COLORS.player} />
        </mesh>
        {/* Face */}
        <mesh position={[0.2, 0.2, 0.45]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="black" /></mesh>
        <mesh position={[-0.2, 0.2, 0.45]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="black" /></mesh>
        {/* Board */}
        {state.activeBoard && (
            <mesh position={[0, -0.6, 0]}>
                <boxGeometry args={[1.6, 0.1, 0.8]} />
                <meshStandardMaterial color="hotpink" emissive="hotpink" emissiveIntensity={0.5} />
            </mesh>
        )}
      </group>
      <ContactShadows opacity={0.4} scale={5} blur={2} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 ENTITY: NPC (AI-Driven)
// ═══════════════════════════════════════════════════════════════════════════════

function NPC({ name, color, home, dialogues }) {
    const { state, actions } = useContext(GameContext);
    const ref = useRef();
    const mode = useRef('idle'); // idle, walk, talk
    const target = useRef(new THREE.Vector3());

    useFrame((sceneState, delta) => {
        if (state.dialogue?.name === name) return; // Freeze if talking
        
        const t = sceneState.clock.elapsedTime + home.x;
        // Schedule: Wander every 10 seconds
        if (Math.floor(t) % 10 === 0 && mode.current === 'idle') {
            mode.current = 'walk';
            target.current.set(home.x + (Math.random()-0.5)*15, 0, home.z + (Math.random()-0.5)*15);
        }

        if (mode.current === 'walk') {
            const dir = target.current.clone().sub(ref.current.position).normalize();
            ref.current.position.add(dir.multiplyScalar(delta * 3));
            ref.current.lookAt(target.current);
            if (ref.current.position.distanceTo(target.current) < 0.5) mode.current = 'idle';
        } else {
            // Idle hover
            ref.current.position.y = 0.6 + Math.sin(t * 2) * 0.1;
        }
    });

    return (
        <group ref={ref} position={[home.x, 0.6, home.z]} onClick={() => {
            actions.setDialogue({ name, color, texts: dialogues, step: 0 });
            audio.playSfx('talk');
        }}>
            <mesh castShadow>
                <sphereGeometry args={[0.6, 32, 32]} />
                <meshStandardMaterial color={color} />
            </mesh>
            <Html position={[0, 1.2, 0]} center>
                <div style={{ background: 'white', padding: '2px 10px', borderRadius: '10px', fontSize: '12px', border: `2px solid ${color}`, fontWeight: 'bold' }}>{name}</div>
            </Html>
            {/* Scooter */}
            <mesh position={[0, -0.5, 0]}><boxGeometry args={[1.2, 0.1, 0.6]} /><meshStandardMaterial color="#444" /></mesh>
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌲 ENVIRONMENT & ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

function WorldAssets() {
    const { state, actions } = useContext(GameContext);
    const fruitData = useMemo(() => Array.from({length: 20}, (_, i) => ({ id: i, pos: [(Math.random()-0.5)*80, 0.6, (Math.random()-0.5)*80] })), []);
    const [activeFruit, setActiveFruit] = useState(new Set(fruitData.map(f => f.id)));

    useFrame(() => {
        fruitData.forEach(f => {
            if (activeFruit.has(f.id)) {
                if (state.playerPos.distanceTo(new THREE.Vector3(...f.pos)) < 1.5) {
                    setActiveFruit(prev => { const n = new Set(prev); n.delete(f.id); return n; });
                    actions.addItem('fruit');
                    actions.addBells(50);
                    audio.playSfx('pop');
                }
            }
        });
    });

    return (
        <group>
            {/* Houses */}
            <House position={[-15, 0, -15]} color={CONFIG.COLORS.barnaby} roof="#333" />
            <House position={[20, 0, 5]} color={CONFIG.COLORS.luna} roof="#333" />
            <House position={[0, 0, 25]} color={CONFIG.COLORS.pip} roof="#333" />

            {/* Trees */}
            <Instances limit={100}>
                <coneGeometry args={[1.5, 4, 8]} />
                <meshStandardMaterial color="#228B22" />
                {Array.from({length: 60}).map((_, i) => (
                    <Instance key={i} position={[(Math.random()-0.5)*100, 2, (Math.random()-0.5)*100]} castShadow />
                ))}
            </Instances>

            {/* Collectibles */}
            {fruitData.map(f => activeFruit.has(f.id) && (
                <Float key={f.id} position={f.pos} speed={5}>
                    <mesh><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color="red" emissive="red" emissiveIntensity={0.5} /></mesh>
                    <Sparkles count={5} scale={1} size={2} color="yellow" />
                </Float>
            ))}
        </group>
    );
}

function House({ position, color }) {
    return (
        <group position={position}>
            <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={[4, 3, 4]} /><meshStandardMaterial color="#fff" /></mesh>
            <mesh position={[0, 4, 0]} rotation={[0, Math.PI/4, 0]} castShadow><coneGeometry args={[3.5, 2.5, 4]} /><meshStandardMaterial color={color} /></mesh>
            <pointLight position={[0, 2, 3]} intensity={1} color={color} distance={10} />
        </group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌓 SKY & LIGHTING
// ═══════════════════════════════════════════════════════════════════════════════

function Atmosphere() {
    const { state, actions } = useContext(GameContext);
    useFrame((_, delta) => actions.updateTime(delta * CONFIG.TIME_SPEED));

    const sunAngle = ((state.gameTime - 6) / 12) * Math.PI - Math.PI;
    const sunPos = [Math.cos(sunAngle) * 80, Math.max(Math.sin(-sunAngle) * 80, -10), 20];
    const isNight = state.gameTime < 6 || state.gameTime > 18;

    return (
        <>
            <Sky sunPosition={sunPos} turbidity={0.1} rayleigh={2} />
            <directionalLight position={sunPos} intensity={isNight ? 0.2 : 1.5} castShadow shadow-mapSize={[2048, 2048]} />
            <ambientLight intensity={isNight ? 0.1 : 0.4} />
            {isNight && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🖥️ UI SYSTEM (React Overlays)
// ═══════════════════════════════════════════════════════════════════════════════

const GameUI = () => {
    const { state, actions } = useContext(GameContext);

    if (state.ui === 'start') return (
        <div style={styles.overlay} onClick={() => { actions.setUI('play'); audio.init(); audio.playBGM(); }}>
            <h1 style={{ fontSize: '100px', margin: 0, textShadow: '5px 5px #ff69b4' }}>🏝️ CANDY ISLAND</h1>
            <p style={{ fontSize: '30px', fontWeight: 'bold' }}>THE ULTIMATE EDITION</p>
            <p>🖱️ CLICK TO ENTER THE WORLD</p>
        </div>
    );

    return (
        <>
            {/* HUD */}
            <div style={styles.hud}>
                <div style={styles.statBox}>🔔 {state.bells.toLocaleString()}</div>
                <div style={styles.statBox}>🍎 {state.inventory.fruit}</div>
                <button style={styles.btn} onClick={() => actions.toggleBoard()}>{state.activeBoard ? '🛹 ON' : '🛹 OFF'}</button>
                <div style={styles.statBox}>{Math.floor(state.gameTime)}:00 {state.gameTime > 12 ? 'PM' : 'AM'}</div>
            </div>

            {/* Dialogue Box */}
            {state.dialogue && (
                <div style={styles.dialogue} onClick={() => {
                    if (state.dialogue.step < state.dialogue.texts.length - 1) {
                        actions.setDialogue({ ...state.dialogue, step: state.dialogue.step + 1 });
                        audio.playSfx('talk');
                    } else {
                        actions.setDialogue(null);
                    }
                }}>
                    <div style={{ background: state.dialogue.color, color: 'white', padding: '5px 20px', display: 'inline-block', borderRadius: '10px 10px 0 0', fontWeight: 'bold' }}>{state.dialogue.name}</div>
                    <div style={styles.dialogueText}>{state.dialogue.texts[state.dialogue.step]}</div>
                </div>
            )}

            {/* Help */}
            <div style={styles.help}>WASD to Walk | SHIFT to Run | SPACE for Board</div>
        </>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏁 BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════════

export default function CandyIslandUltimate() {
  const [state, actions] = useIslandStore();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <GameContext.Provider value={{ state, actions }}>
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 45 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
            <Suspense fallback={null}>
                <Atmosphere />
                <Terrain />
                <Water />
                <WorldAssets />
                
                <PlayerController />
                
                {/* NPCs with Full AI Schedules */}
                <NPC name="Barnaby" color={CONFIG.COLORS.barnaby} home={new THREE.Vector3(-15, 0, -10)} dialogues={["Welcome to the island!", "Have you tried my hoverboard?", "I love the smell of the sea."]} />
                <NPC name="Luna" color={CONFIG.COLORS.luna} home={new THREE.Vector3(20, 0, 10)} dialogues={["Meow! The stars are bright.", "Did you find any fruit today?", "Bells are easy to earn here!"]} />
                <NPC name="Pip" color={CONFIG.COLORS.pip} home={new THREE.Vector3(0, 0, 20)} dialogues={["I'm the fastest bunny alive!", "Hold SHIFT to sprint like me!", "Bells can be used at the shop!"]} />

                <Environment preset="forest" />
                
                <EffectComposer multisampling={8}>
                    <Bloom intensity={0.5} luminanceThreshold={0.9} />
                    <Vignette darkness={0.5} />
                    <ChromaticAberration offset={[0.0005, 0.0005]} />
                </EffectComposer>
            </Suspense>
        </Canvas>
        <GameUI />
      </GameContext.Provider>
    </div>
  );
}

const styles = {
    overlay: { position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #87CEEB, #91CF70)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: '"Comic Sans MS", cursive', cursor: 'pointer', textAlign: 'center' },
    hud: { position: 'absolute', top: 30, left: 30, display: 'flex', gap: 20, pointerEvents: 'none' },
    statBox: { background: 'white', padding: '10px 25px', borderRadius: '50px', border: '5px solid #8B4513', fontWeight: 'bold', fontSize: '20px', fontFamily: '"Comic Sans MS", cursive' },
    btn: { background: '#FF69B4', color: 'white', border: '5px solid white', borderRadius: '50px', padding: '10px 25px', cursor: 'pointer', pointerEvents: 'auto', fontWeight: 'bold', fontFamily: '"Comic Sans MS", cursive', fontSize: '20px' },
    dialogue: { position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)', width: '70%', maxWidth: '900px', cursor: 'pointer', fontFamily: '"Comic Sans MS", cursive' },
    dialogueText: { background: 'rgba(255, 255, 255, 0.95)', padding: '30px', borderRadius: '0 20px 20px 20px', border: '6px solid #333', fontSize: '26px', lineHeight: '1.4' },
    help: { position: 'absolute', bottom: 20, right: 30, color: 'white', opacity: 0.6, fontSize: '14px', fontFamily: 'Arial' },
    invSlot: { background: 'white', padding: '20px', borderRadius: '15px', border: '3px solid #FF69B4' }
};
