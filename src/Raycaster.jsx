import React, { useEffect, useRef, useState } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

const W = 640, H = 480, TEX = 128, FOG_DIST = 12, MOUSE_SENS = 0.0018, PICKUP_COUNT = 8;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h || w;
  return c;
}

// ═══════════════════════════════════════════════════════════════
//  PROCEDURAL WALL TEXTURES
// ═══════════════════════════════════════════════════════════════
function genStoneWall() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  ctx.fillStyle = '#606060'; ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < TEX * TEX / 4; i++) {
    const v = (Math.random() * 40 - 20) | 0;
    ctx.fillStyle = `rgb(${96+v},${94+v},${90+v})`;
    ctx.fillRect((Math.random() * TEX)|0, (Math.random() * TEX)|0, 2, 2);
  }
  const bW = 32, bH = 20;
  ctx.strokeStyle = '#282018'; ctx.lineWidth = 2;
  for (let row = 0; row * bH < TEX; row++) {
    const off = (row % 2) * (bW / 2);
    for (let col = -1; col * bW < TEX + bW; col++) {
      const bx = col * bW + off, by = row * bH;
      const v = (Math.random() * 16 - 8) | 0;
      ctx.fillStyle = `rgb(${88+v},${84+v},${80+v})`;
      ctx.fillRect(bx + 2, by + 2, bW - 3, bH - 3);
      ctx.strokeRect(bx + 1, by + 1, bW - 2, bH - 2);
      if (Math.random() < 0.35) {
        ctx.save(); ctx.strokeStyle = '#181410'; ctx.lineWidth = 1; ctx.beginPath();
        const sx = bx + 4 + Math.random() * (bW - 8), sy = by + 4 + Math.random() * (bH - 8);
        ctx.moveTo(sx, sy); ctx.lineTo(sx + (Math.random() - 0.5) * 16, sy + (Math.random() - 0.5) * 12);
        ctx.stroke(); ctx.restore();
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    const mx = Math.random() * TEX, my = Math.random() * TEX;
    const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 14);
    gr.addColorStop(0, 'rgba(40,80,28,0.55)'); gr.addColorStop(1, 'rgba(40,80,28,0)');
    ctx.fillStyle = gr; ctx.fillRect(mx - 14, my - 14, 28, 28);
  }
  return c;
}

function genBrickWall() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a2818'; ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < TEX * TEX / 6; i++) {
    const v = (Math.random() * 24 - 12) | 0;
    ctx.fillStyle = `rgba(${110+v},${42+v},${20+v},0.6)`;
    ctx.fillRect((Math.random() * TEX)|0, (Math.random() * TEX)|0, 2, 2);
  }
  const bW = 28, bH = 14;
  for (let row = 0; row * bH < TEX; row++) {
    const off = (row % 2) * (bW / 2);
    for (let col = -1; col * bW < TEX + bW; col++) {
      const bx = col * bW + off, by = row * bH;
      const v = (Math.random() * 22 - 11) | 0;
      ctx.fillStyle = `rgb(${138+v},${52+v},${28+v})`;
      ctx.fillRect(bx + 2, by + 2, bW - 3, bH - 3);
    }
  }
  ctx.fillStyle = '#2a1810';
  for (let row = 0; row * bH < TEX; row++) {
    ctx.fillRect(0, row * bH, TEX, 2);
    const off = (row % 2) * (bW / 2);
    for (let col = -1; col * bW < TEX + bW; col++)
      ctx.fillRect(col * bW + off, row * bH, 2, bH);
  }
  return c;
}

function genWoodWall() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  ctx.fillStyle = '#281406'; ctx.fillRect(0, 0, TEX, TEX);
  const pW = 22;
  for (let col = 0; col * pW < TEX; col++) {
    const v = (Math.random() * 18) | 0;
    ctx.fillStyle = `rgb(${52+v},${24+v},${8+v/2})`;
    ctx.fillRect(col * pW + 1, 0, pW - 1, TEX);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let g = 0; g < 10; g++) {
      const gx = col * pW + 2 + Math.random() * (pW - 4);
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx + (Math.random() - 0.5) * 5, TEX); ctx.stroke();
    }
  }
  ctx.fillStyle = '#100806';
  for (let col = 1; col * pW < TEX; col++) ctx.fillRect(col * pW, 0, 2, TEX);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = '#180a04'; ctx.fillRect(0, (TEX / 4) * i, TEX, 3); }
  return c;
}

// ═══════════════════════════════════════════════════════════════
//  ANIMATED DRAGON SPRITE  (12 frames)
// ═══════════════════════════════════════════════════════════════
function genDragonFrame(phase, color = { body: '#4a1830', dark: '#280c1c', wing: '#1e0828', scale: '#3a1020', horn: '#401020', fire: true }) {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX * 0.5, base = TEX * 0.9;
  const wFlap = Math.sin(phase) * 0.45;
  const flapUp = Math.cos(phase);
  const breathe = Math.sin(phase * 1.5) > 0.6;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(cx, base - TEX*0.01, TEX*0.2, TEX*0.025, 0, 0, Math.PI*2); ctx.fill();

  // LEFT WING
  ctx.save(); ctx.translate(cx - TEX*0.18, base - TEX*0.38); ctx.rotate(-0.3 + wFlap);
  ctx.fillStyle = color.wing;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-TEX*0.15, -TEX*0.05 - flapUp*TEX*0.08, -TEX*0.42, -TEX*0.08 - flapUp*TEX*0.18, -TEX*0.46, -TEX*0.02 - flapUp*TEX*0.12);
  ctx.bezierCurveTo(-TEX*0.4, TEX*0.1, -TEX*0.2, TEX*0.16, 0, TEX*0.04);
  ctx.closePath(); ctx.fill();
  // Wing bone spars
  ctx.strokeStyle = '#3a0a50'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const t = (i+1)/4;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(-TEX*0.42*t, (-TEX*0.05 - flapUp*TEX*0.15)*t); ctx.stroke();
  }
  // Membrane texture
  ctx.strokeStyle = 'rgba(80,10,80,0.3)'; ctx.lineWidth = 0.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(-TEX*0.02*i, TEX*0.02*i);
    ctx.lineTo(-TEX*0.3 - TEX*0.02*i, -TEX*0.04 - flapUp*TEX*0.1 + TEX*0.02*i); ctx.stroke();
  }
  ctx.restore();

  // RIGHT WING
  ctx.save(); ctx.translate(cx + TEX*0.18, base - TEX*0.38); ctx.rotate(0.3 - wFlap);
  ctx.fillStyle = color.wing;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(TEX*0.15, -TEX*0.05 - flapUp*TEX*0.08, TEX*0.42, -TEX*0.08 - flapUp*TEX*0.18, TEX*0.46, -TEX*0.02 - flapUp*TEX*0.12);
  ctx.bezierCurveTo(TEX*0.4, TEX*0.1, TEX*0.2, TEX*0.16, 0, TEX*0.04);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a0a50'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const t = (i+1)/4;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(TEX*0.42*t, (-TEX*0.05 - flapUp*TEX*0.15)*t); ctx.stroke();
  }
  ctx.restore();

  // TAIL
  ctx.strokeStyle = color.dark; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - TEX*0.15, base - TEX*0.15);
  ctx.quadraticCurveTo(cx - TEX*0.5, base - TEX*0.05, cx - TEX*0.55, base - TEX*0.4); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = color.scale;
  ctx.beginPath(); ctx.moveTo(cx - TEX*0.15, base - TEX*0.15);
  ctx.quadraticCurveTo(cx - TEX*0.48, base - TEX*0.05, cx - TEX*0.52, base - TEX*0.38); ctx.stroke();
  ctx.fillStyle = color.horn;
  ctx.beginPath(); ctx.moveTo(cx-TEX*0.55, base-TEX*0.4); ctx.lineTo(cx-TEX*0.65, base-TEX*0.5); ctx.lineTo(cx-TEX*0.5, base-TEX*0.42); ctx.closePath(); ctx.fill();

  // BODY
  const bodyGr = ctx.createRadialGradient(cx-TEX*0.05, base-TEX*0.32, 0, cx, base-TEX*0.28, TEX*0.24);
  bodyGr.addColorStop(0, color.body); bodyGr.addColorStop(0.6, color.dark); bodyGr.addColorStop(1, '#0e0408');
  ctx.fillStyle = bodyGr;
  ctx.beginPath(); ctx.ellipse(cx, base - TEX*0.28, TEX*0.22, TEX*0.26, 0, 0, Math.PI*2); ctx.fill();
  // Belly scales
  ctx.strokeStyle = color.scale; ctx.lineWidth = 0.8;
  for (let row = 0; row < 5; row++) {
    for (let col = -2; col <= 2; col++) {
      const sx = cx + col*TEX*0.07 + (row%2)*TEX*0.035, sy = base - TEX*0.14 - row*TEX*0.07;
      ctx.beginPath(); ctx.arc(sx, sy, TEX*0.03, Math.PI, Math.PI*2); ctx.stroke();
    }
  }

  // LEGS
  ctx.strokeStyle = color.dark; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx-TEX*0.13, base-TEX*0.07); ctx.lineTo(cx-TEX*0.2, base+TEX*0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.13, base-TEX*0.07); ctx.lineTo(cx+TEX*0.2, base+TEX*0.05); ctx.stroke();
  ctx.lineWidth = 2.5;
  [[-0.2, 0.05, -1], [0.2, 0.05, 1]].forEach(([lx, ly, dir]) => {
    for (let t = 0; t < 3; t++) {
      const angle = (t - 1) * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx+lx*TEX, base+ly*TEX);
      ctx.lineTo(cx+(lx+dir*0.1+Math.sin(angle)*0.08)*TEX, base+(ly+0.08)*TEX); ctx.stroke();
    }
  });

  // NECK
  ctx.strokeStyle = color.dark; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, base-TEX*0.5);
  ctx.quadraticCurveTo(cx+TEX*0.12, base-TEX*0.64, cx+TEX*0.1, base-TEX*0.72); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = color.scale;
  ctx.beginPath(); ctx.moveTo(cx, base-TEX*0.5);
  ctx.quadraticCurveTo(cx+TEX*0.1, base-TEX*0.62, cx+TEX*0.08, base-TEX*0.7); ctx.stroke();
  // Neck spikes
  ctx.fillStyle = '#6a2840';
  for (let i = 0; i < 4; i++) {
    const nx = cx + TEX*0.02 + i*TEX*0.025, ny = base - TEX*0.53 - i*TEX*0.055;
    ctx.beginPath(); ctx.moveTo(nx-3, ny); ctx.lineTo(nx, ny-TEX*0.046+i*TEX*0.008); ctx.lineTo(nx+3, ny); ctx.closePath(); ctx.fill();
  }

  // HEAD
  const hx = cx + TEX*0.1, hy = base - TEX*0.8;
  const headGr = ctx.createRadialGradient(hx-TEX*0.04, hy, 0, hx, hy, TEX*0.16);
  headGr.addColorStop(0, '#5a1828'); headGr.addColorStop(0.7, '#300c18'); headGr.addColorStop(1, '#180608');
  ctx.fillStyle = headGr;
  ctx.beginPath(); ctx.ellipse(hx, hy, TEX*0.155, TEX*0.13, 0.25, 0, Math.PI*2); ctx.fill();

  // HORNS
  ctx.fillStyle = '#3a0c18';
  [[hx-TEX*0.07, hy-TEX*0.08, hx-TEX*0.15, hy-TEX*0.25, hx-TEX*0.04, hy-TEX*0.08],
   [hx+TEX*0.04, hy-TEX*0.09, hx+TEX*0.09, hy-TEX*0.27, hx+TEX*0.13, hy-TEX*0.09]
  ].forEach(([x1,y1,x2,y2,x3,y3]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a1828';
    ctx.beginPath(); ctx.moveTo((x1+x3)/2,(y1+y3)/2); ctx.lineTo(x2+TEX*0.01,y2+TEX*0.04); ctx.lineTo((x1+x3)/2+TEX*0.02,(y1+y3)/2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a0c18';
  });

  // SNOUT
  ctx.fillStyle = '#3a1020';
  ctx.beginPath(); ctx.ellipse(hx+TEX*0.12, hy+TEX*0.04, TEX*0.08, TEX*0.055, 0.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a0808';
  ctx.beginPath(); ctx.ellipse(hx+TEX*0.155, hy+TEX*0.02, TEX*0.014, TEX*0.011, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx+TEX*0.13, hy+TEX*0.04, TEX*0.012, TEX*0.01, 0, 0, Math.PI*2); ctx.fill();

  // JAW (animates when breathing)
  const jawDrop = breathe ? TEX*0.04 : TEX*0.01;
  ctx.fillStyle = '#20080e';
  ctx.beginPath(); ctx.ellipse(hx+TEX*0.1, hy+TEX*0.1+jawDrop, TEX*0.08, TEX*0.03+jawDrop*0.5, 0.15, 0, Math.PI*2); ctx.fill();
  if (breathe) {
    ctx.fillStyle = '#ddd0b8';
    for (let t = 0; t < 4; t++) {
      ctx.beginPath();
      ctx.moveTo(hx+TEX*0.065+t*TEX*0.038, hy+TEX*0.075);
      ctx.lineTo(hx+TEX*0.07+t*TEX*0.038, hy+TEX*0.1+jawDrop);
      ctx.lineTo(hx+TEX*0.085+t*TEX*0.038, hy+TEX*0.075);
      ctx.closePath(); ctx.fill();
    }
  }

  // EYES
  const eyePositions = [[hx-TEX*0.04, hy-TEX*0.03], [hx+TEX*0.04, hy-TEX*0.035]];
  eyePositions.forEach(([ex, ey]) => {
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(ex, ey, TEX*0.042, TEX*0.042, 0, 0, Math.PI*2); ctx.fill();
    const gr = ctx.createRadialGradient(ex, ey, 0, ex, ey, TEX*0.04);
    gr.addColorStop(0, 'rgba(255,80,0,1)'); gr.addColorStop(0.55, 'rgba(210,30,0,0.85)'); gr.addColorStop(1, 'rgba(160,0,0,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(ex, ey, TEX*0.042, TEX*0.042, 0, 0, Math.PI*2); ctx.fill();
    // Slit pupil
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath(); ctx.ellipse(ex, ey, TEX*0.009, TEX*0.028, 0, 0, Math.PI*2); ctx.fill();
    // Outer eye glow
    const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, TEX*0.1);
    glow.addColorStop(0, `rgba(255,60,0,${breathe?0.5:0.25})`); glow.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(ex-TEX*0.1, ey-TEX*0.1, TEX*0.2, TEX*0.2);
  });

  // FIRE BREATH
  if (breathe) {
    for (let fi = 0; fi < 12; fi++) {
      const fProgress = Math.random();
      const fX = hx + TEX*0.2 + fProgress * TEX*0.55;
      const fY = hy + TEX*0.07 + (Math.random()-0.5) * TEX*0.06 * fProgress;
      const fR = (TEX*0.05 + Math.random()*TEX*0.04) * (1 - fProgress*0.5);
      const alpha = (1 - fProgress) * 0.9;
      const fireGr = ctx.createRadialGradient(fX, fY, 0, fX, fY, fR);
      const r = Math.floor(255), g = Math.floor(200*(1-fProgress)), b = 0;
      fireGr.addColorStop(0, `rgba(255,255,200,${alpha})`);
      fireGr.addColorStop(0.3, `rgba(${r},${g},${b},${alpha*0.85})`);
      fireGr.addColorStop(1, `rgba(180,20,0,0)`);
      ctx.fillStyle = fireGr; ctx.beginPath(); ctx.arc(fX, fY, fR, 0, Math.PI*2); ctx.fill();
    }
    // Fire light on face
    const fireLight = ctx.createRadialGradient(hx+TEX*0.2, hy+TEX*0.07, 0, hx+TEX*0.2, hy+TEX*0.07, TEX*0.25);
    fireLight.addColorStop(0, 'rgba(255,150,0,0.4)'); fireLight.addColorStop(1, 'rgba(255,150,0,0)');
    ctx.fillStyle = fireLight; ctx.fillRect(hx, hy-TEX*0.18, TEX*0.45, TEX*0.36);
  }
  return c;
}

function genDragonSprites(count = 12) {
  return Array.from({length: count}, (_, i) => genDragonFrame((i / count) * Math.PI * 2));
}

// ═══════════════════════════════════════════════════════════════
//  ANIMATED GOBLIN SPRITE  (8 frames)
// ═══════════════════════════════════════════════════════════════
function genGoblinFrame(phase) {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX * 0.5, base = TEX * 0.88;
  const bob = Math.sin(phase) * 3;
  const armSwing = Math.sin(phase) * 0.35;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(cx, base+bob*0.2, TEX*0.14, TEX*0.025, 0, 0, Math.PI*2); ctx.fill();

  // Legs
  ctx.fillStyle = '#2a5020';
  ctx.beginPath(); ctx.ellipse(cx-TEX*0.08, base-TEX*0.1+Math.abs(bob)*0.3, TEX*0.055, TEX*0.12, 0.1+armSwing*0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.08, base-TEX*0.1-Math.abs(bob)*0.3, TEX*0.055, TEX*0.12, -0.1-armSwing*0.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1008';
  ctx.beginPath(); ctx.ellipse(cx-TEX*0.1, base-TEX*0.01, TEX*0.07, TEX*0.04, 0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.1, base-TEX*0.01, TEX*0.07, TEX*0.04, -0.3, 0, Math.PI*2); ctx.fill();

  // Body
  const bodyGr = ctx.createRadialGradient(cx-TEX*0.04, base-TEX*0.3+bob, 0, cx, base-TEX*0.26+bob, TEX*0.19);
  bodyGr.addColorStop(0, '#4a8040'); bodyGr.addColorStop(1, '#2a5028');
  ctx.fillStyle = bodyGr;
  ctx.beginPath(); ctx.ellipse(cx, base-TEX*0.26+bob, TEX*0.16, TEX*0.19, 0, 0, Math.PI*2); ctx.fill();

  // Tunic
  ctx.fillStyle = '#3a2808';
  ctx.beginPath(); ctx.moveTo(cx-TEX*0.15, base-TEX*0.12+bob); ctx.lineTo(cx-TEX*0.09, base-TEX*0.3+bob);
  ctx.lineTo(cx, base-TEX*0.2+bob); ctx.lineTo(cx+TEX*0.09, base-TEX*0.3+bob); ctx.lineTo(cx+TEX*0.15, base-TEX*0.12+bob);
  ctx.closePath(); ctx.fill();
  // Belt
  ctx.fillStyle = '#5a3010';
  ctx.fillRect(cx-TEX*0.16, base-TEX*0.16+bob, TEX*0.32, TEX*0.03);
  ctx.fillStyle = '#c0a020';
  ctx.fillRect(cx-TEX*0.025, base-TEX*0.175+bob, TEX*0.05, TEX*0.055);

  // Left arm + hand (swings)
  ctx.fillStyle = '#3a7030';
  ctx.beginPath(); ctx.ellipse(cx-TEX*0.23, base-TEX*0.22+bob-armSwing*TEX*0.05, TEX*0.05, TEX*0.12, 0.2+armSwing, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx-TEX*0.26, base-TEX*0.11+bob-armSwing*TEX*0.08, TEX*0.05, TEX*0.04, 0, 0, Math.PI*2); ctx.fill();

  // Right arm + club (opposite swing)
  ctx.fillStyle = '#3a7030';
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.23, base-TEX*0.24+bob+armSwing*TEX*0.05, TEX*0.05, TEX*0.13, -0.25-armSwing, 0, Math.PI*2); ctx.fill();
  // Club
  const clubAngle = 0.3 + armSwing;
  ctx.save(); ctx.translate(cx+TEX*0.24, base-TEX*0.12+bob+armSwing*TEX*0.06); ctx.rotate(clubAngle);
  ctx.fillStyle = '#5a3010'; ctx.fillRect(-TEX*0.025, -TEX*0.26, TEX*0.05, TEX*0.26);
  const cGr = ctx.createRadialGradient(0, -TEX*0.3, 0, 0, -TEX*0.28, TEX*0.09);
  cGr.addColorStop(0, '#6a3810'); cGr.addColorStop(1, '#2a1008');
  ctx.fillStyle = cGr; ctx.beginPath(); ctx.ellipse(0, -TEX*0.3, TEX*0.09, TEX*0.08, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#888'; ctx.beginPath();
  ctx.moveTo(TEX*0.08, -TEX*0.38); ctx.lineTo(TEX*0.14, -TEX*0.45); ctx.lineTo(TEX*0.04, -TEX*0.36); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-TEX*0.08, -TEX*0.36); ctx.lineTo(-TEX*0.14, -TEX*0.44); ctx.lineTo(-TEX*0.04, -TEX*0.34); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Neck
  const neckGr = ctx.createLinearGradient(cx-TEX*0.05, base-TEX*0.44+bob, cx+TEX*0.05, base-TEX*0.44+bob);
  neckGr.addColorStop(0, '#3a7030'); neckGr.addColorStop(1, '#2a5022');
  ctx.fillStyle = neckGr; ctx.beginPath(); ctx.ellipse(cx, base-TEX*0.44+bob, TEX*0.065, TEX*0.06, 0, 0, Math.PI*2); ctx.fill();

  // HEAD
  const headGr = ctx.createRadialGradient(cx-TEX*0.04, base-TEX*0.56+bob, 0, cx, base-TEX*0.54+bob, TEX*0.15);
  headGr.addColorStop(0, '#52904a'); headGr.addColorStop(1, '#2e6028');
  ctx.fillStyle = headGr;
  ctx.beginPath(); ctx.ellipse(cx, base-TEX*0.55+bob, TEX*0.14, TEX*0.155, 0, 0, Math.PI*2); ctx.fill();

  // Ears (pointed)
  ctx.fillStyle = '#3a7030';
  [[-0.15, -0.09, -0.22, -0.18, -0.1], [0.15, -0.09, 0.22, -0.18, 0.1]].forEach(([dx, dy, ex, ey, dx2]) => {
    ctx.beginPath(); ctx.moveTo(cx+dx*TEX, base+(dy-0.46)*TEX+bob);
    ctx.lineTo(cx+ex*TEX, base+(ey-0.46)*TEX+bob); ctx.lineTo(cx+dx2*TEX, base+(dy-0.46)*TEX+bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a8040';
    ctx.beginPath(); ctx.moveTo(cx+dx*TEX*0.85, base+(dy-0.46)*TEX+bob);
    ctx.lineTo(cx+ex*TEX*0.9, base+(ey-0.45)*TEX+bob); ctx.lineTo(cx+dx2*TEX*0.85, base+(dy-0.46)*TEX+bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a7030';
  });

  // Eyes (glow red)
  const eys = [[cx-TEX*0.055, base-TEX*0.57+bob], [cx+TEX*0.055, base-TEX*0.57+bob]];
  eys.forEach(([ex, ey]) => {
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex, ey, TEX*0.036, TEX*0.038, 0, 0, Math.PI*2); ctx.fill();
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, TEX*0.032);
    eg.addColorStop(0, 'rgba(255,20,0,1)'); eg.addColorStop(0.6, 'rgba(200,10,0,0.8)'); eg.addColorStop(1, 'rgba(180,0,0,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(ex, ey, TEX*0.032, TEX*0.034, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,100,60,0.6)'; ctx.beginPath(); ctx.arc(ex+TEX*0.01, ey-TEX*0.012, TEX*0.009, 0, Math.PI*2); ctx.fill();
  });

  // Nose
  ctx.fillStyle = '#2e6028';
  ctx.beginPath(); ctx.ellipse(cx, base-TEX*0.53+bob, TEX*0.02, TEX*0.024, 0, 0, Math.PI*2); ctx.fill();

  // Mouth grin with teeth
  ctx.strokeStyle = '#1a0808'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, base-TEX*0.505+bob, TEX*0.06, 0.2, Math.PI-0.2); ctx.stroke();
  ctx.fillStyle = '#e8e0d0';
  for (let t = 0; t < 4; t++) ctx.fillRect(cx-TEX*0.05+t*TEX*0.033, base-TEX*0.505+bob, TEX*0.02, TEX*0.022);

  return c;
}

function genGoblinSprites(count = 8) {
  return Array.from({length: count}, (_, i) => genGoblinFrame((i / count) * Math.PI * 2));
}

// ═══════════════════════════════════════════════════════════════
//  PICKUP SPRITES
// ═══════════════════════════════════════════════════════════════
function genCoinSprite(frame) {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX / 2, cy = TEX / 2;
  const scX = Math.max(0.08, Math.abs(Math.cos(frame * 0.06)));
  const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, TEX*0.35);
  gr.addColorStop(0, 'rgba(255,210,40,0.35)'); gr.addColorStop(1, 'rgba(255,180,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, TEX, TEX);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scX, 1);
  const coinGr = ctx.createRadialGradient(-TEX*0.06, -TEX*0.06, 0, 0, 0, TEX*0.26);
  coinGr.addColorStop(0, '#ffe060'); coinGr.addColorStop(0.5, '#c89020'); coinGr.addColorStop(1, '#7a5008');
  ctx.fillStyle = coinGr; ctx.beginPath(); ctx.arc(0, 0, TEX*0.28, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#f0d040'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#f0d060'; ctx.font = `bold ${TEX*0.28}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('G', 0, 0);
  ctx.restore();
  return c;
}

function genPotionSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX * 0.5, cy = TEX * 0.55;
  const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, TEX*0.32);
  gr.addColorStop(0, 'rgba(220,20,50,0.38)'); gr.addColorStop(1, 'rgba(200,0,30,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, TEX, TEX);
  const bottleGr = ctx.createRadialGradient(cx-TEX*0.07, cy-TEX*0.02, 0, cx, cy, TEX*0.22);
  bottleGr.addColorStop(0, '#c02040'); bottleGr.addColorStop(0.6, '#7a0020'); bottleGr.addColorStop(1, '#3a0010');
  ctx.fillStyle = bottleGr; ctx.beginPath(); ctx.ellipse(cx, cy+TEX*0.08, TEX*0.2, TEX*0.26, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,180,190,0.35)';
  ctx.beginPath(); ctx.ellipse(cx-TEX*0.08, cy-TEX*0.04, TEX*0.05, TEX*0.14, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#5a0818'; ctx.fillRect(cx-TEX*0.08, cy-TEX*0.24, TEX*0.16, TEX*0.12);
  ctx.fillStyle = '#c0a050'; ctx.fillRect(cx-TEX*0.09, cy-TEX*0.14, TEX*0.18, TEX*0.03);
  ctx.fillStyle = '#a07030'; ctx.fillRect(cx-TEX*0.06, cy-TEX*0.33, TEX*0.12, TEX*0.11);
  ctx.fillStyle = '#ff8090'; ctx.fillRect(cx-TEX*0.04, cy+TEX*0.02, TEX*0.08, TEX*0.2);
  ctx.fillRect(cx-TEX*0.1, cy+TEX*0.07, TEX*0.2, TEX*0.07);
  return c;
}

// ═══════════════════════════════════════════════════════════════
//  WAND RENDERER
// ═══════════════════════════════════════════════════════════════
function drawWand(ctx, bobY, fireFlash, frameN, moving) {
  const sway = Math.sin(frameN * 0.025) * 3.5;
  const walkBob = moving ? Math.sin(frameN * 0.14) * 6 : 0;
  const wandX = W * 0.5 + sway;
  const wandBaseY = H * 0.78 + walkBob + bobY * 0.4;
  const wandAngle = 0.12 + sway * 0.018;
  const recoil = fireFlash > 0.7 ? (fireFlash - 0.7) * 30 : 0;

  ctx.save();
  ctx.translate(wandX, wandBaseY + recoil);
  ctx.rotate(wandAngle);

  // Handle shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 60, 6, 55, 0, 0, Math.PI*2); ctx.fill();

  // Handle wood grain
  const handleGr = ctx.createLinearGradient(-5, 0, 5, 0);
  handleGr.addColorStop(0, '#1a0e06'); handleGr.addColorStop(0.3, '#4a2810'); handleGr.addColorStop(0.7, '#382010'); handleGr.addColorStop(1, '#120a04');
  ctx.fillStyle = handleGr;
  ctx.beginPath();
  ctx.moveTo(-6, 65); ctx.lineTo(-4.5, -H*0.27); ctx.lineTo(4.5, -H*0.27); ctx.lineTo(6, 65);
  ctx.closePath(); ctx.fill();

  // Wood grain lines
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8;
  for (let g = 0; g < 6; g++) {
    ctx.beginPath(); ctx.moveTo(-4+g*1.5, 65); ctx.lineTo(-4.5+g*1.5, -H*0.27); ctx.stroke();
  }
  // Leather wrapping
  ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = 2;
  for (let w = 0; w < 6; w++) ctx.strokeRect(-6, -20 + w * 14, 12, 8);
  ctx.strokeStyle = '#6a3010'; ctx.lineWidth = 1;
  for (let w = 0; w < 6; w++) ctx.strokeRect(-5.5, -19 + w * 14, 11, 6);

  // Metal band at grip
  const bandGr = ctx.createLinearGradient(-6, 0, 6, 0);
  bandGr.addColorStop(0, '#484030'); bandGr.addColorStop(0.5, '#908060'); bandGr.addColorStop(1, '#484030');
  ctx.fillStyle = bandGr; ctx.fillRect(-6.5, -H*0.275, 13, 8);

  // Orb socket
  const socketGr = ctx.createLinearGradient(-8, -H*0.32, 8, -H*0.32);
  socketGr.addColorStop(0, '#2a2020'); socketGr.addColorStop(0.5, '#605040'); socketGr.addColorStop(1, '#2a2020');
  ctx.fillStyle = socketGr;
  ctx.beginPath(); ctx.ellipse(0, -H*0.305, 9, 10, 0, 0, Math.PI*2); ctx.fill();

  // Glow from orb
  const orbPulse = Math.sin(frameN * 0.09) * 0.3 + 0.7;
  const orbY = -H * 0.33;
  const outerGlow = ctx.createRadialGradient(0, orbY, 0, 0, orbY, 42 + orbPulse * 8);
  outerGlow.addColorStop(0, `rgba(80,120,255,${0.35 * orbPulse + (fireFlash > 0 ? 0.4 : 0)})`);
  outerGlow.addColorStop(0.5, `rgba(40,60,200,${0.15 * orbPulse})`);
  outerGlow.addColorStop(1, 'rgba(20,30,180,0)');
  ctx.fillStyle = outerGlow; ctx.fillRect(-60, orbY - 60, 120, 120);

  // ORB
  const orbGr = ctx.createRadialGradient(-4, orbY - 4, 0, 0, orbY, 13);
  const orbBrightness = fireFlash > 0 ? 1.0 : orbPulse;
  orbGr.addColorStop(0, `rgba(220,240,255,${orbBrightness})`);
  orbGr.addColorStop(0.3, `rgba(100,140,255,${orbBrightness * 0.9})`);
  orbGr.addColorStop(0.7, `rgba(50,60,200,${orbBrightness * 0.8})`);
  orbGr.addColorStop(1, `rgba(20,20,120,${orbBrightness * 0.6})`);
  ctx.fillStyle = orbGr; ctx.beginPath(); ctx.arc(0, orbY, 13, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = `rgba(160,180,255,${orbBrightness * 0.8})`; ctx.lineWidth = 1.5; ctx.stroke();
  // Orb inner sparkle
  ctx.fillStyle = `rgba(255,255,255,${orbBrightness * 0.7})`;
  ctx.beginPath(); ctx.arc(-4, orbY - 4, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-2, orbY - 2, 1.5, 0, Math.PI*2); ctx.fill();

  // FIRE FLASH effect
  if (fireFlash > 0) {
    const fAlpha = fireFlash;
    // Beam shooting up
    const beamGr = ctx.createLinearGradient(0, orbY, 0, orbY - H*0.8);
    beamGr.addColorStop(0, `rgba(180,210,255,${fAlpha * 0.95})`);
    beamGr.addColorStop(0.2, `rgba(100,150,255,${fAlpha * 0.7})`);
    beamGr.addColorStop(0.6, `rgba(60,80,220,${fAlpha * 0.4})`);
    beamGr.addColorStop(1, 'rgba(40,40,200,0)');
    const beamW = fAlpha * 10 + 2;
    ctx.fillStyle = beamGr; ctx.fillRect(-beamW/2, orbY - H*0.8, beamW, H*0.8);

    // Muzzle burst
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const len = (60 + Math.random() * 30) * fAlpha;
      const gr = ctx.createLinearGradient(0, orbY, Math.cos(angle)*len, orbY + Math.sin(angle)*len);
      gr.addColorStop(0, `rgba(200,220,255,${fAlpha * 0.8})`);
      gr.addColorStop(1, 'rgba(100,120,255,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = fAlpha * 3 + 0.5;
      ctx.beginPath(); ctx.moveTo(0, orbY);
      ctx.lineTo(Math.cos(angle)*len, orbY + Math.sin(angle)*len); ctx.stroke();
    }

    // Impact rings
    for (let r = 0; r < 3; r++) {
      const ringR = (r + 1) * 18 * fAlpha;
      ctx.strokeStyle = `rgba(150,180,255,${fAlpha * (0.6 - r*0.15)})`;
      ctx.lineWidth = fAlpha * 2;
      ctx.beginPath(); ctx.arc(0, orbY, ringR, 0, Math.PI*2); ctx.stroke();
    }
  }
  ctx.restore();

  // Screen-space flash overlay
  if (fireFlash > 0.5) {
    const screenFlash = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, H*0.8);
    screenFlash.addColorStop(0, `rgba(100,140,255,${(fireFlash-0.5)*0.45})`);
    screenFlash.addColorStop(1, 'rgba(40,60,200,0)');
    ctx.fillStyle = screenFlash; ctx.fillRect(0, 0, W, H);
  }
}

// ═══════════════════════════════════════════════════════════════
//  MINIMAP & COMPASS
// ═══════════════════════════════════════════════════════════════
function drawMinimap(ctx, p, pickups, entities, ts) {
  const mW = mapWidth * ts, mH = mapHeight * ts;
  const mx = W - mW - 12, my = 12;
  ctx.fillStyle = 'rgba(4,3,2,0.85)'; ctx.fillRect(mx-3, my-3, mW+6, mH+6);
  ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1; ctx.strokeRect(mx-3, my-3, mW+6, mH+6);
  ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 0.5; ctx.strokeRect(mx-5, my-5, mW+10, mH+10);
  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const t = worldMap[x][y];
      ctx.fillStyle = t===1?'#4a3a24':t===3?'#5a2818':t===4?'#3a2210':t===2?'rgba(180,40,20,0.45)':'#13100c';
      ctx.fillRect(mx+x*ts, my+y*ts, ts, ts);
    }
  }
  pickups.forEach(pu => {
    if (pu.collected) return;
    ctx.fillStyle = pu.type==='coin'?'#c8a020':'#20c050';
    ctx.beginPath(); ctx.arc(mx+pu.x*ts, my+pu.y*ts, 1.5, 0, Math.PI*2); ctx.fill();
  });
  entities.forEach(e => {
    if (worldMap[Math.floor(e.x)][Math.floor(e.y)] !== 2) return;
    ctx.fillStyle = 'rgba(220,40,20,0.9)';
    ctx.beginPath(); ctx.arc(mx+e.x*ts, my+e.y*ts, 2, 0, Math.PI*2); ctx.fill();
  });
  const px = mx+p.x*ts, py = my+p.y*ts;
  ctx.fillStyle = '#e8d070'; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#e8d070'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+p.dirX*7, py+p.dirY*7); ctx.stroke();
}

function drawCompass(ctx, p) {
  const cx = W/2, cy = 30, r = 22;
  const angle = Math.atan2(p.dirY, p.dirX);
  ctx.fillStyle = 'rgba(4,3,2,0.78)'; ctx.beginPath(); ctx.arc(cx, cy, r+4, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(cx, cy, r+6, 0, Math.PI*2); ctx.stroke();
  for (let t = 0; t < 8; t++) {
    const ta = (t/8)*Math.PI*2-angle;
    const ir = t%2===0?r-6:r-3;
    ctx.strokeStyle = t%2===0?'#7a5830':'#3a2810'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx+Math.cos(ta)*ir, cy+Math.sin(ta)*ir);
    ctx.lineTo(cx+Math.cos(ta)*r, cy+Math.sin(ta)*r); ctx.stroke();
  }
  [['N',-Math.PI/2,'#d04040'],['E',0,'#8a6840'],['S',Math.PI/2,'#7a5830'],['W',Math.PI,'#7a5830']].forEach(([l,a,col]) => {
    const ra = a - angle;
    ctx.font = "bold 8px 'Cinzel', serif"; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = col; ctx.globalAlpha = l==='N'?1:0.85;
    ctx.fillText(l, cx+Math.cos(ra)*(r-8), cy+Math.sin(ra)*(r-8));
  });
  ctx.globalAlpha = 1;
  const na = -angle;
  ctx.strokeStyle = '#e03030'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+Math.cos(na)*(r-5), cy+Math.sin(na)*(r-5)); ctx.stroke();
  ctx.strokeStyle = '#506870'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx-Math.cos(na)*(r-8), cy-Math.sin(na)*(r-8)); ctx.stroke();
  ctx.fillStyle = '#c8a96e'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI*2); ctx.fill();
}

// ═══════════════════════════════════════════════════════════════
//  SCARY MUSIC SYSTEM
// ═══════════════════════════════════════════════════════════════
class ScaryMusic {
  constructor() { this.actx = null; this.master = null; this.nodes = []; this.timers = []; this.alive = false; }

  start() {
    if (this.alive) return;
    try {
      this.actx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.actx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.actx.destination);
      this.alive = true;
      this._drone(); this._heartbeat(); this._wind(); this._stabs(); this._descendingMelody();
    } catch(e) { console.warn('AudioContext failed', e); }
  }

  _drone() {
    // Thick detuned drone cluster in A1 / E2 range
    [[55, 'sawtooth', 0.14], [55.4, 'sawtooth', 0.10], [82.4, 'sine', 0.07], [110, 'triangle', 0.05], [146.8, 'sine', 0.04]].forEach(([freq, type, vol], i) => {
      const osc = this.actx.createOscillator();
      const gain = this.actx.createGain();
      const lpf = this.actx.createBiquadFilter();
      osc.type = type; osc.frequency.value = freq;
      lpf.type = 'lowpass'; lpf.frequency.value = 350 + i*80; lpf.Q.value = 1.5;
      gain.gain.value = vol;
      const lfo = this.actx.createOscillator(); const lfoG = this.actx.createGain();
      lfo.frequency.value = 0.08 + i*0.06; lfoG.gain.value = vol * 0.28;
      lfo.connect(lfoG); lfoG.connect(gain.gain); lfo.start();
      osc.connect(lpf); lpf.connect(gain); gain.connect(this.master); osc.start();
      this.nodes.push(osc, lfo);
    });
  }

  _heartbeat() {
    const beat = () => {
      if (!this.alive) return;
      const now = this.actx.currentTime;
      [[0, 65, 30, 0.32], [0.28, 55, 26, 0.22]].forEach(([delay, f1, f2, vol]) => {
        const o = this.actx.createOscillator(), g = this.actx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f1, now+delay); o.frequency.exponentialRampToValueAtTime(f2, now+delay+0.22);
        g.gain.setValueAtTime(vol, now+delay); g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.35);
        o.connect(g); g.connect(this.master); o.start(now+delay); o.stop(now+delay+0.5);
      });
      this.timers.push(setTimeout(beat, 1350 + Math.random()*300));
    };
    this.timers.push(setTimeout(beat, 600));
  }

  _wind() {
    const sr = this.actx.sampleRate, buf = this.actx.createBuffer(1, sr*3, sr);
    const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const src = this.actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = this.actx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=600; bp.Q.value=0.4;
    const hp = this.actx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=300;
    const g = this.actx.createGain(); g.gain.value = 0.038;
    const lfo = this.actx.createOscillator(); const lg = this.actx.createGain();
    lfo.frequency.value = 0.04; lg.gain.value = 0.025; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(this.master); src.start();
    this.nodes.push(src, lfo);
  }

  _stabs() {
    const stab = () => {
      if (!this.alive) return;
      const now = this.actx.currentTime;
      // Dissonant tritone cluster
      const roots = [196, 233.1, 277.2, 311.1, 370.0];
      roots.slice(0, 2 + (Math.random()*3|0)).forEach(freq => {
        const o = this.actx.createOscillator(), g = this.actx.createGain(), f = this.actx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = freq * (Math.random()<0.25?0.5:1);
        f.type = 'lowpass'; f.frequency.value = 1100;
        g.gain.setValueAtTime(0.001, now); g.gain.linearRampToValueAtTime(0.11, now+0.12);
        g.gain.exponentialRampToValueAtTime(0.001, now+2.8);
        o.connect(f); f.connect(g); g.connect(this.master); o.start(now); o.stop(now+3.2);
      });
      this.timers.push(setTimeout(stab, 5000 + Math.random()*9000));
    };
    this.timers.push(setTimeout(stab, 3000 + Math.random()*4000));
  }

  _descendingMelody() {
    // Slow chromatic descent — oppressive, inevitable
    const notes = [220,207.7,196,185,174.6,164.8,155.6,146.8,138.6,130.8,123.5,116.5,110];
    let idx = 0;
    const play = () => {
      if (!this.alive) return;
      const now = this.actx.currentTime, freq = notes[idx++ % notes.length];
      const o = this.actx.createOscillator(), g = this.actx.createGain(), f = this.actx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = freq;
      f.type = 'bandpass'; f.frequency.value = freq*1.5; f.Q.value = 3;
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.055, now+0.5);
      g.gain.setValueAtTime(0.055, now+1.2); g.gain.exponentialRampToValueAtTime(0.001, now+3.2);
      o.connect(f); f.connect(g); g.connect(this.master); o.start(now); o.stop(now+3.8);
      this.timers.push(setTimeout(play, 2400 + Math.random()*1800));
    };
    this.timers.push(setTimeout(play, 2200));
  }

  fireBlast() {
    if (!this.actx) return;
    const now = this.actx.currentTime;
    // Whoosh
    [[800,160,0,0.22],[200,40,0.12,0.18]].forEach(([f1,f2,delay,vol]) => {
      const o = this.actx.createOscillator(), g = this.actx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f1, now+delay);
      o.frequency.exponentialRampToValueAtTime(f2, now+delay+0.18);
      g.gain.setValueAtTime(vol, now+delay); g.gain.exponentialRampToValueAtTime(0.001, now+delay+0.28);
      o.connect(g); g.connect(this.master); o.start(now+delay); o.stop(now+delay+0.35);
    });
    // Arcane resonance
    const o3 = this.actx.createOscillator(), g3 = this.actx.createGain();
    o3.type = 'sine'; o3.frequency.value = 440;
    g3.gain.setValueAtTime(0.08, now+0.05); g3.gain.exponentialRampToValueAtTime(0.001, now+0.5);
    o3.connect(g3); g3.connect(this.master); o3.start(now+0.05); o3.stop(now+0.6);
  }

  stop() {
    this.alive = false;
    this.timers.forEach(clearTimeout);
    this.nodes.forEach(n => { try { n.stop(); } catch(_) {} });
    if (this.actx) this.actx.close();
  }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Raycaster({ onEncounter, onPickup }) {
  const canvasRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const pointerLockedRef = useRef(false);

  const textures = useRef({});
  const dragonFrames = useRef([]);
  const goblinFrames = useRef([]);
  const pickupSprites = useRef({});
  const entities = useRef([]);
  const pickups = useRef([]);

  const player = useRef({ x: 2.5, y: 2.5, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66, moveSpeed: 0.055, rotSpeed: 0.04 });
  const keys = useRef({});
  const torch = useRef(1.0);
  const bob = useRef(0);
  const frame = useRef(0);
  const fireFlash = useRef(0);
  const canvasNotifs = useRef([]);
  const music = useRef(null);
  const onEncounterRef = useRef(onEncounter);
  const onPickupRef = useRef(onPickup);

  useEffect(() => { onEncounterRef.current = onEncounter; }, [onEncounter]);
  useEffect(() => { onPickupRef.current = onPickup; }, [onPickup]);

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    textures.current = { 1: genStoneWall(), 3: genBrickWall(), 4: genWoodWall() };
    dragonFrames.current = genDragonSprites(12);
    goblinFrames.current = genGoblinSprites(8);
    pickupSprites.current = { potion: genPotionSprite(), coin: genCoinSprite(0) };

    const ents = [];
    for (let x = 0; x < mapWidth; x++)
      for (let y = 0; y < mapHeight; y++)
        if (worldMap[x][y] === 2) ents.push({ x: x+0.5, y: y+0.5, type: Math.floor(Math.random()*2) }); // 0=dragon, 1=goblin
    entities.current = ents;

    const open = [];
    for (let x=2;x<mapWidth-2;x++) for (let y=2;y<mapHeight-2;y++) if(worldMap[x][y]===0) open.push({x:x+0.5,y:y+0.5});
    open.sort(()=>Math.random()-0.5);
    for (let i=0;i<Math.min(PICKUP_COUNT,open.length);i++)
      pickups.current.push({...open[i],type:i%3===0?'potion':'coin',collected:false,phase:Math.random()*Math.PI*2});

    music.current = new ScaryMusic();
    setIsLoaded(true);
    return () => { if (music.current) music.current.stop(); };
  }, []);

  // ── Game Loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let rafId;
    let coinFrame = 0;
    const coinInterval = setInterval(() => {
      coinFrame++; pickupSprites.current.coin = genCoinSprite(coinFrame);
    }, 80);

    const onKD = e => {
      keys.current[e.key] = true;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        fireFlash.current = 1.0;
        music.current?.fireBlast();
        // Try to trigger encounter with enemy in crosshair
        const p = player.current;
        let closest = null, closestDist = 6;
        entities.current.forEach(ent => {
          if (worldMap[Math.floor(ent.x)][Math.floor(ent.y)] !== 2) return;
          const dx = ent.x - p.x, dy = ent.y - p.y;
          const dist = Math.sqrt(dx*dx+dy*dy);
          if (dist > closestDist) return;
          // Check if roughly in front
          const dot = (dx/dist)*p.dirX + (dy/dist)*p.dirY;
          if (dot > 0.82) { closest = ent; closestDist = dist; }
        });
        if (closest) {
          worldMap[Math.floor(closest.x)][Math.floor(closest.y)] = 0;
          keys.current = {};
          cancelAnimationFrame(rafId); clearInterval(coinInterval);
          setTimeout(() => onEncounterRef.current(), 300);
        }
      }
    };
    const onKU = e => { keys.current[e.key] = false; };
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);

    const onClick = () => {
      canvas.requestPointerLock();
      music.current?.start();
    };
    const onPLC = () => {
      const locked = document.pointerLockElement === canvas;
      pointerLockedRef.current = locked; setPointerLocked(locked);
    };
    const onMM = e => {
      if (document.pointerLockElement !== canvas) return;
      const p = player.current, rot = -e.movementX * MOUSE_SENS;
      const c = Math.cos(rot), s = Math.sin(rot);
      const [odx,opx] = [p.dirX,p.planeX];
      p.dirX=odx*c-p.dirY*s; p.dirY=odx*s+p.dirY*c;
      p.planeX=opx*c-p.planeY*s; p.planeY=opx*s+p.planeY*c;
    };
    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onPLC);
    window.addEventListener('mousemove', onMM);

    const loop = () => {
      frame.current++;
      const p = player.current;
      const sprint = keys.current['Shift'] ? 1.7 : 1;
      const ms = p.moveSpeed * sprint;
      let moving = false;

      const tryMove = (dx, dy) => {
        if (worldMap[Math.floor(p.x+dx*1.3)][Math.floor(p.y)] === 0) p.x += dx;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y+dy*1.3)] === 0) p.y += dy;
        moving = true;
      };
      const tryRot = a => {
        const c=Math.cos(a),s=Math.sin(a);
        const [odx,opx]=[p.dirX,p.planeX];
        p.dirX=odx*c-p.dirY*s; p.dirY=odx*s+p.dirY*c;
        p.planeX=opx*c-p.planeY*s; p.planeY=opx*s+p.planeY*c;
      };

      if (keys.current['w']||keys.current['ArrowUp'])    tryMove(p.dirX*ms, p.dirY*ms);
      if (keys.current['s']||keys.current['ArrowDown'])  tryMove(-p.dirX*ms, -p.dirY*ms);
      // ✅ FIXED: A = strafe left, D = strafe right
      if (keys.current['a'])          tryMove(-p.planeX*ms, -p.planeY*ms);
      if (keys.current['d'])          tryMove(p.planeX*ms, p.planeY*ms);
      if (keys.current['ArrowLeft'])  tryRot(p.rotSpeed);
      if (keys.current['ArrowRight']) tryRot(-p.rotSpeed);

      // Step on enemy tile
      if (worldMap[Math.floor(p.x)][Math.floor(p.y)] === 2) {
        worldMap[Math.floor(p.x)][Math.floor(p.y)] = 0;
        keys.current = {};
        cancelAnimationFrame(rafId); clearInterval(coinInterval);
        onEncounterRef.current(); return;
      }

      // Pickups
      pickups.current.forEach(pu => {
        if (pu.collected) return;
        const dx=p.x-pu.x, dy=p.y-pu.y;
        if (dx*dx+dy*dy < 0.4) {
          pu.collected = true;
          const [txt, col] = pu.type==='coin' ? ['+15 Gold  💰','#f0d040'] : ['+20 Health  🧪','#50e070'];
          canvasNotifs.current.push({ text: txt, color: col, life: 70, y: H*0.38 });
          onPickupRef.current?.(pu.type==='coin'?'gold':'health', pu.type==='coin'?15:20);
        }
      });

      // Update refs
      if (moving) bob.current += sprint > 1 ? 0.1 : 0.065;
      torch.current += (Math.random()-0.5)*0.03;
      torch.current = Math.max(0.8, Math.min(1.0, torch.current));
      if (fireFlash.current > 0) fireFlash.current = Math.max(0, fireFlash.current - 0.045);

      // ── CEILING & FLOOR ──────────────────────────────────────
      const ceilGr = ctx.createLinearGradient(0,0,0,H/2);
      ceilGr.addColorStop(0,'#060410'); ceilGr.addColorStop(1,'#140c24');
      ctx.fillStyle=ceilGr; ctx.fillRect(0,0,W,H/2);
      const floorGr = ctx.createLinearGradient(0,H/2,0,H);
      floorGr.addColorStop(0,'#181006'); floorGr.addColorStop(1,'#070502');
      ctx.fillStyle=floorGr; ctx.fillRect(0,H/2,W,H/2);
      ctx.globalAlpha=0.06;
      for (let y=H/2+10;y<H;y+=16) { ctx.fillStyle='#c8a96e'; ctx.fillRect(0,y,W,1); }
      ctx.globalAlpha=1;

      const bobY = Math.sin(bob.current*8)*3.5;
      const zBuf = new Float32Array(W);

      // ── WALLS ────────────────────────────────────────────────
      for (let x=0;x<W;x++) {
        const camX=2*x/W-1;
        const rDX=p.dirX+p.planeX*camX, rDY=p.dirY+p.planeY*camX;
        let mX=p.x|0, mY=p.y|0;
        const ddX=Math.abs(1/rDX), ddY=Math.abs(1/rDY);
        let sdX=rDX<0?(p.x-mX)*ddX:(mX+1-p.x)*ddX;
        let sdY=rDY<0?(p.y-mY)*ddY:(mY+1-p.y)*ddY;
        const stX=rDX<0?-1:1, stY=rDY<0?-1:1;
        let hit=0, side=0, tile=1;

        for (let iter=0;iter<48&&!hit;iter++) {
          if (sdX<sdY) { sdX+=ddX; mX+=stX; side=0; } else { sdY+=ddY; mY+=stY; side=1; }
          if (mX<0||mX>=mapWidth||mY<0||mY>=mapHeight){hit=1;tile=1;break;}
          const t=worldMap[mX][mY];
          if(t===1||t===3||t===4){hit=1;tile=t;}
        }
        const pwd=side===0?sdX-ddX:sdY-ddY;
        zBuf[x]=pwd;
        const lH=Math.floor(H/Math.max(pwd,0.01));
        const dS=Math.max(0,Math.floor(-lH/2+H/2+bobY));
        const dE=Math.min(H-1,Math.floor(lH/2+H/2+bobY));
        const aH=dE-dS; if(aH<=0) continue;
        const wallImg=textures.current[tile]||textures.current[1];
        let wX=side===0?p.y+pwd*rDY:p.x+pwd*rDX; wX-=Math.floor(wX);
        let tX=Math.floor(wX*TEX);
        if(side===0&&rDX>0) tX=TEX-tX-1;
        if(side===1&&rDY<0) tX=TEX-tX-1;
        tX=Math.max(0,Math.min(TEX-1,tX));
        ctx.drawImage(wallImg,tX,0,1,TEX,x,dS,1,aH);
        const fog=Math.min(0.93,pwd/FOG_DIST);
        const dim=Math.min(0.97,fog+(side===1?0.18:0)+(1-torch.current)*0.15);
        ctx.fillStyle=`rgba(0,0,0,${dim.toFixed(3)})`; ctx.fillRect(x,dS,1,aH);
        if (pwd<3.5) { const w=(1-pwd/3.5)*0.16*torch.current; ctx.fillStyle=`rgba(200,90,10,${w.toFixed(3)})`; ctx.fillRect(x,dS,1,aH); }
      }

      // ── SPRITES ──────────────────────────────────────────────
      const animTick = Math.floor(frame.current / 5);
      const allSp = [
        ...entities.current.map(e=>({...e,kind:'enemy'})),
        ...pickups.current.filter(pu=>!pu.collected).map(pu=>({...pu,kind:'pickup'})),
      ];
      allSp.forEach(s=>{ s.dist2=(p.x-s.x)**2+(p.y-s.y)**2; });
      allSp.sort((a,b)=>b.dist2-a.dist2);
      let closestEnemyDist2 = Infinity;

      allSp.forEach(sp => {
        if (sp.kind==='enemy' && worldMap[Math.floor(sp.x)][Math.floor(sp.y)]!==2) return;
        const spX=sp.x-p.x, spY=sp.y-p.y;
        const invDet=1/(p.planeX*p.dirY-p.dirX*p.planeY);
        const tX=invDet*(p.dirY*spX-p.dirX*spY);
        const tY=invDet*(-p.planeY*spX+p.planeX*spY);
        if (tY<0.15) return;

        if (sp.kind==='enemy' && sp.dist2<closestEnemyDist2) closestEnemyDist2=sp.dist2;

        const sScreenX=Math.floor((W/2)*(1+tX/tY));
        const sH=Math.abs(Math.floor(H/tY));
        const bobExtra=sp.kind==='pickup'?Math.sin(frame.current*0.045+(sp.phase||0))*9:0;
        const dSY=Math.max(0,Math.floor(-sH/2+H/2+bobY+bobExtra));
        const dEY=Math.min(H-1,Math.floor(sH/2+H/2+bobY+bobExtra));
        const aSH=dEY-dSY; const sW=Math.abs(Math.floor(H/tY));
        const dSX=Math.floor(sScreenX-sW/2);
        if (aSH<=0||sW<=0) return;

        // Pick sprite frame
        let img;
        if (sp.kind==='pickup') {
          img = sp.type==='coin' ? pickupSprites.current.coin : pickupSprites.current.potion;
        } else {
          const frames = sp.type===0 ? dragonFrames.current : goblinFrames.current;
          img = frames[animTick % frames.length];
        }
        if (!img) return;

        // Pickup glow
        if (sp.kind==='pickup') {
          const ga=(Math.sin(frame.current*0.06+(sp.phase||0))*0.15+0.25)*Math.max(0,1-Math.sqrt(sp.dist2)/6);
          if (ga>0.01) { ctx.globalAlpha=ga; ctx.fillStyle=sp.type==='coin'?'#f0c020':'#20d050'; ctx.beginPath(); ctx.arc(sScreenX,(dSY+dEY)/2,sW*0.55,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
        }

        for (let stripe=Math.max(0,dSX);stripe<Math.min(W,dSX+sW);stripe++) {
          if (tY>=zBuf[stripe]) continue;
          const texCol=Math.floor((stripe-dSX)*TEX/sW);
          if (texCol<0||texCol>=TEX) continue;
          ctx.drawImage(img,texCol,0,1,TEX,stripe,dSY,1,aSH);
          const spFog=Math.min(0.88,Math.sqrt(sp.dist2)/FOG_DIST);
          if (spFog>0.04) { ctx.fillStyle=`rgba(0,0,0,${spFog.toFixed(3)})`; ctx.fillRect(stripe,dSY,1,aSH); }
        }
      });

      // ── VIGNETTE ─────────────────────────────────────────────
      const vig=ctx.createRadialGradient(W/2,H/2,H*0.22,W/2,H/2,H*0.85);
      vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.75)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

      // ── WAND ─────────────────────────────────────────────────
      drawWand(ctx, bobY, fireFlash.current, frame.current, moving);

      // ── CROSSHAIR ────────────────────────────────────────────
      const nearEnemy=closestEnemyDist2<9;
      const ca=nearEnemy?0.7+Math.sin(frame.current*0.2)*0.25:0.65;
      ctx.strokeStyle=nearEnemy?'#ff3a3a':'rgba(220,190,130,0.7)'; ctx.globalAlpha=ca; ctx.lineWidth=1.5; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(W/2-13,H/2); ctx.lineTo(W/2-4,H/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W/2+4,H/2); ctx.lineTo(W/2+13,H/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W/2,H/2-13); ctx.lineTo(W/2,H/2-4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W/2,H/2+4); ctx.lineTo(W/2,H/2+13); ctx.stroke();
      if (nearEnemy) {
        ctx.strokeStyle='#ff3a3a'; ctx.lineWidth=0.8; ctx.globalAlpha=ca*0.55;
        ctx.beginPath(); ctx.arc(W/2,H/2,17,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(W/2,H/2,22,0,Math.PI*2); ctx.stroke();
      }
      ctx.globalAlpha=1;

      // ── MINIMAP ──────────────────────────────────────────────
      const ts=Math.max(3,Math.floor(80/Math.max(mapWidth,mapHeight)));
      drawMinimap(ctx,p,pickups.current,entities.current,ts);

      // ── COMPASS ──────────────────────────────────────────────
      drawCompass(ctx,p);

      // ── CANVAS NOTIFS ────────────────────────────────────────
      canvasNotifs.current=canvasNotifs.current.filter(n=>n.life>0);
      canvasNotifs.current.forEach(n => {
        n.life--; n.y-=0.5;
        ctx.globalAlpha=Math.min(1,n.life/20);
        ctx.font="bold 17px 'Cinzel',serif"; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor=n.color; ctx.shadowBlur=10;
        ctx.fillStyle=n.color; ctx.fillText(n.text,W/2,n.y);
        ctx.shadowBlur=0; ctx.globalAlpha=1;
      });

      // ── FIRE HINT / POINTER LOCK HINT ────────────────────────
      if (!pointerLockedRef.current) {
        ctx.globalAlpha=0.45; ctx.fillStyle='#c8a96e'; ctx.font="11px 'Crimson Text',serif"; ctx.textAlign='center';
        ctx.fillText('Click to enable mouse look & start music',W/2,H-14);
        ctx.globalAlpha=1;
      } else {
        ctx.globalAlpha=0.3; ctx.fillStyle='#c8a96e'; ctx.font="10px 'Crimson Text',serif"; ctx.textAlign='left';
        ctx.fillText('SPACE / click enemy to cast',12,H-14);
        ctx.globalAlpha=1;
      }

      rafId=requestAnimationFrame(loop);
    };

    rafId=requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId); clearInterval(coinInterval);
      window.removeEventListener('keydown',onKD); window.removeEventListener('keyup',onKU);
      canvas.removeEventListener('click',onClick);
      document.removeEventListener('pointerlockchange',onPLC);
      window.removeEventListener('mousemove',onMM);
    };
  }, [isLoaded]);

  if (!isLoaded) return (
    <div style={{ width:'100%', height:'calc(100vh - 44px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#060402', gap:24 }}>
      <style>{`@keyframes lb{0%{left:-40%}100%{left:110%}}`}</style>
      <div style={{ fontSize:10, letterSpacing:8, color:'#3a2810', fontFamily:"'Cinzel',serif" }}>FORGING THE DUNGEON</div>
      <div style={{ width:220, height:2, background:'#1a1208', borderRadius:1, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', top:0, width:'40%', height:'100%', background:'linear-gradient(90deg,transparent,#c8a96e,transparent)', animation:'lb 1.4s ease-in-out infinite' }} />
      </div>
      <div style={{ fontSize:10, letterSpacing:3, color:'#2a1808', fontFamily:"'Crimson Text',serif", fontStyle:'italic' }}>Summoning terrors...</div>
    </div>
  );

  return (
    <div style={{ width:'100%', height:'calc(100vh - 44px)', position:'relative', background:'#000', cursor:pointerLocked?'none':'crosshair' }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width:'100%', height:'100%', display:'block', imageRendering:'pixelated' }} />
      <div style={{ position:'absolute', bottom:14, left:16, fontFamily:"'Crimson Text',serif", fontSize:11, color:'rgba(140,100,50,0.55)', lineHeight:1.8, pointerEvents:'none' }}>
        <div>W A S D &nbsp;·&nbsp; Move &amp; Strafe</div>
        <div>← → &nbsp;·&nbsp; Turn &nbsp;|&nbsp; Shift &nbsp;·&nbsp; Sprint</div>
        <div>SPACE &nbsp;·&nbsp; Cast wand</div>
      </div>
    </div>
  );
}
