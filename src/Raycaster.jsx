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
  for (let i = 0; i < TEX * TEX / 4; i++) {
    const v = (Math.random() * 40 - 20) | 0;
    ctx.fillStyle = `rgb(${96+v},${94+v},${90+v})`;
    ctx.fillRect((Math.random() * TEX) | 0, (Math.random() * TEX) | 0, 2, 2);
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
    }
  }
  // Moss & Stains
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
  }
  // Iron rivets
  for (let i = 0; i < 3; i++) {
    for (let col = 0; col * pW < TEX; col++) {
      const rx = col * pW + pW / 2, ry = (TEX / 4) * i + TEX / 8;
      ctx.fillStyle = '#2a2020'; ctx.beginPath(); ctx.arc(rx, ry, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  return c;
}

// ─── Monster Sprite Generators ──────────────────────────────────────────────

function genDragonSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX/2, cy = TEX*0.6;
  // Large leathery wings
  ctx.fillStyle = '#3a0a0a';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx-60, cy-40); ctx.lineTo(cx-20, cy+10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+60, cy-40); ctx.lineTo(cx+20, cy+10); ctx.fill();
  // Scaly body
  const gr = ctx.createRadialGradient(cx, cy, 5, cx, cy, 40);
  gr.addColorStop(0, '#802020'); gr.addColorStop(1, '#301010');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.ellipse(cx, cy, 30, 45, 0, 0, Math.PI*2); ctx.fill();
  // Dragon Head + Horns
  ctx.fillStyle = '#a03030';
  ctx.beginPath(); ctx.moveTo(cx-15, cy-40); ctx.lineTo(cx, cy-70); ctx.lineTo(cx+15, cy-40); ctx.fill();
  ctx.fillStyle = '#ddd';
  ctx.beginPath(); ctx.moveTo(cx-8, cy-65); ctx.lineTo(cx-20, cy-85); ctx.lineTo(cx-2, cy-65); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+8, cy-65); ctx.lineTo(cx+20, cy-85); ctx.lineTo(cx+2, cy-65); ctx.fill();
  // Eyes
  ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(cx-6, cy-50, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+6, cy-50, 3, 0, Math.PI*2); ctx.fill();
  return c;
}

function genBeastSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX/2, cy = TEX*0.7;
  // Hairy bulk
  ctx.fillStyle = '#2b1d14';
  ctx.beginPath(); ctx.ellipse(cx, cy, 40, 35, 0, 0, Math.PI*2); ctx.fill();
  // Massive curved tusks
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx-15, cy); ctx.quadraticCurveTo(cx-35, cy-20, cx-25, cy-45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+15, cy); ctx.quadraticCurveTo(cx+35, cy-20, cx+25, cy-45); ctx.stroke();
  // Glowing red eyes
  ctx.fillStyle = '#ff0000'; ctx.shadowBlur = 15; ctx.shadowColor = 'red';
  ctx.beginPath(); ctx.arc(cx-12, cy-15, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+12, cy-15, 5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  return c;
}

function genDemonSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX/2, cy = TEX*0.55;
  // Obsidian skin
  ctx.fillStyle = '#0a0a0c';
  ctx.beginPath(); ctx.ellipse(cx, cy, 22, 45, 0, 0, Math.PI*2); ctx.fill();
  // Spiked tail
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy+30); ctx.quadraticCurveTo(cx+50, cy+60, cx+30, cy); ctx.stroke();
  // Purple Soul-Fire Head
  const fGr = ctx.createRadialGradient(cx, cy-45, 0, cx, cy-45, 20);
  fGr.addColorStop(0, '#a020f0'); fGr.addColorStop(1, 'rgba(50,0,100,0)');
  ctx.fillStyle = fGr; ctx.beginPath(); ctx.arc(cx, cy-45, 20, 0, Math.PI*2); ctx.fill();
  // Slit eyes
  ctx.fillStyle = '#fff'; ctx.fillRect(cx-9, cy-48, 2, 6); ctx.fillRect(cx+7, cy-48, 2, 6);
  return c;
}

function genCoinSprite(frame) {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  const cx = TEX/2, cy = TEX/2;
  const scX = Math.max(0.08, Math.abs(Math.cos(frame * 0.06)));
  ctx.save(); ctx.translate(cx, cy); ctx.scale(scX, 1);
  ctx.fillStyle = '#c89020'; ctx.beginPath(); ctx.arc(0, 0, TEX*0.28, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  return c;
}

function genPotionSprite() {
  const c = makeCanvas(TEX); const ctx = c.getContext('2d');
  ctx.fillStyle = '#c02040'; ctx.beginPath(); ctx.ellipse(TEX/2, TEX*0.7, 20, 25, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(TEX/2-2, TEX*0.6, 4, 15); ctx.fillRect(TEX/2-7, TEX*0.65, 14, 4);
  return c;
}

// ─── Minimap & Compass ──────────────────────────────────────────────────────

function drawMinimap(ctx, p, pickups, entities, tileSize) {
  const mW = Math.min(mapWidth, 20) * tileSize;
  const mH = Math.min(mapHeight, 20) * tileSize;
  const mmX = W - mW - 12, mmY = 12;
  ctx.fillStyle = 'rgba(4,3,2,0.85)'; ctx.fillRect(mmX-3, mmY-3, mW+6, mH+6);
  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const t = worldMap[x][y];
      if (t > 0 && t !== 2) ctx.fillStyle = '#4a3a24';
      else if (t === 2) ctx.fillStyle = '#ff3333';
      else ctx.fillStyle = '#13100c';
      ctx.fillRect(mmX + x * tileSize, mmY + y * tileSize, tileSize, tileSize);
    }
  }
  ctx.fillStyle = '#e8d070';
  ctx.beginPath(); ctx.arc(mmX + p.x * tileSize, mmY + p.y * tileSize, 2.5, 0, Math.PI*2); ctx.fill();
}

function drawCompass(ctx, p) {
  const cx = W / 2, cy = 30, r = 22;
  const angle = Math.atan2(p.dirY, p.dirX);
  ctx.fillStyle = 'rgba(4,3,2,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#e03030'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(-angle) * 15, cy + Math.sin(-angle) * 15); ctx.stroke();
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

  const player = useRef({ x: 2.5, y: 2.5, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66, moveSpeed: 0.055, rotSpeed: 0.05 });
  const keys = useRef({});
  const torch = useRef(1.0);
  const bob = useRef(0);
  const frame = useRef(0);
  const canvasNotifs = useRef([]);

  useEffect(() => {
    textures.current = { 1: genStoneWall(), 3: genBrickWall(), 4: genWoodWall() };
    sprites.current = { 0: genDragonSprite(), 1: genBeastSprite(), 2: genDemonSprite(), potion: genPotionSprite(), coin: genCoinSprite(0) };

    const ents = [];
    for (let x = 0; x < mapWidth; x++)
      for (let y = 0; y < mapHeight; y++)
        if (worldMap[x][y] === 2) ents.push({ x: x + 0.5, y: y + 0.5, type: Math.floor(Math.random() * 3) });
    entities.current = ents;

    const open = [];
    for (let x = 2; x < mapWidth - 2; x++)
      for (let y = 2; y < mapHeight - 2; y++)
        if (worldMap[x][y] === 0) open.push({ x: x + 0.5, y: y + 0.5 });
    open.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(PICKUP_COUNT, open.length); i++) {
      pickups.current.push({ ...open[i], type: i % 3 === 0 ? 'potion' : 'coin', collected: false, phase: Math.random() * 6.28 });
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let rafId;

    const onKD = e => { keys.current[e.key.toLowerCase()] = true; if(e.key.startsWith("Arrow")) keys.current[e.key] = true; };
    const onKU = e => { keys.current[e.key.toLowerCase()] = false; if(e.key.startsWith("Arrow")) keys.current[e.key] = false; };
    window.addEventListener('keydown', onKD);
    window.addEventListener('keyup', onKU);

    const onMM = e => {
      if (document.pointerLockElement !== canvas) return;
      const p = player.current;
      // FIX: Standard Mouse Rotation (Right movement = Right turn)
      const rot = e.movementX * MOUSE_SENS;
      const c = Math.cos(rot), s = Math.sin(rot);
      const [odx, opx] = [p.dirX, p.planeX];
      p.dirX = odx*c - p.dirY*s; p.dirY = odx*s + p.dirY*c;
      p.planeX = opx*c - p.planeY*s; p.planeY = opx*s + p.planeY*c;
    };
    
    canvas.addEventListener('click', () => canvas.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      pointerLockedRef.current = locked; setPointerLocked(locked);
    });
    window.addEventListener('mousemove', onMM);

    const loop = () => {
      frame.current++;
      const p = player.current;
      const ms = p.moveSpeed * (keys.current['shift'] ? 1.7 : 1);
      const rs = p.rotSpeed;
      let moving = false;

      const tryMove = (dx, dy) => {
        if (worldMap[Math.floor(p.x + dx * 1.5)][Math.floor(p.y)] === 0) p.x += dx;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y + dy * 1.5)] === 0) p.y += dy;
        moving = true;
      };

      // FIX: Keyboard Rotation
      const tryRot = (angle) => {
        const c = Math.cos(angle), s = Math.sin(angle);
        const [odx, opx] = [p.dirX, p.planeX];
        p.dirX = odx*c - p.dirY*s; p.dirY = odx*s + p.dirY*c;
        p.planeX = opx*c - p.planeY*s; p.planeY = opx*s + p.planeY*c;
      };

      if (keys.current['w'] || keys.current['ArrowUp'])    tryMove(p.dirX * ms, p.dirY * ms);
      if (keys.current['s'] || keys.current['ArrowDown'])  tryMove(-p.dirX * ms, -p.dirY * ms);
      if (keys.current['a'])                               tryMove(-p.planeX * ms, -p.planeY * ms);
      if (keys.current['d'])                               tryMove(p.planeX * ms, p.planeY * ms);
      if (keys.current['ArrowLeft'])  tryRot(-rs); 
      if (keys.current['ArrowRight']) tryRot(rs);

      if (moving) bob.current += 0.1;
      torch.current = 0.9 + Math.random() * 0.1;

      // Encounter & Pickup logic
      if (worldMap[Math.floor(p.x)][Math.floor(p.y)] === 2) {
        worldMap[Math.floor(p.x)][Math.floor(p.y)] = 0;
        cancelAnimationFrame(rafId); onEncounter(); return;
      }
      
      pickups.current.forEach(pu => {
        if (!pu.collected && (p.x-pu.x)**2 + (p.y-pu.y)**2 < 0.3) {
          pu.collected = true;
          const isCoin = pu.type === 'coin';
          canvasNotifs.current.push({ text: isCoin ? '+10 Gold' : '+20 Health', color: isCoin ? '#f0d040' : '#50e070', life: 60, y: H * 0.4 });
          onPickup(pu.type, isCoin ? 10 : 20);
        }
      });

      // Rendering
      ctx.fillStyle = '#070511'; ctx.fillRect(0, 0, W, H/2);
      ctx.fillStyle = '#1a1208'; ctx.fillRect(0, H/2, W, H/2);

      const zBuf = new Float32Array(W);
      const bobY = Math.sin(bob.current) * 4;

      // Walls
      for (let x = 0; x < W; x++) {
        const camX = 2 * x / W - 1;
        const rDX = p.dirX + p.planeX * camX;
        const rDY = p.dirY + p.planeY * camX;
        let mX = Math.floor(p.x), mY = Math.floor(p.y);
        const ddX = Math.abs(1 / rDX), ddY = Math.abs(1 / rDY);
        let sdX = rDX < 0 ? (p.x - mX) * ddX : (mX + 1 - p.x) * ddX;
        let sdY = rDY < 0 ? (p.y - mY) * ddY : (mY + 1 - p.y) * ddY;
        const stX = rDX < 0 ? -1 : 1, stY = rDY < 0 ? -1 : 1;
        let hit = 0, side = 0;
        for (let i = 0; i < 40 && !hit; i++) {
          if (sdX < sdY) { sdX += ddX; mX += stX; side = 0; }
          else { sdY += ddY; mY += stY; side = 1; }
          if (worldMap[mX][mY] > 0 && worldMap[mX][mY] !== 2) hit = 1;
        }
        const pwd = side === 0 ? sdX - ddX : sdY - ddY;
        zBuf[x] = pwd;
        const lH = Math.floor(H / pwd);
        const dS = -lH / 2 + H / 2 + bobY;
        ctx.drawImage(textures.current[worldMap[mX][mY]] || textures.current[1], Math.floor((side === 0 ? p.y + pwd * rDY : p.x + pwd * rDX) % 1 * TEX), 0, 1, TEX, x, dS, 1, lH);
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.95, pwd/FOG_DIST)})`; ctx.fillRect(x, dS, 1, lH);
      }

      // Sprites (Monsters & Items)
      const allS = [...entities.current, ...pickups.current.filter(p=>!p.collected)];
      allS.sort((a,b) => ((p.x-b.x)**2+(p.y-b.y)**2) - ((p.x-a.x)**2+(p.y-a.y)**2));
      allS.forEach(s => {
        const sx = s.x - p.x, sy = s.y - p.y;
        const invD = 1 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const tx = invD * (p.dirY * sx - p.dirX * sy), ty = invD * (-p.planeY * sx + p.planeX * sy);
        if (ty <= 0.1) return;
        const screenX = Math.floor((W / 2) * (1 + tx / ty)), sH = Math.abs(Math.floor(H / ty)), dSY = -sH / 2 + H / 2 + bobY;
        const img = sprites.current[s.type];
        if (screenX > -sH && screenX < W + sH) {
          for (let st = Math.max(0, screenX - sH/2); st < Math.min(W, screenX + sH/2); st++) {
            if (ty < zBuf[Math.floor(st)]) ctx.drawImage(img, Math.floor((st - (screenX - sH/2)) * TEX / sH), 0, 1, TEX, st, dSY, 1, sH);
          }
        }
      });

      // UI
      drawMinimap(ctx, p, pickups.current, entities.current, 4);
      drawCompass(ctx, p);
      canvasNotifs.current = canvasNotifs.current.filter(n => {
        n.life--; n.y -= 0.5; ctx.fillStyle = n.color; ctx.globalAlpha = n.life/60;
        ctx.font = "bold 16px serif"; ctx.textAlign = 'center'; ctx.fillText(n.text, W/2, n.y);
        ctx.globalAlpha = 1; return n.life > 0;
      });

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isLoaded]);

  if (!isLoaded) return <div style={{background:'#000', color:'#fff', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>SUMMONING MONSTERS...</div>;

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 44px)', position: 'relative', background: '#000' }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
    </div>
  );
}
