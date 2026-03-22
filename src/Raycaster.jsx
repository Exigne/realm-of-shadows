import React, { useEffect, useRef, useState } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

// ─── Constants ─────────────────────────────────────────────────────────────
const W = 640;
const H = 480;
const TEX = 128;
const FOG_DIST = 11;
const MOUSE_SENS = 0.0018;
const PICKUP_COUNT = 10;

// ─── Procedural Texture Generators ─────────────────────────────────────────

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h || w;
  return c;
}

function genStoneWall() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  ctx.fillStyle = '#606060'; ctx.fillRect(0, 0, TEX, TEX);
  // Noise layer
  for (let i = 0; i < TEX * TEX / 4; i++) {
    const v = (Math.random() * 40 - 20) | 0;
    ctx.fillStyle = `rgb(${96+v},${94+v},${90+v})`;
    ctx.fillRect((Math.random() * TEX) | 0, (Math.random() * TEX) | 0, 2, 2);
  }
  // Stone blocks with mortar
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
      // Cracks
      if (Math.random() < 0.35) {
        ctx.save(); ctx.strokeStyle = '#181410'; ctx.lineWidth = 1; ctx.beginPath();
        const sx = bx + 4 + Math.random() * (bW - 8), sy = by + 4 + Math.random() * (bH - 8);
        ctx.moveTo(sx, sy); ctx.lineTo(sx + (Math.random() - 0.5) * 16, sy + (Math.random() - 0.5) * 12);
        ctx.stroke(); ctx.restore();
      }
    }
  }
  // Moss
  for (let i = 0; i < 6; i++) {
    const mx = Math.random() * TEX, my = Math.random() * TEX;
    const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 14);
    gr.addColorStop(0, 'rgba(40,80,28,0.55)'); gr.addColorStop(1, 'rgba(40,80,28,0)');
    ctx.fillStyle = gr; ctx.fillRect(mx - 14, my - 14, 28, 28);
  }
  // Water stain streaks
  for (let i = 0; i < 3; i++) {
    const sx = (Math.random() * TEX) | 0;
    ctx.fillStyle = 'rgba(20,18,30,0.3)';
    ctx.fillRect(sx, 0, 2, TEX);
  }
  return c;
}

function genBrickWall() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  ctx.fillStyle = '#5a2818'; ctx.fillRect(0, 0, TEX, TEX);
  for (let i = 0; i < TEX * TEX / 6; i++) {
    const v = (Math.random() * 24 - 12) | 0;
    ctx.fillStyle = `rgba(${110+v},${42+v},${20+v},0.6)`;
    ctx.fillRect((Math.random() * TEX) | 0, (Math.random() * TEX) | 0, 2, 2);
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
  // Mortar
  ctx.fillStyle = '#2a1810';
  for (let row = 0; row * bH < TEX; row++) {
    ctx.fillRect(0, row * bH, TEX, 2);
    const off = (row % 2) * (bW / 2);
    for (let col = -1; col * bW < TEX + bW; col++)
      ctx.fillRect(col * bW + off, row * bH, 2, bH);
  }
  // Dark stains
  for (let i = 0; i < 4; i++) {
    const sx = Math.random() * TEX, sy = Math.random() * TEX;
    const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
    gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(sx - 22, sy - 22, 44, 44);
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
  // Plank gaps
  ctx.fillStyle = '#100806';
  for (let col = 1; col * pW < TEX; col++) ctx.fillRect(col * pW, 0, 2, TEX);
  // Horizontal bands
  for (let i = 0; i < 4; i++) { ctx.fillStyle = '#180a04'; ctx.fillRect(0, (TEX / 4) * i, TEX, 3); }
  // Iron rivets
  for (let i = 0; i < 3; i++) {
    for (let col = 0; col * pW < TEX; col++) {
      const rx = col * pW + pW / 2, ry = (TEX / 4) * i + TEX / 8;
      const rg = ctx.createRadialGradient(rx - 1, ry - 1, 0, rx, ry, 4);
      rg.addColorStop(0, '#706060'); rg.addColorStop(1, '#2a2020');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(rx, ry, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Torch sconce silhouette
  ctx.fillStyle = '#1a0e04';
  ctx.fillRect(TEX * 0.45, TEX * 0.2, TEX * 0.1, TEX * 0.35);
  // Torch glow
  const tg = ctx.createRadialGradient(TEX * 0.5, TEX * 0.18, 0, TEX * 0.5, TEX * 0.25, 18);
  tg.addColorStop(0, 'rgba(255,160,20,0.55)'); tg.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = tg; ctx.fillRect(TEX * 0.3, TEX * 0.05, TEX * 0.4, TEX * 0.4);
  return c;
}

// ─── Sprite Generators ──────────────────────────────────────────────────────

function genGoblinSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX / 2, bY = TEX * 0.78;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(cx, bY, TEX * 0.18, TEX * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  // Legs
  ctx.fillStyle = '#2a5020';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.08, bY - TEX*0.1, TEX*0.06, TEX*0.12, 0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.08, bY - TEX*0.1, TEX*0.06, TEX*0.12, -0.12, 0, Math.PI*2); ctx.fill();
  // Boots
  ctx.fillStyle = '#1a1008';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.1, bY - TEX*0.02, TEX*0.07, TEX*0.04, 0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.1, bY - TEX*0.02, TEX*0.07, TEX*0.04, -0.3, 0, Math.PI*2); ctx.fill();
  // Body
  const bodyGr = ctx.createRadialGradient(cx - TEX*0.04, bY - TEX*0.28, 0, cx, bY - TEX*0.25, TEX*0.2);
  bodyGr.addColorStop(0, '#4a8040'); bodyGr.addColorStop(1, '#2a5028');
  ctx.fillStyle = bodyGr;
  ctx.beginPath(); ctx.ellipse(cx, bY - TEX*0.26, TEX*0.17, TEX*0.2, 0, 0, Math.PI*2); ctx.fill();
  // Torn tunic
  ctx.fillStyle = '#3a2808';
  ctx.beginPath(); ctx.moveTo(cx - TEX*0.16, bY - TEX*0.12);
  ctx.lineTo(cx - TEX*0.1, bY - TEX*0.3); ctx.lineTo(cx, bY - TEX*0.2);
  ctx.lineTo(cx + TEX*0.1, bY - TEX*0.3); ctx.lineTo(cx + TEX*0.16, bY - TEX*0.12);
  ctx.closePath(); ctx.fill();
  // Left arm + hand
  ctx.fillStyle = '#3a7030';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.24, bY - TEX*0.2, TEX*0.055, TEX*0.13, 0.25, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.27, bY - TEX*0.09, TEX*0.05, TEX*0.04, 0, 0, Math.PI*2); ctx.fill();
  // Right arm + weapon
  ctx.fillStyle = '#3a7030';
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.24, bY - TEX*0.22, TEX*0.055, TEX*0.14, -0.3, 0, Math.PI*2); ctx.fill();
  // Club
  ctx.fillStyle = '#5a3010';
  ctx.save(); ctx.translate(cx + TEX*0.22, bY - TEX*0.1);
  ctx.rotate(0.4); ctx.fillRect(-3, -TEX*0.22, 6, TEX*0.22); ctx.restore();
  const clubHead = ctx.createRadialGradient(cx+TEX*0.28, bY-TEX*0.32, 0, cx+TEX*0.28, bY-TEX*0.32, TEX*0.08);
  clubHead.addColorStop(0, '#5a3010'); clubHead.addColorStop(1, '#2a1508');
  ctx.fillStyle = clubHead;
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.28, bY - TEX*0.32, TEX*0.08, TEX*0.07, 0.4, 0, Math.PI*2); ctx.fill();
  // Iron spike on club
  ctx.fillStyle = '#888'; ctx.beginPath();
  ctx.moveTo(cx+TEX*0.32, bY-TEX*0.37); ctx.lineTo(cx+TEX*0.37, bY-TEX*0.42); ctx.lineTo(cx+TEX*0.28, bY-TEX*0.35);
  ctx.closePath(); ctx.fill();
  // Neck
  ctx.fillStyle = '#3a7030';
  ctx.beginPath(); ctx.ellipse(cx, bY - TEX*0.44, TEX*0.07, TEX*0.06, 0, 0, Math.PI*2); ctx.fill();
  // Head
  const headGr = ctx.createRadialGradient(cx - TEX*0.04, bY - TEX*0.56, 0, cx, bY - TEX*0.53, TEX*0.16);
  headGr.addColorStop(0, '#52904a'); headGr.addColorStop(1, '#2e6028');
  ctx.fillStyle = headGr;
  ctx.beginPath(); ctx.ellipse(cx, bY - TEX*0.55, TEX*0.14, TEX*0.16, 0, 0, Math.PI*2); ctx.fill();
  // Ears
  ctx.fillStyle = '#3a7030';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.15, bY - TEX*0.56, TEX*0.045, TEX*0.09, -0.25, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.15, bY - TEX*0.56, TEX*0.045, TEX*0.09, 0.25, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#4a8040';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.15, bY - TEX*0.57, TEX*0.025, TEX*0.06, -0.25, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.15, bY - TEX*0.57, TEX*0.025, TEX*0.06, 0.25, 0, Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.055, bY - TEX*0.57, TEX*0.035, TEX*0.038, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.055, bY - TEX*0.57, TEX*0.035, TEX*0.038, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff2200';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.055, bY - TEX*0.57, TEX*0.025, TEX*0.028, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.055, bY - TEX*0.57, TEX*0.025, TEX*0.028, 0, 0, Math.PI*2); ctx.fill();
  // Glints
  ctx.fillStyle = '#ff9060';
  ctx.beginPath(); ctx.arc(cx - TEX*0.045, bY - TEX*0.585, TEX*0.008, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + TEX*0.065, bY - TEX*0.585, TEX*0.008, 0, Math.PI*2); ctx.fill();
  // Nose
  ctx.fillStyle = '#2e6028';
  ctx.beginPath(); ctx.ellipse(cx, bY - TEX*0.53, TEX*0.02, TEX*0.025, 0, 0, Math.PI*2); ctx.fill();
  // Mouth (grin with teeth)
  ctx.strokeStyle = '#1a0808'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, bY - TEX*0.505, TEX*0.065, 0.18, Math.PI - 0.18); ctx.stroke();
  ctx.fillStyle = '#e8e0d0';
  for (let t = 0; t < 4; t++) {
    ctx.fillRect(cx - TEX*0.055 + t * TEX*0.035, bY - TEX*0.506, TEX*0.02, TEX*0.025);
  }
  return c;
}

function genWolfSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX * 0.46, gY = TEX * 0.76;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(cx, gY, TEX*0.22, TEX*0.04, 0, 0, Math.PI*2); ctx.fill();
  // Legs (4)
  ctx.fillStyle = '#30384a';
  const legXs = [cx - TEX*0.17, cx - TEX*0.06, cx + TEX*0.06, cx + TEX*0.16];
  legXs.forEach((lx, i) => {
    ctx.beginPath(); ctx.ellipse(lx, gY - TEX*0.1, TEX*0.045, TEX*0.13, (i % 2 === 0 ? 0.1 : -0.1), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222830';
    ctx.beginPath(); ctx.ellipse(lx + (i < 2 ? -2 : 2), gY - TEX*0.01, TEX*0.06, TEX*0.035, 0.3*(i<2?1:-1), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#30384a';
  });
  // Body
  const bodyGr = ctx.createRadialGradient(cx - TEX*0.05, gY - TEX*0.23, 0, cx, gY - TEX*0.2, TEX*0.25);
  bodyGr.addColorStop(0, '#48526a'); bodyGr.addColorStop(1, '#282e3a');
  ctx.fillStyle = bodyGr;
  ctx.beginPath(); ctx.ellipse(cx, gY - TEX*0.2, TEX*0.26, TEX*0.17, 0, 0, Math.PI*2); ctx.fill();
  // Fur texture
  ctx.strokeStyle = 'rgba(70,80,100,0.45)'; ctx.lineWidth = 1;
  for (let f = 0; f < 40; f++) {
    const fx = cx - TEX*0.2 + Math.random() * TEX*0.4, fy = gY - TEX*0.35 + Math.random() * TEX*0.28;
    ctx.beginPath(); ctx.moveTo(fx, fy);
    ctx.lineTo(fx + (Math.random() - 0.5) * 7, fy + (Math.random() - 0.5) * 5); ctx.stroke();
  }
  // Tail
  ctx.strokeStyle = '#2c3444'; ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - TEX*0.24, gY - TEX*0.18);
  ctx.quadraticCurveTo(cx - TEX*0.42, gY - TEX*0.35, cx - TEX*0.32, gY - TEX*0.52); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = '#38404e';
  ctx.beginPath(); ctx.moveTo(cx - TEX*0.24, gY - TEX*0.18);
  ctx.quadraticCurveTo(cx - TEX*0.4, gY - TEX*0.33, cx - TEX*0.3, gY - TEX*0.5); ctx.stroke();
  // Neck
  ctx.fillStyle = '#384050';
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.14, gY - TEX*0.31, TEX*0.1, TEX*0.12, 0.5, 0, Math.PI*2); ctx.fill();
  // Mane
  ctx.fillStyle = '#222832';
  for (let m = 0; m < 8; m++) {
    const ma = (m / 8) * Math.PI;
    ctx.beginPath(); ctx.ellipse(cx + TEX*0.17 + Math.cos(ma)*TEX*0.09, gY - TEX*0.36 + Math.sin(ma)*TEX*0.06, TEX*0.04, TEX*0.08, ma, 0, Math.PI*2); ctx.fill();
  }
  // Head
  const headGr = ctx.createRadialGradient(cx + TEX*0.24, gY - TEX*0.44, 0, cx + TEX*0.24, gY - TEX*0.42, TEX*0.16);
  headGr.addColorStop(0, '#505870'); headGr.addColorStop(1, '#303848');
  ctx.fillStyle = headGr;
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.24, gY - TEX*0.43, TEX*0.15, TEX*0.13, 0.35, 0, Math.PI*2); ctx.fill();
  // Snout
  ctx.fillStyle = '#404858';
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.37, gY - TEX*0.38, TEX*0.1, TEX*0.07, 0.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#181e28';
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.43, gY - TEX*0.37, TEX*0.03, TEX*0.025, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + TEX*0.38, gY - TEX*0.37, TEX*0.025, TEX*0.02, 0, 0, Math.PI*2); ctx.fill();
  // Ears
  ctx.fillStyle = '#282e38';
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.18, gY-TEX*0.53);
  ctx.lineTo(cx+TEX*0.24, gY-TEX*0.66); ctx.lineTo(cx+TEX*0.31, gY-TEX*0.54); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a3040';
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.21, gY-TEX*0.54);
  ctx.lineTo(cx+TEX*0.25, gY-TEX*0.62); ctx.lineTo(cx+TEX*0.29, gY-TEX*0.54); ctx.closePath(); ctx.fill();
  // Eyes
  ctx.fillStyle = '#e0c000';
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.22, gY-TEX*0.45, TEX*0.032, TEX*0.025, -0.1, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.31, gY-TEX*0.44, TEX*0.032, TEX*0.025, 0.1, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.23, gY-TEX*0.45, TEX*0.016, TEX*0.022, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.32, gY-TEX*0.44, TEX*0.016, TEX*0.022, 0, 0, Math.PI*2); ctx.fill();
  // Eye glint
  ctx.fillStyle = 'rgba(255,255,200,0.7)';
  ctx.beginPath(); ctx.arc(cx+TEX*0.222, gY-TEX*0.458, TEX*0.007, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+TEX*0.312, gY-TEX*0.448, TEX*0.007, 0, Math.PI*2); ctx.fill();
  // Teeth
  ctx.fillStyle = '#ddd'; ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
  [cx+TEX*0.34, cx+TEX*0.38, cx+TEX*0.42].forEach(tx => {
    ctx.beginPath(); ctx.moveTo(tx, gY-TEX*0.33); ctx.lineTo(tx-TEX*0.015, gY-TEX*0.27); ctx.lineTo(tx+TEX*0.015, gY-TEX*0.27); ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  return c;
}

function genSkeletonSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX * 0.5, top = TEX * 0.06;
  const boneCol = '#cec8b8', darkBone = '#a8a090', skullCol = '#ddd8c8';
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(cx, top + TEX*0.9, TEX*0.15, TEX*0.03, 0, 0, Math.PI*2); ctx.fill();
  // Legs
  ctx.strokeStyle = boneCol; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - TEX*0.06, top+TEX*0.63); ctx.lineTo(cx - TEX*0.1, top+TEX*0.82); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + TEX*0.06, top+TEX*0.63); ctx.lineTo(cx + TEX*0.1, top+TEX*0.82); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx-TEX*0.1, top+TEX*0.82); ctx.lineTo(cx-TEX*0.18, top+TEX*0.87); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.1, top+TEX*0.82); ctx.lineTo(cx+TEX*0.18, top+TEX*0.87); ctx.stroke();
  // Knee joints
  ctx.fillStyle = darkBone;
  ctx.beginPath(); ctx.arc(cx-TEX*0.1, top+TEX*0.82, 4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+TEX*0.1, top+TEX*0.82, 4, 0, Math.PI*2); ctx.fill();
  // Pelvis
  ctx.fillStyle = boneCol;
  ctx.beginPath(); ctx.ellipse(cx, top+TEX*0.62, TEX*0.1, TEX*0.055, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1410';
  ctx.beginPath(); ctx.ellipse(cx, top+TEX*0.62, TEX*0.055, TEX*0.03, 0, 0, Math.PI*2); ctx.fill();
  // Spine
  ctx.strokeStyle = darkBone; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, top+TEX*0.62); ctx.lineTo(cx, top+TEX*0.33); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const sy = top + TEX*0.35 + i * TEX*0.05;
    ctx.fillStyle = boneCol; ctx.beginPath(); ctx.ellipse(cx, sy, TEX*0.04, TEX*0.02, 0, 0, Math.PI*2); ctx.fill();
  }
  // Ribs
  ctx.strokeStyle = boneCol; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const ry = top + TEX*0.37 + i * TEX*0.054;
    ctx.beginPath(); ctx.moveTo(cx, ry); ctx.bezierCurveTo(cx-TEX*0.1, ry-TEX*0.01, cx-TEX*0.14, ry+TEX*0.02, cx-TEX*0.12, ry+TEX*0.04); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, ry); ctx.bezierCurveTo(cx+TEX*0.1, ry-TEX*0.01, cx+TEX*0.14, ry+TEX*0.02, cx+TEX*0.12, ry+TEX*0.04); ctx.stroke();
  }
  // Collar bones
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, top+TEX*0.33); ctx.lineTo(cx-TEX*0.13, top+TEX*0.36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, top+TEX*0.33); ctx.lineTo(cx+TEX*0.13, top+TEX*0.36); ctx.stroke();
  // Shield arm (left)
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx-TEX*0.13, top+TEX*0.36); ctx.lineTo(cx-TEX*0.28, top+TEX*0.48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-TEX*0.28, top+TEX*0.48); ctx.lineTo(cx-TEX*0.3, top+TEX*0.6); ctx.stroke();
  // Shield
  ctx.fillStyle = '#7a3018';
  ctx.beginPath();
  ctx.moveTo(cx-TEX*0.4, top+TEX*0.44); ctx.lineTo(cx-TEX*0.28, top+TEX*0.42);
  ctx.lineTo(cx-TEX*0.28, top+TEX*0.66); ctx.lineTo(cx-TEX*0.4, top+TEX*0.68);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c0a050'; ctx.lineWidth = 2; ctx.stroke();
  const bossCtr = ctx.createRadialGradient(cx-TEX*0.34, top+TEX*0.55, 0, cx-TEX*0.34, top+TEX*0.55, TEX*0.06);
  bossCtr.addColorStop(0, '#d0c060'); bossCtr.addColorStop(1, '#8a7028');
  ctx.fillStyle = bossCtr; ctx.beginPath(); ctx.arc(cx-TEX*0.34, top+TEX*0.55, TEX*0.055, 0, Math.PI*2); ctx.fill();
  // Sword arm (right)
  ctx.strokeStyle = boneCol; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.13, top+TEX*0.36); ctx.lineTo(cx+TEX*0.28, top+TEX*0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.28, top+TEX*0.5); ctx.lineTo(cx+TEX*0.26, top+TEX*0.62); ctx.stroke();
  // Sword
  ctx.strokeStyle = '#b0b8d0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.26, top+TEX*0.62); ctx.lineTo(cx+TEX*0.45, top+TEX*0.26); ctx.stroke();
  ctx.strokeStyle = '#8a7030'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.19, top+TEX*0.48); ctx.lineTo(cx+TEX*0.37, top+TEX*0.42); ctx.stroke();
  ctx.strokeStyle = '#d8c070'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.2, top+TEX*0.47); ctx.lineTo(cx+TEX*0.36, top+TEX*0.41); ctx.stroke();
  // Neck
  ctx.fillStyle = boneCol;
  ctx.beginPath(); ctx.ellipse(cx, top+TEX*0.3, TEX*0.05, TEX*0.045, 0, 0, Math.PI*2); ctx.fill();
  // Skull
  const skullGr = ctx.createRadialGradient(cx-TEX*0.03, top+TEX*0.16, 0, cx, top+TEX*0.18, TEX*0.13);
  skullGr.addColorStop(0, skullCol); skullGr.addColorStop(1, darkBone);
  ctx.fillStyle = skullGr;
  ctx.beginPath(); ctx.ellipse(cx, top+TEX*0.18, TEX*0.12, TEX*0.13, 0, 0, Math.PI*2); ctx.fill();
  // Jaw
  ctx.fillStyle = darkBone;
  ctx.beginPath(); ctx.ellipse(cx, top+TEX*0.285, TEX*0.09, TEX*0.05, 0, 0, Math.PI*2); ctx.fill();
  // Cheekbones
  ctx.fillStyle = '#b8b0a0';
  ctx.beginPath(); ctx.ellipse(cx-TEX*0.1, top+TEX*0.22, TEX*0.04, TEX*0.025, -0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.1, top+TEX*0.22, TEX*0.04, TEX*0.025, 0.2, 0, Math.PI*2); ctx.fill();
  // Eye sockets
  ctx.fillStyle = '#0a0806';
  ctx.beginPath(); ctx.ellipse(cx-TEX*0.05, top+TEX*0.16, TEX*0.04, TEX*0.048, 0.1, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+TEX*0.05, top+TEX*0.16, TEX*0.04, TEX*0.048, -0.1, 0, Math.PI*2); ctx.fill();
  // Glowing eyes
  const eyeGlow = ctx.createRadialGradient(cx-TEX*0.05, top+TEX*0.16, 0, cx-TEX*0.05, top+TEX*0.16, TEX*0.03);
  eyeGlow.addColorStop(0, 'rgba(80,255,80,0.9)'); eyeGlow.addColorStop(1, 'rgba(20,180,20,0)');
  ctx.fillStyle = eyeGlow; ctx.fillRect(cx-TEX*0.09, top+TEX*0.12, TEX*0.08, TEX*0.08);
  const eyeGlow2 = ctx.createRadialGradient(cx+TEX*0.05, top+TEX*0.16, 0, cx+TEX*0.05, top+TEX*0.16, TEX*0.03);
  eyeGlow2.addColorStop(0, 'rgba(80,255,80,0.9)'); eyeGlow2.addColorStop(1, 'rgba(20,180,20,0)');
  ctx.fillStyle = eyeGlow2; ctx.fillRect(cx+TEX*0.01, top+TEX*0.12, TEX*0.08, TEX*0.08);
  // Nasal cavity
  ctx.fillStyle = '#0a0806';
  ctx.beginPath(); ctx.moveTo(cx-TEX*0.02, top+TEX*0.22); ctx.lineTo(cx+TEX*0.02, top+TEX*0.22); ctx.lineTo(cx, top+TEX*0.26); ctx.closePath(); ctx.fill();
  // Teeth
  ctx.fillStyle = boneCol;
  for (let t = 0; t < 6; t++) ctx.fillRect(cx - TEX*0.085 + t*TEX*0.033, top+TEX*0.268, TEX*0.024, TEX*0.032);
  // Crack in skull
  ctx.strokeStyle = '#6a6050'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx+TEX*0.03, top+TEX*0.06); ctx.lineTo(cx-TEX*0.02, top+TEX*0.15); ctx.lineTo(cx+TEX*0.01, top+TEX*0.2); ctx.stroke();
  // Dark cloak suggestion
  ctx.fillStyle = 'rgba(10,8,20,0.5)';
  ctx.beginPath(); ctx.ellipse(cx, top+TEX*0.52, TEX*0.14, TEX*0.22, 0, 0, Math.PI*2); ctx.fill();
  return c;
}

function genCoinSprite(frame) {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX / 2, cy = TEX / 2;
  const scX = Math.max(0.08, Math.abs(Math.cos(frame * 0.06)));
  // Glow
  const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, TEX*0.35);
  gr.addColorStop(0, 'rgba(255,210,40,0.35)'); gr.addColorStop(1, 'rgba(255,180,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, TEX, TEX);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scX, 1);
  const coinGr = ctx.createRadialGradient(-TEX*0.06, -TEX*0.06, 0, 0, 0, TEX*0.26);
  coinGr.addColorStop(0, '#ffe060'); coinGr.addColorStop(0.5, '#c89020'); coinGr.addColorStop(1, '#7a5008');
  ctx.fillStyle = coinGr;
  ctx.beginPath(); ctx.arc(0, 0, TEX*0.28, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#f0d040'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = '#c09020'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, TEX*0.22, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#f0d060'; ctx.font = `bold ${TEX*0.28}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('G', 0, 0);
  ctx.restore();
  return c;
}

function genPotionSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX * 0.5, cy = TEX * 0.55;
  // Glow
  const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, TEX*0.32);
  gr.addColorStop(0, 'rgba(220,20,50,0.38)'); gr.addColorStop(1, 'rgba(200,0,30,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, TEX, TEX);
  // Bottle body
  const bottleGr = ctx.createRadialGradient(cx - TEX*0.07, cy - TEX*0.02, 0, cx, cy, TEX*0.22);
  bottleGr.addColorStop(0, '#c02040'); bottleGr.addColorStop(0.6, '#7a0020'); bottleGr.addColorStop(1, '#3a0010');
  ctx.fillStyle = bottleGr;
  ctx.beginPath(); ctx.ellipse(cx, cy + TEX*0.08, TEX*0.2, TEX*0.26, 0, 0, Math.PI*2); ctx.fill();
  // Bottle shine
  ctx.fillStyle = 'rgba(255,180,190,0.35)';
  ctx.beginPath(); ctx.ellipse(cx - TEX*0.08, cy - TEX*0.04, TEX*0.05, TEX*0.14, -0.3, 0, Math.PI*2); ctx.fill();
  // Neck
  ctx.fillStyle = '#5a0818';
  ctx.fillRect(cx - TEX*0.08, cy - TEX*0.24, TEX*0.16, TEX*0.12);
  // Neck ring
  ctx.fillStyle = '#c0a050';
  ctx.fillRect(cx - TEX*0.09, cy - TEX*0.14, TEX*0.18, TEX*0.03);
  // Cork
  const corkGr = ctx.createLinearGradient(cx-TEX*0.06, 0, cx+TEX*0.06, 0);
  corkGr.addColorStop(0, '#a07030'); corkGr.addColorStop(0.5, '#c09040'); corkGr.addColorStop(1, '#806020');
  ctx.fillStyle = corkGr; ctx.fillRect(cx - TEX*0.06, cy - TEX*0.33, TEX*0.12, TEX*0.11);
  ctx.strokeStyle = '#604010'; ctx.lineWidth = 1;
  for (let l = 0; l < 4; l++) ctx.strokeRect(cx - TEX*0.06 + l*TEX*0.025, cy - TEX*0.33, TEX*0.025, TEX*0.11);
  // Liquid line
  ctx.strokeStyle = 'rgba(255,80,80,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, cy + TEX*0.08, TEX*0.16, TEX*0.04, 0, 0, Math.PI*2); ctx.stroke();
  // Plus cross
  ctx.fillStyle = '#ff8090';
  ctx.fillRect(cx - TEX*0.04, cy + TEX*0.02, TEX*0.08, TEX*0.2);
  ctx.fillRect(cx - TEX*0.1, cy + TEX*0.07, TEX*0.2, TEX*0.07);
  ctx.fillStyle = 'rgba(255,150,160,0.5)';
  ctx.fillRect(cx - TEX*0.03, cy + TEX*0.03, TEX*0.035, TEX*0.18);
  return c;
}

// ─── Minimap Drawer ─────────────────────────────────────────────────────────

function drawMinimap(ctx, p, pickups, entities, tileSize) {
  const mW = Math.min(mapWidth, 20) * tileSize;
  const mH = Math.min(mapHeight, 20) * tileSize;
  const mmX = W - mW - 12, mmY = 12;

  ctx.fillStyle = 'rgba(4,3,2,0.82)';
  ctx.fillRect(mmX - 3, mmY - 3, mW + 6, mH + 6);
  ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1; ctx.strokeRect(mmX - 3, mmY - 3, mW + 6, mH + 6);
  ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 0.5; ctx.strokeRect(mmX - 5, mmY - 5, mW + 10, mH + 10);

  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const t = worldMap[x][y];
      if (t === 1) ctx.fillStyle = '#4a3a24';
      else if (t === 3) ctx.fillStyle = '#5a2818';
      else if (t === 4) ctx.fillStyle = '#3a2210';
      else if (t === 2) ctx.fillStyle = 'rgba(180,40,20,0.5)';
      else ctx.fillStyle = '#13100c';
      ctx.fillRect(mmX + x * tileSize, mmY + y * tileSize, tileSize, tileSize);
    }
  }

  // Pickup dots
  pickups.forEach(pu => {
    if (pu.collected) return;
    ctx.fillStyle = pu.type === 'coin' ? '#c8a020' : '#20c050';
    ctx.beginPath(); ctx.arc(mmX + pu.x * tileSize, mmY + pu.y * tileSize, 1.5, 0, Math.PI*2); ctx.fill();
  });

  // Enemy dots
  entities.forEach(e => {
    if (worldMap[Math.floor(e.x)][Math.floor(e.y)] !== 2) return;
    ctx.fillStyle = 'rgba(220,40,20,0.9)';
    ctx.beginPath(); ctx.arc(mmX + e.x * tileSize, mmY + e.y * tileSize, 2, 0, Math.PI*2); ctx.fill();
  });

  // Player arrow
  const px = mmX + p.x * tileSize, py = mmY + p.y * tileSize;
  ctx.fillStyle = '#e8d070';
  ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#e8d070'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + p.dirX * 7, py + p.dirY * 7); ctx.stroke();

  // Legend
  ctx.font = "7px 'Cinzel', monospace"; ctx.textAlign = 'left'; ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#c8a020'; ctx.fillText('■ Gold', mmX, mmY + mH + 14);
  ctx.fillStyle = '#20c050'; ctx.fillText('■ Potion', mmX + 30, mmY + mH + 14);
  ctx.globalAlpha = 1;
}

// ─── Compass Drawer ─────────────────────────────────────────────────────────

function drawCompass(ctx, p) {
  const cx = W / 2, cy = 30, r = 22;
  const angle = Math.atan2(p.dirY, p.dirX);
  ctx.fillStyle = 'rgba(4,3,2,0.75)';
  ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI*2); ctx.stroke();

  // Tick marks
  for (let t = 0; t < 8; t++) {
    const ta = (t / 8) * Math.PI * 2 - angle;
    const ir = t % 2 === 0 ? r - 6 : r - 3;
    ctx.strokeStyle = t % 2 === 0 ? '#7a5830' : '#3a2810'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ta) * ir, cy + Math.sin(ta) * ir);
    ctx.lineTo(cx + Math.cos(ta) * r, cy + Math.sin(ta) * r);
    ctx.stroke();
  }

  const dirs = [['N', -Math.PI/2, '#d04040'], ['E', 0, '#8a6840'], ['S', Math.PI/2, '#8a6840'], ['W', Math.PI, '#8a6840']];
  ctx.font = "bold 8px 'Cinzel', serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  dirs.forEach(([label, a, col]) => {
    const relA = a - angle;
    ctx.fillStyle = col; ctx.globalAlpha = label === 'N' ? 1.0 : 0.85;
    ctx.fillText(label, cx + Math.cos(relA) * (r - 8), cy + Math.sin(relA) * (r - 8));
  });
  ctx.globalAlpha = 1;

  // Needle
  const na = -angle;
  ctx.strokeStyle = '#e03030'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (r - 5), cy + Math.sin(na) * (r - 5)); ctx.stroke();
  ctx.strokeStyle = '#506870'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.cos(na) * (r - 8), cy - Math.sin(na) * (r - 8)); ctx.stroke();

  ctx.fillStyle = '#c8a96e'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI*2); ctx.fill();
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Raycaster({ onEncounter, onPickup }) {
  const canvasRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const pointerLockedRef = useRef(false);
  const [pointerLocked, setPointerLocked] = useState(false);

  const textures = useRef({});
  const sprites = useRef({});
  const entities = useRef([]);
  const pickups = useRef([]);

  const player = useRef({ x: 2.5, y: 2.5, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66, moveSpeed: 0.055, rotSpeed: 0.04 });
  const keys = useRef({});
  const torch = useRef(1.0);
  const bob = useRef(0);
  const frame = useRef(0);
  const canvasNotifs = useRef([]);
  const onEncounterRef = useRef(onEncounter);
  const onPickupRef = useRef(onPickup);

  useEffect(() => { onEncounterRef.current = onEncounter; }, [onEncounter]);
  useEffect(() => { onPickupRef.current = onPickup; }, [onPickup]);

  // ── Init ──
  useEffect(() => {
    textures.current = { 1: genStoneWall(), 3: genBrickWall(), 4: genWoodWall() };
    sprites.current = { 0: genGoblinSprite(), 1: genWolfSprite(), 2: genSkeletonSprite(), potion: genPotionSprite() };
    sprites.current.coin = genCoinSprite(0);

    const ents = [];
    for (let x = 0; x < mapWidth; x++)
      for (let y = 0; y < mapHeight; y++)
        if (worldMap[x][y] === 2) ents.push({ x: x + 0.5, y: y + 0.5, type: Math.floor(Math.random() * 3) });
    entities.current = ents;

    // Scatter pickups
    const open = [];
    for (let x = 2; x < mapWidth - 2; x++)
      for (let y = 2; y < mapHeight - 2; y++)
        if (worldMap[x][y] === 0) open.push({ x: x + 0.5, y: y + 0.5 });
    open.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(PICKUP_COUNT, open.length); i++) {
      pickups.current.push({ ...open[i], type: i % 3 === 0 ? 'potion' : 'coin', collected: false, phase: Math.random() * Math.PI * 2 });
    }
    setIsLoaded(true);
  }, []);

  // ── Game Loop ──
  useEffect(() => {
    if (!isLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let rafId;

    const onKD = e => { keys.current[e.key] = true; };
    const onKU = e => { keys.current[e.key] = false; };
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);

    const onClick = () => canvas.requestPointerLock();
    const onPLChange = () => {
      const locked = document.pointerLockElement === canvas;
      pointerLockedRef.current = locked; setPointerLocked(locked);
    };
    const onMM = e => {
      if (document.pointerLockElement !== canvas) return;
      const p = player.current;
      const rot = -e.movementX * MOUSE_SENS;
      const c = Math.cos(rot), s = Math.sin(rot);
      const [odx, opx] = [p.dirX, p.planeX];
      p.dirX = odx*c - p.dirY*s; p.dirY = odx*s + p.dirY*c;
      p.planeX = opx*c - p.planeY*s; p.planeY = opx*s + p.planeY*c;
    };
    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onPLChange);
    window.addEventListener('mousemove', onMM);

    // Coin animation timer
    let coinFrame = 0;
    const coinInterval = setInterval(() => {
      coinFrame++; sprites.current.coin = genCoinSprite(coinFrame);
    }, 80);

    const loop = () => {
      frame.current++;
      const p = player.current;
      const sprint = keys.current['Shift'] ? 1.75 : 1;
      const ms = p.moveSpeed * sprint;
      const rs = p.rotSpeed;
      let moving = false;

      const tryMove = (dx, dy) => {
        if (worldMap[Math.floor(p.x + dx * 1.25)][Math.floor(p.y)] === 0) p.x += dx;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y + dy * 1.25)] === 0) p.y += dy;
        moving = true;
      };
      const tryRot = (angle) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        const [odx, opx] = [p.dirX, p.planeX];
        p.dirX = odx*c - p.dirY*s; p.dirY = odx*s + p.dirY*c;
        p.planeX = opx*c - p.planeY*s; p.planeY = opx*s + p.planeY*c;
      };

      if (keys.current['w'] || keys.current['ArrowUp'])   tryMove(p.dirX * ms, p.dirY * ms);
      if (keys.current['s'] || keys.current['ArrowDown'])  tryMove(-p.dirX * ms, -p.dirY * ms);
      if (keys.current['a'])                               tryMove(-p.planeX * ms, -p.planeY * ms);
      if (keys.current['d'])                               tryMove(p.planeX * ms, p.planeY * ms);
      if (keys.current['ArrowLeft'])  tryRot(rs);
      if (keys.current['ArrowRight']) tryRot(-rs);

      // Bob & torch
      if (moving) bob.current += sprint > 1 ? 0.1 : 0.065;
      torch.current += (Math.random() - 0.5) * 0.035;
      torch.current = Math.max(0.8, Math.min(1.0, torch.current));

      // Encounter check
      if (worldMap[Math.floor(p.x)][Math.floor(p.y)] === 2) {
        worldMap[Math.floor(p.x)][Math.floor(p.y)] = 0;
        keys.current = {};
        cancelAnimationFrame(rafId); clearInterval(coinInterval);
        onEncounterRef.current();
        return;
      }

      // Pickup check
      pickups.current.forEach(pu => {
        if (pu.collected) return;
        const dx = p.x - pu.x, dy = p.y - pu.y;
        if (dx*dx + dy*dy < 0.45) {
          pu.collected = true;
          if (pu.type === 'coin') {
            canvasNotifs.current.push({ text: '+15 Gold  💰', color: '#f0d040', life: 70, y: H * 0.38 });
            onPickupRef.current?.('gold', 15);
          } else {
            canvasNotifs.current.push({ text: '+20 Health  🧪', color: '#50e070', life: 70, y: H * 0.38 });
            onPickupRef.current?.('health', 20);
          }
        }
      });

      // ── DRAW CEILING & FLOOR ──
      const ceilGr = ctx.createLinearGradient(0, 0, 0, H / 2);
      ceilGr.addColorStop(0, '#070511'); ceilGr.addColorStop(1, '#160e26');
      ctx.fillStyle = ceilGr; ctx.fillRect(0, 0, W, H / 2);

      const floorGr = ctx.createLinearGradient(0, H / 2, 0, H);
      floorGr.addColorStop(0, '#1a1208'); floorGr.addColorStop(1, '#080602');
      ctx.fillStyle = floorGr; ctx.fillRect(0, H / 2, W, H / 2);

      // Subtle floor grid lines (atmospheric)
      ctx.globalAlpha = 0.07;
      for (let y = H / 2 + 10; y < H; y += 18) {
        ctx.fillStyle = '#c8a96e'; ctx.fillRect(0, y, W, 1);
      }
      ctx.globalAlpha = 1;

      const bobY = Math.sin(bob.current * 8) * 3.5;
      const zBuf = new Float32Array(W);

      // ── WALLS ──
      for (let x = 0; x < W; x++) {
        const camX = 2 * x / W - 1;
        const rDX = p.dirX + p.planeX * camX;
        const rDY = p.dirY + p.planeY * camX;
        let mX = Math.floor(p.x), mY = Math.floor(p.y);
        const ddX = Math.abs(1 / rDX), ddY = Math.abs(1 / rDY);
        let sdX = rDX < 0 ? (p.x - mX) * ddX : (mX + 1 - p.x) * ddX;
        let sdY = rDY < 0 ? (p.y - mY) * ddY : (mY + 1 - p.y) * ddY;
        const stX = rDX < 0 ? -1 : 1, stY = rDY < 0 ? -1 : 1;
        let hit = 0, side = 0, hitTile = 1;

        for (let iter = 0; iter < 48 && !hit; iter++) {
          if (sdX < sdY) { sdX += ddX; mX += stX; side = 0; }
          else { sdY += ddY; mY += stY; side = 1; }
          if (mX < 0 || mX >= mapWidth || mY < 0 || mY >= mapHeight) { hit = 1; hitTile = 1; break; }
          const t = worldMap[mX][mY];
          if (t === 1 || t === 3 || t === 4) { hit = 1; hitTile = t; }
        }

        const pwd = side === 0 ? sdX - ddX : sdY - ddY;
        zBuf[x] = pwd;

        const lH = Math.floor(H / Math.max(pwd, 0.01));
        const dS = Math.max(0, Math.floor(-lH / 2 + H / 2 + bobY));
        const dE = Math.min(H - 1, Math.floor(lH / 2 + H / 2 + bobY));
        const aH = dE - dS;
        if (aH <= 0) continue;

        const wallImg = textures.current[hitTile] || textures.current[1];
        let wX = side === 0 ? p.y + pwd * rDY : p.x + pwd * rDX;
        wX -= Math.floor(wX);
        let tX = Math.floor(wX * TEX);
        if (side === 0 && rDX > 0) tX = TEX - tX - 1;
        if (side === 1 && rDY < 0) tX = TEX - tX - 1;
        tX = Math.max(0, Math.min(TEX - 1, tX));

        ctx.drawImage(wallImg, tX, 0, 1, TEX, x, dS, 1, aH);

        // Distance fog
        const fog = Math.min(0.94, pwd / FOG_DIST);
        const sideDim = side === 1 ? 0.18 : 0;
        const dim = Math.min(0.97, fog + sideDim + (1 - torch.current) * 0.18);
        ctx.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`; ctx.fillRect(x, dS, 1, aH);

        // Warm torch tint close up
        if (pwd < 3.5) {
          const w = (1 - pwd / 3.5) * 0.18 * torch.current;
          ctx.fillStyle = `rgba(200,90,10,${w.toFixed(3)})`; ctx.fillRect(x, dS, 1, aH);
        }
      }

      // ── SPRITES ──
      const allSprites = [
        ...entities.current.map(e => ({ ...e, kind: 'enemy' })),
        ...pickups.current.filter(pu => !pu.collected).map(pu => ({ ...pu, kind: 'pickup' })),
      ];
      allSprites.forEach(s => { s.dist2 = (p.x - s.x) ** 2 + (p.y - s.y) ** 2; });
      allSprites.sort((a, b) => b.dist2 - a.dist2);

      let closestEnemyDist = Infinity;

      allSprites.forEach(sp => {
        if (sp.kind === 'enemy') {
          if (worldMap[Math.floor(sp.x)][Math.floor(sp.y)] !== 2) return;
          if (sp.dist2 < closestEnemyDist) closestEnemyDist = sp.dist2;
        }

        const spX = sp.x - p.x, spY = sp.y - p.y;
        const invDet = 1 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const tX = invDet * (p.dirY * spX - p.dirX * spY);
        const tY = invDet * (-p.planeY * spX + p.planeX * spY);
        if (tY < 0.15) return;

        const sScreenX = Math.floor((W / 2) * (1 + tX / tY));
        const sH = Math.abs(Math.floor(H / tY));

        // Vertical bob for pickups
        let extraBobY = 0;
        if (sp.kind === 'pickup') extraBobY = Math.sin(frame.current * 0.045 + (sp.phase || 0)) * 9;

        const dSY = Math.max(0, Math.floor(-sH / 2 + H / 2 + bobY + extraBobY));
        const dEY = Math.min(H - 1, Math.floor(sH / 2 + H / 2 + bobY + extraBobY));
        const aSH = dEY - dSY;
        const sW = Math.abs(Math.floor(H / tY));
        const dSX = Math.floor(sScreenX - sW / 2);
        if (aSH <= 0 || sW <= 0) return;

        const img = sp.kind === 'enemy' ? sprites.current[sp.type] : sprites.current[sp.type];
        if (!img) return;

        // Glow for pickups
        if (sp.kind === 'pickup') {
          const glowAlpha = (Math.sin(frame.current * 0.06 + (sp.phase||0)) * 0.15 + 0.25) * Math.max(0, 1 - Math.sqrt(sp.dist2) / 6);
          if (glowAlpha > 0.01) {
            ctx.globalAlpha = glowAlpha;
            ctx.fillStyle = sp.type === 'coin' ? '#f0c020' : '#20d050';
            ctx.beginPath(); ctx.arc(sScreenX, (dSY + dEY) / 2, sW * 0.6, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
          }
        }

        for (let stripe = Math.max(0, dSX); stripe < Math.min(W, dSX + sW); stripe++) {
          if (tY >= zBuf[stripe]) continue;
          const texCol = Math.floor((stripe - dSX) * TEX / sW);
          if (texCol < 0 || texCol >= TEX) continue;
          ctx.drawImage(img, texCol, 0, 1, TEX, stripe, dSY, 1, aSH);
          // Fog on sprites
          const spFog = Math.min(0.88, Math.sqrt(sp.dist2) / FOG_DIST);
          if (spFog > 0.04) { ctx.fillStyle = `rgba(0,0,0,${spFog.toFixed(3)})`; ctx.fillRect(stripe, dSY, 1, aSH); }
        }
      });

      // ── VIGNETTE ──
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.85);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      // ── CROSSHAIR ──
      const nearEnemy = closestEnemyDist < 9;
      const crossAlpha = nearEnemy ? 0.7 + Math.sin(frame.current * 0.18) * 0.25 : 0.65;
      const crossCol = nearEnemy ? '#ff3a3a' : 'rgba(230,200,140,0.75)';
      ctx.strokeStyle = crossCol; ctx.globalAlpha = crossAlpha; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W/2-12, H/2); ctx.lineTo(W/2-4, H/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W/2+4, H/2); ctx.lineTo(W/2+12, H/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W/2, H/2-12); ctx.lineTo(W/2, H/2-4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W/2, H/2+4); ctx.lineTo(W/2, H/2+12); ctx.stroke();
      if (nearEnemy) {
        ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 0.8; ctx.globalAlpha = crossAlpha * 0.6;
        ctx.beginPath(); ctx.arc(W/2, H/2, 16, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(W/2, H/2, 20, 0, Math.PI*2); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── MINIMAP ──
      const tileSize = Math.max(3, Math.floor(80 / Math.max(mapWidth, mapHeight)));
      drawMinimap(ctx, p, pickups.current, entities.current, tileSize);

      // ── COMPASS ──
      drawCompass(ctx, p);

      // ── CANVAS NOTIFICATIONS ──
      canvasNotifs.current = canvasNotifs.current.filter(n => n.life > 0);
      canvasNotifs.current.forEach(n => {
        n.life--; n.y -= 0.5;
        const a = Math.min(1, n.life / 20);
        ctx.globalAlpha = a;
        ctx.font = "bold 17px 'Cinzel', serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = n.color; ctx.shadowBlur = 10;
        ctx.fillStyle = n.color; ctx.fillText(n.text, W / 2, n.y);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      });

      // ── CONTROLS HINT / POINTER LOCK ──
      if (!pointerLockedRef.current) {
        ctx.globalAlpha = 0.45; ctx.fillStyle = '#c8a96e';
        ctx.font = "11px 'Crimson Text', serif"; ctx.textAlign = 'center';
        ctx.fillText('Click to enable mouse look', W / 2, H - 14);
        ctx.globalAlpha = 1;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId); clearInterval(coinInterval);
      window.removeEventListener('keydown', onKD);
      window.removeEventListener('keyup', onKU);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onPLChange);
      window.removeEventListener('mousemove', onMM);
    };
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <div style={{ width: '100%', height: 'calc(100vh - 44px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060402', gap: 24 }}>
        <style>{`@keyframes loadbar { 0%{left:-40%} 100%{left:110%} }`}</style>
        <div style={{ fontSize: 10, letterSpacing: 8, color: '#3a2810', fontFamily: "'Cinzel', serif" }}>DESCENDING INTO DARKNESS</div>
        <div style={{ width: 220, height: 2, background: '#1a1208', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, #c8a96e, transparent)', animation: 'loadbar 1.4s ease-in-out infinite' }} />
        </div>
        <div style={{ fontSize: 10, letterSpacing: 3, color: '#2a1808', fontFamily: "'Crimson Text', serif", fontStyle: 'italic' }}>Forging the dungeon...</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 44px)', position: 'relative', background: '#000', cursor: pointerLocked ? 'none' : 'crosshair' }}>
      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
      />
      {/* Controls overlay - bottom left */}
      <div style={{ position: 'absolute', bottom: 14, left: 16, fontFamily: "'Crimson Text', serif", fontSize: 11, color: 'rgba(140,100,50,0.6)', lineHeight: 1.8, pointerEvents: 'none', letterSpacing: 0.5 }}>
        <div>W A S D &nbsp;·&nbsp; Move &amp; Strafe</div>
        <div>← → &nbsp;·&nbsp; Turn &nbsp;|&nbsp; Shift &nbsp;·&nbsp; Sprint</div>
        <div>Mouse click &nbsp;·&nbsp; Capture cursor</div>
      </div>
    </div>
  );
}
