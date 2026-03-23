/**
 * Raycaster.jsx  ─  RETRO DOOM-STYLE SPRITE ENEMIES
 *
 * High-performance pixel art sprites that always face player
 * Canvas-generated horror sprites with multiple animation frames
 * 
 * Features:
 * - 8-frame walking animation per enemy type
 * - 4-frame attack animation
 * - Death animation frames
 * - Billboard sprites (always face camera)
 * - Pixel-perfect scaling for retro look
 * - Glow effects via point lights
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { worldMap, mapWidth, mapHeight, enemySpawns } from './gameMap';

// ─── Constants ─────────────────────────────────────────────────────────────
const WALL_H     = 2.6;
const EYE_H      = 1.05;
const MOVE_SPEED = 0.058;
const ROT_SPEED  = 0.033;
const MOUSE_SENS = 0.0019;
const FOG_NEAR   = 1;
const FOG_FAR    = 16;
const PICKUP_N   = 10;
const TEX        = 128;
const SPRITE_SIZE = 128;

const mc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };

// ═══════════════════════════════════════════════════════════════════════════
//  TEXTURE GENERATORS  (pixel-art, NearestFilter-ready)
// ═══════════════════════════════════════════════════════════════════════════

function genStone() {
  const c = mc(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Base grey
  ctx.fillStyle = '#2e2a26';
  ctx.fillRect(0, 0, TEX, TEX);

  // Irregular stone blocks
  const blocks = [
    [0,0,42,28],[42,0,42,28],[84,0,44,28],
    [0,28,54,30],[54,28,74,30],
    [0,58,38,28],[38,58,50,28],[88,58,40,28],
    [0,86,TEX,42],
  ];
  const shades = ['#3a3530','#332e2a','#3f3a34','#2a2622'];
  blocks.forEach(([x,y,w,h], i) => {
    ctx.fillStyle = shades[i % shades.length];
    ctx.fillRect(x+1, y+1, w-2, h-2);
    // mortar gap
    ctx.fillStyle = '#1a1714';
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
  });

  // Noise
  const id = ctx.getImageData(0,0,TEX,TEX); const d = id.data;
  for (let i=0;i<d.length;i+=4) { const n=(Math.random()-0.5)*22; d[i]+=n;d[i+1]+=n;d[i+2]+=n; }
  ctx.putImageData(id,0,0);
  return c;
}

function genBrick() {
  const c = mc(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#1a0a04';
  ctx.fillRect(0, 0, TEX, TEX);

  const brickH = 16, brickW = 32;
  const rows = Math.ceil(TEX / brickH);
  const brickShades = ['#6b1a0a','#5a1408','#721e0c','#601810'];

  for (let row=0; row<rows; row++) {
    const offset = (row % 2 === 0) ? 0 : brickW / 2;
    const cols = Math.ceil((TEX + brickW) / brickW);
    for (let col=0; col<cols; col++) {
      const bx = col * brickW - offset;
      const by = row * brickH;
      ctx.fillStyle = brickShades[(row*3+col) % brickShades.length];
      ctx.fillRect(bx+1, by+1, brickW-2, brickH-2);
    }
  }

  const id = ctx.getImageData(0,0,TEX,TEX); const d = id.data;
  for (let i=0;i<d.length;i+=4) { const n=(Math.random()-0.5)*18; d[i]+=n;d[i+1]+=n;d[i+2]+=n; }
  ctx.putImageData(id,0,0);
  return c;
}

function genWood() {
  const c = mc(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#2a1406';
  ctx.fillRect(0, 0, TEX, TEX);

  // Plank lines
  const plankW = 16;
  const planks = Math.ceil(TEX / plankW);
  const woodShades = ['#3a1e08','#32190a','#3e2008','#2e1806'];
  for (let i=0; i<planks; i++) {
    ctx.fillStyle = woodShades[i % woodShades.length];
    ctx.fillRect(i*plankW+1, 0, plankW-2, TEX);
  }

  // Grain lines
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let y=0; y<TEX; y+=4) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y*0.3)*2);
    ctx.lineTo(TEX, y + Math.sin(y*0.3+2)*2);
    ctx.stroke();
  }

  const id = ctx.getImageData(0,0,TEX,TEX); const d = id.data;
  for (let i=0;i<d.length;i+=4) { const n=(Math.random()-0.5)*14; d[i]+=n;d[i+1]*=0.98;d[i+2]*=0.95; }
  ctx.putImageData(id,0,0);
  return c;
}

function genFloor() {
  const c = mc(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#0e0c0a';
  ctx.fillRect(0, 0, TEX, TEX);

  // Flagstone grid
  const tileSize = 32;
  const tiles = TEX / tileSize;
  const tileShades = ['#181412','#141210','#1c1614','#120f0d'];
  for (let ty=0; ty<tiles; ty++) {
    for (let tx=0; tx<tiles; tx++) {
      ctx.fillStyle = tileShades[(ty*tiles+tx) % tileShades.length];
      ctx.fillRect(tx*tileSize+1, ty*tileSize+1, tileSize-2, tileSize-2);
    }
  }

  const id = ctx.getImageData(0,0,TEX,TEX); const d = id.data;
  for (let i=0;i<d.length;i+=4) { const n=(Math.random()-0.5)*12; d[i]+=n;d[i+1]+=n;d[i+2]+=n; }
  ctx.putImageData(id,0,0);
  return c;
}

function genCeiling() {
  const c = mc(TEX, TEX);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#070508';
  ctx.fillRect(0, 0, TEX, TEX);

  // Dark stone ceiling blocks
  const tileSize = 40;
  const tilesX = Math.ceil(TEX / tileSize);
  const tilesY = Math.ceil(TEX / tileSize);
  const shades = ['#0d0a10','#0a0810','#100c12','#08060e'];
  for (let ty=0; ty<tilesY; ty++) {
    const offset = (ty%2===0) ? 0 : tileSize/2;
    for (let tx=0; tx<tilesX+1; tx++) {
      ctx.fillStyle = shades[(ty*4+tx) % shades.length];
      ctx.fillRect(tx*tileSize-offset+1, ty*tileSize+1, tileSize-2, tileSize-2);
    }
  }

  const id = ctx.getImageData(0,0,TEX,TEX); const d = id.data;
  for (let i=0;i<d.length;i+=4) { const n=(Math.random()-0.5)*10; d[i]+=n;d[i+1]+=n;d[i+2]+=n; }
  ctx.putImageData(id,0,0);
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════
//  RETRO PIXEL ART ENEMY SPRITE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateEnemySpriteSheet(type = 'imp') {
  const frames = [];
  const isRed = type === 'stalker' || type === 'imp';
  const mainColor = isRed ? '#8B0000' : '#2F4F2F';
  const glowColor = isRed ? '#FF0000' : '#00FF44';
  
  for (let frame = 0; frame < 12; frame++) {
    const c = mc(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    
    const cx = SPRITE_SIZE / 2;
    const baseY = SPRITE_SIZE * 0.85;
    const walkBob = frame < 8 ? Math.sin(frame * Math.PI / 4) * 4 : 0;
    
    ctx.fillStyle = mainColor;
    for (let y = 0; y < 40; y++) {
      const width = 30 + Math.sin(y * 0.1) * 10;
      const x = cx - width/2;
      ctx.fillRect(x, baseY - 60 + y - walkBob, width, 1);
    }
    
    ctx.fillStyle = '#4A0000';
    for (let i = 0; i < 4; i++) {
      const ribY = baseY - 45 + i * 8 - walkBob;
      ctx.fillRect(cx - 20 + i * 2, ribY, 40 - i * 4, 3);
    }
    
    const headY = baseY - 75 + walkBob;
    ctx.fillStyle = '#3D0000';
    for (let y = 0; y < 25; y++) {
      const w = 20 - y * 0.3;
      ctx.fillRect(cx - w/2, headY + y, w, 1);
    }
    const jawOpen = frame >= 8 ? (frame - 8) * 0.3 : 0.1;
    ctx.fillStyle = '#2A0000';
    for (let y = 0; y < 15; y++) {
      const w = 16 + y * 0.2;
      ctx.fillRect(cx - w/2, headY + 20 + y + jawOpen * 10, w, 1);
    }
    
    const eyeGlow = frame >= 8 ? '#FFFFFF' : glowColor;
    ctx.fillStyle = eyeGlow;
    ctx.fillRect(cx - 8, headY + 8, 4, 4);
    ctx.fillRect(cx + 4, headY + 8, 4, 4);
    if (isRed) ctx.fillRect(cx - 2, headY + 2, 4, 3);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.fillRect(cx - 8, headY + 8, 4, 4);
    ctx.fillRect(cx + 4, headY + 8, 4, 4);
    ctx.shadowBlur = 0;
    
    const armSwing = frame < 8 ? Math.sin(frame * Math.PI / 2) * 15 :
                     frame === 8 ? -20 : frame === 9 ? -35 : frame === 10 ? -25 : -10;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.moveTo(cx - 15, baseY - 50 + walkBob);
    ctx.lineTo(cx - 25 + armSwing, baseY - 20 + walkBob);
    ctx.lineTo(cx - 20 + armSwing, baseY - 20 + walkBob);
    ctx.lineTo(cx - 12, baseY - 45 + walkBob);
    ctx.fill();
    const rightSwing = -armSwing;
    ctx.beginPath();
    ctx.moveTo(cx + 15, baseY - 50 + walkBob);
    ctx.lineTo(cx + 25 + rightSwing, baseY - 20 + walkBob);
    ctx.lineTo(cx + 20 + rightSwing, baseY - 20 + walkBob);
    ctx.lineTo(cx + 12, baseY - 45 + walkBob);
    ctx.fill();
    
    ctx.fillStyle = '#1A1A1A';
    const clawX = cx - 25 + armSwing;
    const clawY = baseY - 20 + walkBob;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(clawX + i * 3, clawY);
      ctx.lineTo(clawX + i * 3 - 2, clawY + 12 + (frame >= 8 ? 5 : 0));
      ctx.lineTo(clawX + i * 3 + 2, clawY + 12 + (frame >= 8 ? 5 : 0));
      ctx.fill();
    }
    const rClawX = cx + 25 + rightSwing;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(rClawX + i * 3, clawY);
      ctx.lineTo(rClawX + i * 3 - 2, clawY + 12 + (frame >= 8 ? 5 : 0));
      ctx.lineTo(rClawX + i * 3 + 2, clawY + 12 + (frame >= 8 ? 5 : 0));
      ctx.fill();
    }
    
    ctx.fillStyle = '#2A0000';
    const legOffset = frame < 8 ? Math.sin(frame * Math.PI / 2) * 8 : 0;
    ctx.fillRect(cx - 12 + legOffset, baseY - 15 + walkBob, 8, 15);
    ctx.fillRect(cx + 4 - legOffset, baseY - 15 + walkBob, 8, 15);
    
    if (isRed) {
      ctx.fillStyle = '#4A0000';
      ctx.beginPath(); ctx.moveTo(cx - 8, headY); ctx.lineTo(cx - 15, headY - 12); ctx.lineTo(cx - 5, headY - 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 8, headY); ctx.lineTo(cx + 15, headY - 12); ctx.lineTo(cx + 5, headY - 2); ctx.fill();
    }
    
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        const noise = (Math.random() - 0.5) * 20;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
    }
    ctx.putImageData(imageData, 0, 0);
    frames.push(c);
  }
  
  for (let frame = 0; frame < 4; frame++) {
    const c = mc(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const collapse = frame * 0.25;
    const cx = SPRITE_SIZE / 2;
    const baseY = SPRITE_SIZE * 0.85 + frame * 10;
    ctx.fillStyle = mainColor;
    for (let y = 0; y < 20 * (1 - collapse); y++) {
      const width = 40 * (1 - collapse * 0.5);
      ctx.fillRect(cx - width/2, baseY - 30 + y, width, 1);
    }
    ctx.fillStyle = '#000000';
    ctx.fillRect(cx - 8, baseY - 40, 6, 2); ctx.fillRect(cx - 8, baseY - 42, 2, 6);
    ctx.fillRect(cx + 2, baseY - 40, 6, 2); ctx.fillRect(cx + 2, baseY - 42, 2, 6);
    frames.push(c);
  }
  
  return frames;
}

function createSpriteEnemy(type = 'stalker') {
  const frames = generateEnemySpriteSheet(type);
  const textures = frames.map(canvas => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
  
  const material = new THREE.SpriteMaterial({
    map: textures[0],
    color: 0xffffff,
    sizeAttenuation: true,
    transparent: true,
    alphaTest: 0.5
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 1.5, 1);
  sprite.center.set(0.5, 0.5);
  
  const glowColor = type === 'stalker' ? 0xff0000 : 0x00ff44;
  const light = new THREE.PointLight(glowColor, 2, 4, 2);
  light.position.set(0, 0.8, 0);
  
  const group = new THREE.Group();
  group.add(sprite);
  group.add(light);
  
  group.userData = {
    type, sprite, material, textures, light,
    glowColor: new THREE.Color(glowColor),
    hp: type === 'stalker' ? 3 : 2,
    speed: type === 'stalker' ? 0.015 : 0.025,
    frame: 0, animTimer: 0, state: 'idle', lastAttack: 0, dead: false
  };
  
  return group;
}

class SpriteEnemyManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.enemies = [];
  }
  
  spawnEnemy(x, z, type = 'stalker') {
    const enemy = createSpriteEnemy(type);
    enemy.position.set(x, 0, z);
    this.scene.add(enemy);
    this.enemies.push({ mesh: enemy, x, z, hp: enemy.userData.hp, speed: enemy.userData.speed, type, state: 'idle', lastAttack: 0 });
    return enemy;
  }
  
  update(delta, time, playerPos) {
    this.enemies.forEach(enemy => {
      if (enemy.hp <= 0 || enemy.mesh.userData.dead) return;
      const data = enemy.mesh.userData;
      data.animTimer += delta;
      if (data.animTimer > 0.125) {
        data.animTimer = 0;
        data.frame = (data.frame + 1) % 8;
        data.material.map = data.textures[data.frame];
      }
      const dx = playerPos.x - enemy.x;
      const dz = playerPos.z - enemy.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist < 10 && dist > 1.2) {
        const moveX = (dx / dist) * data.speed;
        const moveZ = (dz / dist) * data.speed;
        if (this.canMove(enemy.x + moveX, enemy.z + moveZ)) {
          enemy.x += moveX; enemy.z += moveZ;
          enemy.mesh.position.set(enemy.x, 0, enemy.z);
          data.state = 'chase';
        }
      } else if (dist <= 1.2) {
        if (Date.now() - enemy.lastAttack > 2000) {
          data.frame = 8;
          data.material.map = data.textures[8];
          data.light.intensity = 5;
          setTimeout(() => data.light.intensity = 2, 200);
          const lungeX = (dx / dist) * 0.3;
          const lungeZ = (dz / dist) * 0.3;
          enemy.mesh.position.x += lungeX;
          enemy.mesh.position.z += lungeZ;
          enemy.lastAttack = Date.now();
          setTimeout(() => { if (!data.dead) data.frame = 0; }, 400);
        }
        data.state = 'attack';
      } else {
        data.state = 'idle';
        data.frame = 0;
        data.material.map = data.textures[0];
      }
      data.light.intensity = 2 + Math.sin(time * 4) * 0.5;
    });
  }
  
  canMove(x, z) {
    if (x < 0 || x >= mapWidth || z < 0 || z >= mapHeight) return false;
    const t = worldMap[Math.floor(z)]?.[Math.floor(x)];
    return t === 0;
  }
  
  takeDamage(enemy, damage) {
    enemy.hp -= damage;
    const data = enemy.mesh.userData;
    data.material.color.setHex(0xffffff);
    setTimeout(() => data.material.color.setHex(0xffffff), 100);
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }
  
  killEnemy(enemy) {
    const data = enemy.mesh.userData;
    data.dead = true;
    let deathFrame = 12;
    data.material.map = data.textures[deathFrame];
    const deathInterval = setInterval(() => {
      deathFrame++;
      if (deathFrame < 16) {
        data.material.map = data.textures[deathFrame];
        data.light.intensity *= 0.7;
      } else {
        clearInterval(deathInterval);
        this.removeEnemy(enemy);
      }
    }, 150);
  }
  
  removeEnemy(enemy) {
    this.scene.remove(enemy.mesh);
    const idx = this.enemies.indexOf(enemy);
    if (idx > -1) this.enemies.splice(idx, 1);
  }
  
  checkHit(origin, direction, maxDist = 7) {
    let hit = null, bestDist = maxDist;
    this.enemies.forEach(enemy => {
      if (enemy.hp <= 0 || enemy.mesh.userData.dead) return;
      const dx = enemy.x - origin.x;
      const dz = enemy.z - origin.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > maxDist) return;
      const dot = (dx/dist)*direction.x + (dz/dist)*direction.z;
      if (dot > 0.85 && dist < bestDist) { bestDist = dist; hit = enemy; }
    });
    return hit;
  }
  
  dispose() {
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCARY MUSIC
// ═══════════════════════════════════════════════════════════════════════════
class ScaryMusic {
  constructor() { this.ctx=null; this.master=null; this.nodes=[]; this.timers=[]; this.alive=false; }
  start() {
    if(this.alive) return;
    try {
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination);
      this.alive = true;
      this._drone(); this._heartbeat(); this._wind(); this._stabs(); this._descent();
    } catch(e) { console.warn('Audio failed',e); }
  }
  _drone() {
    [[55,'sawtooth',.13],[55.4,'sawtooth',.09],[82.4,'sine',.065],[110,'triangle',.048],[146.8,'sine',.038]].forEach(([freq,type,vol],i)=>{
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(),lpf=this.ctx.createBiquadFilter();
      o.type=type; o.frequency.value=freq; lpf.type='lowpass'; lpf.frequency.value=320+i*70; lpf.Q.value=1.4; g.gain.value=vol;
      const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain(); lfo.frequency.value=0.07+i*.055; lg.gain.value=vol*.25; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(lpf); lpf.connect(g); g.connect(this.master); o.start(); this.nodes.push(o,lfo);
    });
  }
  _heartbeat() {
    const b=()=>{
      if(!this.alive) return; const now=this.ctx.currentTime;
      [[0,64,28,.3],[0.27,54,24,.2]].forEach(([delay,f1,f2,vol])=>{
        const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sine';
        o.frequency.setValueAtTime(f1,now+delay); o.frequency.exponentialRampToValueAtTime(f2,now+delay+.2);
        g.gain.setValueAtTime(vol,now+delay); g.gain.exponentialRampToValueAtTime(.001,now+delay+.32);
        o.connect(g); g.connect(this.master); o.start(now+delay); o.stop(now+delay+.45);
      });
      this.timers.push(setTimeout(b,1300+Math.random()*280));
    };
    this.timers.push(setTimeout(b,700));
  }
  _wind() {
    const sr=this.ctx.sampleRate,buf=this.ctx.createBuffer(1,sr*3,sr),d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const bp=this.ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=580; bp.Q.value=0.38;
    const g=this.ctx.createGain(); g.gain.value=0.035;
    const lfo=this.ctx.createOscillator(),lg=this.ctx.createGain(); lfo.frequency.value=0.038; lg.gain.value=0.024; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start(); this.nodes.push(src,lfo);
  }
  _stabs() {
    const s=()=>{
      if(!this.alive) return; const now=this.ctx.currentTime;
      [196,233.1,277.2,311.1,370].slice(0,2+(Math.random()*3|0)).forEach(freq=>{
        const o=this.ctx.createOscillator(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();
        o.type='sawtooth'; o.frequency.value=freq*(Math.random()<.22?.5:1); f.type='lowpass'; f.frequency.value=1000;
        g.gain.setValueAtTime(.001,now); g.gain.linearRampToValueAtTime(.1,now+.1); g.gain.exponentialRampToValueAtTime(.001,now+2.6);
        o.connect(f); f.connect(g); g.connect(this.master); o.start(now); o.stop(now+3);
      });
      this.timers.push(setTimeout(s,5000+Math.random()*8500));
    };
    this.timers.push(setTimeout(s,3500+Math.random()*3500));
  }
  _descent() {
    const notes=[220,207.7,196,185,174.6,164.8,155.6,146.8,138.6,130.8,123.5,116.5,110]; let idx=0;
    const p=()=>{
      if(!this.alive) return; const now=this.ctx.currentTime,freq=notes[idx++%notes.length];
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();
      o.type='triangle'; o.frequency.value=freq; f.type='bandpass'; f.frequency.value=freq*1.5; f.Q.value=2.8;
      g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(.05,now+.45); g.gain.setValueAtTime(.05,now+1.1); g.gain.exponentialRampToValueAtTime(.001,now+3);
      o.connect(f); f.connect(g); g.connect(this.master); o.start(now); o.stop(now+3.5);
      this.timers.push(setTimeout(p,2200+Math.random()*1600));
    };
    this.timers.push(setTimeout(p,2400));
  }
  fireBlast() {
    if(!this.ctx) return; const now=this.ctx.currentTime;
    [[750,155,0,.2],[185,38,.11,.17]].forEach(([f1,f2,delay,vol])=>{
      const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sawtooth';
      o.frequency.setValueAtTime(f1,now+delay); o.frequency.exponentialRampToValueAtTime(f2,now+delay+.16);
      g.gain.setValueAtTime(vol,now+delay); g.gain.exponentialRampToValueAtTime(.001,now+delay+.26);
      o.connect(g); g.connect(this.master); o.start(now+delay); o.stop(now+delay+.32);
    });
    const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='sine'; o.frequency.value=435;
    g.gain.setValueAtTime(.07,now+.04); g.gain.exponentialRampToValueAtTime(.001,now+.45);
    o.connect(g); g.connect(this.master); o.start(now+.04); o.stop(now+.55);
  }
  stop() {
    this.alive=false; this.timers.forEach(clearTimeout);
    this.nodes.forEach(n=>{try{n.stop();}catch(_){}});
    if(this.ctx) this.ctx.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Raycaster({ onEncounter, onPickup }) {
  const mountRef    = useRef(null);
  const minimapRef  = useRef(null);
  const [hint, setHint] = useState('click_to_start');
  const [flash, setFlash] = useState(0);

  const onEncounterRef = useRef(onEncounter);
  const onPickupRef    = useRef(onPickup);
  useEffect(() => { onEncounterRef.current = onEncounter; }, [onEncounter]);
  useEffect(() => { onPickupRef.current    = onPickup;    }, [onPickup]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth, H = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled  = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050208, FOG_NEAR, FOG_FAR);
    scene.background = new THREE.Color(0x050208);

    const camera = new THREE.PerspectiveCamera(72, W / H, 0.05, 50);

    const toTex = (canvas, rx=1, ry=1) => {
      const t = new THREE.CanvasTexture(canvas);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
      return t;
    };
    const stoneTex  = toTex(genStone());
    const brickTex  = toTex(genBrick());
    const woodTex   = toTex(genWood());
    const floorTex  = toTex(genFloor(), mapWidth/2, mapHeight/2);
    const ceilTex   = toTex(genCeiling(), mapWidth/2, mapHeight/2);

    const makeMat = (tex) => new THREE.MeshLambertMaterial({ map: tex });
    const mats = { 1: makeMat(stoneTex), 3: makeMat(brickTex), 4: makeMat(woodTex) };

    scene.add(new THREE.AmbientLight(0x180a08, 0.8));

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshLambertMaterial({ map: floorTex })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(mapWidth / 2, 0, mapHeight / 2);
    scene.add(floorMesh);

    const ceilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshLambertMaterial({ map: ceilTex })
    );
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(mapWidth / 2, WALL_H, mapHeight / 2);
    scene.add(ceilMesh);

    const wallGeom = new THREE.BoxGeometry(1, WALL_H, 1);
    for (let x = 0; x < mapWidth; x++) {
      for (let z = 0; z < mapHeight; z++) {
        const t = worldMap[z][x];
        if (!t || t === 2) continue;
        const m = new THREE.Mesh(wallGeom, mats[t] || mats[1]);
        m.position.set(x + 0.5, WALL_H / 2, z + 0.5);
        scene.add(m);
      }
    }

    const fixedTorches = [];
    for (let x = 1; x < mapWidth - 1; x++) {
      for (let z = 1; z < mapHeight - 1; z++) {
        if (worldMap[z][x] !== 0) continue;
        const adj = [worldMap[z+1]?.[x], worldMap[z-1]?.[x], worldMap[z]?.[x+1], worldMap[z]?.[x-1]];
        if (adj.some(v => v && v !== 2) && Math.random() < 0.12) {
          const l = new THREE.PointLight(0xff6010, 1.8, 7, 2);
          l.position.set(x + 0.5, WALL_H * 0.72, z + 0.5);
          scene.add(l);
          const flame = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xff8820 })
          );
          flame.position.copy(l.position);
          scene.add(flame);
          fixedTorches.push({ light: l, base: l.intensity, flame });
        }
      }
    }

    const playerLight = new THREE.PointLight(0xff7820, 3.0, 10, 2);
    playerLight.position.set(0, 0, 0);
    scene.add(playerLight);

    const enemyManager = new SpriteEnemyManager(scene, camera);
    enemySpawns.forEach(spawn => {
      if (worldMap[spawn.y][spawn.x] === 0 || worldMap[spawn.y][spawn.x] === 2) {
        const type = spawn.type === 'runner' ? 'runner' : 'stalker';
        enemyManager.spawnEnemy(spawn.x + 0.5, spawn.y + 0.5, type);
        worldMap[spawn.y][spawn.x] = 0;
      }
    });
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (worldMap[y][x] === 2) {
          const type = Math.random() < 0.6 ? 'stalker' : 'runner';
          enemyManager.spawnEnemy(x + 0.5, y + 0.5, type);
          worldMap[y][x] = 0;
        }
      }
    }

    const open = [];
    for (let y = 2; y < mapHeight - 2; y++)
      for (let x = 2; x < mapWidth - 2; x++)
        if (worldMap[y][x] === 0) open.push({ x: x + 0.5, z: y + 0.5 });
    open.sort(() => Math.random() - 0.5);

    const pickups = [];
    for (let i = 0; i < Math.min(PICKUP_N, open.length); i++) {
      const isCoin = i % 3 !== 0;
      const col = isCoin ? 0xffd020 : 0x20dd55;
      const geom = isCoin
        ? new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8)
        : new THREE.SphereGeometry(0.14, 8, 8);
      const mat  = new THREE.MeshBasicMaterial({ color: col });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(open[i].x, 0.28, open[i].z);
      scene.add(mesh);
      const pLight = new THREE.PointLight(col, 0.8, 3, 2);
      pLight.position.copy(mesh.position);
      scene.add(pLight);
      pickups.push({ x: open[i].x, z: open[i].z, type: isCoin ? 'coin' : 'potion', mesh, light: pLight, collected: false, phase: Math.random() * Math.PI * 2 });
    }

    const weaponScene  = new THREE.Scene();
    const weaponCamera = new THREE.PerspectiveCamera(62, W / H, 0.01, 10);
    weaponScene.add(new THREE.AmbientLight(0x705030, 1.1));
    const weaponPointLight = new THREE.PointLight(0x4060ff, 1.5, 3);
    weaponPointLight.position.set(0, 0.3, -0.3);
    weaponScene.add(weaponPointLight);

    const wGroup = new THREE.Group();
    const handleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.036, 0.65, 8),
      new THREE.MeshLambertMaterial({ color: 0x1e0c04 })
    );
    handleMesh.rotation.z = 0.18;
    wGroup.add(handleMesh);
    const orbMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x3050ee })
    );
    orbMesh.position.set(0, 0.36, 0); wGroup.add(orbMesh);
    wGroup.position.set(0.28, -0.34, -0.52);
    weaponScene.add(wGroup);

    let px = 2.5, pz = 2.5, yaw = 0;
    camera.position.set(px, EYE_H, pz);
    const keys = {};
    let fireFlashVal = 0;
    let bobPhase = 0;
    let torchFlicker = 1;
    let frameCount = 0;

    const music = new ScaryMusic();
    const canvas = renderer.domElement;
    canvas.addEventListener('click', () => { canvas.requestPointerLock(); music.start(); setHint('playing'); });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas) setHint('click_to_start');
    });
    window.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas) return;
      yaw -= e.movementX * MOUSE_SENS;
    });

    const onKD = e => {
      keys[e.key] = true;
      if ((e.key === ' ' || e.code === 'Space') && fireFlashVal <= 0) {
        e.preventDefault();
        fireFlashVal = 1.0;
        music.fireBlast();
        const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
        const hit = enemyManager.checkHit({ x: px, z: pz }, { x: forward.x, z: forward.z });
        if (hit) {
          enemyManager.takeDamage(hit, 1);
          if (hit.hp <= 1) setTimeout(() => onEncounterRef.current(), 320);
        }
      }
    };
    const onKU = e => { keys[e.key] = false; };
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);

    const canWalk = (x, z) => {
      if (x < 0 || x >= mapWidth || z < 0 || z >= mapHeight) return false;
      const t = worldMap[Math.floor(z)]?.[Math.floor(x)];
      return t === 0;
    };

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const drawMinimap = () => {
      const mc2 = minimapRef.current; if (!mc2) return;
      const mctx = mc2.getContext('2d'); if (!mctx) return;
      const ts = 4, mW = mapWidth*ts, mH = mapHeight*ts;
      mc2.width = mW; mc2.height = mH;
      mctx.fillStyle='rgba(4,3,2,0.88)'; mctx.fillRect(0,0,mW,mH);
      for(let y=0;y<mapHeight;y++)for(let x=0;x<mapWidth;x++){const t=worldMap[y][x];mctx.fillStyle=t===1?'#4a3a24':t===3?'#5a2818':t===4?'#3a2210':'#14110d';mctx.fillRect(x*ts,y*ts,ts,ts);}
      pickups.forEach(p=>{if(p.collected)return;mctx.fillStyle=p.type==='coin'?'#c8a020':'#20c050';mctx.beginPath();mctx.arc(p.x*ts,p.z*ts,2,0,Math.PI*2);mctx.fill();});
      enemyManager.enemies.forEach(e=>{
        if(e.hp<=0)return;
        mctx.fillStyle=e.type==='stalker'?'rgba(220,40,20,0.9)':'rgba(40,220,60,0.9)';
        mctx.beginPath();mctx.arc(e.x*ts,e.z*ts,3,0,Math.PI*2);mctx.fill();
      });
      const ppx=px*ts, ppz=pz*ts;
      const fw=new THREE.Vector3(); camera.getWorldDirection(fw);
      mctx.fillStyle='#e8d070'; mctx.beginPath(); mctx.arc(ppx,ppz,3,0,Math.PI*2); mctx.fill();
      mctx.strokeStyle='#e8d070'; mctx.lineWidth=1.5;
      mctx.beginPath(); mctx.moveTo(ppx,ppz); mctx.lineTo(ppx+fw.x*10,ppz+fw.z*10); mctx.stroke();
    };

    let rafId;
    const clock = new THREE.Clock();
    
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      frameCount++;

      const playerPos = { x: px, z: pz };
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward);

      const sprint = keys['Shift'] ? 1.65 : 1;
      const ms = MOVE_SPEED * sprint;
      const fw = new THREE.Vector3(); camera.getWorldDirection(fw); fw.y = 0; fw.normalize();
      const right = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0,1,0)).normalize();
      let moving = false;

      const tryMove = (dx, dz) => {
        const M = 0.3;
        if (canWalk(px+dx+Math.sign(dx)*M, pz) && canWalk(px+dx-Math.sign(dx)*M, pz)) { px += dx; moving = true; }
        if (canWalk(px, pz+dz+Math.sign(dz)*M) && canWalk(px, pz+dz-Math.sign(dz)*M)) { pz += dz; moving = true; }
      };

      if (keys['w'] || keys['ArrowUp'])    tryMove( fw.x*ms,  fw.z*ms);
      if (keys['s'] || keys['ArrowDown'])  tryMove(-fw.x*ms, -fw.z*ms);
      if (keys['a'])                        tryMove(-right.x*ms, -right.z*ms);
      if (keys['d'])                        tryMove( right.x*ms,  right.z*ms);
      if (keys['ArrowLeft'])               { yaw += ROT_SPEED; }
      if (keys['ArrowRight'])              { yaw -= ROT_SPEED; }

      enemyManager.enemies.forEach(enemy => {
        if (enemy.hp <= 0 || enemy.mesh.userData.dead) return;
        const dx = px - enemy.x, dz = pz - enemy.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < 0.8) { enemyManager.takeDamage(enemy, 999); onEncounterRef.current(); }
      });

      pickups.forEach(pu => {
        if (pu.collected) return;
        const dx=px-pu.x, dz=pz-pu.z;
        if (dx*dx+dz*dz < 0.35) {
          pu.collected = true; pu.mesh.visible = false; pu.light.visible = false;
          setFlash(0.5); setTimeout(() => setFlash(0), 400);
          onPickupRef.current?.(pu.type==='coin'?'gold':'health', pu.type==='coin'?15:20);
        }
      });

      camera.position.set(px, EYE_H + (moving ? Math.sin(bobPhase*8)*0.04 : 0), pz);
      camera.rotation.order = 'YXZ'; camera.rotation.y = yaw; camera.rotation.x = 0;
      if (moving) bobPhase += sprint > 1 ? 0.1 : 0.065;

      torchFlicker += (Math.random()-0.5)*0.035;
      torchFlicker = Math.max(0.82, Math.min(1.0, torchFlicker));
      playerLight.position.copy(camera.position).add(new THREE.Vector3(fw.x*0.5, 0.1, fw.z*0.5));
      playerLight.intensity = 3.0 * torchFlicker;

      fixedTorches.forEach(t => {
        t.light.intensity = t.base * (0.88 + Math.random()*0.24);
        t.flame.material.color.setHSL(0.06+Math.random()*0.04, 1, 0.5+Math.random()*0.2);
      });

      enemyManager.update(delta, time, playerPos);

      pickups.forEach(pu => {
        if (pu.collected) return;
        pu.mesh.position.y = 0.28 + Math.sin(frameCount*0.045 + pu.phase)*0.1;
        pu.mesh.rotation.y += 0.025;
      });

      if (fireFlashVal > 0) {
        fireFlashVal = Math.max(0, fireFlashVal - 0.05);
        orbMesh.material.color.setHex(0x88aaff);
        weaponPointLight.intensity = 1.5 + fireFlashVal * 6;
        if (fireFlashVal > 0.55) setFlash(fireFlashVal * 0.5);
        else setFlash(0);
      } else {
        orbMesh.material.color.setHex(0x3050ee);
        weaponPointLight.intensity = 1.5;
      }

      const sway = Math.sin(frameCount*0.025)*0.04;
      const walkSway = moving ? Math.sin(bobPhase*8)*0.018 : 0;
      wGroup.rotation.z = 0.18 + sway;
      wGroup.rotation.x = walkSway;
      wGroup.position.y = -0.34 + (moving ? Math.sin(bobPhase*8)*0.025 : 0);

      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.autoClear = false; renderer.clearDepth();
      renderer.render(weaponScene, weaponCamera);
      renderer.autoClear = true;

      if (frameCount % 4 === 0) drawMinimap();
    };

    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKD);
      window.removeEventListener('keyup', onKU);
      window.removeEventListener('resize', onResize);
      music.stop();
      enemyManager.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', background:'#050208', overflow:'hidden' }}>
      <div ref={mountRef} style={{ width:'100%', height:'100%', imageRendering:'pixelated' }} />
      
      {flash > 0 && (
        <div style={{ position:'absolute', inset:0, background:`rgba(80,110,255,${flash})`, pointerEvents:'none', transition:'opacity 0.1s' }} />
      )}
      
      <canvas ref={minimapRef} style={{ position:'absolute', top:12, right:12, border:'1px solid #3a2a14', outline:'1px solid #5a4020', imageRendering:'pixelated', opacity:0.9 }} />
      
      <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', fontFamily:"'Cinzel',serif", fontSize:10, color:'#7a5828', letterSpacing:6, background:'rgba(4,3,2,0.7)', padding:'4px 14px', border:'1px solid #2a1e0e', borderRadius:2 }}>
        SHADOW KEEP
      </div>
      
      {hint === 'click_to_start' && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(3,2,6,0.55)', pointerEvents:'none' }}>
          <div style={{ fontFamily:"'Cinzel',serif", color:'#c8a96e', fontSize:13, letterSpacing:4, marginBottom:10, textShadow:'0 0 20px #c8a96e88' }}>CLICK TO ENTER THE DUNGEON</div>
          <div style={{ fontFamily:"'Crimson Text',serif", color:'#5a4020', fontSize:12, letterSpacing:2 }}>mouse look · music · full controls</div>
        </div>
      )}
      
      <div style={{ position:'absolute', bottom:14, left:14, fontFamily:"'Crimson Text',serif", fontSize:11, color:'rgba(130,90,40,0.55)', lineHeight:1.9, letterSpacing:0.5, pointerEvents:'none' }}>
        <div>W A S D · move &amp; strafe</div>
        <div>← → · turn &nbsp;|&nbsp; Shift · sprint</div>
        <div>SPACE · cast wand</div>
      </div>
    </div>
  );
}
