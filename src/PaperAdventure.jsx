/**
 * 🏝️ CANDY ISLAND — The High-Res Joyride Update
 * Features: HD Rendering, Hoverboards, NPCs, Inventory, Day/Night & Quests!
 */

import React, { useRef, useMemo, useState, useCallback, createContext } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, ContactShadows, SoftShadows, Float, Sparkles, Instance, Instances, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATE & CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const GameContext = createContext();

const useGameStore = () => {
  const [state, setState] = useState({
    bells: 0,
    items: { flowers: 0, bugs: 0, fish: 0, fruit: 0 },
    isRiding: false,
    isRunning: false,
    gameTime: 8.0,
    playerPos: new THREE.Vector3(0, 0, 0),
    targetPos: null,
    isMoving: false,
    dialogue: null,
    uiState: 'start',
  });

  const actions = useMemo(() => ({
    addBells: (amount) => setState(s => ({ ...s, bells: s.bells + amount })),
    addItem: (type) => setState(s => ({ ...s, items: { ...s.items, [type]: s.items[type] + 1 } })),
    setRiding: (val) => setState(s => ({ ...s, isRiding: val })),
    setRunning: (val) => setState(s => ({ ...s, isRunning: val })),
    setGameTime: (val) => setState(s => ({ ...s, gameTime: val })),
    setPlayerPos: (pos) => setState(s => ({ ...s, playerPos: pos })),
    setTarget: (pos) => setState(s => ({ ...s, targetPos: pos, isMoving: !!pos })),
    stopMoving: () => setState(s => ({ ...s, isMoving: false, targetPos: null })),
    setDialogue: (data) => setState(s => ({ ...s, dialogue: data, uiState: data ? 'dialogue' : 'play' })),
    setUIState: (val) => setState(s => ({ ...s, uiState: val })),
  }), []);

  return [state, actions];
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class SpatialAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmOscillators = [];
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    this.master.connect(compressor);
    compressor.connect(this.ctx.destination);
  }

  startBGM() {
    if (this.isPlaying || !this.ctx) return;
    this.isPlaying = true;

    const chords = [
      [523.25, 659.25, 783.99, 1046.50],
      [587.33, 739.99, 880.00, 1174.66],
      [659.25, 783.99, 987.77, 1318.51],
      [493.88, 622.25, 739.99, 987.77],
    ];

    let chordIndex = 0;
    const playChord = () => {
      if (!this.isPlaying || !this.ctx) return;

      this.bgmOscillators.forEach(osc => {
        osc.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        osc.osc.stop(this.ctx.currentTime + 0.5);
      });
      this.bgmOscillators = [];

      chords[chordIndex].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.02 * (i === 0 ? 1.5 : 0.5), this.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.master); osc.start();
        this.bgmOscillators.push({ osc, gain });
      });

      chordIndex = (chordIndex + 1) % chords.length;
      setTimeout(playChord, 2000);
    };
    playChord();
  }

  sfx(name) {
    if (!this.ctx) return;
    const createSound = () => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      gain.connect(this.master);

      switch(name) {
        case 'step':
          osc.type = 'triangle'; osc.frequency.setValueAtTime(150, this.ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.03, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
          osc.start(); osc.stop(this.ctx.currentTime + 0.1); break;
        case 'collect':
          osc.type = 'sine'; osc.frequency.setValueAtTime(880, this.ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.08, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
          osc.start(); osc.stop(this.ctx.currentTime + 0.3);
          const osc2 = this.ctx.createOscillator(); const gain2 = this.ctx.createGain();
          osc2.type = 'sine'; osc2.frequency.setValueAtTime(1109, this.ctx.currentTime); gain2.gain.setValueAtTime(0.05, this.ctx.currentTime); gain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
          osc2.connect(gain2); gain2.connect(this.master); osc2.start(); osc2.stop(this.ctx.currentTime + 0.3); break;
        case 'pop':
          osc.type = 'sine'; osc.frequency.setValueAtTime(400, this.ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.06, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
          osc.start(); osc.stop(this.ctx.currentTime + 0.15); break;
        case 'hover':
          filter.type = 'lowpass'; filter.frequency.value = 800; osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(80, this.ctx.currentTime); osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.04, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
          osc.connect(filter); filter.connect(gain); osc.start(); osc.stop(this.ctx.currentTime + 0.4); break;
        case 'talk':
          osc.type = 'square'; osc.frequency.setValueAtTime(600, this.ctx.currentTime); gain.gain.setValueAtTime(0.02, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
          osc.start(); osc.stop(this.ctx.currentTime + 0.05); break;
      }
    };
    createSound();
  }
}

const audio = new SpatialAudio(); 
const noise2D = createNoise2D();

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Terrain() { 
  const { geometry } = useMemo(() => { 
    const size = 120; const segments = 80; 
    const geo = new THREE.PlaneGeometry(size, size, segments, segments); 
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const cols = [];
    const colorGrass = new THREE.Color(0x90EE90);
    const colorSand = new THREE.Color(0xF5DEB3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      const islandMask = Math.max(0, 1 - Math.pow(dist / 50, 3));
      let height = noise2D(x * 0.02, z * 0.02) * 4 + noise2D(x * 0.05, z * 0.05) * 2 + noise2D(x * 0.1, z * 0.1) * 0.5;
      height *= islandMask;
      if (dist < 15) height *= 0.3;
      pos.setY(i, Math.max(-2, height));

      const c = new THREE.Color();
      if (height < 0.5) c.lerpColors(colorSand, colorGrass, height / 0.5);
      else { c.copy(colorGrass); c.multiplyScalar(1 - height * 0.02); }
      if (dist > 45) c.lerp(colorSand, (dist - 45) / 10);
      cols.push(c.r, c.g, c.b);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return { geometry: geo };
  }, []);

  return (
    <mesh receiveShadow name="ground">
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial vertexColors roughness={0.8} />
    </mesh>
  );
}

function Ocean() {
  const materialRef = useRef();
  useFrame(({ clock }) => { if (materialRef.current) materialRef.current.uniforms.time.value = clock.elapsedTime; });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
      <planeGeometry args={[300, 300, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{ time: { value: 0 }, color: { value: new THREE.Color(0x40E0D0) } }}
        vertexShader={`
          uniform float time; varying float vElevation; varying vec2 vUv;
          void main() {
            vUv = uv; vec3 pos = position;
            float elevation = sin(pos.x * 0.2 + time) * 0.5 * cos(pos.y * 0.2 + time) * 0.5;
            pos.z += elevation; vElevation = elevation;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 color; varying float vElevation; varying vec2 vUv;
          void main() {
            float mixStrength = (vElevation + 0.5) * 0.3; vec3 finalColor = mix(color, vec3(1.0), mixStrength);
            gl_FragColor = vec4(finalColor, 0.8 + vElevation * 0.1);
          }
        `}
        transparent side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Vegetation() {
  const treeData = useMemo(() => {
    const data = [];
    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * Math.PI * 2; const dist = 20 + Math.random() * 50;
      const x = Math.cos(angle) * dist; const z = Math.sin(angle) * dist;
      const height = noise2D(x * 0.02, z * 0.02) * 4 + noise2D(x * 0.05, z * 0.05) * 2;
      if (height > 1 && dist < 55) data.push({ position: [x, height, z], rotation: [0, Math.random() * Math.PI * 2, 0], scale: 0.7 + Math.random() * 0.6 });
    }
    return data;
  }, []);
  
  const flowerData = useMemo(() => {
    const data = []; const colors = [0xFF69B4, 0xFFD700, 0xFFF8DC, 0xFF1493];
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2; const dist = 5 + Math.random() * 45;
      const x = Math.cos(angle) * dist; const z = Math.sin(angle) * dist;
      const height = noise2D(x * 0.02, z * 0.02) * 4;
      if (height > 0.5 && height < 3) data.push({ position: [x, height, z], color: colors[Math.floor(Math.random() * colors.length)] });
    }
    return data;
  }, []);
  
  return (
    <group>
      <Instances limit={200}>
        <coneGeometry args={[1.2, 3, 6]} />
        <meshStandardMaterial color={0x228B22} roughness={0.8} />
        {treeData.map((tree, i) => <Instance key={i} position={tree.position} rotation={tree.rotation} scale={tree.scale} castShadow receiveShadow />)}
      </Instances>
      <Instances limit={200}>
        <cylinderGeometry args={[0.25, 0.35, 2, 6]} />
        <meshStandardMaterial color={0x8B4513} roughness={0.9} />
        {treeData.map((tree, i) => <Instance key={i} position={[tree.position[0], tree.position[1] - 0.5, tree.position[2]]} rotation={tree.rotation} scale={tree.scale} castShadow />)}
      </Instances>
      <Instances limit={100}>
        <sphereGeometry args={[0.15, 6, 6]} />
        <meshStandardMaterial roughness={0.5} />
        {flowerData.map((flower, i) => <Instance key={i} position={flower.position} color={flower.color} />)}
      </Instances>
    </group>
  );
}

function House({ position, roofColor }) { 
  return ( 
    <group position={position}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow> 
        <boxGeometry args={[4, 3, 4]} />
        <meshStandardMaterial color={0xFFFAFA} />
      </mesh>  
      <mesh position={[0, 4, 0]} rotation={[0, Math.PI/4, 0]} castShadow>
        <coneGeometry args={[3, 2.5, 4]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      <mesh position={[0, 0.9, 2.01]}>
        <planeGeometry args={[1, 1.8]} />
        <meshStandardMaterial color={0x8B4513} />
      </mesh>
      <mesh position={[-1, 1.5, 2.01]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial color={0x444444} emissive={0xFFDD88} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[1, 1.5, 2.01]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial color={0x444444} emissive={0xFFDD88} emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 2.5, 2.5]} intensity={0.5} distance={15} color={0xFFAA55} />
    </group>
  ); 
}

function DayNightCycle({ time }) { 
  const sunAngle = ((time - 6) / 12) * Math.PI - Math.PI; 
  const sunX = Math.cos(sunAngle) * 60; const sunY = Math.max(Math.sin(-sunAngle) * 60, -10); const sunZ = Math.cos(sunAngle) * 20;

  const getSkyColor = () => { 
    if (time >= 5 && time < 8) return new THREE.Color(0xFF7E5F); 
    if (time >= 8 && time < 17) return new THREE.Color(0x87CEEB); 
    if (time >= 17 && time < 20) return new THREE.Color(0xFD5E53); 
    return new THREE.Color(0x0A0A2A); 
  };

  const intensity = time > 6 && time < 18 ? 1.0 : 0.2;

  return ( 
    <> 
      <ambientLight intensity={0.4 + intensity * 0.3} color={getSkyColor()} /> 
      <directionalLight position={[sunX, sunY, sunZ]} intensity={intensity} color={0xFFF5E6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} /> 
      {(time < 6 || time > 19) && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />} 
    </> 
  ); 
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITIES
// ═══════════════════════════════════════════════════════════════════════════════

function Player({ state, actions }) { 
  const groupRef = useRef(); const boardRef = useRef();

  useFrame((frameState, delta) => { 
    if (!groupRef.current) return;
    const currentPos = groupRef.current.position;
    const target = state.targetPos;

    if (target && state.isMoving) {
      const distance = currentPos.distanceTo(target);
      if (distance > 0.3) {
        const speed = state.isRiding ? 35 : (state.isRunning ? 15 : 8);
        const direction = new THREE.Vector3().subVectors(target, currentPos).normalize();
        currentPos.add(direction.multiplyScalar(Math.min(speed * delta, distance)));

        const targetRotation = Math.atan2(direction.x, direction.z);
        let rotDiff = targetRotation - groupRef.current.rotation.y;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2; while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        groupRef.current.rotation.y += rotDiff * 10 * delta;

        if (boardRef.current && state.isRiding) {
          boardRef.current.rotation.x = -0.2;
          boardRef.current.position.y = 0.5 + Math.sin(frameState.clock.elapsedTime * 8) * 0.1;
        }

        if (!state.isRiding && Math.floor(frameState.clock.elapsedTime * 4) % 4 === 0) audio.sfx('step');
      } else {
        actions.stopMoving(); if (boardRef.current) boardRef.current.rotation.x = 0;
      }
    } else {
      if (boardRef.current && state.isRiding) boardRef.current.position.y = 0.5 + Math.sin(frameState.clock.elapsedTime * 2) * 0.05;
    }
    actions.setPlayerPos(currentPos.clone());
  });

  return ( 
    <group ref={groupRef} position={[0, 0, 0]} castShadow> 
      <mesh position={[0, 0.6, 0]} castShadow> 
        <sphereGeometry args={[0.5, 16, 16]} /> <meshStandardMaterial color={0xFFB6C1} />
      </mesh>  
      <mesh position={[-0.2, 1.1, 0]} rotation={[0, 0, 0.2]} castShadow>
        <capsuleGeometry args={[0.12, 0.5, 4, 8]} /> <meshStandardMaterial color={0xFFB6C1} />
      </mesh>
      <mesh position={[0.2, 1.1, 0]} rotation={[0, 0, -0.2]} castShadow>
        <capsuleGeometry args={[0.12, 0.5, 4, 8]} /> <meshStandardMaterial color={0xFFB6C1} />
      </mesh>
      <mesh position={[-0.15, 0.7, 0.4]}><sphereGeometry args={[0.06, 8, 8]} /><meshBasicMaterial color={0x000000} /></mesh>
      <mesh position={[0.15, 0.7, 0.4]}><sphereGeometry args={[0.06, 8, 8]} /><meshBasicMaterial color={0x000000} /></mesh>

      <group ref={boardRef} visible={state.isRiding}>
        <mesh position={[0, 0, 0]} castShadow><boxGeometry args={[1.4, 0.1, 0.5]} /><meshStandardMaterial color={0x222222} metalness={0.8} roughness={0.2} /></mesh>
        <mesh position={[-0.5, 0, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.6, 8]} /><meshStandardMaterial color={0xFF1493} emissive={0xFF1493} emissiveIntensity={0.5} /></mesh>
        <mesh position={[0.5, 0, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.15, 0.15, 0.6, 8]} /><meshStandardMaterial color={0xFF1493} emissive={0xFF1493} emissiveIntensity={0.5} /></mesh>
        {state.isRiding && state.isMoving && <Sparkles count={20} scale={2} size={0.4} speed={0.5} color={0xFF1493} position={[0, -0.2, -0.5]} />}
      </group>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={2} blur={1.5} far={2} />
    </group>
  ); 
}

function NPC({ data, onInteract }) { 
  const groupRef = useRef(); const homePos = data.home;

  useFrame((frameState) => { 
    if (!groupRef.current || data.isTalking) return;
    const tOff = frameState.clock.elapsedTime * 0.5 + data.timeOffset;
    const nextX = homePos.x + Math.cos(tOff) * 4; const nextZ = homePos.z + Math.sin(tOff) * 4;
    groupRef.current.position.set(nextX, 0.9, nextZ);
    groupRef.current.lookAt(nextX + Math.cos(tOff + 0.1), 0.9, nextZ + Math.sin(tOff + 0.1));
  });

  return ( 
    <group ref={groupRef} position={[homePos.x, 0.9, homePos.z]} onClick={(e) => { e.stopPropagation(); onInteract(data); }} > 
      <mesh position={[0, 0.5, 0]} castShadow><sphereGeometry args={[0.5, 16, 16]} /><meshStandardMaterial color={data.color} /></mesh>
      
      {data.earType === 'bear' && (
        <>
          <mesh position={[-0.35, 0.5, 0]} castShadow><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color={data.color} /></mesh>
          <mesh position={[0.35, 0.5, 0]} castShadow><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color={data.color} /></mesh>
        </>
      )}
      {data.earType === 'cat' && (
        <>
          <mesh position={[-0.3, 0.5, 0]} rotation={[0, 0, 0.3]} castShadow><coneGeometry args={[0.15, 0.4, 4]} /><meshStandardMaterial color={data.color} /></mesh>
          <mesh position={[0.3, 0.5, 0]} rotation={[0, 0, -0.3]} castShadow><coneGeometry args={[0.15, 0.4, 4]} /><meshStandardMaterial color={data.color} /></mesh>
        </>
      )}

      <mesh position={[-0.15, 0.1, 0.4]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color={0x000000} /></mesh>
      <mesh position={[0.15, 0.1, 0.4]}><sphereGeometry args={[0.05, 8, 8]} /><meshBasicMaterial color={0x000000} /></mesh>

      <mesh position={[0, -0.4, 0]}><boxGeometry args={[1.2, 0.08, 0.4]} /><meshStandardMaterial color={0x333333} /></mesh>
      <mesh position={[-0.4, -0.4, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.5, 8]} /><meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={0.3} /></mesh>
      <mesh position={[0.4, -0.4, 0]} rotation={[Math.PI/2, 0, 0]}><cylinderGeometry args={[0.12, 0.12, 0.5, 8]} /><meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={0.3} /></mesh>

      <Float speed={2} rotationIntensity={0} floatIntensity={0.5}>
        <mesh position={[0, 1.2, 0]}><sphereGeometry args={[0.1, 8, 8]} /><meshBasicMaterial color={0xFFD700} transparent opacity={0.8} /></mesh>
      </Float>
    </group>
  ); 
}

function Collectibles({ state, actions }) { 
  const items = useMemo(() => { 
    const data = [];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2; const dist = 10 + Math.random() * 35;
      const x = Math.cos(angle) * dist; const z = Math.sin(angle) * dist;
      const height = noise2D(x * 0.02, z * 0.02) * 4;
      if (height > 0.5) data.push({ id: `apple-${i}`, type: 'apple', position: [x, height + 0.3, z], collected: false });
    }
    return data;
  }, []);

  const [collected, setCollected] = useState(new Set());

  useFrame(() => { 
    items.forEach(item => {
      if (collected.has(item.id)) return;
      if (state.playerPos.distanceTo(new THREE.Vector3(...item.position)) < 1.5) {
        setCollected(prev => new Set([...prev, item.id]));
        actions.addBells(100);
        actions.addItem(item.type === 'apple' ? 'fruit' : 'flowers');
        audio.sfx('collect');
      }
    });
  });

  return (
    <group>
      {items.map(item => { 
        if (collected.has(item.id)) return null;
        return (
          <Float key={item.id} speed={3} rotationIntensity={0.2} floatIntensity={0.3}>
            <mesh position={item.position}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color={item.type === 'apple' ? 0xFF4500 : 0xFF69B4} emissive={item.type === 'apple' ? 0xFF2200 : 0xFF1493} emissiveIntensity={0.2} />
            </mesh>
            <Sparkles count={5} scale={0.5} size={0.2} color={item.type === 'apple' ? 0xFF4500 : 0xFF69B3} />
          </Float>
        );
      })}
    </group>
  ); 
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMERA & MAIN SCENE
// ═══════════════════════════════════════════════════════════════════════════════

function CameraController({ state }) { 
  const { camera } = useThree();
  useFrame((_, delta) => { 
    const offset = new THREE.Vector3(20, state.isRiding ? 25 : 18, 20);
    if (state.isRiding && state.isMoving) offset.multiplyScalar(1.3);
    camera.position.lerp(state.playerPos.clone().add(offset), delta * (state.isRiding ? 2 : 3));
    camera.lookAt(state.playerPos.x, 0.5, state.playerPos.z);
  });
  return null; 
}

function Scene({ state, actions }) { 
  const handleGroundClick = useCallback((e) => { 
    if (state.uiState !== 'play') return; 
    e.stopPropagation(); actions.setTarget(e.point); audio.sfx('pop'); 
    if (state.isRiding) audio.sfx('hover'); 
  }, [state.uiState, state.isRiding, actions]);

  const handleNPCInteract = useCallback((npcData) => { 
    actions.setDialogue({ name: npcData.name, texts: npcData.dialogues[0], color: npcData.color, current: 0 }); 
    audio.sfx('talk'); 
  }, [actions]);

  return ( 
    <> 
      <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={6} mieCoefficient={0.005} mieDirectionalG={0.8} /> 
      <DayNightCycle time={state.gameTime} />
      <SoftShadows size={25} samples={16} focus={0.5} /> 

      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={handleGroundClick} visible={false}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial />
      </mesh>

      <Terrain />
      <Ocean />
      <Vegetation />
      <Player state={state} actions={actions} />
      <Collectibles state={state} actions={actions} />

      <NPC data={{ name: "Barnaby", color: 0x87CEFA, earType: 'bear', home: new THREE.Vector3(-12, 0, -10), timeOffset: 0, dialogues: [["Nice day for a hoverboard ride!", "I love cruising around the island."]], isTalking: false }} onInteract={handleNPCInteract} />
      <NPC data={{ name: "Luna", color: 0xDDA0DD, earType: 'cat', home: new THREE.Vector3(15, 0, -5), timeOffset: 2, dialogues: [["Meow... the island air is lovely.", "Have you collected many things today?"]], isTalking: false }} onInteract={handleNPCInteract} />
      <NPC data={{ name: "Pip", color: 0xFFE4B5, earType: 'bunny', home: new THREE.Vector3(-5, 0, 15), timeOffset: 4, dialogues: [["Hop hop! Vroom vroom!", "Click the hoverboard icon to ride!"]], isTalking: false }} onInteract={handleNPCInteract} />

      <House position={[-12, 0, -13]} roofColor={0x87CEFA} />
      <House position={[15, 0, -8]} roofColor={0xDDA0DD} />
      <House position={[-5, 0, 12]} roofColor={0xFFE4B5} />

      <CameraController state={state} />

      {/* High-Resolution HD Post-Processing */}
      <EffectComposer multisampling={8}>
        <Bloom intensity={0.4} luminanceThreshold={0.8} luminanceSmoothing={0.9} />
        <DepthOfField focusDistance={0.025} focalLength={0.05} bokehScale={4} />
        <Vignette eskil={false} offset={0.1} darkness={0.4} />
      </EffectComposer>
    </>
  ); 
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI & WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

const UI = ({ state, actions }) => { 
  React.useEffect(() => { 
    const handleKeyDown = (e) => { 
      if (e.code === 'ShiftLeft') actions.setRunning(true); 
      if (e.code === 'Space') { e.preventDefault(); actions.setRiding(!state.isRiding); audio.sfx('hover'); } 
    }; 
    const handleKeyUp = (e) => { if (e.code === 'ShiftLeft') actions.setRunning(false); };
    document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', handleKeyUp);
    return () => { document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keyup', handleKeyUp); };
  }, [state.isRiding, actions]);

  const formatTime = (time) => { 
    let h = Math.floor(time); let m = Math.floor((time - h) * 60); let ampm = h >= 12 ? 'PM' : 'AM'; 
    h = h % 12; if (h === 0) h = 12; return `${h}:${m.toString().padStart(2, '0')} ${ampm}`; 
  };

  if (state.uiState === 'start') { 
    return (
      <div 
        onClick={() => { actions.setUIState('play'); audio.init(); audio.startBGM(); }} 
        style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(135, 206, 235, 0.98), rgba(144, 238, 144, 0.9))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 150, fontFamily: '"Comic Sans MS", "Nunito", cursive' }}
      > 
        <h1 style={{fontSize: '80px', margin: 0}}>🏝️ CANDY ISLAND</h1> 
        <h2>The HD Joyride 🛹✨</h2> 
        <p>🖱️ Click to Start Exploring</p> 
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {/* HUD Container */}
      <div style={{ pointerEvents: 'auto', display: 'flex', gap: '15px', position: 'absolute', top: 20, left: 20 }}>
        <div style={{ background: 'rgba(255, 223, 186, 0.95)', padding: '12px 24px', borderRadius: '25px', border: '4px solid #8B4513', boxShadow: '0 6px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: '"Comic Sans MS", cursive' }}>
          <span style={{ fontSize: '28px' }}>🔔</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B4513' }}>{state.bells.toLocaleString()}</span>
        </div>
        <button
          onClick={() => actions.setUIState(state.uiState === 'inventory' ? 'play' : 'inventory')}
          style={{ background: state.uiState === 'inventory' ? '#FFB6C1' : 'rgba(255, 255, 255, 0.95)', padding: '10px 20px', borderRadius: '25px', border: '4px solid #FF69B4', boxShadow: '0 6px 12px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: '32px' }}
        >🎒</button>
        <button
          onClick={() => { actions.setRiding(!state.isRiding); audio.sfx('hover'); }}
          style={{ background: state.isRiding ? '#00FA9A' : 'rgba(255, 255, 255, 0.95)', padding: '10px 20px', borderRadius: '25px', border: `4px solid ${state.isRiding ? '#2E8B57' : '#87CEEB'}`, boxShadow: '0 6px 12px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: '32px' }}
        >🛹</button>
      </div>

      <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255, 255, 255, 0.95)', padding: '12px 30px', borderRadius: '25px', border: '4px solid #87CEEB', boxShadow: '0 6px 12px rgba(0,0,0,0.2)', fontFamily: '"Comic Sans MS", sans-serif', pointerEvents: 'auto' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{formatTime(state.gameTime)}</div>
      </div>

      <div style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(0, 0, 0, 0.7)', color: 'white', padding: '15px 20px', borderRadius: '15px', fontFamily: '"Comic Sans MS", sans-serif', fontSize: '14px', pointerEvents: 'auto' }}>
        <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#FFD700' }}>Controls:</div>
        <div>🖱️ Click ground — Move</div>
        <div>🖱️ Click NPC — Talk</div>
        <div>🛹 Space — Toggle Hoverboard</div>
        <div>🏃 Shift — Run</div>
      </div>

      {state.uiState === 'inventory' && (
        <div onClick={() => actions.setUIState('play')} style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#FFF0F5', width: '80%', maxWidth: '800px', borderRadius: '40px', border: '8px solid #FFB6C1', padding: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px dashed #FFB6C1', paddingBottom: '20px', marginBottom: '30px' }}>
              <h2 style={{ fontFamily: '"Comic Sans MS", cursive', color: '#8B4513', fontSize: '40px', margin: 0 }}>My Pockets 🎒</h2>
              <button onClick={() => actions.setUIState('play')} style={{ background: '#FF69B4', color: 'white', border: 'none', borderRadius: '50%', width: '50px', height: '50px', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '20px' }}>
              {[
                { icon: '🍎', count: state.items.fruit, name: 'Apple', color: '#FF4500' },
                { icon: '🌸', count: state.items.flowers, name: 'Flower', color: '#FF69B4' },
                { icon: '🐛', count: state.items.bugs, name: 'Bug', color: '#8B4513' },
                { icon: '🐟', count: state.items.fish, name: 'Fish', color: '#40E0D0' },
                ...Array(8).fill(null)
              ].map((slot, i) => (
                <div key={i} style={{ background: slot?.count > 0 ? 'white' : 'rgba(255,255,255,0.4)', aspectRatio: '1', borderRadius: '20px', border: slot?.count > 0 ? `4px solid ${slot.color}` : '4px dashed #ccc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {slot?.count > 0 && (
                    <>
                      <span style={{ fontSize: '50px' }}>{slot.icon}</span>
                      <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', background: '#FFD700', color: '#8B4513', border: '3px solid white', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: '"Comic Sans MS", cursive', fontSize: '16px' }}>{slot.count}</div>
                      <div style={{ position: 'absolute', top: '10px', fontFamily: '"Comic Sans MS", cursive', fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>{slot.name}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.uiState === 'dialogue' && state.dialogue && (
        <div onClick={() => { if (state.dialogue.current < state.dialogue.texts.length - 1) { actions.setDialogue({ ...state.dialogue, current: state.dialogue.current + 1 }); audio.sfx('talk'); } else { actions.setDialogue(null); } }} style={{ position: 'absolute', inset: 0, zIndex: 100, cursor: 'pointer', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '40px', pointerEvents: 'auto' }}>
          <div style={{ width: '80%', maxWidth: '800px', pointerEvents: 'none' }}>
            <div style={{ background: `#${state.dialogue.color.toString(16).padStart(6, '0')}`, color: 'white', padding: '8px 24px', borderRadius: '20px 20px 0 0', fontFamily: '"Comic Sans MS", cursive', fontSize: '24px', fontWeight: 'bold', display: 'inline-block', border: '5px solid white', borderBottom: 'none', marginLeft: '40px' }}>{state.dialogue.name}</div>
            <div style={{ background: 'rgba(255, 255, 255, 0.98)', padding: '30px 40px', borderRadius: '30px', border: '6px solid white', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: '"Comic Sans MS", cursive', fontSize: '26px', color: '#333' }}>
              {state.dialogue.texts[state.dialogue.current]}
              <div style={{ textAlign: 'right', fontSize: '16px', color: '#888', marginTop: '20px' }}>▼ Click to continue ({state.dialogue.current + 1}/{state.dialogue.texts.length})</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function CandyIslandJoyride() {
  const [state, actions] = useGameStore();

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <GameContext.Provider value={{ state, actions }}>
        {/* The HD Resolution Fixes are applied to the Canvas here */}
        <Canvas 
            shadows 
            dpr={[1, 2]} 
            camera={{ position: [20, 18, 20], fov: 45 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <Scene state={state} actions={actions} />
        </Canvas>
        <UI state={state} actions={actions} />
      </GameContext.Provider>
    </div>
  );
}
