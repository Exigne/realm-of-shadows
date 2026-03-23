/**
 * Raycaster.jsx  ─  now with procedural 3D TERRIFYING enemies
 *
 * NO EXTERNAL MODELS REQUIRED
 * Generates organic, pulsating horror creatures procedurally
 * 
 * Features:
 * - Procedural demon geometry with animated vertices
 * - Pulsating flesh shaders
 * - Twitching limb animations
 * - Dynamic silhouette that responds to light
 *
 * Install:  npm install three
 *
 * Controls:
 *   W / S          – move forward / back
 *   A / D          – strafe left / right
 *   ← →            – turn
 *   Shift          – sprint
 *   SPACE          – cast wand (fires at aimed enemy)
 *   Click canvas   – lock pointer for mouse look
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { worldMap, mapWidth, mapHeight } from './gameMap';

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

// ─── Canvas helper ─────────────────────────────────────────────────────────
const mc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };

// ═══════════════════════════════════════════════════════════════════════════
//  WALL TEXTURES (unchanged)
// ═══════════════════════════════════════════════════════════════════════════
function genStone() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle = '#5a5550'; ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < TEX*TEX/4; i++) { const v=(Math.random()*30-15)|0; ctx.fillStyle=`rgb(${90+v},${86+v},${82+v})`; ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2); }
  const bW=32,bH=18; ctx.strokeStyle='#201a14'; ctx.lineWidth=2;
  for (let row=0;row*bH<TEX;row++) { const off=(row%2)*(bW/2); for (let col=-1;col*bW<TEX+bW;col++) { const bx=col*bW+off,by=row*bH,v=(Math.random()*14-7)|0; ctx.fillStyle=`rgb(${82+v},${78+v},${74+v})`; ctx.fillRect(bx+2,by+2,bW-3,bH-3); ctx.strokeRect(bx+1,by+1,bW-2,bH-2); if(Math.random()<0.3){ctx.save();ctx.strokeStyle='#14100c';ctx.lineWidth=1;ctx.beginPath();const sx=bx+4+Math.random()*(bW-8),sy=by+4+Math.random()*(bH-8);ctx.moveTo(sx,sy);ctx.lineTo(sx+(Math.random()-0.5)*14,sy+(Math.random()-0.5)*10);ctx.stroke();ctx.restore();} } }
  for (let i=0;i<5;i++) { const mx=Math.random()*TEX,my=Math.random()*TEX,gr=ctx.createRadialGradient(mx,my,0,mx,my,12); gr.addColorStop(0,'rgba(35,65,22,0.5)'); gr.addColorStop(1,'rgba(35,65,22,0)'); ctx.fillStyle=gr; ctx.fillRect(mx-12,my-12,24,24); }
  for (let i=0;i<3;i++) { ctx.fillStyle='rgba(10,8,20,0.28)'; ctx.fillRect((Math.random()*TEX)|0,0,2,TEX); }
  return c;
}

function genBrick() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#4a2014'; ctx.fillRect(0,0,TEX,TEX);
  for(let i=0;i<TEX*TEX/6;i++){const v=(Math.random()*20-10)|0;ctx.fillStyle=`rgba(${105+v},${40+v},${18+v},0.6)`;ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2);}
  const bW=28,bH=13;
  for(let row=0;row*bH<TEX;row++){const off=(row%2)*(bW/2);for(let col=-1;col*bW<TEX+bW;col++){const bx=col*bW+off,by=row*bH,v=(Math.random()*18-9)|0;ctx.fillStyle=`rgb(${130+v},${48+v},${24+v})`;ctx.fillRect(bx+2,by+2,bW-3,bH-3);}}
  ctx.fillStyle='#1e1008';
  for(let row=0;row*bH<TEX;row++){ctx.fillRect(0,row*bH,TEX,2);const off=(row%2)*(bW/2);for(let col=-1;col*bW<TEX+bW;col++)ctx.fillRect(col*bW+off,row*bH,2,bH);}
  for(let i=0;i<3;i++){const sx=Math.random()*TEX,sy=Math.random()*TEX,gr=ctx.createRadialGradient(sx,sy,0,sx,sy,20);gr.addColorStop(0,'rgba(0,0,0,0.45)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(sx-20,sy-20,40,40);}
  return c;
}

function genWood() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#201004'; ctx.fillRect(0,0,TEX,TEX);
  const pW=20;
  for(let col=0;col*pW<TEX;col++){const v=(Math.random()*16)|0;ctx.fillStyle=`rgb(${48+v},${22+v},${7+v/2})`;ctx.fillRect(col*pW+1,0,pW-1,TEX);ctx.strokeStyle='rgba(0,0,0,0.22)';ctx.lineWidth=1;for(let g=0;g<8;g++){const gx=col*pW+2+Math.random()*(pW-4);ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx+(Math.random()-0.5)*4,TEX);ctx.stroke();}}
  ctx.fillStyle='#0e0602'; for(let col=1;col*pW<TEX;col++) ctx.fillRect(col*pW,0,2,TEX);
  for(let i=0;i<4;i++){ctx.fillStyle='#140800';ctx.fillRect(0,(TEX/4)*i,TEX,3);}
  for(let i=0;i<3;i++)for(let col=0;col*pW<TEX;col++){const rx=col*pW+pW/2,ry=(TEX/4)*i+TEX/8,rg=ctx.createRadialGradient(rx-1,ry-1,0,rx,ry,4);rg.addColorStop(0,'#686058');rg.addColorStop(1,'#201810');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(rx,ry,3.5,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#120a02'; ctx.fillRect(TEX*.45,TEX*.2,TEX*.1,TEX*.35);
  const tg=ctx.createRadialGradient(TEX*.5,TEX*.18,0,TEX*.5,TEX*.25,20);tg.addColorStop(0,'rgba(255,150,18,0.55)');tg.addColorStop(1,'rgba(255,90,0,0)');ctx.fillStyle=tg;ctx.fillRect(TEX*.28,TEX*.04,TEX*.44,TEX*.42);
  return c;
}

function genFloor() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#1c1810'; ctx.fillRect(0,0,TEX,TEX);
  for(let i=0;i<TEX*TEX/3;i++){const v=(Math.random()*18-9)|0;ctx.fillStyle=`rgb(${40+v},${36+v},${32+v})`;ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2);}
  ctx.strokeStyle='#0e0c08'; ctx.lineWidth=1;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(Math.random()*TEX,Math.random()*TEX);ctx.lineTo(Math.random()*TEX,Math.random()*TEX);ctx.stroke();}
  return c;
}

function genCeiling() {
  const c = mc(TEX), ctx = c.getContext('2d');
  ctx.fillStyle='#0a0810'; ctx.fillRect(0,0,TEX,TEX);
  for(let i=0;i<TEX*TEX/5;i++){const v=(Math.random()*12-6)|0;ctx.fillStyle=`rgb(${20+v},${18+v},${24+v})`;ctx.fillRect((Math.random()*TEX)|0,(Math.random()*TEX)|0,2,2);}
  return c;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROCEDURAL TERRIFYING ENEMIES
// ═══════════════════════════════════════════════════════════════════════════

// Shader for pulsating flesh effect
const fleshVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uPulse;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Pulsating flesh - vertices breathe
    vec3 newPos = position + normal * sin(uTime * 2.0 + position.y * 3.0) * uPulse * 0.1;
    
    // Occasional twitch
    float twitch = step(0.97, sin(uTime * 10.0)) * sin(uTime * 30.0) * 0.05;
    newPos.x += twitch * (position.y - 1.0);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

const fleshFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  
  void main() {
    // Base flesh color with noise-like variation
    float noise = sin(vPosition.x * 10.0) * sin(vPosition.y * 10.0) * sin(vPosition.z * 10.0);
    vec3 baseColor = uColor + noise * 0.1;
    
    // Veins pulsing
    float vein = sin(vPosition.y * 8.0 - uTime * 3.0) * 0.5 + 0.5;
    vein = pow(vein, 4.0) * 0.3;
    baseColor += uGlowColor * vein;
    
    // Rim lighting for scary silhouette
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    rim = pow(rim, 3.0);
    
    // Pulsating glow from within
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    vec3 glow = uGlowColor * pulse * uGlowIntensity * rim;
    
    // Final scary flesh
    gl_FragColor = vec4(baseColor + glow, 1.0);
  }
`;

// Create a terrifying procedural demon
function createProceduralDemon(type = 'stalker') {
  const group = new THREE.Group();
  
  // Materials
  const isStalker = type === 'stalker';
  const mainColor = isStalker ? new THREE.Color(0x2a0a0a) : new THREE.Color(0x1a2a1a);
  const glowColor = isStalker ? new THREE.Color(0xff1100) : new THREE.Color(0x44ff22);
  
  const fleshMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0.5 },
      uColor: { value: mainColor },
      uGlowColor: { value: glowColor },
      uGlowIntensity: { value: 1.5 }
    },
    vertexShader: fleshVertexShader,
    fragmentShader: fleshFragmentShader,
    side: THREE.DoubleSide
  });
  
  // 1. DISTORTED TORSO (elongated, hunched)
  const torsoGeom = new THREE.CylinderGeometry(0.3, 0.5, 1.8, 8, 4);
  // Distort vertices for hunched back
  const posAttribute = torsoGeom.attributes.position;
  for (let i = 0; i < posAttribute.count; i++) {
    const y = posAttribute.getY(i);
    const x = posAttribute.getX(i);
    if (y > 0) {
      posAttribute.setX(i, x * 0.7); // Narrow shoulders
      posAttribute.setZ(i, posAttribute.getZ(i) - y * 0.3); // Hunch forward
    }
  }
  torsoGeom.computeVertexNormals();
  const torso = new THREE.Mesh(torsoGeom, fleshMaterial.clone());
  torso.position.y = 1.4;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);
  
  // 2. RIBCAGE (exposed ribs - terrifying detail)
  const ribGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const ribGeom = new THREE.TorusGeometry(0.35 - i * 0.04, 0.03, 4, 8, Math.PI);
    const rib = new THREE.Mesh(ribGeom, fleshMaterial.clone());
    rib.position.y = 1.8 - i * 0.25;
    rib.rotation.x = Math.PI / 2;
    rib.rotation.z = 0.2;
    ribGroup.add(rib);
  }
  group.add(ribGroup);
  
  // 3. HEAD (distorted, no face - just darkness)
  const headGeom = new THREE.SphereGeometry(0.35, 12, 12);
  // Elongate head
  headGeom.scale(0.8, 1.3, 0.9);
  const head = new THREE.Mesh(headGeom, fleshMaterial.clone());
  head.position.set(0, 2.6, 0.2);
  head.castShadow = true;
  
  // Glowing eyes (deep in sockets)
  const eyeGeom = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: glowColor });
  const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
  leftEye.position.set(-0.12, 2.65, 0.25);
  const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
  rightEye.position.set(0.12, 2.65, 0.25);
  group.add(leftEye, rightEye);
  group.add(head);
  
  // 4. ELONGATED ARMS (reach for player)
  const armLength = isStalker ? 2.2 : 1.6;
  const armGeom = new THREE.CylinderGeometry(0.08, 0.12, armLength, 6);
  armGeom.translate(0, -armLength/2, 0); // Pivot at shoulder
  
  const leftArm = new THREE.Mesh(armGeom, fleshMaterial.clone());
  leftArm.position.set(-0.5, 2.0, 0);
  leftArm.rotation.z = 0.3;
  leftArm.rotation.x = 0.4;
  
  const rightArm = new THREE.Mesh(armGeom, fleshMaterial.clone());
  rightArm.position.set(0.5, 2.0, 0);
  rightArm.rotation.z = -0.3;
  rightArm.rotation.x = 0.4;
  
  // Claws
  const clawGeom = new THREE.ConeGeometry(0.04, 0.3, 4);
  for (let i = 0; i < 3; i++) {
    const clawL = new THREE.Mesh(clawGeom, fleshMaterial.clone());
    clawL.position.set(-0.5 + i * 0.05, -armLength, 0.1);
    clawL.rotation.x = -0.5;
    leftArm.add(clawL);
    
    const clawR = new THREE.Mesh(clawGeom, fleshMaterial.clone());
    clawR.position.set(0.5 - i * 0.05, -armLength, 0.1);
    clawR.rotation.x = -0.5;
    rightArm.add(clawR);
  }
  
  group.add(leftArm, rightArm);
  
  // 5. SPINDLY LEGS
  const legGeom = new THREE.CylinderGeometry(0.1, 0.06, 1.4, 6);
  legGeom.translate(0, -0.7, 0);
  
  const leftLeg = new THREE.Mesh(legGeom, fleshMaterial.clone());
  leftLeg.position.set(-0.25, 0.7, 0);
  leftLeg.rotation.z = 0.15;
  leftLeg.rotation.x = -0.2;
  
  const rightLeg = new THREE.Mesh(legGeom, fleshMaterial.clone());
  rightLeg.position.set(0.25, 0.7, 0);
  rightLeg.rotation.z = -0.15;
  rightLeg.rotation.x = -0.2;
  
  group.add(leftLeg, rightLeg);
  
  // 6. TENTACLES/SPIKES on back (for stalker)
  if (isStalker) {
    for (let i = 0; i < 6; i++) {
      const spikeGeom = new THREE.ConeGeometry(0.05, 0.6 + Math.random() * 0.4, 4);
      const spike = new THREE.Mesh(spikeGeom, fleshMaterial.clone());
      const angle = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.3, 1.2 + Math.random() * 0.5, Math.sin(angle) * 0.3 - 0.3);
      spike.rotation.x = Math.random() * 0.5;
      spike.rotation.z = (Math.random() - 0.5) * 0.5;
      group.add(spike);
    }
  }
  
  // 7. GLOW LIGHT
  const glowLight = new THREE.PointLight(glowColor, 2, 5, 2);
  glowLight.position.set(0, 2, 0.5);
  group.add(glowLight);
  
  // Store references for animation
  group.userData = {
    type: type,
    materials: [torso.material, leftArm.material, rightArm.material, head.material],
    leftArm: leftArm,
    rightArm: rightArm,
    head: head,
    leftEye: leftEye,
    rightEye: rightEye,
    glowLight: glowLight,
    glowColor: glowColor,
    hp: isStalker ? 3 : 2,
    speed: isStalker ? 0.015 : 0.035,
    state: 'idle',
    lastAttack: 0,
    animTime: Math.random() * 100
  };
  
  return group;
}

// Enemy Manager for procedural demons
class ProceduralEnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
  }
  
  spawnEnemy(x, z, type = 'stalker') {
    const enemy = createProceduralDemon(type);
    enemy.position.set(x, 0, z);
    this.scene.add(enemy);
    
    this.enemies.push({
      mesh: enemy,
      x: x,
      z: z,
      hp: enemy.userData.hp,
      speed: enemy.userData.speed,
      type: type,
      state: 'idle',
      lastAttack: 0
    });
    
    return enemy;
  }
  
  update(delta, playerPos, playerDir) {
    const time = performance.now() / 1000;
    
    this.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;
      
      const data = enemy.mesh.userData;
      
      // Update shader uniforms for pulsating effect
      data.materials.forEach(mat => {
        if (mat.uniforms) {
          mat.uniforms.uTime.value = time + data.animTime;
          mat.uniforms.uPulse.value = 0.5 + Math.sin(time * 2) * 0.2;
        }
      });
      
      // AI Movement
      const dx = playerPos.x - enemy.x;
      const dz = playerPos.z - enemy.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist < 10 && dist > 1.2) {
        // Chase player
        const moveX = (dx / dist) * enemy.speed;
        const moveZ = (dz / dist) * enemy.speed;
        
        if (this.canMove(enemy.x + moveX, enemy.z + moveZ)) {
          enemy.x += moveX;
          enemy.z += moveZ;
          enemy.mesh.position.set(enemy.x, 0, enemy.z);
          enemy.mesh.lookAt(playerPos.x, 0, playerPos.z);
          
          // Running animation - arms swing
          const runTime = time * 8;
          data.leftArm.rotation.x = 0.4 + Math.sin(runTime) * 0.6;
          data.rightArm.rotation.x = 0.4 + Math.cos(runTime) * 0.6;
          
          // Bobbing
          enemy.mesh.position.y = Math.abs(Math.sin(runTime * 2)) * 0.1;
        }
      } else if (dist <= 1.2) {
        // Attack - lunge
        if (Date.now() - enemy.lastAttack > 2000) {
          data.leftArm.rotation.x = -1.5; // Raise arms
          data.rightArm.rotation.x = -1.5;
          enemy.lastAttack = Date.now();
          
          // Flash eyes
          data.leftEye.material.color.setHex(0xffffff);
          data.rightEye.material.color.setHex(0xffffff);
          setTimeout(() => {
            data.leftEye.material.color.copy(data.glowColor);
            data.rightEye.material.color.copy(data.glowColor);
          }, 200);
        }
      } else {
        // Idle - breathing animation
        data.leftArm.rotation.x = 0.4 + Math.sin(time + data.animTime) * 0.1;
        data.rightArm.rotation.x = 0.4 + Math.cos(time + data.animTime) * 0.1;
        
        // Occasional twitch
        if (Math.random() < 0.01) {
          data.head.rotation.y = (Math.random() - 0.5) * 0.5;
          setTimeout(() => { data.head.rotation.y = 0; }, 200);
        }
      }
      
      // Update glow light
      data.glowLight.intensity = 1.5 + Math.sin(time * 3 + data.animTime) * 0.5;
    });
  }
  
  canMove(x, z) {
    if (x < 0 || x >= mapWidth || z < 0 || z >= mapHeight) return false;
    const t = worldMap[Math.floor(x)]?.[Math.floor(z)];
    return t === 0;
  }
  
  takeDamage(enemy, damage) {
    enemy.hp -= damage;
    const data = enemy.mesh.userData;
    
    // Flash white
    data.materials.forEach(mat => {
      const oldColor = mat.uniforms.uColor.value.clone();
      mat.uniforms.uColor.value.setHex(0xffffff);
      setTimeout(() => {
        mat.uniforms.uColor.value.copy(oldColor);
      }, 100);
    });
    
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }
  
  killEnemy(enemy) {
    // Death animation - dissolve and fall
    const mesh = enemy.mesh;
    let scale = 1;
    let y = mesh.position.y;
    
    const deathAnim = setInterval(() => {
      scale *= 0.95;
      y -= 0.02;
      mesh.scale.setScalar(scale);
      mesh.position.y = y;
      mesh.rotation.x += 0.1;
      
      // Fade out glow
      mesh.userData.glowLight.intensity *= 0.9;
      
      if (scale < 0.1) {
        clearInterval(deathAnim);
        this.removeEnemy(enemy);
      }
    }, 50);
  }
  
  removeEnemy(enemy) {
    this.scene.remove(enemy.mesh);
    const idx = this.enemies.indexOf(enemy);
    if (idx > -1) this.enemies.splice(idx, 1);
  }
  
  checkHit(origin, direction, maxDist = 7) {
    let hit = null;
    let bestDist = maxDist;
    
    this.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;
      
      const dx = enemy.x - origin.x;
      const dz = enemy.z - origin.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist > maxDist) return;
      
      const dot = (dx/dist)*direction.x + (dz/dist)*direction.z;
      if (dot > 0.84 && dist < bestDist) {
        bestDist = dist;
        hit = enemy;
      }
    });
    
    return hit;
  }
  
  dispose() {
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCARY MUSIC (unchanged)
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

    // ── Renderer ────────────────────────────────────────────────
    const W = container.clientWidth, H = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled  = true;
    renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    container.appendChild(renderer.domElement);

    // ── Main scene ──────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050208, FOG_NEAR, FOG_FAR);
    scene.background = new THREE.Color(0x050208);

    // ── Camera ──────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(72, W / H, 0.05, 50);

    // ── Textures ────────────────────────────────────────────────
    const toTex = (canvas, rx=1, ry=1) => {
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
    };
    const stoneTex  = toTex(genStone());
    const brickTex  = toTex(genBrick());
    const woodTex   = toTex(genWood());
    const floorTex  = toTex(genFloor(), mapWidth/2, mapHeight/2);
    const ceilTex   = toTex(genCeiling(), mapWidth/2, mapHeight/2);

    // ── Materials ───────────────────────────────────────────────
    const makeMat = (tex) => new THREE.MeshLambertMaterial({ map: tex });
    const mats = { 1: makeMat(stoneTex), 3: makeMat(brickTex), 4: makeMat(woodTex) };

    // ── Ambient ─────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x180a08, 0.8));

    // ── Floor & Ceiling ─────────────────────────────────────────
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshLambertMaterial({ map: floorTex })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(mapWidth / 2, 0, mapHeight / 2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const ceilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(mapWidth, mapHeight),
      new THREE.MeshLambertMaterial({ map: ceilTex })
    );
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(mapWidth / 2, WALL_H, mapHeight / 2);
    scene.add(ceilMesh);

    // ── Walls ───────────────────────────────────────────────────
    const wallGeom = new THREE.BoxGeometry(1, WALL_H, 1);
    for (let x = 0; x < mapWidth; x++) {
      for (let z = 0; z < mapHeight; z++) {
        const t = worldMap[x][z];
        if (!t || t === 2) continue;
        const m = new THREE.Mesh(wallGeom, mats[t] || mats[1]);
        m.position.set(x + 0.5, WALL_H / 2, z + 0.5);
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
      }
    }

    // ── Torches (fixed lights) ───────────────────────────────────
    const fixedTorches = [];
    for (let x = 1; x < mapWidth - 1; x++) {
      for (let z = 1; z < mapHeight - 1; z++) {
        if (worldMap[x][z] !== 0) continue;
        const adj = [worldMap[x+1]?.[z], worldMap[x-1]?.[z], worldMap[x]?.[z+1], worldMap[x]?.[z-1]];
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

    // ── Player torch ───────────────────────────────────────────
    const playerLight = new THREE.PointLight(0xff7820, 3.0, 10, 2);
    playerLight.castShadow = true;
    playerLight.shadow.mapSize.setScalar(512);
    playerLight.shadow.camera.near = 0.1;
    playerLight.shadow.camera.far  = 10;
    scene.add(playerLight);

    // ── SPAWN PROCEDURAL ENEMIES ────────────────────────────────
    const enemyManager = new ProceduralEnemyManager(scene);
    
    // Spawn enemies at worldMap '2' positions
    for (let x = 0; x < mapWidth; x++) {
      for (let z = 0; z < mapHeight; z++) {
        if (worldMap[x][z] === 2) {
          const type = Math.random() < 0.45 ? 'stalker' : 'runner';
          enemyManager.spawnEnemy(x + 0.5, z + 0.5, type);
          worldMap[x][z] = 0; // Clear spawn point
        }
      }
    }

    // ── Pickups ─────────────────────────────────────────────────
    const open = [];
    for (let x = 2; x < mapWidth - 2; x++)
      for (let z = 2; z < mapHeight - 2; z++)
        if (worldMap[x][z] === 0) open.push({ x: x + 0.5, z: z + 0.5 });
    open.sort(() => Math.random() - 0.5);

    const pickups = [];
    for (let i = 0; i < Math.min(PICKUP_N, open.length); i++) {
      const isCoin = i % 3 !== 0;
      const col = isCoin ? 0xffd020 : 0x20dd55;
      const geom = isCoin
        ? new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12)
        : new THREE.SphereGeometry(0.14, 10, 10);
      const mat  = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.3, metalness: isCoin ? 0.8 : 0.1 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(open[i].x, 0.28, open[i].z);
      mesh.castShadow = true;
      scene.add(mesh);
      const pLight = new THREE.PointLight(col, 0.8, 3, 2);
      pLight.position.copy(mesh.position);
      scene.add(pLight);
      pickups.push({ ...open[i], type: isCoin ? 'coin' : 'potion', mesh, light: pLight, collected: false, phase: Math.random() * Math.PI * 2 });
    }

    // ── Weapon scene ────────────────────────────────────────────
    const weaponScene  = new THREE.Scene();
    const weaponCamera = new THREE.PerspectiveCamera(62, W / H, 0.01, 10);
    weaponScene.add(new THREE.AmbientLight(0x705030, 1.1));
    const weaponPointLight = new THREE.PointLight(0x4060ff, 1.5, 3);
    weaponPointLight.position.set(0, 0.3, -0.3);
    weaponScene.add(weaponPointLight);

    const wGroup = new THREE.Group();
    const handleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.036, 0.65, 10),
      new THREE.MeshLambertMaterial({ color: 0x1e0c04 })
    );
    handleMesh.rotation.z = 0.18;
    wGroup.add(handleMesh);
    for (let i = 0; i < 5; i++) {
      const wrap = new THREE.Mesh(
        new THREE.TorusGeometry(0.028, 0.008, 5, 16),
        new THREE.MeshLambertMaterial({ color: 0x3a1606 })
      );
      wrap.rotation.y = Math.PI / 2; wrap.position.y = -0.22 + i * 0.11;
      wrap.rotation.z = 0.18; wGroup.add(wrap);
    }
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.01, 5, 20),
      new THREE.MeshStandardMaterial({ color: 0x807060, metalness: 0.9, roughness: 0.3 })
    );
    band.rotation.y = Math.PI / 2; band.position.y = 0.3; band.rotation.z = 0.18; wGroup.add(band);
    const orbMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0x3050ee, emissive: 0x1030bb, emissiveIntensity: 1.4, roughness: 0.05, metalness: 0.2 })
    );
    orbMesh.position.set(0, 0.36, 0); wGroup.add(orbMesh);
    const innerOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xaaccff })
    );
    innerOrb.position.set(-0.022, 0.375, 0.022); wGroup.add(innerOrb);
    const beamMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.025, 2.8, 6),
      new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.7 })
    );
    beamMesh.rotation.x = Math.PI / 2; beamMesh.position.set(0, 0.36, -1.45); beamMesh.visible = false;
    wGroup.add(beamMesh);
    const rings = Array.from({ length: 3 }, (_, i) => {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(0.08 + i * 0.08, 0.012, 4, 20),
        new THREE.MeshBasicMaterial({ color: 0x8899ff, transparent: true, opacity: 0.6 - i * 0.15 })
      );
      r.position.set(0, 0.36, -0.05); r.visible = false; wGroup.add(r); return r;
    });

    wGroup.position.set(0.28, -0.34, -0.52);
    weaponScene.add(wGroup);

    // ── Player state ────────────────────────────────────────────
    let px = 2.5, pz = 2.5, yaw = 0;
    camera.position.set(px, EYE_H, pz);
    const keys = {};
    let fireFlashVal = 0;
    let bobPhase = 0;
    let torchFlicker = 1;
    let frameCount = 0;

    // ── Pointer lock ────────────────────────────────────────────
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

    // ── Keyboard ────────────────────────────────────────────────
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
          if (hit.hp <= 1) {
            setTimeout(() => onEncounterRef.current(), 320);
          }
        }
      }
    };
    const onKU = e => { keys[e.key] = false; };
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);

    // ── Collision helper ────────────────────────────────────────
    const canWalk = (x, z) => {
      if (x < 0 || x >= mapWidth || z < 0 || z >= mapHeight) return false;
      const t = worldMap[Math.floor(x)]?.[Math.floor(z)];
      return t === 0;
    };

    // ── Resize ──────────────────────────────────────────────────
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    // ── Minimap draw ────────────────────────────────────────────
    const drawMinimap = () => {
      const mc2 = minimapRef.current; if (!mc2) return;
      const mctx = mc2.getContext('2d'); if (!mctx) return;
      const ts = 4, mW = mapWidth*ts, mH = mapHeight*ts;
      mc2.width = mW; mc2.height = mH;
      mctx.fillStyle='rgba(4,3,2,0.88)'; mctx.fillRect(0,0,mW,mH);
      for(let x=0;x<mapWidth;x++)for(let z=0;z<mapHeight;z++){const t=worldMap[x][z];mctx.fillStyle=t===1?'#4a3a24':t===3?'#5a2818':t===4?'#3a2210':'#14110d';mctx.fillRect(x*ts,z*ts,ts,ts);}
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

    // ── Game loop ───────────────────────────────────────────────
    let rafId;
    const clock = new THREE.Clock();
    
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      const delta = clock.getDelta();
      frameCount++;

      const playerPos = { x: px, z: pz };
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
      const playerDir = { x: forward.x, z: forward.z };

      // Movement
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

      // Check enemy collision
      enemyManager.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        const dx = px - enemy.x;
        const dz = pz - enemy.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < 0.8) {
          enemyManager.takeDamage(enemy, 999);
          onEncounterRef.current();
        }
      });

      // Pickups
      pickups.forEach(pu => {
        if (pu.collected) return;
        const dx=px-pu.x, dz=pz-pu.z;
        if (dx*dx+dz*dz < 0.35) {
          pu.collected = true; pu.mesh.visible = false; pu.light.visible = false;
          setFlash(0.5); setTimeout(() => setFlash(0), 400);
          onPickupRef.current?.(pu.type==='coin'?'gold':'health', pu.type==='coin'?15:20);
        }
      });

      // Camera
      camera.position.set(px, EYE_H + (moving ? Math.sin(bobPhase*8)*0.04 : 0), pz);
      camera.rotation.order = 'YXZ'; camera.rotation.y = yaw; camera.rotation.x = 0;
      if (moving) bobPhase += sprint > 1 ? 0.1 : 0.065;

      // Player torch
      torchFlicker += (Math.random()-0.5)*0.035;
      torchFlicker = Math.max(0.82, Math.min(1.0, torchFlicker));
      playerLight.position.copy(camera.position).add(new THREE.Vector3(fw.x*0.5, 0.1, fw.z*0.5));
      playerLight.intensity = 3.0 * torchFlicker;

      // Fixed torches
      fixedTorches.forEach(t => {
        t.light.intensity = t.base * (0.88 + Math.random()*0.24);
        t.flame.material.color.setHSL(0.06+Math.random()*0.04, 1, 0.5+Math.random()*0.2);
      });

      // Update enemies
      enemyManager.update(delta, playerPos, playerDir);

      // Pickup float
      pickups.forEach(pu => {
        if (pu.collected) return;
        pu.mesh.position.y = 0.28 + Math.sin(frameCount*0.045 + pu.phase)*0.1;
        pu.mesh.rotation.y += 0.025;
      });

      // Fire flash
      if (fireFlashVal > 0) {
        fireFlashVal = Math.max(0, fireFlashVal - 0.05);
        orbMesh.material.emissiveIntensity = 1.4 + fireFlashVal * 5;
        weaponPointLight.intensity = 1.5 + fireFlashVal * 6;
        beamMesh.visible = fireFlashVal > 0.1;
        beamMesh.material.opacity = fireFlashVal * 0.8;
        rings.forEach((r, i) => { r.visible = fireFlashVal > 0.2; r.scale.setScalar(1 + (1-fireFlashVal)*(i+1)*1.2); r.material.opacity = fireFlashVal*(0.55-i*.14); });
        if (fireFlashVal > 0.55) setFlash(fireFlashVal * 0.5);
        else setFlash(0);
      } else {
        orbMesh.material.emissiveIntensity = 1.4 + Math.sin(frameCount*0.09)*0.3;
        weaponPointLight.intensity = 1.5 + Math.sin(frameCount*0.07)*0.4;
        beamMesh.visible = false; rings.forEach(r => r.visible = false);
      }

      // Wand sway
      const sway = Math.sin(frameCount*0.025)*0.04;
      const walkSway = moving ? Math.sin(bobPhase*8)*0.018 : 0;
      wGroup.rotation.z = 0.18 + sway;
      wGroup.rotation.x = walkSway;
      wGroup.position.y = -0.34 + (moving ? Math.sin(bobPhase*8)*0.025 : 0);

      // Render
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.autoClear = false; renderer.clearDepth();
      renderer.render(weaponScene, weaponCamera);
      renderer.autoClear = true;

      // Minimap
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
      <div ref={mountRef} style={{ width:'100%', height:'100%' }} />
      
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
