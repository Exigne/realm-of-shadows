/**
 * 🏝️ CANDY ISLAND — Animal Crossing Style
 * Third-person exploration with smooth camera follow
 * WASD to move, Mouse to rotate camera, Scroll to zoom
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  moveSpeed: 8,
  runSpeed: 14,
  rotateSpeed: 0.15,
  cameraDistance: 12,
  cameraHeight: 8,
  cameraMinDist: 5,
  cameraMaxDist: 20,
  worldSize: 100,
};

const COLORS = {
  grass: 0x7cfc00,
  grassDark: 0x32cd32,
  water: 0x40a4df,
  sand: 0xf4a460,
  dirt: 0x8b4513,
  wood: 0x8b5a2b,
  leaves: 0x228b22,
  flowerRed: 0xff6b6b,
  flowerYellow: 0xffd93d,
  flowerWhite: 0xffffff,
  player: 0xffb6c1,
  sky: 0x87ceeb,
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO ENGINE — Relaxing Island Sounds
// ═══════════════════════════════════════════════════════════════════════════════

class IslandAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmGain = null;
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.2;
    this.master.connect(this.ctx.destination);
  }

  startBGM() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.init();

    // Simple ambient chord progression
    const chords = [
      [523.25, 659.25, 783.99], // C major
      [587.33, 739.99, 880.00], // D major
      [659.25, 783.99, 987.77], // E minor
      [493.88, 622.25, 739.99], // G major
    ];
    
    let chordIndex = 0;
    
    const playChord = () => {
      if (!this.isPlaying) return;
      
      const chord = chords[chordIndex];
      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);
        
        osc.connect(gain);
        gain.connect(this.master);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 2);
      });
      
      chordIndex = (chordIndex + 1) % chords.length;
      setTimeout(playChord, 2000);
    };
    
    playChord();
  }

  sfx(name) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.connect(this.master);
    
    switch(name) {
      case 'step':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
        break;
        
      case 'collect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
        break;
        
      case 'pop':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
        break;
    }
  }

  stop() {
    this.isPlaying = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — Candy Island
// ═══════════════════════════════════════════════════════════════════════════════

export default function CandyIsland() {
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('start');
  const [bells, setBells] = useState(0);
  const [items, setItems] = useState({ flowers: 0, bugs: 0, fish: 0 });
  const [time, setTime] = useState(new Date());
  const [message, setMessage] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const gameRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    player: null,
    cameraPivot: null,
    cameraGoal: null,
    audio: new IslandAudio(),
    keys: {},
    isLocked: false,
    cameraAngle: Math.PI / 2,
    cameraPitch: 0.3,
    cameraDist: CONFIG.cameraDistance,
    velocity: new THREE.Vector3(),
    isMoving: false,
    stepTimer: 0,
    worldObjects: [],
    collectibles: [],
    particles: [],
    lastTime: 0,
  });

  const showMessage = useCallback((text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2000);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const g = gameRef.current;

    // ─── 1. Scene Setup ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 20, 80);
    g.scene = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
    g.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    g.renderer = renderer;

    // ─── 2. Lighting ──────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1);
    sunLight.position.set(50, 80, 30);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // ─── 3. Ground (Island) ───────────────────────────────────────────────────
    // Create a circular island
    const groundGeo = new THREE.CircleGeometry(CONFIG.worldSize, 64);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: COLORS.grass,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add some random elevation (hills)
    for (let i = 0; i < 8; i++) {
      const hillGeo = new THREE.SphereGeometry(3 + Math.random() * 4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const hillMat = new THREE.MeshStandardMaterial({ color: COLORS.grassDark });
      const hill = new THREE.Mesh(hillGeo, hillMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      hill.position.set(Math.cos(angle) * dist, -1, Math.sin(angle) * dist);
      hill.receiveShadow = true;
      scene.add(hill);
    }

    // Beach ring
    const beachGeo = new THREE.RingGeometry(CONFIG.worldSize, CONFIG.worldSize + 8, 64);
    const beachMat = new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 0.01;
    beach.receiveShadow = true;
    scene.add(beach);

    // Water
    const waterGeo = new THREE.PlaneGeometry(300, 300);
    const waterMat = new THREE.MeshStandardMaterial({ 
      color: COLORS.water, 
      transparent: true, 
      opacity: 0.8,
      roughness: 0.1,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.5;
    scene.add(water);

    // ─── 4. Trees ─────────────────────────────────────────────────────────────
    const createTree = (x, z, scale = 1) => {
      const group = new THREE.Group();
      
      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 2 * scale, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.wood });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1 * scale;
      trunk.castShadow = true;
      group.add(trunk);
      
      // Leaves (3 layers)
      const leavesMat = new THREE.MeshStandardMaterial({ color: COLORS.leaves });
      for (let i = 0; i < 3; i++) {
        const leavesGeo = new THREE.ConeGeometry((1.5 - i * 0.3) * scale, 2 * scale, 8);
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = (2.5 + i * 1.2) * scale;
        leaves.castShadow = true;
        group.add(leaves);
      }
      
      group.position.set(x, 0, z);
      // Random rotation for variety
      group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(group);
      g.worldObjects.push({ mesh: group, type: 'tree', position: new THREE.Vector3(x, 0, z) });
    };

    // Spawn trees
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 35;
      createTree(Math.cos(angle) * dist, Math.sin(angle) * dist, 0.8 + Math.random() * 0.4);
    }

    // ─── 5. Flowers (Collectibles) ──────────────────────────────────────────
    const createFlower = (x, z, color) => {
      const group = new THREE.Group();
      
      // Stem
      const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4);
      const stemMat = new THREE.MeshStandardMaterial({ color: COLORS.leaves });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.25;
      group.add(stem);
      
      // Petals
      const petalGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const petalMat = new THREE.MeshStandardMaterial({ color });
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        const angle = (i / 5) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.15, 0.5, Math.sin(angle) * 0.15);
        group.add(petal);
      }
      
      // Center
      const centerGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const centerMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
      const center = new THREE.Mesh(centerGeo, centerMat);
      center.position.y = 0.5;
      group.add(center);
      
      group.position.set(x, 0, z);
      scene.add(group);
      
      return { mesh: group, type: 'flower', color, position: new THREE.Vector3(x, 0, z), collected: false };
    };

    const flowerColors = [COLORS.flowerRed, COLORS.flowerYellow, COLORS.flowerWhite];
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 40;
      const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      g.collectibles.push(createFlower(Math.cos(angle) * dist, Math.sin(angle) * dist, color));
    }

    // ─── 6. Player Character ────────────────────────────────────────────────
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 0, 0);
    scene.add(playerGroup);
    g.player = playerGroup;

    // Body (cute round shape)
    const bodyGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.player });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    playerGroup.add(body);

    // Ears (bunny style)
    const earGeo = new THREE.CapsuleGeometry(0.12, 0.4, 4, 8);
    const earMat = new THREE.MeshStandardMaterial({ color: COLORS.player });
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-0.2, 0.9, 0);
    leftEar.rotation.z = 0.2;
    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(0.2, 0.9, 0);
    rightEar.rotation.z = -0.2;
    playerGroup.add(leftEar);
    playerGroup.add(rightEar);

    // Face
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.6, 0.4);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 0.6, 0.4);
    playerGroup.add(leftEye);
    playerGroup.add(rightEye);

    // Blush
    const blushGeo = new THREE.CircleGeometry(0.08, 8);
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xff69b4, transparent: true, opacity: 0.5 });
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-0.25, 0.5, 0.42);
    leftBlush.rotation.y = -0.3;
    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(0.25, 0.5, 0.42);
    rightBlush.rotation.y = 0.3;
    playerGroup.add(leftBlush);
    playerGroup.add(rightBlush);

    // ─── 7. Third-Person Camera System ───────────────────────────────────────
    // Camera pivot follows player but rotates independently
    const cameraPivot = new THREE.Object3D();
    cameraPivot.position.copy(playerGroup.position);
    scene.add(cameraPivot);
    g.cameraPivot = cameraPivot;

    // The actual camera is offset from the pivot
    camera.position.set(0, CONFIG.cameraHeight, CONFIG.cameraDistance);
    cameraPivot.add(camera);
    camera.lookAt(playerGroup.position);

    // ─── 8. Input Handling ────────────────────────────────────────────────────
    const keys = {};
    const handleKeyDown = (e) => {
      keys[e.code] = true;
      if (e.code === 'ShiftLeft') setIsRunning(true);
    };
    const handleKeyUp = (e) => {
      keys[e.code] = false;
      if (e.code === 'ShiftLeft') setIsRunning(false);
    };

    // Mouse controls for camera
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e) => {
      if (gameState === 'play' && e.button === 0) {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseMove = (e) => {
      if (!isDragging || gameState !== 'play') return;
      
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      // Rotate camera around player
      g.cameraAngle -= deltaMove.x * 0.005;
      g.cameraPitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, g.cameraPitch - deltaMove.y * 0.005));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e) => {
      if (gameState !== 'play') return;
      g.cameraDist = Math.max(CONFIG.cameraMinDist, Math.min(CONFIG.cameraMaxDist, g.cameraDist + e.deltaY * 0.01));
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel);

    // ─── 9. Resize Handler ────────────────────────────────────────────────────
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ─── 10. Game Loop ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    
    const animate = () => {
      requestAnimationFrame(animate);
      
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();
      
      if (gameState === 'play') {
        // Movement based on camera angle (Animal Crossing style)
        const moveSpeed = isRunning ? CONFIG.runSpeed : CONFIG.moveSpeed;
        const forward = new THREE.Vector3(Math.sin(g.cameraAngle), 0, Math.cos(g.cameraAngle));
        const right = new THREE.Vector3(Math.cos(g.cameraAngle), 0, -Math.sin(g.cameraAngle));
        
        let moveDir = new THREE.Vector3();
        
        if (keys['KeyW'] || keys['ArrowUp']) moveDir.add(forward);
        if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward);
        if (keys['KeyA'] || keys['ArrowLeft']) moveDir.sub(right);
        if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);
        
        // Normalize and apply movement
        if (moveDir.length() > 0) {
          moveDir.normalize();
          
          // Smooth rotation to face movement direction
          const targetRotation = Math.atan2(moveDir.x, moveDir.z);
          let rotDiff = targetRotation - playerGroup.rotation.y;
          while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
          while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
          playerGroup.rotation.y += rotDiff * CONFIG.rotateSpeed;
          
          // Move player
          const newPos = playerGroup.position.clone().add(moveDir.multiplyScalar(moveSpeed * delta));
          
          // Boundary check (keep on island)
          if (newPos.length() < CONFIG.worldSize - 2) {
            playerGroup.position.copy(newPos);
          }
          
          // Bobbing animation when walking
          g.isMoving = true;
          body.position.y = 0.5 + Math.abs(Math.sin(time * (isRunning ? 15 : 10))) * 0.1;
          
          // Step sounds
          g.stepTimer += delta;
          if (g.stepTimer > (isRunning ? 0.3 : 0.5)) {
            g.audio.sfx('step');
            g.stepTimer = 0;
          }
        } else {
          g.isMoving = false;
          body.position.y = THREE.MathUtils.lerp(body.position.y, 0.5, delta * 10);
        }
        
        // Camera follow with smooth interpolation
        // Update pivot position to follow player
        cameraPivot.position.lerp(playerGroup.position, delta * 5);
        
        // Calculate camera position based on angle, pitch, and distance
        const camX = Math.sin(g.cameraAngle) * Math.cos(g.cameraPitch) * g.cameraDist;
        const camY = Math.sin(g.cameraPitch) * g.cameraDist + 2; // +2 for head height
        const camZ = Math.cos(g.cameraAngle) * Math.cos(g.cameraPitch) * g.cameraDist;
        
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), delta * 3);
        camera.lookAt(cameraPivot.position.x, cameraPivot.position.y + 1, cameraPivot.position.z);
        
        // Animate collectibles
        g.collectibles.forEach(c => {
          if (c.collected) return;
          
          // Gentle bobbing
          c.mesh.rotation.y += delta;
          c.mesh.position.y = Math.sin(time * 2 + c.position.x) * 0.1;
          
          // Collection check
          const dist = playerGroup.position.distanceTo(c.position);
          if (dist < 1) {
            c.collected = true;
            c.mesh.visible = false;
            g.audio.sfx('collect');
            setItems(prev => ({ ...prev, flowers: prev.flowers + 1 }));
            setBells(prev => prev + 100);
            showMessage(`+100 Bells 🌸`);
          }
        });
        
        // Animate trees (gentle sway)
        g.worldObjects.forEach((obj, i) => {
          if (obj.type === 'tree') {
            const sway = Math.sin(time * 0.5 + i) * 0.02;
            obj.mesh.rotation.z = sway;
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Update time every minute
    const timeInterval = setInterval(() => setTime(new Date()), 60000);

    return () => {
      clearInterval(timeInterval);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      g.audio.stop();
    };
  }, [gameState, isRunning, showMessage]);

  // Start game
  const startGame = () => {
    setGameState('play');
    gameRef.current.audio.startBGM();
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', background: '#87ceeb' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.1) 100%)',
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* HUD */}
      {gameState === 'play' && (
        <>
          {/* Top Left — Bells */}
          <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            fontFamily: '"Comic Sans MS", "Verdana", sans-serif',
            zIndex: 20,
          }}>
            <div style={{
              background: 'rgba(255, 223, 186, 0.9)',
              padding: '10px 20px',
              borderRadius: '20px',
              border: '3px solid #8b4513',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '24px' }}>🔔</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b4513' }}>
                {bells.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Top Right — Time */}
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            fontFamily: '"Comic Sans MS", sans-serif',
            zIndex: 20,
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '10px 20px',
              borderRadius: '20px',
              border: '3px solid #87ceeb',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Bottom Left — Items */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            display: 'flex',
            gap: '10px',
            zIndex: 20,
          }}>
            {[
              { icon: '🌸', count: items.flowers, color: '#ffb6c1' },
              { icon: '🦋', count: items.bugs, color: '#98fb98' },
              { icon: '🐟', count: items.fish, color: '#87ceeb' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '8px 15px',
                borderRadius: '15px',
                border: `3px solid ${item.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontFamily: '"Comic Sans MS", sans-serif',
              }}>
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{item.count}</span>
              </div>
            ))}
          </div>

          {/* Bottom Right — Controls */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            background: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '10px',
            fontFamily: '"Comic Sans MS", sans-serif',
            fontSize: '12px',
            zIndex: 20,
          }}>
            <div>WASD / Arrows — Move</div>
            <div>Mouse Drag — Rotate Camera</div>
            <div>Scroll — Zoom</div>
            <div>Shift — Run</div>
          </div>

          {/* Message Popup */}
          {message && (
            <div style={{
              position: 'absolute',
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '15px 30px',
              borderRadius: '25px',
              border: '4px solid #ffd700',
              boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
              fontFamily: '"Comic Sans MS", cursive',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333',
              zIndex: 30,
              animation: 'pop 0.3s ease-out',
            }}>
              {message}
            </div>
          )}
        </>
      )}

      {/* Start Screen */}
      {gameState === 'start' && (
        <div 
          onClick={startGame}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(135, 206, 235, 0.95), rgba(124, 252, 0, 0.8))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 50,
          }}
        >
          <h1 style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '72px',
            color: 'white',
            textShadow: '4px 4px 0 #228b22, 8px 8px 0 rgba(0,0,0,0.2)',
            marginBottom: '20px',
            animation: 'bounce 2s infinite',
          }}>
            🏝️ CANDY ISLAND
          </h1>
          <p style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '28px',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
            marginBottom: '40px',
            textAlign: 'center',
          }}>
            Your relaxing island getaway awaits!<br/>
            Click to start exploring 🌸
          </p>
          <div style={{ fontSize: '48px', animation: 'float 3s ease-in-out infinite' }}>
            🐰 🌺 🦋 🍃 🌳
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }
        @keyframes pop {
          0% { transform: translate(-50%, -50%) scale(0); }
          80% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
