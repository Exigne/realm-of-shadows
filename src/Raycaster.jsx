import React, { useEffect, useRef, useState } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

// HIGH QUALITY TEXTURES - 256x256 for crisp detail
const textureSources = {
  // 1: STONE WALL - Grey bricks with depth
  1: `data:image/svg+xml;utf8,<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="stone1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%23999"/>
        <stop offset="100%" stop-color="%23666"/>
      </linearGradient>
      <linearGradient id="stone2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%23888"/>
        <stop offset="100%" stop-color="%23555"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" fill="%23444"/>
    <!-- Row 1 -->
    <rect x="4" y="4" width="120" height="60" fill="url(%23stone1)" rx="2"/>
    <rect x="132" y="4" width="120" height="60" fill="url(%23stone2)" rx="2"/>
    <!-- Row 2 -->
    <rect x="4" y="72" width="120" height="60" fill="url(%23stone2)" rx="2"/>
    <rect x="132" y="72" width="120" height="60" fill="url(%23stone1)" rx="2"/>
    <!-- Row 3 -->
    <rect x="4" y="140" width="120" height="60" fill="url(%23stone1)" rx="2"/>
    <rect x="132" y="140" width="120" height="60" fill="url(%23stone2)" rx="2"/>
    <!-- Row 4 -->
    <rect x="4" y="208" width="120" height="44" fill="url(%23stone2)" rx="2"/>
    <rect x="132" y="208" width="120" height="44" fill="url(%23stone1)" rx="2"/>
    <!-- Highlights -->
    <line x1="0" y1="0" x2="256" y2="0" stroke="%23aaa" stroke-width="4"/>
    <line x1="0" y1="0" x2="0" y2="256" stroke="%23aaa" stroke-width="4"/>
    <!-- Cracks -->
    <path d="M50 30 L55 50 L52 70" stroke="%23333" stroke-width="3" fill="none" opacity="0.6"/>
    <path d="M180 150 L185 170 L182 190" stroke="%23333" stroke-width="2" fill="none" opacity="0.5"/>
  </svg>`,

  // 2: MAGICAL TILE - Glowing encounter
  2: `data:image/svg+xml;utf8,<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="magic" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="%23ffff00"/>
        <stop offset="20%" stop-color="%23ff8800"/>
        <stop offset="50%" stop-color="%23cc2200"/>
        <stop offset="100%" stop-color="%23441100"/>
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <rect width="256" height="256" fill="url(%23magic)"/>
    <!-- Magic circle -->
    <circle cx="128" cy="128" r="80" fill="none" stroke="%23ffff00" stroke-width="4" filter="url(%23glow)"/>
    <circle cx="128" cy="128" r="60" fill="none" stroke="%23ffaa00" stroke-width="2"/>
    <circle cx="128" cy="128" r="40" fill="%23ffff00" opacity="0.3"/>
    <!-- Runes -->
    <path d="M128 48 L132 120 L128 128 L124 120 Z" fill="%23ffff00"/>
    <path d="M128 208 L132 136 L128 128 L124 136 Z" fill="%23ffff00"/>
    <path d="M48 128 L120 132 L128 128 L120 124 Z" fill="%23ffff00"/>
    <path d="M208 128 L136 132 L128 128 L136 124 Z" fill="%23ffff00"/>
  </svg>`,

  // 3: RED BRICK WITH MOSS - Warm dungeon
  3: `data:image/svg+xml;utf8,<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brick1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%23994444"/>
        <stop offset="100%" stop-color="%23662222"/>
      </linearGradient>
      <linearGradient id="brick2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%23883333"/>
        <stop offset="100%" stop-color="%23551111"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" fill="%23442222"/>
    <!-- Bricks -->
    <rect x="4" y="4" width="120" height="60" fill="url(%23brick1)" rx="2"/>
    <rect x="132" y="4" width="120" height="60" fill="url(%23brick2)" rx="2"/>
    <rect x="4" y="72" width="120" height="60" fill="url(%23brick2)" rx="2"/>
    <rect x="132" y="72" width="120" height="60" fill="url(%23brick1)" rx="2"/>
    <rect x="4" y="140" width="120" height="60" fill="url(%23brick1)" rx="2"/>
    <rect x="132" y="140" width="120" height="60" fill="url(%23brick2)" rx="2"/>
    <rect x="4" y="208" width="120" height="44" fill="url(%23brick2)" rx="2"/>
    <rect x="132" y="208" width="120" height="44" fill="url(%23brick1)" rx="2"/>
    <!-- Moss patches -->
    <ellipse cx="40" cy="40" rx="25" ry="18" fill="%232d5016" opacity="0.85"/>
    <ellipse cx="200" cy="80" rx="30" ry="22" fill="%233d6020" opacity="0.75"/>
    <ellipse cx="60" cy="160" rx="20" ry="15" fill="%23204010" opacity="0.9"/>
    <ellipse cx="180" cy="200" rx="28" ry="20" fill="%232d5016" opacity="0.7"/>
    <ellipse cx="120" cy="120" rx="15" ry="12" fill="%233d6020" opacity="0.6"/>
    <!-- Moss details -->
    <circle cx="30" cy="35" r="6" fill="%234d8030" opacity="0.6"/>
    <circle cx="50" cy="45" r="4" fill="%234d8030" opacity="0.5"/>
    <circle cx="190" cy="75" r="8" fill="%234d8030" opacity="0.5"/>
    <circle cx="210" cy="85" r="5" fill="%234d8030" opacity="0.4"/>
  </svg>`,

  // 4: WOODEN DOOR - Detailed
  4: `data:image/svg+xml;utf8,<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wood1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="%235d3d26"/>
        <stop offset="25%" stop-color="%237a5239"/>
        <stop offset="50%" stop-color="%235d3d26"/>
        <stop offset="75%" stop-color="%236b462e"/>
        <stop offset="100%" stop-color="%235d3d26"/>
      </linearGradient>
      <linearGradient id="iron" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%23666"/>
        <stop offset="50%" stop-color="%23888"/>
        <stop offset="100%" stop-color="%23555"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" fill="url(%23wood1)"/>
    <!-- Vertical planks -->
    <line x1="64" y1="0" x2="64" y2="256" stroke="%233d2817" stroke-width="4"/>
    <line x1="128" y1="0" x2="128" y2="256" stroke="%233d2817" stroke-width="4"/>
    <line x1="192" y1="0" x2="192" y2="256" stroke="%233d2817" stroke-width="4"/>
    <!-- Wood grain -->
    <path d="M20 40 Q30 45 25 55" stroke="%233d2817" stroke-width="2" opacity="0.4" fill="none"/>
    <path d="M80 100 Q90 105 85 115" stroke="%233d2817" stroke-width="2" opacity="0.4" fill="none"/>
    <path d="M150 60 Q160 65 155 75" stroke="%233d2817" stroke-width="2" opacity="0.4" fill="none"/>
    <path d="M220 150 Q230 155 225 165" stroke="%233d2817" stroke-width="2" opacity="0.4" fill="none"/>
    <!-- Iron bands -->
    <rect x="0" y="24" width="256" height="32" fill="url(%23iron)"/>
    <rect x="0" y="200" width="256" height="32" fill="url(%23iron)"/>
    <!-- Rivets -->
    <circle cx="24" cy="40" r="8" fill="%23444"/>
    <circle cx="72" cy="40" r="8" fill="%23444"/>
    <circle cx="120" cy="40" r="8" fill="%23444"/>
    <circle cx="168" cy="40" r="8" fill="%23444"/>
    <circle cx="216" cy="40" r="8" fill="%23444"/>
    <circle cx="24" cy="216" r="8" fill="%23444"/>
    <circle cx="72" cy="216" r="8" fill="%23444"/>
    <circle cx="120" cy="216" r="8" fill="%23444"/>
    <circle cx="168" cy="216" r="8" fill="%23444"/>
    <circle cx="216" cy="216" r="8" fill="%23444"/>
    <!-- Handle -->
    <circle cx="48" cy="128" r="20" fill="%23444"/>
    <circle cx="48" cy="128" r="12" fill="%23666"/>
    <rect x="44" y="128" width="8" height="40" fill="%23444"/>
  </svg>`,

  // 5: DARK STONE - Alternative
  5: `data:image/svg+xml;utf8,<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <rect width="256" height="256" fill="%23333"/>
    <rect x="4" y="4" width="120" height="120" fill="%23555" rx="3"/>
    <rect x="132" y="4" width="120" height="120" fill="%23444" rx="3"/>
    <rect x="4" y="132" width="120" height="120" fill="%23444" rx="3"/>
    <rect x="132" y="132" width="120" height="120" fill="%23555" rx="3"/>
    <path d="M40 40 L50 80 L45 110" stroke="%23222" stroke-width="3" fill="none"/>
    <path d="M160 160 L170 200 L165 230" stroke="%23222" stroke-width="3" fill="none"/>
    <line x1="0" y1="0" x2="256" y2="0" stroke="%23666" stroke-width="4"/>
    <line x1="0" y1="0" x2="0" y2="256" stroke="%23666" stroke-width="4"/>
  </svg>`
};

// ENHANCED GOBLIN
const spriteSource = `data:image/svg+xml;utf8,<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="64" cy="118" rx="35" ry="8" fill="%23000" opacity="0.3"/>
  <path d="M32 96 L40 44 L64 24 L88 44 L96 96 Z" fill="%232d5a27"/>
  <path d="M40 56 L20 72" stroke="%232d5a27" stroke-width="10" stroke-linecap="round"/>
  <path d="M88 56 L108 72" stroke="%232d5a27" stroke-width="10" stroke-linecap="round"/>
  <circle cx="64" cy="40" r="18" fill="%233d7a37"/>
  <path d="M48 32 L36 16 L52 28" fill="%232d5a27"/>
  <path d="M80 32 L92 16 L76 28" fill="%232d5a27"/>
  <circle cx="56" cy="36" r="6" fill="%23ff0000"/>
  <circle cx="72" cy="36" r="6" fill="%23ff0000"/>
  <circle cx="56" cy="34" r="2" fill="%23ffff00"/>
  <circle cx="72" cy="34" r="2" fill="%23ffff00"/>
  <path d="M56 52 Q64 56 72 52" stroke="%23000" stroke-width="3" fill="none"/>
  <path d="M60 52 L62 56 L64 52" fill="%23ffffaa"/>
  <path d="M68 52 L66 56 L64 52" fill="%23ffffaa"/>
</svg>`;

export default function Raycaster({ onEncounter }) {
  const canvasRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const textures = useRef({});
  const sprite = useRef(null);

  const player = useRef({
    x: 2.5, y: 2.5,
    dirX: -1, dirY: 0,
    planeX: 0, planeY: 0.66,
    moveSpeed: 0.05,
    rotSpeed: 0.04
  });

  const goblin = useRef({ x: 5.5, y: 5.5, loaded: false });
  const keys = useRef({});

  // Load assets
  useEffect(() => {
    let loaded = 0;
    const total = Object.keys(textureSources).length + 1;

    const check = () => {
      loaded++;
      if (loaded >= total) setImagesLoaded(true);
    };

    Object.entries(textureSources).forEach(([id, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => { textures.current[id] = img; check(); };
      img.onerror = check;
    });

    const sImg = new Image();
    sImg.src = spriteSource;
    sImg.onload = () => { sprite.current = sImg; goblin.current.loaded = true; check(); };
    sImg.onerror = check;
  }, []);

  // Game loop
  useEffect(() => {
    if (!imagesLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let animId;

    const onKey = (e, d) => { 
      keys.current[e.key] = d; 
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
    };

    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup', e => onKey(e, false));

    const loop = () => {
      const p = player.current;

      // Movement with collision
      const ms = p.moveSpeed;
      if (keys.current['w'] || keys.current['ArrowUp']) {
        const nx = p.x + p.dirX * ms;
        const ny = p.y + p.dirY * ms;
        if (!worldMap[Math.floor(nx)]?.[Math.floor(p.y)]) p.x = nx;
        if (!worldMap[Math.floor(p.x)]?.[Math.floor(ny)]) p.y = ny;
      }
      if (keys.current['s'] || keys.current['ArrowDown']) {
        const nx = p.x - p.dirX * ms;
        const ny = p.y - p.dirY * ms;
        if (!worldMap[Math.floor(nx)]?.[Math.floor(p.y)]) p.x = nx;
        if (!worldMap[Math.floor(p.x)]?.[Math.floor(ny)]) p.y = ny;
      }
      if (keys.current['d']) {
        const nx = p.x + p.planeX * ms;
        const ny = p.y + p.planeY * ms;
        if (!worldMap[Math.floor(nx)]?.[Math.floor(p.y)]) p.x = nx;
        if (!worldMap[Math.floor(p.x)]?.[Math.floor(ny)]) p.y = ny;
      }
      if (keys.current['a']) {
        const nx = p.x - p.planeX * ms;
        const ny = p.y - p.planeY * ms;
        if (!worldMap[Math.floor(nx)]?.[Math.floor(p.y)]) p.x = nx;
        if (!worldMap[Math.floor(p.x)]?.[Math.floor(ny)]) p.y = ny;
      }
      if (keys.current['ArrowRight']) {
        const odx = p.dirX, opx = p.planeX;
        const c = Math.cos(-p.rotSpeed), s = Math.sin(-p.rotSpeed);
        p.dirX = p.dirX * c - p.dirY * s;
        p.dirY = odx * s + p.dirY * c;
        p.planeX = p.planeX * c - p.planeY * s;
        p.planeY = opx * s + p.planeY * c;
      }
      if (keys.current['ArrowLeft']) {
        const odx = p.dirX, opx = p.planeX;
        const c = Math.cos(p.rotSpeed), s = Math.sin(p.rotSpeed);
        p.dirX = p.dirX * c - p.dirY * s;
        p.dirY = odx * s + p.dirY * c;
        p.planeX = p.planeX * c - p.planeY * s;
        p.planeY = opx * s + p.planeY * c;
      }

      // Encounter
      const tx = Math.floor(p.x), ty = Math.floor(p.y);
      if (worldMap[tx]?.[ty] === 2) {
        worldMap[tx][ty] = 0;
        keys.current = {};
        onEncounter();
        return;
      }

      // RENDER
      const w = canvas.width, h = canvas.height;
      const hh = h / 2;

      // Sky/ceiling
      const grad = ctx.createLinearGradient(0, 0, 0, hh);
      grad.addColorStop(0, '#1a1510');
      grad.addColorStop(1, '#2a2520');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, hh);

      // Floor
      const fgrad = ctx.createLinearGradient(0, hh, 0, h);
      fgrad.addColorStop(0, '#1a1510');
      fgrad.addColorStop(1, '#0a0505');
      ctx.fillStyle = fgrad;
      ctx.fillRect(0, hh, w, hh);

      // Cast rays
      const zBuffer = new Float32Array(w);

      for (let x = 0; x < w; x += 2) { // Step by 2 for performance
        const camX = 2 * x / w - 1;
        const rayX = p.dirX + p.planeX * camX;
        const rayY = p.dirY + p.planeY * camX;

        let mapX = Math.floor(p.x), mapY = Math.floor(p.y);
        let sideDistX, sideDistY;
        const deltaX = Math.abs(1 / rayX);
        const deltaY = Math.abs(1 / rayY);
        let perpDist, stepX, stepY, side, hit = 0;

        if (rayX < 0) { stepX = -1; sideDistX = (p.x - mapX) * deltaX; }
        else { stepX = 1; sideDistX = (mapX + 1 - p.x) * deltaX; }
        if (rayY < 0) { stepY = -1; sideDistY = (p.y - mapY) * deltaY; }
        else { stepY = 1; sideDistY = (mapY + 1 - p.y) * deltaY; }

        while (!hit) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaY;
            mapY += stepY;
            side = 1;
          }
          if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) { hit = 1; break; }
          hit = worldMap[mapX][mapY];
        }

        perpDist = side === 0 ? (mapX - p.x + (1 - stepX) / 2) / rayX : (mapY - p.y + (1 - stepY) / 2) / rayY;
        if (perpDist < 0.1) perpDist = 0.1;

        zBuffer[x] = perpDist;
        zBuffer[x + 1] = perpDist;

        const lineH = Math.min(h, Math.floor(h / perpDist));
        const drawStart = Math.max(0, -lineH / 2 + hh);
        const drawEnd = Math.min(h, lineH / 2 + hh);

        const tex = textures.current[hit] || textures.current[1];
        if (tex) {
          let wallX = side === 0 ? p.y + perpDist * rayY : p.x + perpDist * rayX;
          wallX -= Math.floor(wallX);

          let texX = Math.floor(wallX * tex.width);
          if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) texX = tex.width - texX - 1;

          // Draw 2 pixels at once
          ctx.drawImage(tex, texX, 0, 1, tex.height, x, drawStart, 2, drawEnd - drawStart);

          // Shading
          const shade = Math.min(0.7, perpDist / 10);
          const sideShade = side === 1 ? 0.15 : 0;
          ctx.fillStyle = `rgba(0,0,0,${shade + sideShade})`;
          ctx.fillRect(x, drawStart, 2, drawEnd - drawStart);
        }
      }

      // Draw sprite
      if (goblin.current.loaded && sprite.current) {
        const g = goblin.current;
        const relX = g.x - p.x;
        const relY = g.y - p.y;

        const invDet = 1.0 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const transX = invDet * (p.dirY * relX - p.dirX * relY);
        const transY = invDet * (-p.planeY * relX + p.planeX * relY);

        if (transY > 0.1) {
          const screenX = Math.floor((w / 2) * (1 + transX / transY));
          const spriteH = Math.abs(Math.floor(h / transY));
          const spriteW = spriteH;

          const drawStartY = Math.max(0, -spriteH / 2 + hh + spriteH / 4);
          const drawStartX = Math.max(0, screenX - spriteW / 2);
          const drawEndX = Math.min(w, screenX + spriteW / 2);

          const sImg = sprite.current;
          for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
            const texX = Math.floor((stripe - (screenX - spriteW / 2)) * sImg.width / spriteW);
            if (texX >= 0 && texX < sImg.width && transY < zBuffer[stripe]) {
              ctx.drawImage(sImg, texX, 0, 1, sImg.height, stripe, drawStartY, 1, spriteH);
            }
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', e => onKey(e, true));
      window.removeEventListener('keyup', e => onKey(e, false));
    };
  }, [imagesLoaded, onEncounter]);

  if (!imagesLoaded) {
    return (
      <div style={{ 
        width: '100%', height: 'calc(100vh - 120px)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a1208', color: '#ff6600', fontFamily: 'monospace'
      }}>
        <h2>LOADING DUNGEON...</h2>
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef}
      width={800}
      height={600}
      style={{
        width: '100%',
        height: 'calc(100vh - 120px)',
        display: 'block',
        imageRendering: 'pixelated'
      }}
    />
  );
}
