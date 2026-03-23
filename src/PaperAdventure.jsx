/**
 * 🏝️ CANDY ISLAND — Living Town Update
 * Added Houses, Vehicles, Multi-line Dialogue, and Quests!
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  walkSpeed: 8,
  runSpeed: 15,
  cameraHeight: 18,
  cameraDistance: 25,
  worldSize: 80,
};

const COLORS = {
  grass: 0x90EE90,
  grassDark: 0x7CFC00,
  water: 0x40E0D0,
  sand: 0xF5DEB3,
  wood: 0x8B4513,
  leaves: 0x228B22,
  flowerRed: 0xFF69B4,
  flowerYellow: 0xFFD700,
  flowerWhite: 0xFFF8DC,
  apple: 0xFF4500,
  butterfly: 0x9370DB,
  fish: 0x4169E1,
  rock: 0x808080,
  player: 0xFFB6C1,
  sky: 0x87CEEB,
  targetMarker: 0xFFD700,
  npc1: 0x87CEFA, // Barnaby (Blue)
  npc2: 0xFFE4B5, // Pip (Orange/Yellow)
  npc3: 0xDDA0DD, // Luna (Purple)
  houseBody: 0xFFFAFA,
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
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.ctx.destination);
    } catch (e) { console.warn('Audio init failed:', e); }
  }

  startBGM() {
    if (this.isPlaying || !this.ctx) return;
    this.isPlaying = true;
    const chords = [[523.25, 659.25, 783.99], [587.33, 739.99, 880.00], [659.25, 783.99, 987.77], [493.88, 622.25, 739.99]];
    let chordIndex = 0;
    const playChord = () => {
      if (!this.isPlaying || !this.ctx) return;
      chords[chordIndex].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
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
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.connect(this.master);
      
      switch(name) {
        case 'step':
          osc.type = 'triangle'; osc.frequency.setValueAtTime(200, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.02, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
          osc.start(); osc.stop(this.ctx.currentTime + 0.05); break;
        case 'collect':
          osc.type = 'sine'; osc.frequency.setValueAtTime(880, this.ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.08, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
          osc.start(); osc.stop(this.ctx.currentTime + 0.15); break;
        case 'pop':
          osc.type = 'sine'; osc.frequency.setValueAtTime(600, this.ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.05, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
          osc.start(); osc.stop(this.ctx.currentTime + 0.1); break;
        case 'talk': 
          let t = this.ctx.currentTime;
          for(let i=0; i<6; i++) {
            const tOsc = this.ctx.createOscillator(); const tGain = this.ctx.createGain();
            tOsc.type = 'sine'; tOsc.frequency.setValueAtTime(800 + Math.random() * 600, t + i * 0.06);
            tGain.gain.setValueAtTime(0, t + i * 0.06); tGain.gain.linearRampToValueAtTime(0.04, t + i * 0.06 + 0.02); tGain.gain.linearRampToValueAtTime(0, t + i * 0.06 + 0.05);
            tOsc.connect(tGain); tGain.connect(this.master); tOsc.start(t + i * 0.06); tOsc.stop(t + i * 0.06 + 0.06);
          }
          break;
      }
    } catch (e) {}
  }
  stop() { this.isPlaying = false; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT 
// ═══════════════════════════════════════════════════════════════════════════════

export default function CandyIslandEnhanced() {
  const mountRef = useRef(null);
  const [uiState, setUiState] = useState('start'); 
  const [dialogueData, setDialogueData] = useState(null);
  const [bells, setBells] = useState(0);
  const [items, setItems] = useState({ flowers: 0, bugs: 0, fish: 0, fruit: 0 });
  const [time, setTime] = useState(new Date());
  const [message, setMessage] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  
  const gameRef = useRef({
    isPlaying: false,
    uiState: 'start',
    scene: null, camera: null, renderer: null,
    player: null, playerBody: null, targetMarker: null,
    raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    audio: new IslandAudio(),
    targetPosition: null, targetNPC: null, isMoving: false,
    worldObjects: [], collectibles: [], npcs: [],
    stepTimer: 0, cameraOffset: new THREE.Vector3(20, CONFIG.cameraHeight, 20),
  });

  const showMessage = useCallback((text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const g = gameRef.current;

    // ─── 1. Scene Setup ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 30, 100);
    g.scene = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(20, CONFIG.cameraHeight, 20);
    g.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    g.renderer = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
    sunLight.position.set(50, 80, 30); sunLight.castShadow = true;
    sunLight.shadow.camera.left = -60; sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60; sunLight.shadow.camera.bottom = -60;
    scene.add(sunLight);

    // ─── 2. Environment ─────────────────────────────────────────────
    const ground = new THREE.Mesh(new THREE.CircleGeometry(CONFIG.worldSize, 64), new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.8 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = 'ground';
    scene.add(ground);

    const beach = new THREE.Mesh(new THREE.RingGeometry(CONFIG.worldSize - 5, CONFIG.worldSize + 15, 64), new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 }));
    beach.rotation.x = -Math.PI / 2; beach.position.y = 0.02; beach.receiveShadow = true; beach.name = 'ground';
    scene.add(beach);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: COLORS.water, transparent: true, opacity: 0.75, roughness: 0.1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.8;
    scene.add(water);

    const createTree = (x, z, scale = 1) => {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * scale, 0.5 * scale, 2.5 * scale, 8), new THREE.MeshStandardMaterial({ color: COLORS.wood }));
      trunk.position.y = 1.25 * scale; trunk.castShadow = true; group.add(trunk);
      for (let i = 0; i < 3; i++) {
        const leaves = new THREE.Mesh(new THREE.ConeGeometry((2 - i * 0.4) * scale, 2.5 * scale, 8), new THREE.MeshStandardMaterial({ color: COLORS.leaves }));
        leaves.position.y = (3 + i * 1.5) * scale; leaves.castShadow = true; group.add(leaves);
      }
      group.position.set(x, 0, z); group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(group);
    };

    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2; const dist = 25 + Math.random() * 35;
      createTree(Math.cos(angle) * dist, Math.sin(angle) * dist, 0.8 + Math.random() * 0.4);
    }

    // Apples to collect
    for (let i = 0; i < 10; i++) {
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: COLORS.apple }));
      const a = Math.random() * Math.PI * 2; const d = 10 + Math.random() * 30;
      apple.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d);
      scene.add(apple);
      g.collectibles.push({ mesh: apple, type: 'apple', active: true });
    }

    // ─── 3. Characters, Houses & Vehicles ────────────────────────────────────────
    const createCharacter = (color, earType) => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshStandardMaterial({ color: color }));
        body.position.y = 0.6; body.castShadow = true; group.add(body);
        
        if (earType === 'bunny') {
            const leftEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.6, 4, 8), body.material); leftEar.position.set(-0.25, 1.1, 0); leftEar.rotation.z = 0.15;
            const rightEar = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.6, 4, 8), body.material); rightEar.position.set(0.25, 1.1, 0); rightEar.rotation.z = -0.15;
            group.add(leftEar, rightEar);
        } else if (earType === 'bear') {
            const leftEar = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), body.material); leftEar.position.set(-0.35, 1.0, 0);
            const rightEar = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), body.material); rightEar.position.set(0.35, 1.0, 0);
            group.add(leftEar, rightEar);
        } else if (earType === 'cat') {
            const leftEar = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), body.material); leftEar.position.set(-0.3, 1.0, 0); leftEar.rotation.z = 0.2;
            const rightEar = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), body.material); rightEar.position.set(0.3, 1.0, 0); rightEar.rotation.z = -0.2;
            group.add(leftEar, rightEar);
        }

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat); leftEye.position.set(-0.2, 0.7, 0.5);
        const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat); rightEye.position.set(0.2, 0.7, 0.5);
        group.add(leftEye, rightEye);
        return { group, body };
    };

    // Player
    const playerAssets = createCharacter(COLORS.player, 'bunny');
    scene.add(playerAssets.group);
    g.player = playerAssets.group; g.playerBody = playerAssets.body;

    // Houses
    const createHouse = (x, z, roofColor) => {
        const group = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({color: COLORS.houseBody}));
        base.position.y = 1.5; base.castShadow = true; base.receiveShadow = true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2.5, 4), new THREE.MeshStandardMaterial({color: roofColor}));
        roof.position.y = 4.25; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.8), new THREE.MeshStandardMaterial({color: COLORS.wood}));
        door.position.set(0, 0.9, 2.01);
        group.add(base, roof, door);
        group.position.set(x, 0, z);
        // Make houses block raycasting to ground by making them solid
        base.name = 'obstacle';
        scene.add(group);
    };

    // NPCs + Vehicles
    const spawnNPC = (name, color, earType, homePos, dialogues, handleQuest = null) => {
        createHouse(homePos.x, homePos.z - 3, color); // Build house behind them
        
        const npcAssets = createCharacter(color, earType);
        npcAssets.group.position.copy(homePos);
        
        // Add Hover Scooter
        const scooter = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.4, 4, 8), new THREE.MeshStandardMaterial({color: 0x555555}));
        scooter.rotation.z = Math.PI / 2; scooter.position.y = 0.2;
        npcAssets.group.add(scooter);
        npcAssets.body.position.y = 0.8; // raise body onto scooter

        // Hitbox
        const hitbox = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3, 8), new THREE.MeshBasicMaterial({ visible: false }));
        hitbox.position.y = 1.5; hitbox.userData = { isNPC: true, parent: npcAssets.group };
        npcAssets.group.add(hitbox);

        npcAssets.group.userData = { 
            isNPC: true, name, color, dialogues, dialogIndex: 0, 
            body: npcAssets.body, home: homePos, timeOffset: Math.random() * 10,
            handleQuest
        };
        scene.add(npcAssets.group);
        g.npcs.push(npcAssets.group);
    };

    // ─── 4. Dialogue Data & Logic ───────────────────────────────────────────
    spawnNPC("Barnaby", COLORS.npc1, 'bear', new THREE.Vector3(-12, 0, -10), [
        ["Oh, hello there! Nice day for a drive.", "I love cruising on my hover-scooter."],
        ["I'm actually quite hungry...", "If you find any apples, could you bring me one?"],
    ], (inventory) => {
        if (inventory.fruit > 0) {
            setItems(prev => ({ ...prev, fruit: prev.fruit - 1 }));
            setBells(prev => prev + 500);
            showMessage("Gave Apple! +500 Bells");
            return ["Oh wow, an apple! Thank you so much!", "Here are some bells for your trouble!"];
        }
        return null; // Continue standard dialogue if condition not met
    });
    
    spawnNPC("Luna", COLORS.npc3, 'cat', new THREE.Vector3(15, 0, -5), [
        ["Meow... the island air is lovely.", "I just had my house painted purple!"],
        ["Have you collected many things today?", "There are apples scattered all over the grass."]
    ]);

    spawnNPC("Pip", COLORS.npc2, 'bunny', new THREE.Vector3(-5, 0, 15), [
        ["Hop hop! Vroom vroom!", "My scooter is the fastest on the island!"],
        ["If you hold SHIFT, you can run faster!", "Try to keep up with me!"]
    ]);

    // Target Marker
    const markerMat = new THREE.MeshBasicMaterial({ color: COLORS.targetMarker, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const targetMarker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 16), markerMat);
    targetMarker.rotation.x = -Math.PI / 2; targetMarker.visible = false;
    scene.add(targetMarker);
    g.targetMarker = targetMarker;

    // ─── 5. Input Handling ──────────────────────────────────────────────────
    const handleClick = (e) => {
      if (!g.isPlaying) return;

      // Handle Dialogue Click
      if (g.uiState === 'dialogue') {
          setDialogueData(prev => {
              if (prev && prev.current < prev.texts.length - 1) {
                  g.audio.sfx('talk');
                  return { ...prev, current: prev.current + 1 };
              } else {
                  // End conversation
                  g.uiState = 'play'; setUiState('play');
                  g.targetNPC.userData.isTalking = false; g.targetNPC = null;
                  return null;
              }
          });
          return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      g.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      g.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      g.raycaster.setFromCamera(g.mouse, camera);
      const intersects = g.raycaster.intersectObjects(scene.children, true);
      
      const npcHit = intersects.find(hit => hit.object.userData?.isNPC);
      if (npcHit) {
          const npc = npcHit.object.userData.parent;
          const direction = new THREE.Vector3().subVectors(g.player.position, npc.position).normalize();
          g.targetPosition = npc.position.clone().add(direction.multiplyScalar(2.0)); // Stop slightly further back
          g.targetPosition.y = 0; g.isMoving = true; g.targetNPC = npc;
          
          targetMarker.position.copy(g.targetPosition); targetMarker.position.y = 0.1; targetMarker.visible = true;
          g.player.userData.targetRotation = Math.atan2(direction.x, direction.z);
          g.audio.sfx('pop');
          setTimeout(() => { targetMarker.visible = false; }, 1500);
          return;
      }

      const groundHit = intersects.find(hit => hit.object.name === 'ground');
      if (groundHit) {
        g.targetNPC = null;
        g.targetPosition = groundHit.point.clone(); g.targetPosition.y = 0; g.isMoving = true;
        targetMarker.position.copy(g.targetPosition); targetMarker.position.y = groundHit.point.y > 0 ? 0.1 : -0.5; 
        targetMarker.visible = true;
        
        const direction = new THREE.Vector3().subVectors(g.targetPosition, g.player.position);
        if (direction.length() > 0.1) g.player.userData.targetRotation = Math.atan2(direction.x, direction.z);
        g.audio.sfx('pop');
        setTimeout(() => { targetMarker.visible = false; }, 1500);
      }
    };

    container.addEventListener('click', handleClick);
    const handleKeyDown = (e) => { if (e.code === 'ShiftLeft') setIsRunning(true); };
    const handleKeyUp = (e) => { if (e.code === 'ShiftLeft') setIsRunning(false); };
    document.addEventListener('keydown', handleKeyDown); document.addEventListener('keyup', handleKeyUp);

    // ─── 6. GAME LOOP ───────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const gameTime = clock.getElapsedTime();
      
      if (g.isPlaying) {
        
        // NPC AI: Driving around
        g.npcs.forEach(npc => {
            if (g.targetNPC !== npc && !npc.userData.isTalking) {
                const timeOffset = gameTime * 0.5 + npc.userData.timeOffset;
                const radius = 4;
                // Patrol center slightly in front of their house
                const centerX = npc.userData.home.x;
                const centerZ = npc.userData.home.z + 5; 
                
                const nextX = centerX + Math.cos(timeOffset) * radius;
                const nextZ = centerZ + Math.sin(timeOffset) * radius;
                
                npc.lookAt(nextX, npc.position.y, nextZ);
                npc.position.set(nextX, npc.position.y, nextZ);
                
                // Scooter Bobbing
                npc.userData.body.position.y = 0.8 + Math.sin(gameTime * 8 + npc.userData.timeOffset) * 0.05;
            }
        });

        // Collectibles check
        g.collectibles.forEach(c => {
          if (!c.active) return;
          if (g.player.position.distanceTo(c.mesh.position) < 1.5) {
            c.active = false; c.mesh.visible = false;
            g.audio.sfx('collect');
            setItems(prev => {
                const next = {...prev};
                if(c.type === 'apple') next.fruit++;
                return next;
            });
            setBells(prev => prev + 100);
            showMessage("+100 Bells 🍎");
          }
        });

        // Player Movement
        if (g.isMoving && g.targetPosition) {
          const distance = g.player.position.distanceTo(g.targetPosition);
          if (distance > 0.2) {
            const dirX = (g.targetPosition.x - g.player.position.x) / distance;
            const dirZ = (g.targetPosition.z - g.player.position.z) / distance;
            
            if (g.player.userData.targetRotation !== undefined) {
              let diff = g.player.userData.targetRotation - g.player.rotation.y;
              while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
              g.player.rotation.y += diff * 8 * delta;
            }
            
            const moveStep = (isRunning ? CONFIG.runSpeed : CONFIG.walkSpeed) * delta;
            const actualMove = Math.min(moveStep, distance);
            g.player.position.x += dirX * actualMove; g.player.position.z += dirZ * actualMove;
            
            g.playerBody.position.y = 0.6 + Math.abs(Math.sin(gameTime * (isRunning ? 15 : 10))) * 0.15;
            
            g.stepTimer += delta;
            if (g.stepTimer > (isRunning ? 0.25 : 0.4)) { g.audio.sfx('step'); g.stepTimer = 0; }
          } else {
            g.isMoving = false; g.targetPosition = null; g.playerBody.position.y = 0.6; targetMarker.visible = false;

            // Talk to NPC upon arrival
            if (g.targetNPC && !g.targetNPC.userData.isTalking) {
                const npc = g.targetNPC;
                npc.userData.isTalking = true;
                g.player.lookAt(npc.position.x, g.player.position.y, npc.position.z);
                npc.lookAt(g.player.position.x, npc.position.y, g.player.position.z);

                // Check Quests using current items state via ref or closure
                let convoText = null;
                setItems(currentItems => {
                    if (npc.userData.handleQuest) {
                        convoText = npc.userData.handleQuest(currentItems);
                    }
                    return currentItems; 
                });

                if (!convoText) {
                    const convoArr = npc.userData.dialogues[npc.userData.dialogIndex % npc.userData.dialogues.length];
                    convoText = convoArr;
                    npc.userData.dialogIndex++;
                }

                g.audio.sfx('talk');
                requestAnimationFrame(() => {
                    setDialogueData({ name: npc.userData.name, texts: convoText, current: 0, color: npc.userData.color });
                    g.uiState = 'dialogue'; setUiState('dialogue');
                });
            }
          }
        } else {
          g.playerBody.position.y = 0.6 + Math.sin(gameTime * 2) * 0.02;
        }
        
        const targetCamPos = new THREE.Vector3(g.player.position.x + g.cameraOffset.x, g.cameraOffset.y, g.player.position.z + g.cameraOffset.z);
        camera.position.lerp(targetCamPos, delta * 3); camera.lookAt(g.player.position.x, 0.5, g.player.position.z);
        
        if (targetMarker.visible) {
          targetMarker.rotation.z += delta * 3;
          const scale = 1 + Math.sin(gameTime * 8) * 0.2; targetMarker.scale.set(scale, scale, scale);
        }
      }
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      container.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('keyup', handleKeyUp);
      renderer.dispose(); g.audio.stop();
    };
  }, [isRunning, showMessage]);

  const startGame = () => {
    setUiState('play'); gameRef.current.uiState = 'play';
    gameRef.current.isPlaying = true; gameRef.current.audio.init(); gameRef.current.audio.startBGM();
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', background: '#87ceeb' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: uiState === 'play' ? 'crosshair' : 'default' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent 50%, rgba(0,0,0,0.1) 100%)', pointerEvents: 'none', zIndex: 10 }} />

      {(uiState === 'play' || uiState === 'dialogue') && (
        <>
          <div style={{ position: 'absolute', top: 20, left: 20, fontFamily: '"Comic Sans MS", "Verdana", sans-serif', zIndex: 20 }}>
            <div style={{ background: 'rgba(255, 223, 186, 0.95)', padding: '12px 24px', borderRadius: '25px', border: '4px solid #8B4513', boxShadow: '0 6px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>🔔</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B4513' }}>{bells.toLocaleString()}</span>
              <span style={{ fontSize: '28px', marginLeft: '10px' }}>🍎</span>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B4513' }}>{items.fruit}</span>
            </div>
          </div>
          <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0, 0, 0, 0.7)', color: 'white', padding: '15px 20px', borderRadius: '15px', fontFamily: '"Comic Sans MS", sans-serif', fontSize: '14px', zIndex: 20 }}>
            <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#FFD700' }}>Controls:</div>
            <div>🖱️ Click ground — Walk</div>
            <div>🖱️ Click NPC — Talk</div>
            <div>🏃 Shift — Run fast</div>
          </div>
          {message && (
            <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255, 255, 255, 0.98)', padding: '20px 40px', borderRadius: '30px', border: '5px solid #FFD700', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: '"Comic Sans MS", cursive', fontSize: '28px', fontWeight: 'bold', color: '#333', zIndex: 30, pointerEvents: 'none', animation: 'bounceIn 0.4s ease-out' }}>
              {message}
            </div>
          )}
        </>
      )}

      {/* DIALOGUE UI */}
      {uiState === 'dialogue' && dialogueData && (
        <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', width: '80%', maxWidth: '800px', zIndex: 100, pointerEvents: 'none' }}>
            <div style={{ background: `#${dialogueData.color.toString(16).padStart(6, '0')}`, color: 'white', padding: '8px 24px', borderRadius: '20px 20px 0 0', fontFamily: '"Comic Sans MS", cursive', fontSize: '24px', fontWeight: 'bold', display: 'inline-block', border: '5px solid white', borderBottom: 'none', textShadow: '2px 2px 0 rgba(0,0,0,0.2)', marginLeft: '40px' }}>
                {dialogueData.name}
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '30px 40px', borderRadius: '30px', border: '6px solid white', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', fontFamily: '"Comic Sans MS", cursive', fontSize: '26px', color: '#333', lineHeight: '1.4' }}>
                {dialogueData.texts[dialogueData.current]}
                <div style={{ textAlign: 'right', fontSize: '16px', color: '#888', marginTop: '20px', animation: 'blink 1.5s infinite' }}>
                    ▼ Click anywhere to continue ({dialogueData.current + 1}/{dialogueData.texts.length})
                </div>
            </div>
        </div>
      )}

      {/* Start Screen */}
      {uiState === 'start' && (
        <div onClick={startGame} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(135, 206, 235, 0.98), rgba(144, 238, 144, 0.9))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 50 }}>
          <h1 style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive', fontSize: '80px', color: 'white', textShadow: '5px 5px 0 #228B22, 10px 10px 0 rgba(0,0,0,0.2)', marginBottom: '30px', animation: 'float 3s ease-in-out infinite', textAlign: 'center' }}>
            🏝️ CANDY<br/>ISLAND
          </h1>
          <p style={{ fontFamily: '"Comic Sans MS", cursive', fontSize: '32px', color: 'white', textShadow: '3px 3px 6px rgba(0,0,0,0.3)', marginBottom: '50px', textAlign: 'center' }}>
            Your town is alive! 🏡🛵
          </p>
          <div style={{ marginTop: '40px', padding: '20px 40px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', border: '3px solid white', fontFamily: '"Comic Sans MS", cursive', color: 'white', fontSize: '18px' }}>
            🖱️ Click to Start
          </div>
        </div>
      )}

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-25px) rotate(3deg); } }
        @keyframes bounceIn { 0% { transform: translate(-50%, -50%) scale(0); opacity: 0; } 50% { transform: translate(-50%, -50%) scale(1.1); } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
