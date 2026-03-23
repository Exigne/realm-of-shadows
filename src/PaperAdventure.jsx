/**
 * PaperAdventure.jsx — COTTON CANDY WORLD
 * * Visual Style: Ultra-Stylized "Fluffy Toy Diorama"
 * * Tech: True 3D, High-Roughness Metaball Shading
 * * Features:
 * - Sugary Ground with Procedural Sprinkles
 * - Gumdrop Walls & Cotton Candy Trees
 * - Jump Mechanic with Gravity (Spacebar)
 * - Custom Audio Suite (Boings & Twinkles)
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ─── Creative Style Config ────────────────────────────────────────────────
const COLORS = {
  sugaryGrass: 0xdbf0db,   // Pale sugary green
  gumdropWall: 0xffccf2,   // Pastel Pink
  sky: 0xade8ff,          // Soft Blue
  marshmallow: 0xffffaa,   // Warm creamy yellow
  slime: 0xff66b2,
  cupcakeBase: 0xff80bf,
};

const mc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };

// ═══════════════════════════════════════════════════════════════════════════
//  CUTE PROCEDURAL TEXTURES
// ═══════════════════════════════════════════════════════════════════════════

const genSprinkleGround = () => {
    const c = mc(256); const ctx = c.getContext('2d');
    ctx.fillStyle = '#dbf0db'; ctx.fillRect(0,0,256,256);
    const sprinkles = ['#ff66b2', '#ff88ff', '#88ffaa', '#88aaff'];
    for(let i=0; i<100; i++) {
        ctx.fillStyle = sprinkles[Math.floor(Math.random()*sprinkles.length)];
        ctx.fillRect(Math.random()*250, Math.random()*250, 4, 10);
    }
    return c;
};

// ═══════════════════════════════════════════════════════════════════════════
//  CUTE AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class CandyMusic {
    constructor() { this.ctx=null; this.master=null; this.nodes=[]; this.timers=[]; this.alive=false; }
    start() {
        if(this.alive) return;
        try {
            this.ctx = new (window.AudioContext||window.webkitAudioContext)();
            this.master = this.ctx.createGain(); this.master.gain.value=0.3; this.master.connect(this.ctx.destination);
            this.alive = true;
            this._melody();
        } catch(e) { console.warn(e); }
    }
    _melody() {
        const scale = [261.63, 329.63, 392.00, 523.25]; // C Major
        const play = () => {
            if(!this.alive) return;
            const now = this.ctx.currentTime;
            const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
            o.type = 'triangle'; o.frequency.value = scale[Math.floor(Math.random()*scale.length)];
            g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            o.connect(g); g.connect(this.master); o.start(); o.stop(now + 0.6);
            this.timers.push(setTimeout(play, 600));
        }; play();
    }
    boing() {
        if(!this.ctx) return;
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.frequency.setValueAtTime(100, now); o.frequency.exponentialRampToValueAtTime(300, now+0.1);
        g.gain.value = 0.2; o.connect(g); g.connect(this.master); o.start(); o.stop(now+0.15);
    }
    sparkle() {
        if(!this.ctx) return;
        const now = this.ctx.currentTime;
        [800, 1200, 1600].forEach((f,i) => {
            const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
            o.frequency.value = f;
            g.gain.setValueAtTime(0.1, now + i*0.03); g.gain.exponentialRampToValueAtTime(0.001, now + i*0.03 + 0.1);
            o.connect(g); g.connect(this.master); o.start(now + i*0.03); o.stop(now + i*0.03 + 0.1);
        });
    }
    stop() { this.alive=false; this.timers.forEach(clearTimeout); if(this.ctx) this.ctx.close(); }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const mountRef = useRef(null);
  const [health, setHealth] = useState(5);
  const [items, setItems] = useState(0);

  useEffect(() => {
    const container = mountRef.current;
    
    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 5, 25);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 2. Soft Candy Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 1.4);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
    sunLight.position.set(5, 10, 7.5);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // 3. Environment: Sugary Ground
    const floorGeom = new THREE.PlaneGeometry(60, 60);
    const floorTex = new THREE.CanvasTexture(genSprinkleGround());
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(10,10);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Gumdrop Walls (Replacing blocky walls)
    const gdGeom = new THREE.DodecahedronGeometry(2, 1);
    const gdMat = new THREE.MeshStandardMaterial({ color: COLORS.gumdropWall, flatShading: true, roughness: 0.3 });
    for(let i=0; i<30; i++) {
        const wall = new THREE.Mesh(gdGeom, gdMat);
        wall.position.set(Math.random()*50-25, 1, Math.random()*50-25);
        if(wall.position.length() > 5) scene.add(wall);
    }

    // 5. Fluffy "Cotton Candy" Trees
    const createFluffyTree = (x, z) => {
      const group = new THREE.Group();
      // Trunk (Giant Marshmallow)
      const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.marshmallow, roughness: 0.9 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.8), trunkMat);
      trunk.position.y = 0.4;
      group.add(trunk);
      // Fluff (Nested Spheres)
      const colors = [0xffccf2, 0xdbf0db, 0xade8ff];
      for(let i=0; i<3; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: colors[i], roughness: 1.0 });
        const fluff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6-i*0.1, 1), mat);
        fluff.position.y = 1.0 + i*0.4;
        group.add(fluff);
      }
      group.position.set(x, 0, z);
      scene.add(group);
    };
    for(let i=0; i<20; i++) createFluffyTree(Math.random()*40-20, Math.random()*40-20);

    // 6. Slime Friends
    const slimes = [];
    const createSlime = (x, z) => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: COLORS.slime, roughness: 0.3 }));
        const eyeGeom = new THREE.SphereGeometry(0.08, 8, 8); const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeL = new THREE.Mesh(eyeGeom, eyeMat); eyeL.position.set(-0.2, 0.1, 0.4); const eyeR = eyeL.clone(); eyeR.position.x = 0.2;
        group.add(body, eyeL, eyeR); group.position.set(x, 0.5, z);
        scene.add(group);
        slimes.push({ mesh: group, body, originalZ: z, offset: Math.random()*Math.PI });
    };
    for(let i=0; i<6; i++) createSlime(Math.random()*20-10, Math.random()*20-10);

    // 7. Power-Up Cupcakes
    const cupcakes = [];
    const cupcakeMat = new THREE.MeshStandardMaterial({ color: COLORS.cupcakeBase, flatShading:true });
    for(let i=0; i<10; i++) {
        const group = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), cupcakeMat);
        const frosting = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 1), cupcakeMat); frosting.position.y=0.25;
        const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: COLORS.cherry })); cherry.position.y=0.5;
        const glow = new THREE.PointLight(COLORS.cupcakeBase, 1, 3); glow.position.y=0.5;
        group.add(base, frosting, cherry, glow); group.position.set(Math.random()*30-15, 0.4, Math.random()*30-15);
        scene.add(group); cupcakes.push({ mesh: group, x:group.position.x, z:group.position.z, collected: false });
    }

    // 8. Player & Input
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 1.5, 10);
    scene.add(playerGroup);
    playerGroup.add(camera);

    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    const music = new CandyMusic();
    const canvas = renderer.domElement;
    canvas.addEventListener('click', () => { canvas.requestPointerLock(); music.start(); });

    // 9. Jump Physics
    let velocityY = 0;
    const GRAVITY = -0.01;
    const JUMP_FORCE = 0.22;
    const GROUND_Y = 1.5;
    let isGrounded = true;

    // 10. Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      const time = Date.now() * 0.002;

      // Movement
      if (keys['KeyW']) playerGroup.translateZ(-0.1);
      if (keys['KeyS']) playerGroup.translateZ(0.1);
      if (keys['KeyA']) playerGroup.rotation.y += 0.03;
      if (keys['KeyD']) playerGroup.rotation.y -= 0.03;

      // Jump Logic
      if (keys['Space'] && isGrounded) {
          music.boing();
          velocityY = JUMP_FORCE;
          isGrounded = false;
          keys['Space'] = false; // Prevent auto-jumping
      }

      // Physics (Gravity)
      if(!isGrounded) {
          velocityY += GRAVITY;
          playerGroup.position.y += velocityY;
          
          if(playerGroup.position.y <= GROUND_Y) {
              playerGroup.position.y = GROUND_Y;
              velocityY = 0;
              isGrounded = true;
          }
      }

      // Animate Objects
      slimes.forEach(s => {
          const bounce = Math.abs(Math.sin(time + s.offset));
          s.mesh.position.y = 0.5 + bounce*0.5;
          s.body.scale.y = 1 - bounce*0.3;
          s.body.scale.x = 1 + bounce*0.2;
      });
      cupcakes.forEach(c => {
          if(!c.collected) {
              c.mesh.rotation.y += 0.02;
              c.mesh.position.y = 0.5 + Math.sin(time) * 0.1;
              const dist = playerGroup.position.distanceTo(c.mesh.position);
              if(dist < 1.0) {
                  c.collected = true; c.mesh.visible = false;
                  setHealth(h => Math.min(5, h + 1));
                  setItems(prev => prev + 1);
                  music.sparkle();
              }
          }
      });

      renderer.render(scene, camera);
    };

    animate();
    return () => { renderer.dispose(); music.stop(); };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 150px rgba(255,100,200,0.1)', pointerEvents: 'none' }} />
      {flash > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(255,255,150,${flash})`, pointerEvents: 'none' }} />}

      {/* Styled UI */}
      <div style={{ position: 'absolute', top: 30, left: 30, fontFamily: "'Comic Sans MS', cursive", color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: 0 }}>CUPCAKES: {items}</h2>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          {[...Array(5)].map((_, i) => (
            <span key={i} style={{ fontSize: '30px', opacity: i < health ? 1 : 0.2, transition: '0.3s' }}>🌸</span>
          ))}
        </div>
      </div>
      
      {gameState === 'start' && <div onClick={() => music.start()} style={{ position: 'absolute', inset: 0, background: COLORS.sky, display: 'flex', alignItems: 'center', justifyContent: 'center', color:'white', fontSize: 30, cursor:'pointer' }}>CLICK FOR JUMPING MAGIC</div>}
    </div>
  );
}
