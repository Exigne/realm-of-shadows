/**
 * 🍭 CANDY WORLD — Fixed Movement Version
 * Properly handles game state and uses PointerLockControls for FPS-style movement
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  moveSpeed: 12,
  jumpForce: 8,
  gravity: 30,
  playerHeight: 2,
  playerRadius: 0.5,
};

const COLORS = {
  sugaryGrass: 0xffb3d9,
  skyDay: 0x87CEEB,
  skyNight: 0x1a1a2e,
  slime: 0xff1493,
  slimeElite: 0x9400d3,
  cupcakeBase: 0xff69b4,
  cherry: 0xdc143c,
  gold: 0xffd700,
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class CandyAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
  }

  sfx(name) {
    if (!this.ctx || this.isMuted) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.connect(this.master);
    
    switch(name) {
      case 'jump':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
        break;
        
      case 'collect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
        break;
        
      case 'land':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
        break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CandyWorld() {
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('start'); // 'start' | 'play' | 'gameover'
  const [score, setScore] = useState(0);
  const [cupcakes, setCupcakes] = useState(0);
  const [health, setHealth] = useState(5);
  const [message, setMessage] = useState(null);
  
  // Use refs for game loop to avoid closure issues
  const gameRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    player: null,
    audio: new CandyAudio(),
    keys: { w: false, a: false, s: false, d: false, space: false },
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    isGrounded: false,
    canJump: false,
    prevTime: 0,
    isPlaying: false,
    collectibles: [],
    enemies: [],
  });

  const showMessage = useCallback((text, duration = 2000) => {
    setMessage(text);
    setTimeout(() => setMessage(null), duration);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const g = gameRef.current;

    // ─── 1. Setup Scene ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.skyDay);
    scene.fog = new THREE.Fog(COLORS.skyDay, 10, 60);
    g.scene = scene;

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    g.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    g.renderer = renderer;

    // ─── 2. Lighting ────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // ─── 3. Ground ────────────────────────────────────────────────────────────
    // Infinite ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 200, 50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: COLORS.sugaryGrass,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper for visual reference
    const grid = new THREE.GridHelper(200, 40, 0xffffff, 0xffffff);
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    scene.add(grid);

    // ─── 4. Player Setup ──────────────────────────────────────────────────────
    // Player group - this will be controlled by PointerLockControls
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, CONFIG.playerHeight, 0);
    scene.add(playerGroup);
    g.player = playerGroup;

    // Visual player body (cute sphere character)
    const bodyGeo = new THREE.SphereGeometry(CONFIG.playerRadius, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    playerGroup.add(body);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.1, 0.4);
    rightEye.position.set(0.15, 0.1, 0.4);
    body.add(leftEye);
    body.add(rightEye);

    // ─── 5. PointerLockControls (FPS-style) ─────────────────────────────────
    const controls = new PointerLockControls(camera, document.body);
    g.controls = controls;
    
    // Add camera to player group so it moves with player
    playerGroup.add(camera);
    camera.position.set(0, 0.5, 0); // First person view from eyes
    
    // Lock/unlock events
    controls.addEventListener('lock', () => {
      g.isPlaying = true;
      setGameState('play');
      g.audio.init();
      showMessage('WASD to move, SPACE to jump, MOUSE to look!');
    });

    controls.addEventListener('unlock', () => {
      g.isPlaying = false;
      if (gameState !== 'gameover') {
        setGameState('start');
      }
    });

    // ─── 6. Collectibles ───────────────────────────────────────────────────────
    const createCupcake = (x, z) => {
      const group = new THREE.Group();
      
      const cake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.cupcakeBase })
      );
      const frosting = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      frosting.position.y = 0.2;
      const cherry = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.cherry })
      );
      cherry.position.y = 0.5;
      
      group.add(cake, frosting, cherry);
      group.position.set(x, 1, z);
      scene.add(group);
      
      return { mesh: group, position: new THREE.Vector3(x, 1, z), collected: false };
    };

    // Spawn cupcakes
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 30;
      g.collectibles.push(createCupcake(Math.cos(angle) * dist, Math.sin(angle) * dist));
    }

    // ─── 7. Enemies (Simple Slimes) ────────────────────────────────────────────
    const createSlime = (x, z, type = 'normal') => {
      const group = new THREE.Group();
      const color = type === 'elite' ? COLORS.slimeElite : COLORS.slime;
      
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(type === 'elite' ? 0.6 : 0.4, 16, 16),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
      );
      body.castShadow = true;
      group.add(body);
      
      // Eyes
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.12, 0.1, 0.3);
      rightEye.position.set(0.12, 0.1, 0.3);
      body.add(leftEye);
      body.add(rightEye);
      
      group.position.set(x, 0.5, z);
      scene.add(group);
      
      return { 
        mesh: group, 
        position: new THREE.Vector3(x, 0.5, z),
        type,
        velocity: new THREE.Vector3(),
        offset: Math.random() * 100
      };
    };

    // Spawn enemies
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 20;
      g.enemies.push(createSlime(Math.cos(angle) * dist, Math.sin(angle) * dist));
    }
    g.enemies.push(createSlime(20, 20, 'elite'));

    // ─── 8. Input Handling ────────────────────────────────────────────────────
    const onKeyDown = (e) => {
      switch(e.code) {
        case 'KeyW': case 'ArrowUp': g.keys.w = true; break;
        case 'KeyA': case 'ArrowLeft': g.keys.a = true; break;
        case 'KeyS': case 'ArrowDown': g.keys.s = true; break;
        case 'KeyD': case 'ArrowRight': g.keys.d = true; break;
        case 'Space': 
          g.keys.space = true;
          if (g.canJump && g.isPlaying) {
            g.velocity.y = CONFIG.jumpForce;
            g.canJump = false;
            g.audio.sfx('jump');
          }
          break;
        case 'Escape':
          controls.unlock();
          break;
      }
    };

    const onKeyUp = (e) => {
      switch(e.code) {
        case 'KeyW': case 'ArrowUp': g.keys.w = false; break;
        case 'KeyA': case 'ArrowLeft': g.keys.a = false; break;
        case 'KeyS': case 'ArrowDown': g.keys.s = false; break;
        case 'KeyD': case 'ArrowRight': g.keys.d = false; break;
        case 'Space': g.keys.space = false; break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // ─── 9. Resize Handler ────────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ─── 10. Game Loop ────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    
    const animate = () => {
      requestAnimationFrame(animate);
      
      const delta = Math.min(clock.getDelta(), 0.1); // Cap delta to prevent huge jumps
      const time = clock.getElapsedTime();
      
      if (g.isPlaying && controls.isLocked) {
        // Movement physics based on PointerLockControls example [^10^]
        g.velocity.x -= g.velocity.x * 10.0 * delta;
        g.velocity.z -= g.velocity.z * 10.0 * delta;
        g.velocity.y -= CONFIG.gravity * delta;

        // Calculate movement direction
        g.direction.z = Number(g.keys.w) - Number(g.keys.s);
        g.direction.x = Number(g.keys.d) - Number(g.keys.a);
        g.direction.normalize();

        // Apply movement
        if (g.keys.w || g.keys.s) g.velocity.z -= g.direction.z * CONFIG.moveSpeed * 10.0 * delta;
        if (g.keys.a || g.keys.d) g.velocity.x -= g.direction.x * CONFIG.moveSpeed * 10.0 * delta;

        // Move the camera (which is inside player group)
        controls.moveRight(-g.velocity.x * delta);
        controls.moveForward(-g.velocity.z * delta);

        // Apply gravity to player position
        playerGroup.position.y += g.velocity.y * delta;

        // Ground collision
        if (playerGroup.position.y < CONFIG.playerHeight) {
          if (!g.isGrounded && g.velocity.y < -2) {
            g.audio.sfx('land');
          }
          g.velocity.y = 0;
          playerGroup.position.y = CONFIG.playerHeight;
          g.canJump = true;
          g.isGrounded = true;
        } else {
          g.isGrounded = false;
        }

        // Update collectibles (bobbing animation + collision)
        g.collectibles.forEach(c => {
          if (c.collected) return;
          
          // Bobbing
          c.mesh.rotation.y += 0.03;
          c.mesh.position.y = 1 + Math.sin(time * 3 + c.position.x) * 0.2;
          
          // Collision
          const dist = playerGroup.position.distanceTo(c.mesh.position);
          if (dist < 1.5) {
            c.collected = true;
            c.mesh.visible = false;
            g.audio.sfx('collect');
            setCupcakes(prev => prev + 1);
            setScore(prev => prev + 100);
            showMessage('+100 🧁');
          }
        });

        // Update enemies (simple bounce animation)
        g.enemies.forEach(e => {
          const bounce = Math.abs(Math.sin(time * 2 + e.offset));
          e.mesh.position.y = 0.5 + bounce * 0.5;
          e.mesh.scale.set(
            1 + bounce * 0.2,
            1 - bounce * 0.2,
            1 + bounce * 0.2
          );
          
          // Simple chase behavior
          const dist = playerGroup.position.distanceTo(e.mesh.position);
          if (dist < 15 && dist > 1.5) {
            const dir = new THREE.Vector3().subVectors(playerGroup.position, e.mesh.position).normalize();
            e.mesh.position.add(dir.multiplyScalar((e.type === 'elite' ? 3 : 2) * delta));
          }
          
          // Damage player
          if (dist < 1.2) {
            setHealth(prev => {
              const newHealth = Math.max(0, prev - 1);
              if (newHealth === 0) {
                controls.unlock();
                setGameState('gameover');
              }
              return newHealth;
            });
          }
        });

        // Infinite ground follow
        ground.position.x = playerGroup.position.x;
        ground.position.z = playerGroup.position.z;
        grid.position.x = playerGroup.position.x;
        grid.position.z = playerGroup.position.z;
      }

      renderer.render(scene, camera);
    };

    animate();

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [showMessage]); // Only re-run if showMessage changes (it won't)

  // Start game handler
  const startGame = () => {
    gameRef.current.controls?.lock();
  };

  const resetGame = () => {
    setScore(0);
    setCupcakes(0);
    setHealth(5);
    setGameState('start');
    // Reset player position
    if (gameRef.current.player) {
      gameRef.current.player.position.set(0, CONFIG.playerHeight, 0);
    }
    gameRef.current.collectibles.forEach(c => {
      c.collected = false;
      c.mesh.visible = true;
    });
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Vignette Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at center, transparent 50%, rgba(255,100,200,0.1) 100%)',
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* HUD */}
      {gameState === 'play' && (
        <>
          <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            fontFamily: '"Comic Sans MS", cursive',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            zIndex: 20,
          }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>
              🧁 {cupcakes} | ⭐ {score}
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ 
                  fontSize: '32px',
                  filter: i < health ? 'none' : 'grayscale(100%)',
                  opacity: i < health ? 1 : 0.3,
                }}>
                  {i < health ? '💖' : '🤍'}
                </span>
              ))}
            </div>
          </div>

          {message && (
            <div style={{
              position: 'absolute',
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: '"Comic Sans MS", cursive',
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#ffd700',
              textShadow: '3px 3px 6px rgba(0,0,0,0.5)',
              zIndex: 30,
              pointerEvents: 'none',
              animation: 'bounce 0.5s',
            }}>
              {message}
            </div>
          )}

          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            fontFamily: '"Comic Sans MS", cursive',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            zIndex: 20,
          }}>
            WASD/Arrows — Move | SPACE — Jump | MOUSE — Look | ESC — Pause
          </div>
        </>
      )}

      {/* Start Screen */}
      {gameState === 'start' && (
        <div 
          onClick={startGame}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(255,182,193,0.95), rgba(255,105,180,0.95))',
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
            fontSize: '64px',
            color: 'white',
            textShadow: '4px 4px 8px rgba(0,0,0,0.2)',
            marginBottom: '20px',
          }}>
            🍭 CANDY WORLD 🍬
          </h1>
          <p style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '24px',
            color: 'white',
            marginBottom: '30px',
          }}>
            Click to start your adventure!
          </p>
          <div style={{ fontSize: '40px' }}>🧁 🍬 🍭 🍫 🍪</div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <h1 style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '56px',
            color: '#ff6b6b',
            marginBottom: '20px',
          }}>
            💔 Game Over
          </h1>
          <div style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '28px',
            color: 'white',
            marginBottom: '30px',
          }}>
            <div>Score: {score}</div>
            <div>Cupcakes: {cupcakes} 🧁</div>
          </div>
          <button
            onClick={resetGame}
            style={{
              padding: '15px 40px',
              fontSize: '24px',
              fontFamily: '"Comic Sans MS", cursive',
              background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
              border: 'none',
              borderRadius: '30px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Play Again 🔄
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  );
}
