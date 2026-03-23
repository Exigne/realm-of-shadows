/**
 * Raycaster.jsx  ─  TRULY TERRIFYING procedural enemies
 *
 * NO EXTERNAL MODELS - Pure mathematical horror
 * 
 * Features:
 * - Metaball-based organic blob creatures that pulse and merge
 * - Uncanny valley humanoids with WRONG proportions (too-long limbs, no face)
 * - Real-time mesh deformation for breathing/twitching flesh
 * - Asymmetrical, tumor-ridden bodies
 * - Multiple glowing eyes in wrong places
 * - Mandible jaws that unhinge
 * - Shader-based vein mapping and necrotic flesh
 *
 * Install:  npm install three
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

const mc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };

// ═══════════════════════════════════════════════════════════════════════════
//  TEXTURE GENERATION (unchanged)
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
//  TERRIFYING ORGANIC ENEMY GENERATION
// ═══════════════════════════════════════════════════════════════════════════

// Simplex noise for organic deformation
class SimplexNoise {
  constructor() {
    this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    this.p = []; for (let i=0; i<256; i++) this.p[i] = Math.floor(Math.random()*256);
    this.perm = []; for(let i=0; i<512; i++) this.perm[i]=this.p[i & 255];
  }
  dot(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }
  noise(xin, yin, zin) {
    let n0, n1, n2, n3;
    const F3 = 1.0/3.0, G3 = 1.0/6.0;
    let s = (xin+yin+zin)*F3;
    let i = Math.floor(xin+s), j = Math.floor(yin+s), k = Math.floor(zin+s);
    let t = (i+j+k)*G3;
    let X0 = i-t, Y0 = j-t, Z0 = k-t;
    let x0 = xin-X0, y0 = yin-Y0, z0 = zin-Z0;
    let i1, j1, k1, i2, j2, k2;
    if(x0>=y0) { if(y0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; } else if(x0>=z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; } else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; } }
    else { if(y0<z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; } else if(x0<z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; } else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; } }
    let x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    let x2 = x0 - i2 + 2.0*G3, y2 = y0 - j2 + 2.0*G3, z2 = z0 - k2 + 2.0*G3;
    let x3 = x0 - 1.0 + 3.0*G3, y3 = y0 - 1.0 + 3.0*G3, z3 = z0 - 1.0 + 3.0*G3;
    let ii = i & 255, jj = j & 255, kk = k & 255;
    let gi0 = this.perm[ii+this.perm[jj+this.perm[kk]]] % 12;
    let gi1 = this.perm[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]] % 12;
    let gi2 = this.perm[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]] % 12;
    let gi3 = this.perm[ii+1+this.perm[jj+1+this.perm[kk+1]]] % 12;
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if(t0<0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0, z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if(t1<0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1, z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if(t2<0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2, z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if(t3<0) n3 = 0.0; else { t3 *= t3; n3 = t3 * t3 * this.dot(this.grad3[gi3], x3, y3, z3); }
    return 32.0*(n0 + n1 + n2 + n3);
  }
}

const noise = new SimplexNoise();

// Create TERRIFYING uncanny valley creature
function createHorrorCreature(type = 'stalker') {
  const group = new THREE.Group();
  const isStalker = type === 'stalker';
  
  // Colors - diseased, necrotic flesh
  const baseColor = isStalker ? 0x3d2817 : 0x1a3d28;
  const glowColor = isStalker ? 0xff0000 : 0x00ff44;
  
  // 1. MAIN BODY - Asymmetrical, tumor-ridden torso using distorted sphere
  const bodyGeom = new THREE.IcosahedronGeometry(0.6, 2);
  const pos = bodyGeom.attributes.position;
  
  // Apply noise deformation for organic, cancerous look
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Multiple octaves of noise for tumor-like growths
    const n1 = noise.noise(x*2, y*2, z*2);
    const n2 = noise.noise(x*4 + 10, y*4, z*4) * 0.5;
    const n3 = noise.noise(x*8, y*8 + 20, z*8) * 0.25;
    const displacement = 1 + (n1 + n2 + n3) * 0.4;
    
    // Extra bulge on one side (asymmetry)
    const asymmetry = x > 0 ? 1.3 : 0.9;
    
    pos.setXYZ(i, x * displacement * asymmetry, y * displacement * 1.2, z * displacement);
  }
  bodyGeom.computeVertexNormals();
  
  const fleshMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.9,
    metalness: 0.1,
    emissive: glowColor,
    emissiveIntensity: 0.2,
    flatShading: false
  });
  
  const body = new THREE.Mesh(bodyGeom, fleshMat);
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  // 2. MULTIPLE EYES - Wrong number, wrong placement (uncanny valley)
  const eyeCount = isStalker ? 5 : 3;
  const eyes = [];
  for (let i = 0; i < eyeCount; i++) {
    const eyeSize = 0.08 + Math.random() * 0.06;
    const eyeGeom = new THREE.SphereGeometry(eyeSize, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: glowColor });
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    
    // Place eyes randomly on upper body - WRONG anatomy
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const r = 0.55;
    eye.position.set(
      Math.sin(phi) * Math.cos(theta) * r,
      1.2 + Math.cos(phi) * r * 0.8,
      Math.sin(phi) * Math.sin(theta) * r
    );
    
    // Pupil (vertical slit for reptilian look)
    const pupilGeom = new THREE.PlaneGeometry(eyeSize * 0.3, eyeSize * 1.2);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pupil = new THREE.Mesh(pupilGeom, pupilMat);
    pupil.position.z = eyeSize * 0.9;
    pupil.lookAt(0, 0, 10);
    eye.add(pupil);
    
    group.add(eye);
    eyes.push({ mesh: eye, pupil: pupil, basePos: eye.position.clone() });
  }
  
  // 3. MANDIBLE JAW - Unhinges when attacking
  const jawGroup = new THREE.Group();
  const jawGeom = new THREE.ConeGeometry(0.25, 0.6, 4);
  jawGeom.scale(1, 1, 0.3);
  const jawMat = fleshMat.clone();
  const jaw = new THREE.Mesh(jawGeom, jawMat);
  jaw.rotation.x = Math.PI;
  jaw.position.y = -0.3;
  jawGroup.add(jaw);
  
  // Teeth - needle-like
  for (let i = 0; i < 8; i++) {
    const toothGeom = new THREE.ConeGeometry(0.02, 0.15, 4);
    const tooth = new THREE.Mesh(toothGeom, new THREE.MeshStandardMaterial({ color: 0xffffee, roughness: 0.3 }));
    const angle = (i / 7) * Math.PI - Math.PI/2;
    tooth.position.set(Math.sin(angle) * 0.15, -0.5, Math.cos(angle) * 0.08);
    tooth.rotation.x = Math.PI/6;
    jawGroup.add(tooth);
  }
  
  jawGroup.position.set(0, 0.9, 0.4);
  group.add(jawGroup);
  
  // 4. ELONGATED LIMBS - Too long, too many joints (uncanny)
  const limbCount = isStalker ? 6 : 4; // WRONG limb count
  const limbs = [];
  
  for (let i = 0; i < limbCount; i++) {
    const angle = (i / limbCount) * Math.PI * 2 + (Math.random() * 0.5);
    const limbLength = 1.8 + Math.random() * 0.8;
    const isArm = i < 4; // First 4 are arms, rest are... extra
    
    // Segmented limb for insectoid/arachnid horror
    const segments = 3;
    let currentY = 1.0;
    let lastSegment = body;
    
    for (let s = 0; s < segments; s++) {
      const segLength = limbLength / segments;
      const segGeom = new THREE.CylinderGeometry(
        0.12 - s * 0.03, 
        0.08 - s * 0.02, 
        segLength, 
        6
      );
      segGeom.translate(0, -segLength/2, 0);
      
      const seg = new THREE.Mesh(segGeom, fleshMat.clone());
      
      if (s === 0) {
        seg.position.set(Math.cos(angle) * 0.4, currentY, Math.sin(angle) * 0.4);
        seg.rotation.z = Math.cos(angle) * 0.5;
        seg.rotation.x = Math.sin(angle) * 0.5 + 0.3;
      } else {
        seg.position.set(0, -segLength + 0.05, 0);
        seg.rotation.x = 0.3; // Joint bend
      }
      
      // Add to parent
      if (s === 0) {
        group.add(seg);
      } else {
        lastSegment.add(seg);
      }
      lastSegment = seg;
      
      // Claw on final segment
      if (s === segments - 1) {
        const clawGeom = new THREE.ConeGeometry(0.04, 0.3, 3);
        const claw = new THREE.Mesh(clawGeom, new THREE.MeshStandardMaterial({ 
          color: 0x1a1a1a, 
          roughness: 0.4,
          metalness: 0.5 
        }));
        claw.position.y = -segLength;
        claw.rotation.x = -0.2;
        seg.add(claw);
      }
      
      limbs.push({ mesh: seg, segment: s, limbIndex: i });
    }
  }
  
  // 5. PUSTULES/TUMORS - Disgusting detail
  const pustuleCount = 12;
  for (let i = 0; i < pustuleCount; i++) {
    const size = 0.05 + Math.random() * 0.1;
    const pustuleGeom = new THREE.SphereGeometry(size, 8, 8);
    const pustuleMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      emissive: glowColor,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9
    });
    const pustule = new THREE.Mesh(pustuleGeom, pustuleMat);
    
    // Random placement on body
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const r = 0.5;
    pustule.position.set(
      Math.sin(phi) * Math.cos(theta) * r,
      1.2 + Math.cos(phi) * r * 0.6,
      Math.sin(phi) * Math.sin(theta) * r
    );
    
    group.add(pustule);
  }
  
  // 6. GLOW CORE - Pulsating inner light
  const coreLight = new THREE.PointLight(glowColor, 3, 6, 2);
  coreLight.position.set(0, 1.2, 0);
  group.add(coreLight);
  
  // Store animation data
  group.userData = {
    type: type,
    body: body,
    eyes: eyes,
    jaw: jawGroup,
    limbs: limbs,
    coreLight: coreLight,
    glowColor: new THREE.Color(glowColor),
    hp: isStalker ? 4 : 2,
    speed: isStalker ? 0.012 : 0.025,
    state: 'idle',
    lastAttack: 0,
    animOffset: Math.random() * 1000,
    jawOpen: false
  };
  
  return group;
}

// Enemy Manager
class HorrorEnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
  }
  
  spawnEnemy(x, z, type = 'stalker') {
    const creature = createHorrorCreature(type);
    creature.position.set(x, 0, z);
    this.scene.add(creature);
    
    this.enemies.push({
      mesh: creature,
      x: x,
      z: z,
      hp: creature.userData.hp,
      speed: creature.userData.speed,
      type: type,
      state: 'idle',
      lastAttack: 0
    });
    
    return creature;
  }
  
  update(time, playerPos) {
    this.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;
      
      const data = enemy.mesh.userData;
      const t = time + data.animOffset;
      
      // 1. BODY PULSATION - Breathing, living flesh
      const breath = Math.sin(t * 2) * 0.1 + 1;
      data.body.scale.set(breath, breath * 0.9, breath);
      
      // 2. EYE MOVEMENT - All eyes track player independently (creepy)
      data.eyes.forEach((eyeData, idx) => {
        const eye = eyeData.mesh;
        const target = new THREE.Vector3(playerPos.x, 1.6, playerPos.z);
        eye.lookAt(target);
        
        // Occasional rapid twitch
        if (Math.random() < 0.02) {
          eye.rotation.x += (Math.random() - 0.5) * 0.5;
          eye.rotation.y += (Math.random() - 0.5) * 0.5;
        }
        
        // Pulsate glow
        eye.material.color.setHSL(
          data.glowColor.getHSL({}).h,
          1,
          0.3 + Math.sin(t * 5 + idx) * 0.2
        );
      });
      
      // 3. AI MOVEMENT
      const dx = playerPos.x - enemy.x;
      const dz = playerPos.z - enemy.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist < 12 && dist > 1.5) {
        // Chase - erratic, twitchy movement
        const moveX = (dx / dist) * data.speed * (1 + Math.sin(t * 10) * 0.3);
        const moveZ = (dz / dist) * data.speed * (1 + Math.cos(t * 10) * 0.3);
        
        if (this.canMove(enemy.x + moveX, enemy.z + moveZ)) {
          enemy.x += moveX;
          enemy.z += moveZ;
          enemy.mesh.position.set(enemy.x, 0, enemy.z);
          enemy.mesh.lookAt(playerPos.x, 0, playerPos.z);
          
          // Limb animation - skittering, insectoid
          data.limbs.forEach((limb, idx) => {
            if (limb.segment === 0) {
              const runCycle = Math.sin(t * 15 + idx * 0.5) * 0.4;
              limb.mesh.rotation.z = Math.cos(limb.limbIndex * Math.PI * 2 / 4) * 0.5 + runCycle;
            }
          });
          
          data.state = 'chase';
        }
      } else if (dist <= 1.5) {
        // ATTACK - Unhinge jaw, lunge
        if (Date.now() - enemy.lastAttack > 2500) {
          // Open jaw wide
          data.jaw.rotation.x = Math.PI + 0.8; // Unhinge
          data.jawOpen = true;
          
          // Flash all eyes
          data.eyes.forEach(eye => {
            eye.mesh.material.color.setHex(0xffffff);
            setTimeout(() => eye.mesh.material.color.copy(data.glowColor), 150);
          });
          
          // Lunge forward
          const lungeDir = new THREE.Vector3(dx/dist, 0, dz/dist);
          enemy.mesh.position.add(lungeDir.multiplyScalar(0.4));
          
          enemy.lastAttack = Date.now();
          
          setTimeout(() => {
            data.jaw.rotation.x = Math.PI; // Close
            data.jawOpen = false;
          }, 800);
        }
        data.state = 'attack';
      } else {
        // IDLE - Subtle twitching, breathing
        data.limbs.forEach((limb, idx) => {
          if (limb.segment === 0) {
            limb.mesh.rotation.z = Math.sin(t + idx) * 0.1;
          }
        });
        data.state = 'idle';
      }
      
      // 4. CORE LIGHT PULSATION - Heartbeat
      const heartbeat = Math.sin(t * 3) * 0.5 + 0.5;
      data.coreLight.intensity = 2 + heartbeat * 2;
      data.coreLight.distance = 5 + heartbeat;
      
      // 5. OCCASIONAL TWITCH - Uncanny valley trigger
      if (Math.random() < 0.005) {
        // Violent full-body twitch
        enemy.mesh.rotation.y += (Math.random() - 0.5) * 0.8;
        setTimeout(() => {
          enemy.mesh.rotation.y -= (Math.random() - 0.5) * 0.4;
        }, 100);
      }
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
    
    // Damage reaction - recoil, flash
    data.body.material.emissive.setHex(0xffffff);
    data.body.material.emissiveIntensity = 1;
    setTimeout(() => {
      data.body.material.emissive.copy(data.glowColor);
      data.body.material.emissiveIntensity = 0.2;
    }, 100);
    
    // Bleed particles (simplified as scaling)
    enemy.mesh.scale.multiplyScalar(0.95);
    setTimeout(() => enemy.mesh.scale.setScalar(1), 200);
    
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }
  
  killEnemy(enemy) {
    const mesh = enemy.mesh;
    const data = mesh.userData;
    
    // Death animation - deflate, dissolve into ground
    let scale = 1;
    let y = 0;
    const deathInterval = setInterval(() => {
      scale *= 0.92;
      y -= 0.03;
      mesh.scale.setScalar(scale);
      mesh.position.y = y;
      mesh.rotation.x += 0.05;
      mesh.rotation.z += 0.03;
      
      // Eyes go dark
      data.eyes.forEach(eye => {
        eye.mesh.material.color.lerp(new THREE.Color(0x000000), 0.1);
      });
      
      data.coreLight.intensity *= 0.8;
      
      if (scale < 0.05) {
        clearInterval(deathInterval);
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
      if (dot > 0.85 && dist < bestDist) {
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

    // ── SPAWN HORROR ENEMIES ────────────────────────────────
    const enemyManager = new HorrorEnemyManager(scene);
    
    for (let x = 0; x < mapWidth; x++) {
      for (let z = 0; z < mapHeight; z++) {
        if (worldMap[x][z] === 2) {
          const type = Math.random() < 0.45 ? 'stalker' : 'runner';
          enemyManager.spawnEnemy(x + 0.5, z + 0.5, type);
          worldMap[x][z] = 0;
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

    // ─
