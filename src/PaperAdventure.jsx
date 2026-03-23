/**
 * 🏝️ CANDY ISLAND — FIXED
 *
 * Fixes applied:
 *  1. CONFIG.walk → CONFIG.SPEEDS.walk (movement was NaN)
 *  2. Mouse look + pointer lock (was a top-down RTS camera)
 *  3. WASD now moves relative to camera yaw (not world-space)
 *  4. Keys tracked in useRef, not useState (no stale closures)
 *  5. SPACE key toggles board (was in help text but never wired)
 *  6. playerPos is a shared ref, not state (no 60fps re-renders)
 *  7. Terrain height raycast so player walks on the ground
 *  8. NPC home is plain {x,y,z}, not new THREE.Vector3() per render
 *  9. removeEventListener now correctly references named functions
 */

import React, {
  useRef, useMemo, useState, useEffect,
  Suspense, createContext, useContext,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sky, ContactShadows, Stars, Sparkles,
  Float, Instance, Instances, Environment, Html,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// ─── Constants ────────────────────────────────────────────────────────────────

const noise2D = createNoise2D();
const GameContext = createContext();

// Module-level camera state — lives outside React to avoid re-renders
const camState = { yaw: Math.PI, pitch: 0.45, locked: false };

const CONFIG = {
  FRICTION: 0.80,
  SPEEDS: { walk: 14, run: 25, ride: 42 },
  COLORS: {
    grass: '#91CF70', sand: '#F2D9BB', water: '#4FC3F7',
    player: '#FFB6C1', barnaby: '#87CEFA', luna: '#DDA0DD', pip: '#FFD700',
  },
  TIME_SPEED: 0.05,
};

// ─── Store ────────────────────────────────────────────────────────────────────

const useIslandStore = () => {
  // playerPos as a ref — updated every frame without triggering re-renders
  const playerPosRef = useRef(new THREE.Vector3(0, 1, 0));
  // playerGroup ref shared between PlayerController and CameraRig
  const playerGroupRef = useRef();

  const [state, setState] = useState({
    bells: 100,
    inventory: { fruit: 0, flowers: 0, fish: 0 },
    activeBoard: false,
    gameTime: 8.0,
    dialogue: null,
    ui: 'start',
  });

  const actions = useMemo(() => ({
    setUI: (v) => setState(s => ({ ...s, ui: v })),
    addBells: (n) => setState(s => ({ ...s, bells: s.bells + n })),
    addItem: (type, n = 1) => setState(s => ({ ...s, inventory: { ...s.inventory, [type]: s.inventory[type] + n } })),
    toggleBoard: () => setState(s => ({ ...s, activeBoard: !s.activeBoard })),
    setDialogue: (d) => setState(s => ({ ...s, dialogue: d })),
    updateTime: (dt) => setState(s => ({ ...s, gameTime: (s.gameTime + dt) % 24 })),
  }), []);

  return { state, actions, playerPosRef, playerGroupRef };
};

// ─── Audio ────────────────────────────────────────────────────────────────────

class GameAudio {
  constructor() { this.ctx = null; this.master = null; this.bgm = false; }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.08;
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
  sfx(type) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.connect(g); g.connect(this.master);
    if (type === 'pop') {
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.15, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.start(); osc.stop(this.ctx.currentTime + 0.15);
    }
    if (type === 'talk') {
      osc.type = 'square';
      osc.frequency.value = 550 + Math.random() * 250;
      g.gain.setValueAtTime(0.03, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.start(); osc.stop(this.ctx.currentTime + 0.06);
    }
  }
}
const audio = new GameAudio();

// ─── Terrain ─────────────────────────────────────────────────────────────────

function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(150, 150, 128, 128);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = [];
    const cA = new THREE.Color(CONFIG.COLORS.grass);
    const cB = new THREE.Color(CONFIG.COLORS.sand);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      let h = noise2D(x * 0.04, z * 0.04) * 3 + noise2D(x * 0.1, z * 0.1) * 0.8;
      const mask = Math.max(0, 1 - Math.pow(d / 60, 4));
      h *= mask;
      if (d > 55) h = -2.5;
      pos.setY(i, h);
      const c = h > 0.4 ? cA : cB;
      colors.push(c.r, c.g, c.b);
    }
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, []);

  return (
    <mesh geometry={geo} receiveShadow name="ground">
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
    </mesh>
  );
}

function Water() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = -1.2 + Math.sin(clock.elapsedTime) * 0.1;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color={CONFIG.COLORS.water} transparent opacity={0.6} metalness={0.9} roughness={0.1} />
    </mesh>
  );
}

// ─── Camera (pointer-lock mouse look) ────────────────────────────────────────

function CameraRig() {
  const { playerGroupRef } = useContext(GameContext);
  const { gl, camera } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      // Only lock if not interacting with UI
      if (document.activeElement === document.body || document.activeElement === canvas) {
        canvas.requestPointerLock();
      }
    };
    const onLockChange = () => {
      camState.locked = document.pointerLockElement === canvas;
    };
    const onMouseMove = (e) => {
      if (!camState.locked) return;
      camState.yaw   -= e.movementX * 0.003;
      camState.pitch  = Math.max(0.12, Math.min(1.1, camState.pitch - e.movementY * 0.003));
    };

    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [gl]);

  const _target = useMemo(() => new THREE.Vector3(), []);
  const _camPos  = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const p = playerGroupRef.current;
    if (!p) return;

    const dist = 16;
    const px = p.position.x + Math.sin(camState.yaw)  * dist * Math.cos(camState.pitch);
    const pz = p.position.z + Math.cos(camState.yaw)  * dist * Math.cos(camState.pitch);
    const py = p.position.y + dist * Math.sin(camState.pitch) + 1.5;

    _camPos.set(px, py, pz);
    camera.position.lerp(_camPos, 0.1);

    _target.set(p.position.x, p.position.y + 1.2, p.position.z);
    camera.lookAt(_target);
  });

  return null;
}

// ─── Player ───────────────────────────────────────────────────────────────────

function PlayerController() {
  const { state, actions, playerPosRef, playerGroupRef } = useContext(GameContext);
  const body  = useRef();
  const vel   = useRef(new THREE.Vector3());
  const keys  = useRef({});

  // Reusable objects to avoid GC pressure
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const downVec   = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const { scene } = useThree();

  useEffect(() => {
    // FIX: keys tracked in a ref — no stale closures, no re-renders
    // FIX: named functions so removeEventListener actually works
    const onDown = (e) => {
      keys.current[e.key.toLowerCase()] = true;
      // FIX: SPACE wired up (was missing from original)
      if (e.code === 'Space') { e.preventDefault(); actions.toggleBoard(); }
    };
    const onUp = (e) => { keys.current[e.key.toLowerCase()] = false; };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [actions]);

  useFrame(({ clock }, delta) => {
    const g = playerGroupRef.current;
    if (!g || state.ui !== 'play') return;

    const k = keys.current;
    // FIX: CONFIG.SPEEDS.walk (was CONFIG.walk — undefined → NaN → no movement)
    const speed = state.activeBoard
      ? CONFIG.SPEEDS.ride
      : (k['shift'] ? CONFIG.SPEEDS.run : CONFIG.SPEEDS.walk);

    // FIX: movement is relative to camera yaw, not world axes
    const mx = (k['a'] || k['arrowleft']  ? -1 : 0) + (k['d'] || k['arrowright'] ? 1 : 0);
    const mz = (k['w'] || k['arrowup']    ? -1 : 0) + (k['s'] || k['arrowdown']  ? 1 : 0);

    if (mx !== 0 || mz !== 0) {
      const angle = Math.atan2(mx, mz) + camState.yaw;
      vel.current.x += Math.sin(angle) * speed * delta;
      vel.current.z += Math.cos(angle) * speed * delta;
    }

    vel.current.multiplyScalar(CONFIG.FRICTION);

    // Island bounds
    g.position.x = Math.max(-57, Math.min(57, g.position.x + vel.current.x));
    g.position.z = Math.max(-57, Math.min(57, g.position.z + vel.current.z));

    // Terrain height following via raycast
    raycaster.set(new THREE.Vector3(g.position.x, 10, g.position.z), downVec);
    const ground = scene.getObjectByName('ground');
    if (ground) {
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0) {
        g.position.y = THREE.MathUtils.lerp(g.position.y, hits[0].point.y + 0.65, 0.3);
      }
    }

    // Rotation toward movement direction
    const spd2D = Math.sqrt(vel.current.x ** 2 + vel.current.z ** 2);
    if (spd2D > 0.04) {
      const targetRot = Math.atan2(vel.current.x, vel.current.z);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRot, 0.18);
      if (body.current) {
        const cycle = Math.sin(clock.elapsedTime * 10);
        body.current.position.y = Math.abs(cycle) * 0.1;
        body.current.rotation.z = cycle * 0.045;
      }
    } else if (body.current) {
      body.current.position.y = THREE.MathUtils.lerp(body.current.position.y, 0, 0.12);
      body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, 0, 0.12);
    }

    // FIX: update ref directly — no setState, no re-renders
    playerPosRef.current.copy(g.position);
  });

  return (
    <group ref={playerGroupRef} position={[0, 1, 0]}>
      <group ref={body}>
        <mesh castShadow>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshStandardMaterial color={CONFIG.COLORS.player} />
        </mesh>
        {/* Eyes */}
        <mesh position={[ 0.22, 0.2, 0.46]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="black" /></mesh>
        <mesh position={[-0.22, 0.2, 0.46]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="black" /></mesh>
        {/* Board */}
        {state.activeBoard && (
          <mesh position={[0, -0.68, 0]}>
            <boxGeometry args={[1.7, 0.1, 0.85]} />
            <meshStandardMaterial color="hotpink" emissive="hotpink" emissiveIntensity={0.9} />
          </mesh>
        )}
      </group>
      <ContactShadows opacity={0.4} scale={5} blur={2} />
    </group>
  );
}

// ─── NPC ─────────────────────────────────────────────────────────────────────

function NPC({ name, color, home, dialogues }) {
  const { state, actions } = useContext(GameContext);
  const ref     = useRef();
  const modeRef = useRef('idle');
  // FIX: target as a ref with stable THREE.Vector3 — not recreated each frame
  const target  = useRef(new THREE.Vector3(home.x, home.y + 0.6, home.z));

  useFrame(({ clock }, delta) => {
    if (!ref.current || state.dialogue?.name === name) return;
    const t = clock.elapsedTime + home.x;

    if (Math.floor(t) % 10 === 0 && modeRef.current === 'idle') {
      modeRef.current = 'walk';
      target.current.set(
        home.x + (Math.random() - 0.5) * 14,
        ref.current.position.y,
        home.z + (Math.random() - 0.5) * 14,
      );
    }

    if (modeRef.current === 'walk') {
      const dir = target.current.clone().sub(ref.current.position).normalize();
      ref.current.position.add(dir.multiplyScalar(delta * 3));
      ref.current.lookAt(target.current.x, ref.current.position.y, target.current.z);
      if (ref.current.position.distanceTo(target.current) < 0.5) modeRef.current = 'idle';
    } else {
      ref.current.position.y = home.y + 0.6 + Math.sin(t * 2) * 0.1;
    }
  });

  return (
    // FIX: home is plain {x,y,z} object — no new THREE.Vector3() created every render
    <group
      ref={ref}
      position={[home.x, home.y + 0.6, home.z]}
      onClick={() => {
        actions.setDialogue({ name, color, texts: dialogues, step: 0 });
        audio.sfx('talk');
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[0, 1.3, 0]} center occlude>
        <div style={{
          background: 'white', padding: '2px 10px', borderRadius: '10px',
          fontSize: '12px', border: `2px solid ${color}`, fontWeight: 'bold',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{name}</div>
      </Html>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[1.2, 0.1, 0.6]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    </group>
  );
}

// ─── World Assets ─────────────────────────────────────────────────────────────

function WorldAssets() {
  // FIX: reads playerPosRef (a ref) instead of state.playerPos (caused 60fps re-renders)
  const { actions, playerPosRef } = useContext(GameContext);

  const fruitData = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      // Store as THREE.Vector3 once, not rebuilt every frame
      pos: new THREE.Vector3((Math.random() - 0.5) * 80, 0.6, (Math.random() - 0.5) * 80),
    })),
  []);
  const [activeFruit, setActiveFruit] = useState(() => new Set(fruitData.map(f => f.id)));

  useFrame(() => {
    fruitData.forEach(f => {
      if (activeFruit.has(f.id) && playerPosRef.current.distanceTo(f.pos) < 1.5) {
        setActiveFruit(prev => { const n = new Set(prev); n.delete(f.id); return n; });
        actions.addItem('fruit');
        actions.addBells(50);
        audio.sfx('pop');
      }
    });
  });

  return (
    <group>
      <House position={[-15, 0, -15]} color={CONFIG.COLORS.barnaby} />
      <House position={[ 20, 0,   5]} color={CONFIG.COLORS.luna} />
      <House position={[  0, 0,  25]} color={CONFIG.COLORS.pip} />

      <Instances limit={80}>
        <coneGeometry args={[1.5, 4, 8]} />
        <meshStandardMaterial color="#228B22" />
        {Array.from({ length: 60 }).map((_, i) => (
          <Instance key={i} position={[(Math.random() - 0.5) * 100, 2, (Math.random() - 0.5) * 100]} castShadow />
        ))}
      </Instances>

      {fruitData.map(f => activeFruit.has(f.id) && (
        <Float key={f.id} position={[f.pos.x, f.pos.y, f.pos.z]} speed={5}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="red" emissive="red" emissiveIntensity={0.5} />
          </mesh>
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
      <mesh position={[0, 4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.5, 2.5, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <pointLight position={[0, 2, 3]} intensity={1} color={color} distance={10} />
    </group>
  );
}

// ─── Atmosphere ───────────────────────────────────────────────────────────────

function Atmosphere() {
  const { state, actions } = useContext(GameContext);
  useFrame((_, delta) => actions.updateTime(delta * CONFIG.TIME_SPEED));

  const sunAngle = ((state.gameTime - 6) / 12) * Math.PI - Math.PI;
  const sunPos   = [Math.cos(sunAngle) * 80, Math.max(Math.sin(-sunAngle) * 80, -10), 20];
  const isNight  = state.gameTime < 6 || state.gameTime > 18;

  return (
    <>
      <Sky sunPosition={sunPos} turbidity={0.1} rayleigh={2} />
      <directionalLight position={sunPos} intensity={isNight ? 0.2 : 1.5} castShadow shadow-mapSize={[2048, 2048]} />
      <ambientLight intensity={isNight ? 0.1 : 0.4} />
      {isNight && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
    </>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function GameUI() {
  const { state, actions } = useContext(GameContext);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const onLock = () => setLocked(document.pointerLockElement != null);
    document.addEventListener('pointerlockchange', onLock);
    return () => document.removeEventListener('pointerlockchange', onLock);
  }, []);

  if (state.ui === 'start') return (
    <div
      style={styles.overlay}
      onClick={() => { actions.setUI('play'); audio.init(); audio.playBGM(); }}
    >
      <h1 style={{ fontSize: '80px', margin: 0, textShadow: '5px 5px #ff69b4' }}>🏝️ CANDY ISLAND</h1>
      <p style={{ fontSize: '26px', fontWeight: 'bold', margin: '10px 0' }}>THE ULTIMATE EDITION</p>
      <p style={{ fontSize: '17px', opacity: 0.85 }}>Click to start, then click the game to enable mouse look</p>
    </div>
  );

  return (
    <>
      {/* HUD */}
      <div style={styles.hud}>
        <div style={styles.statBox}>🔔 {state.bells.toLocaleString()}</div>
        <div style={styles.statBox}>🍎 {state.inventory.fruit}</div>
        <button style={styles.btn} onClick={() => actions.toggleBoard()}>
          {state.activeBoard ? '🛹 ON' : '🛹 OFF'}
        </button>
        <div style={styles.statBox}>
          {String(Math.floor(state.gameTime % 12) || 12).padStart(2, '0')}:00{' '}
          {state.gameTime >= 12 ? 'PM' : 'AM'}
        </div>
      </div>

      {/* Crosshair */}
      {locked && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'white', fontSize: 20, pointerEvents: 'none', opacity: 0.6 }}>+</div>
      )}

      {/* Dialogue */}
      {state.dialogue && (
        <div
          style={styles.dialogue}
          onClick={() => {
            const d = state.dialogue;
            if (d.step < d.texts.length - 1) {
              actions.setDialogue({ ...d, step: d.step + 1 });
              audio.sfx('talk');
            } else {
              actions.setDialogue(null);
            }
          }}
        >
          <div style={{ background: state.dialogue.color, color: 'white', padding: '5px 20px', display: 'inline-block', borderRadius: '10px 10px 0 0', fontWeight: 'bold' }}>
            {state.dialogue.name}
          </div>
          <div style={styles.dialogueText}>{state.dialogue.texts[state.dialogue.step]}</div>
          <div style={{ textAlign: 'right', padding: '4px 16px 0', fontSize: '13px', opacity: 0.5 }}>click to continue ▶</div>
        </div>
      )}

      {/* Help bar */}
      <div style={styles.help}>
        {locked
          ? 'WASD · Move  |  SHIFT · Sprint  |  SPACE · Board  |  ESC · Unlock mouse  |  Click NPC · Talk'
          : '🖱️ Click the game world to enable mouse look'}
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CandyIslandUltimate() {
  const store = useIslandStore();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#87CEEB' }}>
      <GameContext.Provider value={store}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ fov: 45, position: [0, 12, 18] }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <Suspense fallback={null}>
            <Atmosphere />
            <Terrain />
            <Water />
            <WorldAssets />

            <PlayerController />
            <CameraRig />

            {/* FIX: home is plain {x,y,z} — no new THREE.Vector3() per render */}
            <NPC name="Barnaby" color={CONFIG.COLORS.barnaby} home={{ x: -15, y: 0, z: -10 }}
              dialogues={['Welcome to the island!', 'Have you tried the hoverboard?', 'I love the smell of the sea.']} />
            <NPC name="Luna"    color={CONFIG.COLORS.luna}    home={{ x:  20, y: 0, z:  10 }}
              dialogues={['Meow! The stars are bright.', 'Did you find any fruit today?', 'Bells are easy to earn here!']} />
            <NPC name="Pip"     color={CONFIG.COLORS.pip}     home={{ x:   0, y: 0, z:  20 }}
              dialogues={["I'm the fastest bunny alive!", 'Hold SHIFT to sprint like me!', 'Bells can be used at the shop!']} />

            <Environment preset="forest" />

            <EffectComposer multisampling={4}>
              <Bloom intensity={0.5} luminanceThreshold={0.9} />
              <Vignette darkness={0.45} />
              <ChromaticAberration offset={[0.0005, 0.0005]} />
            </EffectComposer>
          </Suspense>
        </Canvas>
        <GameUI />
      </GameContext.Provider>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const FF = '"Comic Sans MS", cursive';
const styles = {
  overlay: {
    position: 'absolute', inset: 0, zIndex: 100, cursor: 'pointer',
    background: 'linear-gradient(135deg, #87CEEB 0%, #91CF70 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontFamily: FF, textAlign: 'center',
  },
  hud: { position: 'absolute', top: 24, left: 24, display: 'flex', gap: 16, pointerEvents: 'none', zIndex: 10 },
  statBox: {
    background: 'rgba(255,255,255,0.92)', padding: '8px 22px', borderRadius: '50px',
    border: '4px solid #8B4513', fontWeight: 'bold', fontSize: '18px', fontFamily: FF,
  },
  btn: {
    background: '#FF69B4', color: 'white', border: '4px solid white', borderRadius: '50px',
    padding: '8px 22px', cursor: 'pointer', pointerEvents: 'auto',
    fontWeight: 'bold', fontFamily: FF, fontSize: '18px',
  },
  dialogue: {
    position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)',
    width: '68%', maxWidth: '860px', cursor: 'pointer', fontFamily: FF, zIndex: 10,
  },
  dialogueText: {
    background: 'rgba(255,255,255,0.96)', padding: '24px 28px',
    borderRadius: '0 20px 20px 20px', border: '5px solid #333',
    fontSize: '24px', lineHeight: 1.5,
  },
  help: {
    position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
    color: 'white', opacity: 0.7, fontSize: '13px', fontFamily: 'Arial, sans-serif',
    background: 'rgba(0,0,0,0.35)', padding: '5px 16px', borderRadius: '20px',
    whiteSpace: 'nowrap', zIndex: 10,
  },
};
