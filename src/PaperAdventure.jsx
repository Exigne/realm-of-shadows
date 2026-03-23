/**
 * 🏝️ CANDY ISLAND — Point & Click Edition
 * Animal Crossing style: Click anywhere on the ground to walk there!
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  walkSpeed: 6,
  runSpeed: 12,
  cameraHeight: 15,
  cameraDistance: 20,
  worldSize: 80,
};

const COLORS = {
  grass: 0x90EE90,
  grassDark: 0x7CFC00,
  water: 0x40E0D0,
  sand: 0xF5DEB3,
  dirt: 0xD2691E,
  wood: 0x8B4513,
  leaves: 0x228B22,
  flowerRed: 0xFF69B4,
  flowerYellow: 0xFFD700,
  flowerWhite: 0xFFF8DC,
  player: 0xFFB6C1,
  sky: 0x87CEEB,
  targetMarker: 0xFFD700,
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO ENGINE
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
    this.master.gain.value = 0.2;
    this.master.connect(this.ctx.destination);
  }

  startBGM() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.init();

    // Relaxing island chords
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
      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
        
        osc.connect(gain);
        gain.connect(this.master);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 1.5);
      });
      
      chordIndex = (chordIndex + 1) % chords.length;
      setTimeout(playChord, 1800);
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
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
        break;
        
      case 'collect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
        break;
        
      case 'pop':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
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
// MAIN COMPONENT — Point & Click Candy Island
// ═══════════════════════════════════════════════════════════════════════════════

export default function CandyIslandPointClick() {
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('start');
  const [bells, setBells] = useState(0);
  const [items, setItems] = useState({ flowers: 0, bugs: 0, fish: 0, fruit: 0 });
  const [time, setTime] = useState(new Date());
  const [message, setMessage] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const gameRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    player: null,
    targetMarker: null,
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    audio: new IslandAudio(),
    targetPosition: null,
    isMoving: false,
    velocity: new THREE.Vector3(),
    worldObjects: [],
    collectibles: [],
    lastTime: 0,
    stepTimer: 0,
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
    scene.fog = new THREE.Fog(COLORS.sky, 30, 90);
    g.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
    // Isometric-style camera position
    camera.position.set(20, CONFIG.cameraHeight, 20);
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

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
    sunLight.position.set(50, 80, 30);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // ─── 3. Ground (Clickable Island) ────────────────────────────────────
    const groundGeo = new THREE.CircleGeometry(CONFIG.worldSize, 64);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: COLORS.grass,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground'; // For raycasting identification
    scene.add(ground);

    // Hills
    for (let i = 0; i < 6; i++) {
      const hillGeo = new THREE.SphereGeometry(4 + Math.random() * 5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const hillMat = new THREE.MeshStandardMaterial({ color: COLORS.grassDark });
      const hill = new THREE.Mesh(hillGeo, hillMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      hill.position.set(Math.cos(angle) * dist, -1.5, Math.sin(angle) * dist);
      hill.receiveShadow = true;
      scene.add(hill);
    }

    // Beach
    const beachGeo = new THREE.RingGeometry(CONFIG.worldSize - 5, CONFIG.worldSize + 10, 64);
    const beachMat = new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.y = 0.02;
    beach.receiveShadow = true;
    beach.name = 'ground';
    scene.add(beach);

    // Water
    const waterGeo = new THREE.PlaneGeometry(300, 300);
    const waterMat = new THREE.MeshStandardMaterial({ 
      color: COLORS.water, 
      transparent: true, 
      opacity: 0.7,
      roughness: 0.1,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.8;
    scene.add(water);

    // ─── 4. Trees ─────────────────────────────────────────────────────────────
    const createTree = (x, z, scale = 1) => {
      const group = new THREE.Group();
      
      const trunkGeo = new THREE.CylinderGeometry(0.4 * scale, 0.5 * scale, 2.5 * scale, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.wood });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.25 * scale;
      trunk.castShadow = true;
      group.add(trunk);
      
      const leavesMat = new THREE.MeshStandardMaterial({ color: COLORS.leaves });
      for (let i = 0; i < 3; i++) {
        const leavesGeo = new THREE.ConeGeometry((2 - i * 0.4) * scale, 2.5 * scale, 8);
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = (3 + i * 1.5) * scale;
        leaves.castShadow = true;
        group.add(leaves);
      }
      
      group.position.set(x, 0, z);
      group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(group);
      g.worldObjects.push({ mesh: group, type: 'tree', position: new THREE.Vector3(x, 0, z) });
    };

    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 35;
      createTree(Math.cos(angle) * dist, Math.sin(angle) * dist, 0.9 + Math.random() * 0.3);
    }

    // ─── 5. Flowers (Collectibles) ──────────────────────────────────────────
    const createFlower = (x, z, color) => {
      const group = new THREE.Group();
      
      const stemGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 4);
      const stemMat = new THREE.MeshStandardMaterial({ color: COLORS.leaves });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.3;
      group.add(stem);
      
      const petalGeo = new THREE.SphereGeometry(0.18, 8, 8);
      const petalMat = new THREE.MeshStandardMaterial({ color });
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(petalGeo, petalMat);
        const angle = (i / 5) * Math.PI * 2;
        petal.position.set(Math.cos(angle) * 0.18, 0.6, Math.sin(angle) * 0.18);
        group.add(petal);
      }
      
      const centerGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const centerMat = new THREE.MeshStandardMaterial({ color: 0xFFD700 });
      const center = new THREE.Mesh(centerGeo, centerMat);
      center.position.y = 0.6;
      group.add(center);
      
      group.position.set(x, 0, z);
      scene.add(group);
      
      return { mesh: group, type: 'flower', color, position: new THREE.Vector3(x, 0, z), collected: false };
    };

    const flowerColors = [COLORS.flowerRed, COLORS.flowerYellow, COLORS.flowerWhite];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 35;
      const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      g.collectibles.push(createFlower(Math.cos(angle) * dist, Math.sin(angle) * dist, color));
    }

    // ─── 6. Player Character (Cute Bunny) ───────────────────────────────────
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 0, 0);
    scene.add(playerGroup);
    g.player = playerGroup;

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.player });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    playerGroup.add(body);

    // Ears
    const earGeo = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8);
    const earMat = new THREE.MeshStandardMaterial({ color: COLORS.player });
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-0.25, 1.1, 0);
    leftEar.rotation.z = 0.15;
    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(0.25, 1.1, 0);
    rightEar.rotation.z = -0.15;
    playerGroup.add(leftEar);
    playerGroup.add(rightEar);

    // Face
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.2, 0.7, 0.5);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.2, 0.7, 0.5);
    playerGroup.add(leftEye);
    playerGroup.add(rightEye);

    // Blush
    const blushGeo = new THREE.CircleGeometry(0.1, 8);
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xFF69B4, transparent: true, opacity: 0.4 });
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-0.3, 0.6, 0.52);
    leftBlush.rotation.y = -0.3;
    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(0.3, 0.6, 0.52);
    rightBlush.rotation.y = 0.3;
    playerGroup.add(leftBlush);
    playerGroup.add(rightBlush);

    // ─── 7. Target Marker (Shows where you clicked) ─────────────────────────
    const markerGeo = new THREE.RingGeometry(0.3, 0.5, 16);
    const markerMat = new THREE.MeshBasicMaterial({ 
      color: COLORS.targetMarker, 
      transparent: true, 
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const targetMarker = new THREE.Mesh(markerGeo, markerMat);
    targetMarker.rotation.x = -Math.PI / 2;
    targetMarker.position.y = 0.1;
    targetMarker.visible = false;
    scene.add(targetMarker);
    g.targetMarker = targetMarker;

    // ─── 8. Camera Setup ──────────────────────────────────────────────────────
    camera.lookAt(playerGroup.position);

    // ─── 9. Click Handler (Point & Click Movement!) ────────────────────────
    const handleClick = (e) => {
      if (gameState !== 'play') return;

      // Calculate mouse position in normalized device coordinates
      const rect = renderer.domElement.getBoundingClientRect();
      g.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      g.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast from camera through mouse position
      g.raycaster.setFromCamera(g.mouse, camera);

      // Intersect with ground
      const intersects = g.raycaster.intersectObjects(scene.children);
      const groundHit = intersects.find(hit => hit.object.name === 'ground');

      if (groundHit) {
        // Set target position
        g.targetPosition = groundHit.point;
        g.targetPosition.y = 0; // Keep on ground
        g.isMoving = true;
        
        // Show target marker
        targetMarker.position.copy(g.targetPosition);
        targetMarker.position.y = 0.1;
        targetMarker.visible = true;
        
        // Calculate direction to face
        const direction = new THREE.Vector3().subVectors(g.targetPosition, playerGroup.position);
        direction.y = 0;
        if (direction.length() > 0) {
          const targetRotation = Math.atan2(direction.x, direction.z);
          // Smooth rotation will happen in animate loop
          playerGroup.userData.targetRotation = targetRotation;
        }
        
        // Pop sound effect
        g.audio.sfx('pop');
        
        // Hide marker after delay
        setTimeout(() => {
          targetMarker.visible = false;
        }, 1000);
      }
    };

    container.addEventListener('click', handleClick);

    // Shift to run
    const handleKeyDown = (e) => {
      if (e.code === 'ShiftLeft') setIsRunning(true);
    };
    const handleKeyUp = (e) => {
      if (e.code === 'ShiftLeft') setIsRunning(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // ─── 10. Resize Handler ─────────────────────────────────────────────────
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ─── 11. Game Loop ──────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    
    const animate = () => {
      requestAnimationFrame(animate);
      
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();
      
      if (gameState === 'play') {
        // Point & Click Movement
        if (g.isMoving && g.targetPosition) {
          const direction = new THREE.Vector3().subVectors(g.targetPosition, playerGroup.position);
          direction.y = 0;
          const distance = direction.length();
          
          if (distance > 0.1) {
            direction.normalize();
            
            // Smooth rotation to face target
            if (playerGroup.userData.targetRotation !== undefined) {
              let currentRot = playerGroup.rotation.y;
              let targetRot = playerGroup.userData.targetRotation;
              
              // Shortest path rotation
              let diff = targetRot - currentRot;
              while (diff > Math.PI) diff -= Math.PI * 2;
              while (diff < -Math.PI) diff += Math.PI * 2;
              
              playerGroup.rotation.y += diff * 10 * delta;
            }
            
            // Move towards target
            const speed = isRunning ? CONFIG.runSpeed : CONFIG.walkSpeed;
            const moveStep = speed * delta;
            const actualMove = Math.min(moveStep, distance);
            
            playerGroup.position.x += direction.x * actualMove;
            playerGroup.position.z += direction.z * actualMove;
            
            // Walking animation (bobbing)
            const bobSpeed = isRunning ? 15 : 10;
            body.position.y = 0.6 + Math.abs(Math.sin(time * bobSpeed)) * 0.15;
            
            // Step sounds
            g.stepTimer += delta;
            const stepInterval = isRunning ? 0.25 : 0.4;
            if (g.stepTimer > stepInterval) {
              g.audio.sfx('step');
              g.stepTimer = 0;
            }
          } else {
            // Arrived at destination
            g.isMoving = false;
            g.targetPosition = null;
            body.position.y = 0.6;
            targetMarker.visible = false;
          }
        } else {
          // Idle breathing animation
          body.position.y = 0.6 + Math.sin(time * 2) * 0.02;
          body.scale.set(
            1 + Math.sin(time * 2) * 0.01,
            1 - Math.sin(time * 2) * 0.01,
            1 + Math.sin(time * 2) * 0.01
          );
        }
        
        // Camera follow player (smooth)
        const targetCamPos = new THREE.Vector3(
          playerGroup.position.x + 20,
          CONFIG.cameraHeight,
          playerGroup.position.z + 20
        );
        camera.position.lerp(targetCamPos, delta * 2);
        camera.lookAt(playerGroup.position);
        
        // Animate collectibles
        g.collectibles.forEach(c => {
          if (c.collected) return;
          
          c.mesh.rotation.y += delta;
          c.mesh.position.y = Math.sin(time * 3 + c.position.x) * 0.1;
          
          // Collection check
          const dist = playerGroup.position.distanceTo(c.position);
          if (dist < 1.2) {
            c.collected = true;
            c.mesh.visible = false;
            g.audio.sfx('collect');
            setItems(prev => ({ ...prev, flowers: prev.flowers + 1 }));
            setBells(prev => prev + 100);
            showMessage(`+100 Bells 🌸`);
          }
        });
        
        // Animate trees
        g.worldObjects.forEach((obj, i) => {
          if (obj.type === 'tree') {
            obj.mesh.rotation.z = Math.sin(time * 0.5 + i) * 0.02;
          }
        });
        
        // Animate target marker
        if (targetMarker.visible) {
          targetMarker.rotation.z += delta * 2;
          const scale = 1 + Math.sin(time * 10) * 0.2;
          targetMarker.scale.set(scale, scale, scale);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Update time
    const timeInterval = setInterval(() => setTime(new Date()), 60000);

    return () => {
      clearInterval(timeInterval);
      container.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
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
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      position: 'relative', 
      overflow: 'hidden', 
      background: '#87ceeb',
      cursor: gameState === 'play' ? 'crosshair' : 'default'
    }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 50%, rgba(0,0,0,0.1) 100%)',
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
              background: 'rgba(255, 223, 186, 0.95)',
              padding: '12px 24px',
              borderRadius: '25px',
              border: '4px solid #8B4513',
              boxShadow: '0 6px 12px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <span style={{ fontSize: '28px' }}>🔔</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B4513' }}>
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
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '12px 24px',
              borderRadius: '25px',
              border: '4px solid #87CEEB',
              boxShadow: '0 6px 12px rgba(0,0,0,0.2)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
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
            gap: '12px',
            zIndex: 20,
          }}>
            {[
              { icon: '🌸', count: items.flowers, color: '#FFB6C1', label: 'Flowers' },
              { icon: '🦋', count: items.bugs, color: '#98FB98', label: 'Bugs' },
              { icon: '🐟', count: items.fish, color: '#87CEEB', label: 'Fish' },
              { icon: '🍎', count: items.fruit, color: '#FFA07A', label: 'Fruit' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255, 255, 255, 0.95)',
                padding: '10px 18px',
                borderRadius: '20px',
                border: `4px solid ${item.color}`,
                boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: '"Comic Sans MS", sans-serif',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ fontSize: '24px' }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{item.count}</div>
                  <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Right — Controls */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '15px',
            fontFamily: '"Comic Sans MS", sans-serif',
            fontSize: '14px',
            zIndex: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#FFD700' }}>Controls:</div>
            <div>🖱️ Click ground — Walk there</div>
            <div>🏃 Shift — Run faster</div>
          </div>

          {/* Center Message */}
          {message && (
            <div style={{
              position: 'absolute',
              top: '25%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255, 255, 255, 0.98)',
              padding: '20px 40px',
              borderRadius: '30px',
              border: '5px solid #FFD700',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              fontFamily: '"Comic Sans MS", cursive',
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#333',
              zIndex: 30,
              animation: 'bounceIn 0.4s ease-out',
              pointerEvents: 'none',
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
            background: 'linear-gradient(135deg, rgba(135, 206, 235, 0.98), rgba(144, 238, 144, 0.9))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 50,
          }}
        >
          <h1 style={{
            fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
            fontSize: '80px',
            color: 'white',
            textShadow: '5px 5px 0 #228B22, 10px 10px 0 rgba(0,0,0,0.2)',
            marginBottom: '30px',
            animation: 'float 3s ease-in-out infinite',
            textAlign: 'center',
          }}>
            🏝️ CANDY<br/>ISLAND
          </h1>
          <p style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '32px',
            color: 'white',
            textShadow: '3px 3px 6px rgba(0,0,0,0.3)',
            marginBottom: '50px',
            textAlign: 'center',
            maxWidth: '600px',
          }}>
            Click anywhere to walk there!<br/>
            Collect flowers and explore 🌸
          </p>
          <div style={{ 
            fontSize: '56px', 
            animation: 'wiggle 2s ease-in-out infinite',
            display: 'flex',
            gap: '20px'
          }}>
            🐰 🌺 🦋 🍃 🌳
          </div>
          
          <div style={{
            marginTop: '40px',
            padding: '20px 40px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            border: '3px solid white',
            fontFamily: '"Comic Sans MS", cursive',
            color: 'white',
            fontSize: '18px',
          }}>
            🖱️ Point & Click Adventure
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(3deg); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes bounceIn {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
