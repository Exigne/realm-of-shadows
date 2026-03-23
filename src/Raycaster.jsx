/**
 * Raycaster.jsx — SPARKLE MEADOW: THE GREAT CELEBRATION
 * * Features:
 * - 5-Heart HUb & Power-Up Cupcakes
 * - Challenge: Collect 4 Harmony Stars in corners
 * - Confetti Particle Event
 * - Giant Golden Victory Cake (Goal)
 * - Upbeat Melodic Music
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { worldMap, mapWidth, mapHeight, enemySpawns } from './gameMap';

// ─── Constants ─────────────────────────────────────────────────────────────
const WALL_H      = 2.2;
const EYE_H       = 1.05;
const MOVE_SPEED  = 0.06;
const ROT_SPEED   = 0.035;
const MOUSE_SENS  = 0.002;
const FOG_NEAR    = 2;
const FOG_FAR     = 20;
const SPRITE_SIZE = 128;

const mc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };

// ═══════════════════════════════════════════════════════════════════════════
//  PROCEDURAL TEXTURE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

const genGrass = () => {
  const c = mc(128); const ctx = c.getContext('2d');
  ctx.fillStyle = '#b3f5bc'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#8ce098';
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 4, 8);
  return c;
};

const genCandyBlock = () => {
  const c = mc(128); const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffccf2'; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 120, 120);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 15; i++) ctx.fillRect(Math.random()*120, Math.random()*120, 4, 4);
  return c;
};

const genSkyWall = () => {
  const c = mc(128); const ctx = c.getContext('2d');
  ctx.fillStyle = '#ade8ff'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(40 + i*20, 60, 15, 0, Math.PI * 2); ctx.fill();
  }
  return c;
};

const genCupcake = () => {
  const c = mc(SPRITE_SIZE); const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#d2b48c'; ctx.fillRect(44, 80, 40, 30); // Wrapper
  ctx.fillStyle = '#ff66b2'; // Cake
  ctx.beginPath(); ctx.arc(64, 75, 25, 0, Math.PI, true); ctx.fill();
  ctx.fillStyle = '#ff0000'; // Cherry
  ctx.beginPath(); ctx.arc(64, 50, 8, 0, Math.PI * 2); ctx.fill();
  return c;
};

const genHarmonyStar = (mainColor, glow) => {
    const c = mc(SPRITE_SIZE); const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = mainColor;
    ctx.beginPath(); ctx.moveTo(64, 10); ctx.lineTo(80, 50); ctx.lineTo(120, 50); ctx.lineTo(90, 80); ctx.lineTo(100, 120); ctx.lineTo(64, 100); ctx.lineTo(28, 120); ctx.lineTo(38, 80); ctx.lineTo(8, 50); ctx.lineTo(48, 50); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = glow; ctx.lineWidth = 4; ctx.stroke();
    return c;
};

const genVictoryCake = () => {
    const c = mc(256); const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffd700'; ctx.fillRect(50, 150, 156, 106); // Tier 1
    ctx.fillStyle = '#ffff66'; ctx.fillRect(80, 80, 96, 70);  // Tier 2
    ctx.fillStyle = '#fffacd'; ctx.fillRect(100, 30, 56, 50); // Tier 3
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 6; ctx.strokeRect(50, 150, 156, 106); ctx.strokeRect(80, 80, 96, 70); ctx.strokeRect(100, 30, 56, 50);
    return c;
};

const genConfettiTex = () => {
    const c = mc(32); const ctx = c.getContext('2d');
    const colors = ['#ff66b2', '#ade8ff', '#b3f5bc', '#ffff00'];
    ctx.fillStyle = colors[Math.floor(Math.random()*colors.length)];
    ctx.fillRect(4,4,24,24);
    return c;
};

// ═══════════════════════════════════════════════════════════════════════════
//  SPRITE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

function generateSlimeSpriteSheet(color = '#ff66b2') {
  const frames = [];
  for (let frame = 0; frame < 12; frame++) {
    const c = mc(SPRITE_SIZE); const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const cx = SPRITE_SIZE / 2;
    const baseY = SPRITE_SIZE * 0.85;
    const squash = Math.sin(frame * Math.PI / 4) * 8;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(cx, baseY - 30 + squash/2, 40 + squash, 35 - squash, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    if (frame % 10 !== 0) {
      ctx.beginPath(); ctx.arc(cx - 15, baseY - 35 + squash, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 15, baseY - 35 + squash, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(cx - 15, baseY - 35 + squash, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 15, baseY - 35 + squash, 4, 0, Math.PI * 2); ctx.fill();
    }
    frames.push(c);
  }
  return frames;
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class MeadowMusic {
  constructor() { this.ctx=null; this.master=null; this.alive=false; this.timers=[]; }
  start() {
    if(this.alive) return;
    this.ctx = new (window.AudioContext||window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value=0.2; this.master.connect(this.ctx.destination);
    this.alive = true;
    this._melody();
  }
  _melody() {
    const scale = [261.63, 329.63, 392.00, 523.25];
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
  fanfare() {
      if(!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((f,i) => {
          const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
          o.type='sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0.2, now + i*0.1); g.gain.exponentialRampToValueAtTime(0.001, now + i*0.1 + 0.5);
          o.connect(g); g.connect(this.master); o.start(now + i*0.1); o.stop(now + i*0.1 + 0.5);
      });
  }
  stop() { this.alive=false; this.timers.forEach(clearTimeout); if(this.ctx) this.ctx.close(); }
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Raycaster({ onEncounter, onPickup }) {
  const mountRef = useRef(null);
  const [gameState, setGameState] = useState('start');
  const [health, setHealth] = useState(5);
  const [beacons, setBeacons] = useState([false, false, false, false]); // NW, NE, SW, SE
  const [victoryCakeSpawned, setVictoryCakeSpawned] = useState(false);
  const [flash, setFlash] = useState(0);
  const invulnRef = useRef(false);

  useEffect(() => {
    if (gameState !== 'play') return;

    const container = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffeefb);
    scene.fog = new THREE.Fog(0xffeefb, FOG_NEAR, FOG_FAR);

    const camera = new THREE.PerspectiveCamera(72, container.clientWidth/container.clientHeight, 0.1, 50);

    const candyTex = new THREE.CanvasTexture(genCandyBlock()); candyTex.magFilter = THREE.NearestFilter;
    const skyTex = new THREE.CanvasTexture(genSkyWall()); skyTex.magFilter = THREE.NearestFilter;
    const grassTex = new THREE.CanvasTexture(genGrass()); grassTex.magFilter = THREE.NearestFilter;
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(20, 20);

    const wallGeom = new THREE.BoxGeometry(1, WALL_H, 1);
    for(let z=0; z<mapHeight; z++) for(let x=0; x<mapWidth; x++) {
      if(worldMap[z][x] === 1 || worldMap[z][x] === 3) {
        const m = new THREE.Mesh(wallGeom, new THREE.MeshLambertMaterial({ map: worldMap[z][x]===1?candyTex:skyTex }));
        m.position.set(x+0.5, WALL_H/2, z+0.5); scene.add(m);
      }
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50,50), new THREE.MeshLambertMaterial({ map: grassTex }));
    floor.rotation.x = -Math.PI/2; scene.add(floor);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));

    // Harmony Stars
    const harmonyStars = [];
    const starConfigs = [
        { color: '#88aaff', glow: '#ade8ff', spot: { x: 2.5, z: 2.5 } }, // NW
        { color: '#ffff88', glow: '#ffff00', spot: { x: mapWidth-2.5, z: 2.5 } }, // NE
        { color: '#88ffaa', glow: '#b3f5bc', spot: { x: 2.5, z: mapHeight-2.5 } }, // SW
        { color: '#ff88ff', glow: '#ffccf2', spot: { x: mapWidth-2.5, z: mapHeight-2.5 } }, // SE
    ];
    starConfigs.forEach((c,i) => {
        const tex = new THREE.CanvasTexture(genHarmonyStar(c.color, c.glow));
        tex.magFilter = THREE.NearestFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.5, 1.5, 1);
        sprite.position.set(c.spot.x, EYE_H, c.spot.z);
        scene.add(sprite);
        harmonyStars.push({ sprite, ...c, id: i });
    });

    // Victory Cake & Confetti
    const victoryCakeTex = new THREE.CanvasTexture(genVictoryCake()); victoryCakeTex.magFilter = THREE.NearestFilter;
    let victoryCakeObj = null;
    const confettiParticles = [];
    const confettiTex = new THREE.CanvasTexture(genConfettiTex()); confettiTex.magFilter = THREE.NearestFilter;
    const confettiMat = new THREE.SpriteMaterial({ map: confettiTex, transparent: true });

    // Enemies
    const slimes = [];
    const frames = generateSlimeSpriteSheet('#ff66b2').map(c => {
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
    });
    enemySpawns.forEach(s => {
      const mat = new THREE.SpriteMaterial({ map: frames[0], transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.2, 1, 1); sprite.position.set(s.x, 0.5, s.y);
      scene.add(sprite); slimes.push({ sprite, x: s.x, z: s.y, frame: 0 });
    });

    const music = new MeadowMusic(); music.start();
    let px = 2.5, pz = 2.5, yaw = 0, bob = 0;
    const keys = {};

    const loop = () => {
      if (gameState !== 'play') return;
      if (keys['w']) { px += Math.cos(yaw+Math.PI/2)*MOVE_SPEED; pz -= Math.sin(yaw+Math.PI/2)*MOVE_SPEED; bob+=0.15; }
      if (keys['s']) { px -= Math.cos(yaw+Math.PI/2)*MOVE_SPEED; pz += Math.sin(yaw+Math.PI/2)*MOVE_SPEED; bob+=0.15; }
      if (keys['a']) yaw += ROT_SPEED; if (keys['d']) yaw -= ROT_SPEED;

      camera.position.set(px, EYE_H + Math.sin(bob)*0.03, pz); camera.rotation.y = yaw;

      // Harmony Star Collection
      harmonyStars.forEach(s => {
          if(!beacons[s.id]) {
              const dist = Math.sqrt((px - s.spot.x)**2 + (pz - s.spot.z)**2);
              if(dist < 1.0) {
                  scene.remove(s.sprite);
                  music.fanfare();
                  setFlash(0.3); setTimeout(() => setFlash(0), 100);
                  setBeacons(b => {
                      const nb = [...b]; nb[s.id] = true;
                      if(nb.every(v=>v)) {
                          setVictoryCakeSpawned(true);
                      }
                      return nb;
                  });
              }
              s.sprite.rotation.y += 0.05;
              s.sprite.position.y = EYE_H + Math.sin(Date.now()/300 + s.id)*0.1;
          }
      });

      // Spawn Victory Cake
      if(victoryCakeSpawned && !victoryCakeObj) {
          music.fanfare();
          const mat = new THREE.SpriteMaterial({ map: victoryCakeTex, transparent: true });
          victoryCakeObj = new THREE.Sprite(mat);
          victoryCakeObj.scale.set(6, 6, 1);
          victoryCakeObj.position.set(mapWidth/2, 3, mapHeight/2);
          scene.add(victoryCakeObj);
          // Spawn Confetti
          for(let i=0; i<100; i++) {
              const c = new THREE.Sprite(confettiMat);
              c.position.set(mapWidth/2 + (Math.random()-0.5)*10, 8 + Math.random()*5, mapHeight/2 + (Math.random()-0.5)*10);
              c.scale.set(0.1, 0.1, 1);
              scene.add(c);
              confettiParticles.push({ sprite: c, speed: 0.05 + Math.random()*0.05, rot: (Math.random()-0.5)*0.1 });
          }
          setTimeout(() => setFlash(0), 100); setFlash(0.6);
      }

      // Victory Check
      if(victoryCakeObj) {
          victoryCakeObj.rotation.y += 0.01;
          const dist = Math.sqrt((px - (mapWidth/2))**2 + (pz - (mapHeight/2))**2);
          if(dist < 1.5) setGameState('victory');
          confettiParticles.forEach(c => {
              c.sprite.position.y -= c.speed;
              c.sprite.rotation.z += c.rot;
              if(c.sprite.position.y < 0.2) { scene.remove(c.sprite); confettiParticles.splice(confettiParticles.indexOf(c), 1); }
          });
      }

      slimes.forEach(s => {
        s.frame = (s.frame + 1) % 12; s.sprite.material.map = frames[s.frame];
      });

      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    };

    window.addEventListener('keydown', e => keys[e.key] = true);
    window.addEventListener('keyup', e => keys[e.key] = false);
    loop();

    return () => { music.stop(); renderer.dispose(); };
  }, [gameState]);

  return (
    <div style={{ width:'100%', height:'100vh', position:'relative', background:'#ffeefb', overflow:'hidden', fontFamily:"'Comic Sans MS', cursive" }}>
      <div ref={mountRef} style={{ width:'100%', height:'100%' }} />
      {flash > 0 && <div style={{ position:'absolute', inset:0, background:`rgba(255,255,100,${flash})`, pointerEvents:'none' }} />}

      {/* Harmony HUD */}
      <div style={{ position:'absolute', top:20, left:20, display:'flex', gap:10, pointerEvents:'none', background:'rgba(255,255,255,0.5)', padding:10, borderRadius:15 }}>
        {['#88aaff', '#ffff88', '#88ffaa', '#ff88ff'].map((c, i) => (
          <div key={i} style={{ 
            fontSize: 32, textShadow:`0 0 10px ${c}`,
            opacity: beacons[i] ? 1 : 0.2, transition: 'opacity 0.5s'
          }}>⭐</div>
        ))}
      </div>

      {gameState === 'start' && (
        <div onClick={() => setGameState('play')} style={{ position:'absolute', inset:0, background:'rgba(255,255,255,0.85)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', zIndex:10 }}>
          <div style={{ fontSize:42, color:'#ff66b2', marginBottom:15 }}>✨ SPARKLE MEADOW ✨</div>
          <div style={{ fontSize:18, color:'#888' }}>Find the 4 Harmony Stars!</div>
        </div>
      )}

      {gameState === 'victory' && (
        <div style={{ position:'absolute', inset:0, background:'rgba(255,240,150,0.95)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10 }}>
          <div style={{ fontSize:36, color:'#ffcc00', textShadow:'0 4px 10px rgba(0,0,0,0.1)', marginBottom:20 }}>YOU ARE A JOY HARMONIZER!</div>
          <button onClick={() => window.location.reload()} style={{ padding:'12px 40px', fontSize:18, borderRadius:30, border:'none', background:'#fff', color:'#ffcc00', fontWeight:'bold', cursor:'pointer' }}>Play Again 🌸</button>
        </div>
      )}
    </div>
  );
}
