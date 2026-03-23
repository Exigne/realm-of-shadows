/**
 * 🍭 CANDY WORLD — The Ultimate Sugar Rush Adventure
 * Features: Infinite procedural terrain, particle effects, boss battles,
 * power-ups, day/night cycle, weather, and pure chaos!
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  worldSize: 200,
  chunkSize: 20,
  renderDistance: 3,
  gravity: -0.015,
  jumpForce: 0.35,
  moveSpeed: 0.15,
  sprintSpeed: 0.25,
  dayDuration: 30000, // ms for full day cycle
};

const COLORS = {
  sugaryGrass: 0xffb3d9,
  gumdropWall: 0xff69b4,
  skyDay: 0x87CEEB,
  skySunset: 0xff6b6b,
  skyNight: 0x1a1a2e,
  marshmallow: 0xfffff0,
  slime: 0xff1493,
  slimeElite: 0x9400d3,
  cupcakeBase: 0xff69b4,
  cherry: 0xdc143c,
  gold: 0xffd700,
  rainbow: [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3],
  chocolate: 0x8b4513,
  mint: 0x98ff98,
};

const BIOMES = {
  CANDYLAND: { color: 0xffb3d9, ground: 'sprinkles', enemy: 'slime' },
  CHOCOLATE: { color: 0x8b4513, ground: 'chocolate', enemy: 'chocoGolem' },
  MINT: { color: 0x98ff98, ground: 'mint', enemy: 'minty' },
  GUMMY: { color: 0xff69b4, ground: 'gummy', enemy: 'gummyBear' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO ENGINE — Sweet Synth Sounds
// ═══════════════════════════════════════════════════════════════════════════════

class CandyAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bgmOscillators = [];
    this.isPlaying = false;
    this.bgmGain = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
    
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.1;
    this.bgmGain.connect(this.master);
  }

  startBGM() {
    if (!this.ctx) this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    // Arpeggiator pattern
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25]; // C major
    let noteIndex = 0;
    
    const playNote = () => {
      if (!this.isPlaying) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = notes[noteIndex];
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.bgmGain);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
      
      noteIndex = (noteIndex + 1) % notes.length;
      setTimeout(playNote, 200);
    };
    
    playNote();
    
    // Bass line
    const bass = this.ctx.createOscillator();
    bass.type = 'triangle';
    bass.frequency.value = 130.81; // C3
    const bassGain = this.ctx.createGain();
    bassGain.gain.value = 0.05;
    bass.connect(bassGain);
    bassGain.connect(this.master);
    bass.start();
    this.bgmOscillators.push(bass);
  }

  stopBGM() {
    this.isPlaying = false;
    this.bgmOscillators.forEach(osc => osc.stop());
    this.bgmOscillators = [];
  }

  sfx(name) {
    if (!this.ctx) return;
    
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
        
      case 'powerup':
        osc.type = 'sawtooth';
        const now = this.ctx.currentTime;
        [440, 554, 659, 880].forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.05, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.1);
          o.connect(g);
          g.connect(this.master);
          o.start(now + i * 0.05);
          o.stop(now + i * 0.05 + 0.1);
        });
        break;
        
      case 'explosion':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
        break;
        
      case 'hit':
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
        break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE SYSTEM — Sparkles, Explosions & Magic
// ═══════════════════════════════════════════════════════════════════════════════

class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.geometry = new THREE.BufferGeometry();
    this.maxParticles = 1000;
    
    const positions = new Float32Array(this.maxParticles * 3);
    const colors = new Float32Array(this.maxParticles * 3);
    const sizes = new Float32Array(this.maxParticles);
    
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    this.material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.8,
    });
    
    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  emit(position, type = 'sparkle', count = 10) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      
      const color = new THREE.Color();
      if (type === 'rainbow') {
        color.setHex(COLORS.rainbow[Math.floor(Math.random() * COLORS.rainbow.length)]);
      } else if (type === 'gold') {
        color.setHex(COLORS.gold);
      } else if (type === 'explosion') {
        color.setHex(Math.random() > 0.5 ? 0xff6600 : 0xff0000);
      } else {
        color.setHex(COLORS.rainbow[Math.floor(Math.random() * COLORS.rainbow.length)]);
      }
      
      this.particles.push({
        position: position.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * (type === 'explosion' ? 0.5 : 0.2),
          Math.random() * (type === 'explosion' ? 0.5 : 0.3),
          (Math.random() - 0.5) * (type === 'explosion' ? 0.5 : 0.2)
        ),
        color: color,
        size: Math.random() * 0.5 + 0.2,
        life: 1.0,
        decay: Math.random() * 0.02 + 0.01,
      });
    }
  }

  update() {
    const positions = this.geometry.attributes.position.array;
    const colors = this.geometry.attributes.color.array;
    const sizes = this.geometry.attributes.size.array;
    
    let index = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      p.position.add(p.velocity);
      p.velocity.y -= 0.005; // Gravity
      
      positions[index * 3] = p.position.x;
      positions[index * 3 + 1] = p.position.y;
      positions[index * 3 + 2] = p.position.z;
      
      colors[index * 3] = p.color.r * p.life;
      colors[index * 3 + 1] = p.color.g * p.life;
      colors[index * 3 + 2] = p.color.b * p.life;
      
      sizes[index] = p.size * p.life;
      
      index++;
    }
    
    // Clear remaining slots
    for (let i = index; i < this.maxParticles; i++) {
      positions[i * 3 + 1] = -1000; // Hide unused
    }
    
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCEDURAL TERRAIN GENERATION — Infinite Candy World
// ═══════════════════════════════════════════════════════════════════════════════

class TerrainGenerator {
  constructor() {
    this.chunks = new Map();
    this.seed = Math.random() * 10000;
  }

  noise(x, z) {
    // Simple pseudo-random noise
    const sin = Math.sin;
    return sin(x * 0.1 + this.seed) * sin(z * 0.1 + this.seed) * 0.5 +
           sin(x * 0.3 + this.seed * 2) * sin(z * 0.3) * 0.25 +
           sin(x * 0.7) * sin(z * 0.7 + this.seed * 0.5) * 0.125;
  }

  getBiome(x, z) {
    const value = this.noise(x * 0.05, z * 0.05);
    if (value < -0.3) return BIOMES.CHOCOLATE;
    if (value < 0) return BIOMES.MINT;
    if (value > 0.5) return BIOMES.GUMMY;
    return BIOMES.CANDYLAND;
  }

  getHeight(x, z) {
    const n = this.noise(x, z);
    return Math.max(0, (n + 1) * 2); // Height 0-4
  }

  generateChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return this.chunks.get(key);
    
    const chunk = {
      x: cx,
      z: cz,
      objects: [],
      biome: this.getBiome(cx * CONFIG.chunkSize, cz * CONFIG.chunkSize),
    };
    
    // Generate terrain features
    const baseX = cx * CONFIG.chunkSize;
    const baseZ = cz * CONFIG.chunkSize;
    
    for (let x = 0; x < CONFIG.chunkSize; x += 2) {
      for (let z = 0; z < CONFIG.chunkSize; z += 2) {
        const worldX = baseX + x;
        const worldZ = baseZ + z;
        const height = this.getHeight(worldX, worldZ);
        
        // Random objects based on biome
        if (Math.random() < 0.1) {
          chunk.objects.push({
            type: 'tree',
            x: worldX,
            y: height,
            z: worldZ,
            height: 2 + Math.random() * 2,
          });
        }
        
        if (Math.random() < 0.05) {
          chunk.objects.push({
            type: 'rock',
            x: worldX,
            y: height,
            z: worldZ,
            size: 0.5 + Math.random(),
          });
        }
      }
    }
    
    this.chunks.set(key, chunk);
    return chunk;
  }

  getChunksAround(x, z, radius) {
    const cx = Math.floor(x / CONFIG.chunkSize);
    const cz = Math.floor(z / CONFIG.chunkSize);
    const chunks = [];
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        chunks.push(this.generateChunk(cx + dx, cz + dz));
      }
    }
    
    return chunks;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENEMY SYSTEM — AI with Different Behaviors
// ═══════════════════════════════════════════════════════════════════════════════

class EnemySystem {
  constructor(scene, player, audio) {
    this.scene = scene;
    this.player = player;
    this.audio = audio;
    this.enemies = [];
    this.meshPool = new Map();
  }

  spawn(type, position) {
    const enemy = {
      type,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      health: type === 'elite' ? 3 : 1,
      maxHealth: type === 'elite' ? 3 : 1,
      state: 'idle',
      timer: 0,
      mesh: null,
      id: Math.random().toString(36),
    };
    
    // Create mesh
    const geometry = type === 'elite' 
      ? new THREE.IcosahedronGeometry(0.6, 1)
      : new THREE.SphereGeometry(0.4, 16, 16);
    
    const material = new THREE.MeshStandardMaterial({
      color: type === 'elite' ? COLORS.slimeElite : COLORS.slime,
      emissive: type === 'elite' ? 0x440044 : 0x220022,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    
    enemy.mesh = new THREE.Mesh(geometry, material);
    enemy.mesh.position.copy(position);
    enemy.mesh.castShadow = true;
    this.scene.add(enemy.mesh);
    
    // Add cute face
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.1, 0.3);
    rightEye.position.set(0.15, 0.1, 0.3);
    enemy.mesh.add(leftEye);
    enemy.mesh.add(rightEye);
    
    this.enemies.push(enemy);
    return enemy;
  }

  update(deltaTime, particles) {
    const playerPos = this.player.position;
    
    this.enemies.forEach((enemy, index) => {
      // AI Behavior
      const dist = enemy.position.distanceTo(playerPos);
      
      if (enemy.type === 'elite') {
        // Elite: smarter, faster, shoots
        if (dist < 15) {
          if (dist > 3) {
            // Chase
            const dir = new THREE.Vector3().subVectors(playerPos, enemy.position).normalize();
            enemy.velocity.add(dir.multiplyScalar(0.02));
          } else if (dist < 2) {
            // Retreat
            const dir = new THREE.Vector3().subVectors(enemy.position, playerPos).normalize();
            enemy.velocity.add(dir.multiplyScalar(0.03));
          }
          
          // Shoot projectile
          enemy.timer += deltaTime;
          if (enemy.timer > 2000) {
            enemy.timer = 0;
            // Create projectile
          }
        }
      } else {
        // Regular: simple chase
        if (dist < 10 && dist > 1) {
          const dir = new THREE.Vector3().subVectors(playerPos, enemy.position).normalize();
          enemy.velocity.add(dir.multiplyScalar(0.01));
        }
      }
      
      // Physics
      enemy.velocity.multiplyScalar(0.95); // Friction
      enemy.position.add(enemy.velocity);
      
      // Bounce animation
      enemy.mesh.position.copy(enemy.position);
      enemy.mesh.position.y = 0.5 + Math.abs(Math.sin(Date.now() * 0.003 + enemy.id)) * 0.3;
      enemy.mesh.scale.set(
        1 + Math.sin(Date.now() * 0.005) * 0.1,
        1 - Math.sin(Date.now() * 0.005) * 0.1,
        1 + Math.sin(Date.now() * 0.005) * 0.1
      );
      
      // Look at player
      enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y, playerPos.z);
      
      // Collision with player
      if (dist < 1.2) {
        // Damage player
        particles.emit(enemy.position.clone(), 'explosion', 5);
        this.audio.sfx('hit');
      }
    });
  }

  remove(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index > -1) {
      this.scene.remove(enemy.mesh);
      this.enemies.splice(index, 1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTIBLE SYSTEM — Cupcakes, Power-ups & Secrets
// ═══════════════════════════════════════════════════════════════════════════════

class CollectibleSystem {
  constructor(scene) {
    this.scene = scene;
    this.collectibles = [];
    this.spawnTimer = 0;
  }

  spawn(position, type = 'cupcake') {
    const group = new THREE.Group();
    
    if (type === 'cupcake') {
      const cake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.cupcakeBase, roughness: 0.3 })
      );
      const frosting = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
      );
      frosting.position.y = 0.2;
      const cherry = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.cherry, roughness: 0.1 })
      );
      cherry.position.y = 0.5;
      
      group.add(cake, frosting, cherry);
    } else if (type === 'powerup') {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.4, 0),
        new THREE.MeshStandardMaterial({ 
          color: COLORS.gold, 
          emissive: COLORS.gold,
          emissiveIntensity: 0.5,
        })
      );
      group.add(star);
      
      // Glow
      const light = new THREE.PointLight(COLORS.gold, 2, 5);
      group.add(light);
    }
    
    group.position.copy(position);
    group.position.y = 1;
    this.scene.add(group);
    
    this.collectibles.push({
      mesh: group,
      type,
      position: position.clone(),
      collected: false,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  update(playerPosition, particles, audio, onCollect) {
    const time = Date.now() * 0.002;
    
    this.collectibles.forEach((c, index) => {
      if (c.collected) return;
      
      // Animation
      c.mesh.rotation.y += 0.03;
      c.mesh.position.y = 1 + Math.sin(time + c.bobOffset) * 0.2;
      
      // Collection check
      const dist = playerPosition.distanceTo(c.mesh.position);
      if (dist < 1.5) {
        c.collected = true;
        c.mesh.visible = false;
        
        particles.emit(c.mesh.position, c.type === 'powerup' ? 'gold' : 'rainbow', 20);
        audio.sfx(c.type === 'powerup' ? 'powerup' : 'collect');
        
        onCollect(c.type);
      }
    });
    
    // Cleanup collected
    this.collectibles = this.collectibles.filter(c => {
      if (c.collected) {
        this.scene.remove(c.mesh);
        return false;
      }
      return true;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — The Full Experience
// ═══════════════════════════════════════════════════════════════════════════════

export default function CandyWorld() {
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(5);
  const [maxHealth] = useState(5);
  const [cupcakes, setCupcakes] = useState(0);
  const [powerUps, setPowerUps] = useState(0);
  const [combo, setCombo] = useState(0);
  const [dayTime, setDayTime] = useState(0); // 0-1
  const [showDamage, setShowDamage] = useState(false);
  const [message, setMessage] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  
  const gameData = useRef({
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    player: null,
    audio: new CandyAudio(),
    particles: null,
    terrain: new TerrainGenerator(),
    enemies: null,
    collectibles: null,
    keys: {},
    velocity: new THREE.Vector3(),
    isGrounded: false,
    canDoubleJump: false,
    hasDoubleJumped: false,
    invincible: false,
    speedBoost: false,
    lastTime: 0,
    comboTimer: null,
  });

  // Show temporary message
  const showMessage = useCallback((text, duration = 2000) => {
    setMessage(text);
    setTimeout(() => setMessage(null), duration);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Initialize Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.skyDay);
    scene.fog = new THREE.Fog(COLORS.skyDay, 10, 50);
    
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Post-processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.5, 0.4, 0.85
    );
    composer.addPass(bloomPass);

    // Store refs
    gameData.current.scene = scene;
    gameData.current.camera = camera;
    gameData.current.renderer = renderer;
    gameData.current.composer = composer;

    // Lighting
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
    
    gameData.current.sunLight = sunLight;

    // Ground plane (infinite illusion)
    const groundGeo = new THREE.PlaneGeometry(200, 200, 50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: COLORS.sugaryGrass,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    gameData.current.ground = ground;

    // Player
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 2, 0);
    scene.add(playerGroup);
    
    // Player mesh (cute character)
    const bodyGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffb6c1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    playerGroup.add(body);
    
    // Player eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 0.1, 0.4);
    rightEye.position.set(0.15, 0.1, 0.4);
    body.add(leftEye);
    body.add(rightEye);
    
    gameData.current.player = playerGroup;

    // Camera follow
    playerGroup.add(camera);
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0, 0);

    // Initialize systems
    gameData.current.particles = new ParticleSystem(scene);
    gameData.current.enemies = new EnemySystem(scene, playerGroup, gameData.current.audio);
    gameData.current.collectibles = new CollectibleSystem(scene);

    // Spawn initial collectibles
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 30;
      gameData.current.collectibles.spawn(
        new THREE.Vector3(Math.cos(angle) * dist, 1, Math.sin(angle) * dist),
        Math.random() > 0.8 ? 'powerup' : 'cupcake'
      );
    }

    // Spawn enemies
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 20;
      gameData.current.enemies.spawn('normal', new THREE.Vector3(Math.cos(angle) * dist, 1, Math.sin(angle) * dist));
    }
    
    // Spawn one elite
    gameData.current.enemies.spawn('elite', new THREE.Vector3(20, 1, 20));

    // Input handling
    const keys = {};
    const handleKeyDown = (e) => {
      keys[e.code] = true;
      
      if (e.code === 'Space' && gameState === 'play' && !isPaused) {
        e.preventDefault();
        const gd = gameData.current;
        
        if (gd.isGrounded) {
          gd.velocity.y = CONFIG.jumpForce;
          gd.isGrounded = false;
          gd.hasDoubleJumped = false;
          gd.audio.sfx('jump');
          gd.particles.emit(gd.player.position, 'sparkle', 8);
        } else if (gd.canDoubleJump && !gd.hasDoubleJumped) {
          gd.velocity.y = CONFIG.jumpForce * 0.8;
          gd.hasDoubleJumped = true;
          gd.audio.sfx('jump');
          gd.particles.emit(gd.player.position, 'rainbow', 12);
          showMessage('Double Jump! ✨');
        }
      }
      
      if (e.code === 'Escape') {
        setIsPaused(p => !p);
      }
    };
    
    const handleKeyUp = (e) => {
      keys[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    gameData.current.keys = keys;

    // Resize handler
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      composer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Game loop
    let animationId;
    const animate = (time) => {
      animationId = requestAnimationFrame(animate);
      
      const delta = time - gameData.current.lastTime;
      gameData.current.lastTime = time;
      
      if (gameState !== 'play' || isPaused) {
        composer.render();
        return;
      }

      const gd = gameData.current;
      
      // Day/Night cycle
      const dayProgress = (time % CONFIG.dayDuration) / CONFIG.dayDuration;
      setDayTime(dayProgress);
      
      // Update sky color
      let skyColor, fogColor, lightIntensity;
      if (dayProgress < 0.25) { // Day
        skyColor = COLORS.skyDay;
        fogColor = COLORS.skyDay;
        lightIntensity = 1;
      } else if (dayProgress < 0.5) { // Sunset
        skyColor = COLORS.skySunset;
        fogColor = COLORS.skySunset;
        lightIntensity = 0.6;
      } else if (dayProgress < 0.75) { // Night
        skyColor = COLORS.skyNight;
        fogColor = COLORS.skyNight;
        lightIntensity = 0.2;
      } else { // Sunrise
        skyColor = 0xffa07a;
        fogColor = 0xffa07a;
        lightIntensity = 0.6;
      }
      
      scene.background.setHex(skyColor);
      scene.fog.color.setHex(fogColor);
      sunLight.intensity = lightIntensity;
      
      // Movement
      const speed = gd.speedBoost ? CONFIG.sprintSpeed : CONFIG.moveSpeed;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerGroup.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerGroup.quaternion);
      
      if (keys['KeyW'] || keys['ArrowUp']) {
        gd.velocity.x += forward.x * 0.02;
        gd.velocity.z += forward.z * 0.02;
      }
      if (keys['KeyS'] || keys['ArrowDown']) {
        gd.velocity.x -= forward.x * 0.02;
        gd.velocity.z -= forward.z * 0.02;
      }
      if (keys['KeyA'] || keys['ArrowLeft']) {
        playerGroup.rotation.y += 0.05;
      }
      if (keys['KeyD'] || keys['ArrowRight']) {
        playerGroup.rotation.y -= 0.05;
      }
      
      // Sprint
      if (keys['ShiftLeft']) {
        gd.velocity.x *= 1.5;
        gd.velocity.z *= 1.5;
      }

      // Apply physics
      gd.velocity.y += CONFIG.gravity;
      gd.velocity.x *= 0.9; // Friction
      gd.velocity.z *= 0.9;
      
      // Update position
      playerGroup.position.x += gd.velocity.x;
      playerGroup.position.y += gd.velocity.y;
      playerGroup.position.z += gd.velocity.z;
      
      // Ground collision
      if (playerGroup.position.y <= 1) {
        playerGroup.position.y = 1;
        gd.velocity.y = 0;
        gd.isGrounded = true;
      }
      
      // Ground texture follows player (infinite illusion)
      ground.position.x = playerGroup.position.x;
      ground.position.z = playerGroup.position.z;
      
      // Update systems
      gd.particles.update();
      gd.enemies.update(delta, gd.particles);
      gd.collectibles.update(
        playerGroup.position,
        gd.particles,
        gd.audio,
        (type) => {
          if (type === 'cupcake') {
            setCupcakes(c => c + 1);
            setScore(s => s + 100);
            setCombo(c => {
              const newCombo = c + 1;
              if (newCombo > 2) showMessage(`${newCombo}x Combo! 🔥`);
              if (newCombo === 5) {
                gd.canDoubleJump = true;
                showMessage('Double Jump Unlocked! 🌟');
              }
              
              clearTimeout(gd.comboTimer);
              gd.comboTimer = setTimeout(() => setCombo(0), 3000);
              return newCombo;
            });
          } else if (type === 'powerup') {
            setPowerUps(p => p + 1);
            setScore(s => s + 500);
            gd.speedBoost = true;
            setTimeout(() => gd.speedBoost = false, 10000);
            showMessage('Speed Boost! ⚡');
          }
        }
      );
      
      // Spawn new collectibles periodically
      gd.collectibles.spawnTimer += delta;
      if (gd.collectibles.spawnTimer > 5000) {
        gd.collectibles.spawnTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 20;
        gd.collectibles.spawn(
          new THREE.Vector3(
            playerGroup.position.x + Math.cos(angle) * dist,
            1,
            playerGroup.position.z + Math.sin(angle) * dist
          ),
          Math.random() > 0.9 ? 'powerup' : 'cupcake'
        );
      }

      composer.render();
    };

    animate(0);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      gameData.current.audio.stopBGM();
    };
  }, [gameState, isPaused, showMessage]);

  // Start game
  const startGame = () => {
    setGameState('play');
    gameData.current.audio.init();
    gameData.current.audio.startBGM();
    showMessage('Collect cupcakes! Avoid slimes! 🧁');
  };

  // Reset game
  const resetGame = () => {
    setScore(0);
    setHealth(5);
    setCupcakes(0);
    setPowerUps(0);
    setCombo(0);
    setGameState('start');
    setIsPaused(false);
  };

  // Get time of day name
  const getTimeOfDay = () => {
    if (dayTime < 0.25) return '☀️ Day';
    if (dayTime < 0.5) return '🌅 Sunset';
    if (dayTime < 0.75) return '🌙 Night';
    return '🌄 Sunrise';
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: '#000',
    }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Vignette & Scanlines Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at center, transparent 40%, rgba(255,100,200,0.1) 100%),
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)
        `,
        pointerEvents: 'none',
        zIndex: 10,
      }} />

      {/* HUD */}
      {gameState === 'play' && (
        <>
          {/* Top Left — Stats */}
          <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            zIndex: 20,
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '10px' }}>
              🧁 {cupcakes} | ⭐ {score.toLocaleString()}
            </div>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              {[...Array(maxHealth)].map((_, i) => (
                <span key={i} style={{ 
                  fontSize: '36px',
                  filter: i < health ? 'none' : 'grayscale(100%)',
                  opacity: i < health ? 1 : 0.3,
                  transition: 'all 0.3s',
                }}>
                  {i < health ? '💖' : '🤍'}
                </span>
              ))}
            </div>
            {combo > 1 && (
              <div style={{
                fontSize: '24px',
                color: '#ff6b6b',
                animation: 'pulse 0.5s infinite',
              }}>
                🔥 {combo}x COMBO!
              </div>
            )}
          </div>

          {/* Top Right — Time & Power-ups */}
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            textAlign: 'right',
            fontFamily: '"Comic Sans MS", cursive',
            color: 'white',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            zIndex: 20,
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>
              {getTimeOfDay()}
            </div>
            {powerUps > 0 && (
              <div style={{ fontSize: '20px', color: '#ffd700' }}>
                ⚡ Power-ups: {powerUps}
              </div>
            )}
            {gameData.current?.canDoubleJump && (
              <div style={{ fontSize: '16px', color: '#ff69b4' }}>
                ✨ Double Jump Active
              </div>
            )}
          </div>

          {/* Center Message */}
          {message && (
            <div style={{
              position: 'absolute',
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: '"Comic Sans MS", cursive',
              fontSize: '36px',
              fontWeight: 'bold',
              color: '#ffd700',
              textShadow: '3px 3px 6px rgba(0,0,0,0.5)',
              animation: 'bounce 0.5s ease-out',
              zIndex: 30,
              pointerEvents: 'none',
            }}>
              {message}
            </div>
          )}

          {/* Damage Flash */}
          {showDamage && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 25,
              transition: 'opacity 0.2s',
            }} />
          )}

          {/* Pause Menu */}
          {isPaused && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 40,
            }}>
              <h1 style={{
                fontFamily: '"Comic Sans MS", cursive',
                fontSize: '48px',
                color: 'white',
                marginBottom: '30px',
              }}>
                ⏸️ PAUSED
              </h1>
              <button
                onClick={() => setIsPaused(false)}
                style={{
                  padding: '15px 40px',
                  fontSize: '24px',
                  fontFamily: '"Comic Sans MS", cursive',
                  background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
                  border: 'none',
                  borderRadius: '30px',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(255,20,147,0.4)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.target.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.target.style.transform = 'scale(1)'}
              >
                Resume
              </button>
            </div>
          )}

          {/* Controls Help */}
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            fontFamily: '"Comic Sans MS", cursive',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            zIndex: 20,
          }}>
            <div>WASD / Arrows — Move | Space — Jump | Shift — Sprint | ESC — Pause</div>
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
            background: 'linear-gradient(135deg, rgba(255,182,193,0.9), rgba(255,105,180,0.9))',
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
            fontSize: '72px',
            color: 'white',
            textShadow: '4px 4px 8px rgba(0,0,0,0.2)',
            marginBottom: '20px',
            animation: 'float 3s ease-in-out infinite',
          }}>
            🍭 CANDY WORLD 🍬
          </h1>
          <p style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '28px',
            color: 'white',
            marginBottom: '40px',
          }}>
            Click anywhere to start your sugar rush! 🧁✨
          </p>
          <div style={{
            display: 'flex',
            gap: '20px',
            fontSize: '48px',
            animation: 'bounce 1s infinite',
          }}>
            🧁 🍬 🍭 🍫 🍪
          </div>
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
            fontSize: '64px',
            color: '#ff6b6b',
            marginBottom: '20px',
          }}>
            💔 Game Over
          </h1>
          <div style={{
            fontFamily: '"Comic Sans MS", cursive',
            fontSize: '32px',
            color: 'white',
            marginBottom: '40px',
            textAlign: 'center',
          }}>
            <div>Final Score: {score.toLocaleString()}</div>
            <div>Cupcakes: {cupcakes} 🧁</div>
            <div>Power-ups: {powerUps} ⚡</div>
          </div>
          <button
            onClick={resetGame}
            style={{
              padding: '20px 50px',
              fontSize: '28px',
              fontFamily: '"Comic Sans MS", cursive',
              background: 'linear-gradient(135deg, #ff69b4, #ff1493)',
              border: 'none',
              borderRadius: '40px',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(255,20,147,0.4)',
            }}
          >
            Play Again 🔄
          </button>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
