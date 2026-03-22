import React, { useEffect, useRef, useState } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

// SIMPLIFIED TEXTURES - Using basic shapes for reliability
const textureSources = {
  // 1: GREY STONE WALL - Classic dungeon brick
  1: `data:image/svg+xml;utf8,<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="128" height="128" fill="%23666"/>
    <!-- Mortar lines -->
    <rect x="0" y="0" width="128" height="128" fill="none" stroke="%23444" stroke-width="2"/>
    <!-- Bricks -->
    <rect x="2" y="2" width="60" height="28" fill="%23888" rx="1"/>
    <rect x="66" y="2" width="60" height="28" fill="%23777" rx="1"/>
    <rect x="2" y="34" width="60" height="28" fill="%23777" rx="1"/>
    <rect x="66" y="34" width="60" height="28" fill="%23888" rx="1"/>
    <rect x="2" y="66" width="60" height="28" fill="%23888" rx="1"/>
    <rect x="66" y="66" width="60" height="28" fill="%23777" rx="1"/>
    <rect x="2" y="98" width="60" height="28" fill="%23777" rx="1"/>
    <rect x="66" y="98" width="60" height="28" fill="%23888" rx="1"/>
    <!-- Highlight edges -->
    <line x1="0" y1="0" x2="128" y2="0" stroke="%23999" stroke-width="2"/>
    <line x1="0" y1="0" x2="0" y2="128" stroke="%23999" stroke-width="2"/>
  </svg>`,

  // 2: ENCOUNTER TILE - Magical red glow
  2: `data:image/svg+xml;utf8,<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="%23ff4400"/>
        <stop offset="30%" stop-color="%23cc2200"/>
        <stop offset="70%" stop-color="%23661100"/>
        <stop offset="100%" stop-color="%23221100"/>
      </radialGradient>
    </defs>
    <rect width="128" height="128" fill="url(%23glow2)"/>
    <!-- Inner pattern -->
    <circle cx="64" cy="64" r="40" fill="none" stroke="%23ff6600" stroke-width="3" opacity="0.8"/>
    <circle cx="64" cy="64" r="25" fill="%23ffaa00" opacity="0.6"/>
    <path d="M64 24 L68 60 L64 64 L60 60 Z" fill="%23ffff00"/>
    <path d="M64 104 L68 68 L64 64 L60 68 Z" fill="%23ffff00"/>
    <path d="M24 64 L60 68 L64 64 L60 60 Z" fill="%23ffff00"/>
    <path d="M104 64 L68 68 L64 64 L68 60 Z" fill="%23ffff00"/>
  </svg>`,

  // 3: RED BRICK WITH MOSS - Warm dungeon wall
  3: `data:image/svg+xml;utf8,<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <!-- Base red brick -->
    <rect width="128" height="128" fill="%23552a2a"/>
    <!-- Bricks -->
    <rect x="2" y="2" width="60" height="28" fill="%23774444" rx="1"/>
    <rect x="66" y="2" width="60" height="28" fill="%23663333" rx="1"/>
    <rect x="2" y="34" width="60" height="28" fill="%23663333" rx="1"/>
    <rect x="66" y="34" width="60" height="28" fill="%23774444" rx="1"/>
    <rect x="2" y="66" width="60" height="28" fill="%23774444" rx="1"/>
    <rect x="66" y="66" width="60" height="28" fill="%23663333" rx="1"/>
    <rect x="2" y="98" width="60" height="28" fill="%23663333" rx="1"/>
    <rect x="66" y="98" width="60" height="28" fill="%23774444" rx="1"/>
    <!-- Moss patches -->
    <ellipse cx="20" cy="20" rx="12" ry="8" fill="%232d5016" opacity="0.8"/>
    <ellipse cx="100" cy="40" rx="15" ry="10" fill="%233d6020" opacity="0.7"/>
    <ellipse cx="30" cy="80" rx="10" ry="6" fill="%23204010" opacity="0.9"/>
    <ellipse cx="90" cy="100" rx="14" ry="9" fill="%232d5016" opacity="0.6"/>
    <!-- Moss details -->
    <circle cx="15" cy="18" r="3" fill="%234d8030" opacity="0.5"/>
    <circle cx="25" cy="22" r="2" fill="%234d8030" opacity="0.5"/>
    <circle cx="95" cy="38" r="4" fill="%234d8030" opacity="0.5"/>
  </svg>`,

  // 4: WOODEN DOOR - Detailed dungeon door
  4: `data:image/svg+xml;utf8,<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="woodgrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="%233d2817"/>
        <stop offset="25%" stop-color="%23523726"/>
        <stop offset="50%" stop-color="%233d2817"/>
        <stop offset="75%" stop-color="%234a2f1a"/>
        <stop offset="100%" stop-color="%233d2817"/>
      </linearGradient>
      <linearGradient id="irongrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%23555"/>
        <stop offset="50%" stop-color="%23777"/>
        <stop offset="100%" stop-color="%23444"/>
      </linearGradient>
    </defs>
    <!-- Wood background -->
    <rect width="128" height="128" fill="url(%23woodgrad)"/>
    <!-- Vertical planks -->
    <line x1="32" y1="0" x2="32" y2="128" stroke="%232a1a0f" stroke-width="3"/>
    <line x1="64" y1="0" x2="64" y2="128" stroke="%232a1a0f" stroke-width="3"/>
    <line x1="96" y1="0" x2="96" y2="128" stroke="%232a1a0f" stroke-width="3"/>
    <!-- Wood grain -->
    <line x1="10" y1="20" x2="22" y2="20" stroke="%232a1a0f" stroke-width="1" opacity="0.5"/>
    <line x1="40" y1="60" x2="56" y2="60" stroke="%232a1a0f" stroke-width="1" opacity="0.5"/>
    <line x1="72" y1="40" x2="88" y2="40" stroke="%232a1a0f" stroke-width="1" opacity="0.5"/>
    <line x1="104" y1="80" x2="120" y2="80" stroke="%232a1a0f" stroke-width="1" opacity="0.5"/>
    <!-- Iron bands -->
    <rect x="0" y="12" width="128" height="16" fill="url(%23irongrad)"/>
    <rect x="0" y="100" width="128" height="16" fill="url(%23irongrad)"/>
    <!-- Rivets on bands -->
    <circle cx="12" cy="20" r="4" fill="%23333"/>
    <circle cx="36" cy="20" r="4" fill="%23333"/>
    <circle cx="60" cy="20" r="4" fill="%23333"/>
    <circle cx="84" cy="20" r="4" fill="%23333"/>
    <circle cx="108" cy="20" r="4" fill="%23333"/>
    <circle cx="12" cy="108" r="4" fill="%23333"/>
    <circle cx="36" cy="108" r="4" fill="%23333"/>
    <circle cx="60" cy="108" r="4" fill="%23333"/>
    <circle cx="84" cy="108" r="4" fill="%23333"/>
    <circle cx="108" cy="108" r="4" fill="%23333"/>
    <!-- Door handle -->
    <circle cx="24" cy="64" r="10" fill="%23444"/>
    <circle cx="24" cy="64" r="6" fill="%23666"/>
    <rect x="22" y="64" width="4" height="20" fill="%23444"/>
  </svg>`,

  // 5: DARK STONE - Alternative wall
  5: `data:image/svg+xml;utf8,<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" fill="%23444"/>
    <!-- Large stone blocks -->
    <rect x="2" y="2" width="60" height="60" fill="%23666" rx="2"/>
    <rect x="66" y="2" width="60" height="60" fill="%23555" rx="2"/>
    <rect x="2" y="66" width="60" height="60" fill="%23555" rx="2"/>
    <rect x="66" y="66" width="60" height="60" fill="%23666" rx="2"/>
    <!-- Cracks -->
    <path d="M20 20 L25 35 L22 50" stroke="%23222" stroke-width="2" fill="none"/>
    <path d="M80 80 L85 95 L82 110" stroke="%23333" stroke-width="2" fill="none"/>
    <path d="M100 30 L95 45 L105 55" stroke="%23222" stroke-width="2" fill="none"/>
    <!-- Highlight -->
    <line x1="0" y1="0" x2="128" y2="0" stroke="%23777" stroke-width="2"/>
    <line x1="0" y1="0" x2="0" y2="128" stroke="%23777" stroke-width="2"/>
  </svg>`
};

// ENHANCED GOBLIN SPRITE
const spriteSource = `data:image/svg+xml;utf8,<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- Shadow -->
  <ellipse cx="32" cy="58" rx="18" ry="4" fill="%23000" opacity="0.4"/>
  <!-- Body -->
  <path d="M18 48 L24 22 L32 14 L40 22 L46 48 Z" fill="%232d5a27"/>
  <!-- Arms -->
  <path d="M24 30 L14 38" stroke="%232d5a27" stroke-width="5" stroke-linecap="round"/>
  <path d="M40 30 L50 38" stroke="%232d5a27" stroke-width="5" stroke-linecap="round"/>
  <!-- Head -->
  <circle cx="32" cy="20" r="9" fill="%233d7a37"/>
  <!-- Ears -->
  <path d="M24 16 L18 8 L26 14" fill="%232d5a27"/>
  <path d="M40 16 L46 8 L38 14" fill="%232d5a27"/>
  <!-- Eyes - bright red -->
  <circle cx="28" cy="18" r="3" fill="%23ff0000"/>
  <circle cx="36" cy="18" r="3" fill="%23ff0000"/>
  <circle cx="28" cy="17" r="1" fill="%23ffff00"/>
  <circle cx="36" cy="17" r="1" fill="%23ffff00"/>
  <!-- Mouth -->
  <path d="M28 24 Q32 26 36 24" stroke="%23000" stroke-width="1.5" fill="none"/>
  <!-- Teeth -->
  <path d="M30 24 L31 26 L32 24" fill="%23ffffaa"/>
  <path d="M34 24 L33 26 L32 24" fill="%23ffffaa"/>
</svg>`;

// FLOOR TEXTURE
const floorSource = `data:image/svg+xml;utf8,<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="%232a1e12"/>
  <rect x="0" y="0" width="64" height="64" fill="%23332a1a"/>
  <rect x="64" y="64" width="64" height="64" fill="%23332a1a"/>
  <line x1="64" y1="0" x2="64" y2="128" stroke="%231a1208" stroke-width="2"/>
  <line x1="0" y1="64" x2="128" y2="64" stroke="%231a1208" stroke-width="2"/>
</svg>`;

export default function Raycaster({ onEncounter }) {
  const canvasRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [debug, setDebug] = useState('');

  const textures = useRef({});
  const sprite = useRef(null);
  const floorImg = useRef(null);

  const player = useRef({
    x: 2.5, y: 2.5,
    dirX: -1, dirY: 0,
    planeX: 0, planeY: 0.66,
    moveSpeed: 0.06,
    rotSpeed: 0.045
  });

  const goblin = useRef({
    x: 5.5, y: 5.5,
    loaded: false
  });

  const keys = useRef({});

  // Load all assets
  useEffect(() => {
    let loadedCount = 0;
    const totalAssets = Object.keys(textureSources).length + 2; // textures + sprite + floor

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalAssets) {
        setImagesLoaded(true);
      }
    };

    // Load wall textures
    Object.entries(textureSources).forEach(([id, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        textures.current[id] = img;
        checkLoaded();
      };
      img.onerror = () => {
        console.error('Failed to load texture:', id);
        checkLoaded();
      };
    });

    // Load sprite
    const sImg = new Image();
    sImg.src = spriteSource;
    sImg.onload = () => {
      sprite.current = sImg;
      goblin.current.loaded = true;
      checkLoaded();
    };

    // Load floor
    const fImg = new Image();
    fImg.src = floorSource;
    fImg.onload = () => {
      floorImg.current = fImg;
      checkLoaded();
    };

    // Timeout fallback
    setTimeout(() => {
      if (!imagesLoaded) setImagesLoaded(true);
    }, 3000);
  }, []);

  // Game loop
  useEffect(() => {
    if (!imagesLoaded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let animationId;

    const handleKey = (e, down) => {
      keys.current[e.key] = down;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    const gameLoop = () => {
      const p = player.current;

      // Movement
      const moveSpeed = p.moveSpeed;

      if (keys.current['w'] || keys.current['ArrowUp']) {
        const nx = p.x + p.dirX * moveSpeed;
        const ny = p.y + p.dirY * moveSpeed;
        if (worldMap[Math.floor(nx)]?.[Math.floor(p.y)] === 0) p.x = nx;
        if (worldMap[Math.floor(p.x)]?.[Math.floor(ny)] === 0) p.y = ny;
      }
      if (keys.current['s'] || keys.current['ArrowDown']) {
        const nx = p.x - p.dirX * moveSpeed;
        const ny = p.y - p.dirY * moveSpeed;
        if (worldMap[Math.floor(nx)]?.[Math.floor(p.y)] === 0) p.x = nx;
        if (worldMap[Math.floor(p.x)]?.[Math.floor(ny)] === 0) p.y = ny;
      }
      if (keys.current['d']) {
        const nx = p.x + p.planeX * moveSpeed;
        const ny = p.y + p.planeY * moveSpeed;
        if (worldMap[Math.floor(nx)]?.[Math.floor(p.y)] === 0) p.x = nx;
        if (worldMap[Math.floor(p.x)]?.[Math.floor(ny)] === 0) p.y = ny;
      }
      if (keys.current['a']) {
        const nx = p.x - p.planeX * moveSpeed;
        const ny = p.y - p.planeY * moveSpeed;
        if (worldMap[Math.floor(nx)]?.[Math.floor(p.y)] === 0) p.x = nx;
        if (worldMap[Math.floor(p.x)]?.[Math.floor(ny)] === 0) p.y = ny;
      }
      if (keys.current['ArrowRight']) {
        const oldDirX = p.dirX;
        p.dirX = p.dirX * Math.cos(-p.rotSpeed) - p.dirY * Math.sin(-p.rotSpeed);
        p.dirY = oldDirX * Math.sin(-p.rotSpeed) + p.dirY * Math.cos(-p.rotSpeed);
        const oldPlaneX = p.planeX;
        p.planeX = p.planeX * Math.cos(-p.rotSpeed) - p.planeY * Math.sin(-p.rotSpeed);
        p.planeY = oldPlaneX * Math.sin(-p.rotSpeed) + p.planeY * Math.cos(-p.rotSpeed);
      }
      if (keys.current['ArrowLeft']) {
        const oldDirX = p.dirX;
        p.dirX = p.dirX * Math.cos(p.rotSpeed) - p.dirY * Math.sin(p.rotSpeed);
        p.dirY = oldDirX * Math.sin(p.rotSpeed) + p.dirY * Math.cos(p.rotSpeed);
        const oldPlaneX = p.planeX;
        p.planeX = p.planeX * Math.cos(p.rotSpeed) - p.planeY * Math.sin(p.rotSpeed);
        p.planeY = oldPlaneX * Math.sin(p.rotSpeed) + p.planeY * Math.cos(p.rotSpeed);
      }

      // Check encounter
      const tileX = Math.floor(p.x);
      const tileY = Math.floor(p.y);
      if (worldMap[tileX]?.[tileY] === 2) {
        worldMap[tileX][tileY] = 0;
        keys.current = {};
        onEncounter();
        return;
      }

      // RENDER
      const w = canvas.width;
      const h = canvas.height;
      const halfH = h / 2;

      // Ceiling
      ctx.fillStyle = '#2a1e12';
      ctx.fillRect(0, 0, w, halfH);

      // Floor
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, halfH, w, halfH);

      // Raycasting
      const zBuffer = new Array(w);

      for (let x = 0; x < w; x++) {
        const cameraX = 2 * x / w - 1;
        const rayDirX = p.dirX + p.planeX * cameraX;
        const rayDirY = p.dirY + p.planeY * cameraX;

        let mapX = Math.floor(p.x);
        let mapY = Math.floor(p.y);

        let sideDistX, sideDistY;
        const deltaDistX = Math.abs(1 / rayDirX);
        const deltaDistY = Math.abs(1 / rayDirY);
        let perpWallDist;
        let stepX, stepY;
        let hit = 0, side;

        if (rayDirX < 0) { stepX = -1; sideDistX = (p.x - mapX) * deltaDistX; } 
        else { stepX = 1; sideDistX = (mapX + 1.0 - p.x) * deltaDistX; }
        if (rayDirY < 0) { stepY = -1; sideDistY = (p.y - mapY) * deltaDistY; } 
        else { stepY = 1; sideDistY = (mapY + 1.0 - p.y) * deltaDistY; }

        while (hit === 0) {
          if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; } 
          else { sideDistY += deltaDistY; mapY += stepY; side = 1; }

          if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
            hit = 1; break;
          }

          const tile = worldMap[mapX][mapY];
          if (tile > 0) hit = tile;
        }

        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else perpWallDist = (sideDistY - deltaDistY);

        zBuffer[x] = perpWallDist;

        const lineHeight = Math.floor(h / perpWallDist);
        const drawStart = Math.max(0, -lineHeight / 2 + halfH);
        const drawEnd = Math.min(h - 1, lineHeight / 2 + halfH);
        const drawH = drawEnd - drawStart;

        // Draw textured wall
        const tex = textures.current[hit] || textures.current[1];
        if (tex) {
          let wallX;
          if (side === 0) wallX = p.y + perpWallDist * rayDirY;
          else wallX = p.x + perpWallDist * rayDirX;
          wallX -= Math.floor(wallX);

          const texW = tex.width || 128;
          let texX = Math.floor(wallX * texW);

          if (side === 0 && rayDirX > 0) texX = texW - texX - 1;
          if (side === 1 && rayDirY < 0) texX = texW - texX - 1;

          ctx.drawImage(tex, texX, 0, 1, tex.height || 128, x, drawStart, 1, drawH);

          // Shading
          const shade = Math.min(0.6, perpWallDist / 12);
          const sideDark = side === 1 ? 0.1 : 0;
          ctx.fillStyle = `rgba(0,0,0,${shade + sideDark})`;
          ctx.fillRect(x, drawStart, 1, drawH);
        }
      }

      // Draw goblin sprite
      if (goblin.current.loaded && sprite.current) {
        const g = goblin.current;
        const sImg = sprite.current;

        const spriteX = g.x - p.x;
        const spriteY = g.y - p.y;

        const invDet = 1.0 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const transformX = invDet * (p.dirY * spriteX - p.dirX * spriteY);
        const transformY = invDet * (-p.planeY * spriteX + p.planeX * spriteY);

        if (transformY > 0.1) {
          const spriteScreenX = Math.floor((w / 2) * (1 + transformX / transformY));
          const spriteH = Math.abs(Math.floor(h / transformY));
          const spriteW = spriteH;

          const drawStartY = Math.max(0, -spriteH / 2 + halfH + spriteH / 4);
          const drawStartX = Math.max(0, spriteScreenX - spriteW / 2);
          const drawEndX = Math.min(w - 1, spriteScreenX + spriteW / 2);

          const sW = sImg.width || 64;

          for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
            const texX = Math.floor((stripe - (spriteScreenX - spriteW / 2)) * sW / spriteW);
            if (transformY < zBuffer[stripe] && texX >= 0 && texX < sW) {
              ctx.drawImage(sImg, texX, 0, 1, sImg.height || 64, stripe, drawStartY, 1, spriteH);
            }
          }
        }
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [imagesLoaded, onEncounter]);

  if (!imagesLoaded) {
    return (
      <div style={{ 
        width: '100%', 
        height: 'calc(100vh - 120px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#1a1208', 
        color: '#ff6600', 
        fontFamily: 'monospace' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>LOADING...</h2>
          <div style={{ marginTop: 20, fontSize: 12, color: '#666' }}>{debug}</div>
        </div>
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      width="640" 
      height="480" 
      style={{ 
        width: '100%', 
        height: 'calc(100vh - 120px)', 
        display: 'block', 
        imageRendering: 'pixelated' 
      }} 
    />
  );
}
