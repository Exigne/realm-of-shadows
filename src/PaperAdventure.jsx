/**
 * PaperAdventure.jsx — COTTON CANDY WORLD (Fixed)
 * Fixes: Added missing gameState hook, centered camera, and added resize listener.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const COLORS = {
  sugaryGrass: 0xdbf0db,
  gumdropWall: 0xffccf2,
  sky: 0xade8ff,
  marshmallow: 0xffffaa,
  slime: 0xff66b2,
  cupcakeBase: 0xff80bf,
  cherry: 0xff0000
};

const mc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };

// ─── Procedural Sprinkle Texture ──────────────────────────────────────────
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

// ─── Cute Audio Engine ────────────────────────────────────────────────────
class CandyMusic {
    constructor() { this.ctx=null; this.master=null; this.nodes=[]; this.timers=[]; this.alive=false; }
    start() {
        if(this.alive) return;
        try {
            this.ctx = new (window.AudioContext||window.webkitAudioContext)();
            this.master = this.ctx.createGain(); this.master.gain.value=0.2; this.master.connect(this.ctx.destination);
            this.alive = true;
            this._melody();
        } catch(e) { console.warn("Audio blocked by browser"); }
    }
    _melody() {
        const scale = [261.63, 329.63, 392.00, 523.25];
        const play = () => {
            if(!this.alive) return;
            const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
            o.type = 'triangle'; o.frequency.value = scale[Math.floor(Math.random()*scale.length)];
            g.gain.setValueAtTime(0.05, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
            o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + 0.6);
            this.timers.push(setTimeout(play, 800));
        }; play();
    }
    boing() {
        if(!this.ctx) return;
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.frequency.setValueAtTime(150, this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime+0.1);
        g.gain.value = 0.1; o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime+0.15);
    }
    sparkle() {
        if(!this.ctx) return;
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.frequency.setValueAtTime(1500, this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime+0.1);
        g.gain.value = 0.1; o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime+0.15);
    }
    stop() { this.alive=false; this.timers.forEach(clearTimeout); if(this.ctx) this.ctx.close(); }
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function PaperAdventure() {
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('start'); // FIXED: Added missing hook
  const [health, setHealth] = useState(5);
  const [items, setItems] = useState(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 5, 35);

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(5, 10, 7.5);
    sun.castShadow = true;
    scene.add(sun);

    // 3. Ground
    const floorTex = new THREE.CanvasTexture(genSprinkleGround());
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(15,15);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Content (Slimes, Trees, Gumdrops)
    const slimes = [];
    const createSlime = (x, z) => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: COLORS.slime, roughness: 0.3 }));
        body.castShadow = true;
        group.add(body);
        group.position.set(x, 0.5, z);
        scene.add(group);
        slimes.push({ mesh: group, body, offset: Math.random()*Math.PI });
    };
    for(let i=0; i<8; i++) createSlime(Math.random()*40-20, Math.random()*40-20);

    const cupcakes = [];
    for(let i=0; i<12; i++) {
        const group = new THREE.Group();
        const cake = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 1), new THREE.MeshStandardMaterial({ color: COLORS.cupcakeBase }));
        const glow = new THREE.PointLight(COLORS.cupcakeBase, 1, 4);
        group.add(cake, glow);
        group.position.set(Math.random()*40-20, 0.5, Math.random()*40-20);
        scene.add(group);
        cupcakes.push({ mesh: group, collected: false });
    }

    // 5. Player & Physics
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 1.5, 10);
    scene.add(playerGroup);
    playerGroup.add(camera);

    const keys = {};
    const music = new CandyMusic();
    let velocityY = 0;
    let isGrounded = true;

    const onKeyDown = (e) => { 
        keys[e.code] = true;
        if (e.code === 'Space' && isGrounded) {
            music.boing();
            velocityY = 0.2;
            isGrounded = false;
        }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    // 6. Loop
    let rafId;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const time = Date.now() * 0.002;

      // Move
      if (keys['KeyW']) playerGroup.translateZ(-0.1);
      if (keys['KeyS']) playerGroup.translateZ(0.1);
      if (keys['KeyA']) playerGroup.rotation.y += 0.04;
      if (keys['KeyD']) playerGroup.rotation.y -= 0.04;

      // Jump Physics
      if (!isGrounded) {
          velocityY -= 0.01; // Gravity
          playerGroup.position.y += velocityY;
          if (playerGroup.position.y <= 1.5) {
              playerGroup.position.y = 1.5;
              isGrounded = true;
          }
      }

      // Animate Slimes
      slimes.forEach(s => {
          const bounce = Math.abs(Math.sin(time + s.offset));
          s.mesh.position.y = 0.5 + bounce * 0.6;
          s.body.scale.set(1 + bounce*0.2, 1 - bounce*0.3, 1 + bounce*0.2);
      });

      // Animate Cupcakes & Collision
      cupcakes.forEach(c => {
          if (!c.collected) {
              c.mesh.rotation.y += 0.05;
              c.mesh.position.y = 0.6 + Math.sin(time*2) * 0.1;
              if (playerGroup.position.distanceTo(c.mesh.position) < 1.2) {
                  c.collected = true; c.mesh.visible = false;
                  music.sparkle();
                  setItems(v => v + 1);
              }
          }
      });

      renderer.render(scene, camera);
    };

    // 7. Cleanup & Listeners
    const onResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);
    
    container.addEventListener('click', () => {
        setGameState('play');
        music.start();
    });

    animate();

    return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        music.stop();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', background: COLORS.sky }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Vignette Overlay */}
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 150px rgba(255,100,200,0.15)', pointerEvents: 'none' }} />

      {/* HUD */}
      <div style={{ position: 'absolute', top: 30, left: 30, fontFamily: "'Comic Sans MS', cursive", color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
        <h2 style={{ margin: 0 }}>🍬 CUPCAKES: {items}</h2>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          {[...Array(health)].map((_, i) => (
            <span key={i} style={{ fontSize: '32px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>🌸</span>
          ))}
        </div>
      </div>

      {gameState === 'start' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(173, 232, 255, 0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <h1 style={{ color: 'white', fontSize: '42px', fontFamily: "'Comic Sans MS', cursive", textShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>✨ CANDY WORLD ✨</h1>
            <p style={{ color: 'white', fontSize: '20px' }}>Click anywhere to hop!</p>
        </div>
      )}
    </div>
  );
}
