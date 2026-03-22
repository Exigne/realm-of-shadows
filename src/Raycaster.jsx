import React, { useEffect, useRef, useState, useCallback } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

// Enhanced texture sources with higher detail and better visual design
const textureSources = {
  // 1: Grey Cobblestone - improved with noise and depth
  1: `data:image/svg+xml;utf8,<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.3" intercept="0.35"/>
          <feFuncG type="linear" slope="0.3" intercept="0.35"/>
          <feFuncB type="linear" slope="0.3" intercept="0.35"/>
        </feComponentTransfer>
      </filter>
      <pattern id="stones" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
        <rect width="32" height="32" fill="%23666"/>
        <rect x="2" y="2" width="28" height="28" fill="%23888" rx="2"/>
        <path d="M2 16h28M16 2v28" stroke="%23555" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="128" height="128" fill="url(%23stones)"/>
    <rect width="128" height="128" filter="url(%23noise)" opacity="0.4"/>
    <rect x="0" y="0" width="128" height="4" fill="%23444"/>
    <rect x="0" y="124" width="128" height="4" fill="%23444"/>
  </svg>`,

  // 2: Encounter/Event tile - glowing magical floor
  2: `data:image/svg+xml;utf8,<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="%23ff6600"/>
        <stop offset="50%" stop-color="%23cc3300"/>
        <stop offset="100%" stop-color="%23331100"/>
      </radialGradient>
      <filter id="blur">
        <feGaussianBlur stdDeviation="2"/>
      </filter>
    </defs>
    <rect width="128" height="128" fill="%23222"/>
    <circle cx="64" cy="64" r="50" fill="url(%23glow)" opacity="0.8"/>
    <circle cx="64" cy="64" r="40" fill="none" stroke="%23ffaa00" stroke-width="2" filter="url(%23blur)"/>
    <path d="M64 24v80M24 64h80" stroke="%23ff4400" stroke-width="4" opacity="0.6"/>
    <circle cx="64" cy="64" r="15" fill="%23ffff00" opacity="0.9"/>
  </svg>`,

  // 3: Mossy Red Brick - enhanced with moss details
  3: `data:image/svg+xml;utf8,<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="bricks" x="0" y="0" width="64" height="32" patternUnits="userSpaceOnUse">
        <rect width="64" height="32" fill="%23552a2a"/>
        <rect x="2" y="2" width="28" height="28" fill="%23774444" rx="1"/>
        <rect x="34" y="2" width="28" height="28" fill="%23663333" rx="1"/>
      </pattern>
      <filter id="moss">
        <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" result="turbulence"/>
        <feDisplacementMap in2="turbulence" in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>
    <rect width="128" height="128" fill="url(%23bricks)"/>
    <ellipse cx="20" cy="30" rx="15" ry="10" fill="%232d5016" opacity="0.7" filter="url(%23moss)"/>
    <ellipse cx="90" cy="80" rx="20" ry="15" fill="%233d6020" opacity="0.6" filter="url(%23moss)"/>
    <ellipse cx="60" cy="110" rx="12" ry="8" fill="%23204010" opacity="0.8"/>
    <path d="M10 10 Q30 5 50 15" stroke="%231a330a" stroke-width="3" fill="none" opacity="0.5"/>
  </svg>`,

  // 4: Wooden Dungeon Door - enhanced with iron details and wood grain
  4: `data:image/svg+xml;utf8,<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wood" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="%233d2817"/>
        <stop offset="20%" stop-color="%23523726"/>
        <stop offset="40%" stop-color="%233d2817"/>
        <stop offset="60%" stop-color="%234a2f1a"/>
        <stop offset="80%" stop-color="%23523726"/>
        <stop offset="100%" stop-color="%233d2817"/>
      </linearGradient>
      <linearGradient id="iron" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="%23333"/>
        <stop offset="50%" stop-color="%23666"/>
        <stop offset="100%" stop-color="%23222"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" fill="url(%23wood)"/>
    <!-- Wood grain lines -->
    <path d="M0 20h128M0 40h128M0 60h128M0 80h128M0 100h128" stroke="%232a1a0f" stroke-width="1" opacity="0.5"/>
    <!-- Vertical planks -->
    <line x1="32" y1="0" x2="32" y2="128" stroke="%232a1a0f" stroke-width="2"/>
    <line x1="64" y1="0" x2="64" y2="128" stroke="%232a1a0f" stroke-width="2"/>
    <line x1="96" y1="0" x2="96" y2="128" stroke="%232a1a0f" stroke-width="2"/>
    <!-- Iron bands -->
    <rect x="0" y="15" width="128" height="12" fill="url(%23iron)"/>
    <rect x="0" y="101" width="128" height="12" fill="url(%23iron)"/>
    <!-- Rivets -->
    <circle cx="10" cy="21" r="3" fill="%23444"/>
    <circle cx="40" cy="21" r="3" fill="%23444"/>
    <circle cx="70" cy="21" r="3" fill="%23444"/>
    <circle cx="100" cy="21" r="3" fill="%23444"/>
    <circle cx="10" cy="107" r="3" fill="%23444"/>
    <circle cx="40" cy="107" r="3" fill="%23444"/>
    <circle cx="70" cy="107" r="3" fill="%23444"/>
    <circle cx="100" cy="107" r="3" fill="%23444"/>
    <!-- Handle -->
    <circle cx="20" cy="64" r="8" fill="%23555"/>
    <circle cx="20" cy="64" r="5" fill="%23777"/>
    <rect x="18" y="64" width="4" height="15" fill="%23444"/>
  </svg>`,

  // 5: Stone Wall with cracks - new variation
  5: `data:image/svg+xml;utf8,<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="bigstones" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
        <rect width="64" height="64" fill="%23555"/>
        <rect x="4" y="4" width="56" height="56" fill="%23777" rx="3"/>
        <path d="M4 32h56M32 4v56" stroke="%23444" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="128" height="128" fill="url(%23bigstones)"/>
    <!-- Cracks -->
    <path d="M20 20 L25 40 L20 60" stroke="%23222" stroke-width="2" fill="none"/>
    <path d="M80 80 L85 100 L80 120" stroke="%23333" stroke-width="1.5" fill="none"/>
    <path d="M100 30 L95 50 L105 70" stroke="%23222" stroke-width="2" fill="none"/>
  </svg>`
};

// Enhanced Goblin Sprite with animation frames concept
const spriteSources = {
  idle: `data:image/svg+xml;utf8,<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <!-- Shadow -->
    <ellipse cx="32" cy="58" rx="20" ry="4" fill="%23000" opacity="0.3"/>
    <!-- Body -->
    <path d="M16 48 L24 20 L32 12 L40 20 L48 48 Z" fill="%232d5a27"/>
    <!-- Arms -->
    <path d="M24 28 L12 38" stroke="%232d5a27" stroke-width="6" stroke-linecap="round"/>
    <path d="M40 28 L52 38" stroke="%232d5a27" stroke-width="6" stroke-linecap="round"/>
    <!-- Head -->
    <circle cx="32" cy="18" r="10" fill="%233d7a37"/>
    <!-- Ears -->
    <path d="M24 14 L18 6 L26 12" fill="%232d5a27"/>
    <path d="M40 14 L46 6 L38 12" fill="%232d5a27"/>
    <!-- Eyes - glowing red -->
    <circle cx="28" cy="16" r="3" fill="%23ff0000" filter="url(%23glow)"/>
    <circle cx="36" cy="16" r="3" fill="%23ff0000" filter="url(%23glow)"/>
    <!-- Pupils -->
    <circle cx="28" cy="16" r="1" fill="%23ffff00"/>
    <circle cx="36" cy="16" r="1" fill="%23ffff00"/>
    <!-- Mouth -->
    <path d="M28 22 Q32 24 36 22" stroke="%23000" stroke-width="1.5" fill="none"/>
    <!-- Teeth -->
    <path d="M30 22 L31 24 L32 22" fill="%23ffffaa"/>
    <path d="M34 22 L33 24 L32 22" fill="%23ffffaa"/>
  </svg>`
};

// Floor and ceiling texture
const floorCeilingSource = `data:image/svg+xml;utf8,<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="floor" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
      <rect width="32" height="32" fill="%232a1e12"/>
      <rect x="0" y="0" width="16" height="16" fill="%23332a1a"/>
      <rect x="16" y="16" width="16" height="16" fill="%23332a1a"/>
      <path d="M0 16h32M16 0v32" stroke="%231a1208" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="128" height="128" fill="url(%23floor)"/>
</svg>`;

export default function Raycaster({ onEncounter }) {
  const canvasRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [fps, setFps] = useState(0);

  // Image assets map
  const textures = useRef({});
  const sprite = useRef(null);
  const floorTexture = useRef(null);

  // State management for rendering loop
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
  const fpsCounter = useRef({ frames: 0, lastTime: performance.now() });

  // Asset pre-loading with progress tracking
  useEffect(() => {
    const loadImages = async () => {
      const loadTexture = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = reject;
      });

      try {
        // Load wall textures
        const textureEntries = Object.entries(textureSources);
        for (const [id, src] of textureEntries) {
          textures.current[id] = await loadTexture(src);
        }

        // Load sprite
        sprite.current = await loadTexture(spriteSources.idle);
        goblin.current.loaded = true;

        // Load floor texture
        floorTexture.current = await loadTexture(floorCeilingSource);

        setImagesLoaded(true);
      } catch (error) {
        console.error('Failed to load assets:', error);
      }
    };

    loadImages();
  }, []);

  // Game loop with enhanced rendering
  useEffect(() => {
    if (!imagesLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Disable smoothing for pixel art look
    ctx.imageSmoothingEnabled = false;

    let animationFrameId;
    let lastTime = performance.now();

    const handleKeyDown = (e) => { 
      keys.current[e.key] = true; 
      // Prevent default for game keys to stop scrolling
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => { keys.current[e.key] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 16.67; // Normalize to ~60fps
      lastTime = currentTime;

      // FPS counter
      fpsCounter.current.frames++;
      if (currentTime - fpsCounter.current.lastTime >= 1000) {
        setFps(fpsCounter.current.frames);
        fpsCounter.current.frames = 0;
        fpsCounter.current.lastTime = currentTime;
      }

      const p = player.current;
      const moveSpeed = p.moveSpeed * deltaTime;
      const rotSpeed = p.rotSpeed * deltaTime;

      // Movement with collision detection
      const tryMove = (newX, newY) => {
        const buffer = 0.2;
        const mapX = Math.floor(newX);
        const mapY = Math.floor(newY);

        // Check collision with buffer
        if (worldMap[mapX] && worldMap[mapX][mapY] !== 0 && worldMap[mapX][mapY] !== 2) {
          return false;
        }
        return true;
      };

      if (keys.current['w'] || keys.current['ArrowUp']) {
        const newX = p.x + p.dirX * moveSpeed;
        const newY = p.y + p.dirY * moveSpeed;
        if (tryMove(newX, p.y)) p.x = newX;
        if (tryMove(p.x, newY)) p.y = newY;
      }
      if (keys.current['s'] || keys.current['ArrowDown']) {
        const newX = p.x - p.dirX * moveSpeed;
        const newY = p.y - p.dirY * moveSpeed;
        if (tryMove(newX, p.y)) p.x = newX;
        if (tryMove(p.x, newY)) p.y = newY;
      }
      if (keys.current['d']) {
        const newX = p.x + p.planeX * moveSpeed;
        const newY = p.y + p.planeY * moveSpeed;
        if (tryMove(newX, p.y)) p.x = newX;
        if (tryMove(p.x, newY)) p.y = newY;
      }
      if (keys.current['a']) {
        const newX = p.x - p.planeX * moveSpeed;
        const newY = p.y - p.planeY * moveSpeed;
        if (tryMove(newX, p.y)) p.x = newX;
        if (tryMove(p.x, newY)) p.y = newY;
      }
      if (keys.current['ArrowRight']) {
        const oldDirX = p.dirX;
        p.dirX = p.dirX * Math.cos(-rotSpeed) - p.dirY * Math.sin(-rotSpeed);
        p.dirY = oldDirX * Math.sin(-rotSpeed) + p.dirY * Math.cos(-rotSpeed);
        const oldPlaneX = p.planeX;
        p.planeX = p.planeX * Math.cos(-rotSpeed) - p.planeY * Math.sin(-rotSpeed);
        p.planeY = oldPlaneX * Math.sin(-rotSpeed) + p.planeY * Math.cos(-rotSpeed);
      }
      if (keys.current['ArrowLeft']) {
        const oldDirX = p.dirX;
        p.dirX = p.dirX * Math.cos(rotSpeed) - p.dirY * Math.sin(rotSpeed);
        p.dirY = oldDirX * Math.sin(rotSpeed) + p.dirY * Math.cos(rotSpeed);
        const oldPlaneX = p.planeX;
        p.planeX = p.planeX * Math.cos(rotSpeed) - p.planeY * Math.sin(rotSpeed);
        p.planeY = oldPlaneX * Math.sin(rotSpeed) + p.planeY * Math.cos(rotSpeed);
      }

      // Encounter trigger
      const playerTileX = Math.floor(p.x);
      const playerTileY = Math.floor(p.y);
      if (worldMap[playerTileX] && worldMap[playerTileX][playerTileY] === 2) {
        worldMap[playerTileX][playerTileY] = 0;
        keys.current = {};
        onEncounter();
        return;
      }

      const screenWidth = canvas.width;
      const screenHeight = canvas.height;
      const halfHeight = screenHeight / 2;

      // Clear screen
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, 0, screenWidth, screenHeight);

      // Draw textured floor and ceiling
      if (floorTexture.current) {
        // Simple floor casting for better performance
        for (let y = halfHeight; y < screenHeight; y++) {
          const rowDistance = screenHeight / (2 * y - screenHeight);
          const floorStepX = rowDistance * (p.dirX + p.planeX - (p.dirX - p.planeX)) / screenWidth;
          const floorStepY = rowDistance * (p.dirY + p.planeY - (p.dirY - p.planeY)) / screenWidth;

          let floorX = p.x + rowDistance * (p.dirX - p.planeX);
          let floorY = p.y + rowDistance * (p.dirY - p.planeY);

          // Draw floor strip
          const floorImg = floorTexture.current;
          const texWidth = floorImg.width || 128;
          const texHeight = floorImg.height || 128;

          const cellX = Math.floor(floorX);
          const cellY = Math.floor(floorY);

          const tx = Math.floor(texWidth * (floorX - cellX)) & (texWidth - 1);
          const ty = Math.floor(texHeight * (floorY - cellY)) & (texHeight - 1);

          // Draw floor
          ctx.drawImage(floorImg, tx, ty, 1, 1, 0, y, screenWidth, 1);

          // Ceiling (darker version)
          const ceilingY = screenHeight - y - 1;
          ctx.fillStyle = `rgba(26, 18, 8, ${0.3 + (y - halfHeight) / screenHeight})`;
          ctx.fillRect(0, ceilingY, screenWidth, 1);
        }
      } else {
        // Fallback solid colors
        ctx.fillStyle = '#2a1e12';
        ctx.fillRect(0, 0, screenWidth, halfHeight);
        ctx.fillStyle = '#1a1208';
        ctx.fillRect(0, halfHeight, screenWidth, halfHeight);
      }

      // Wall raycasting
      const zBuffer = new Array(screenWidth);

      for (let x = 0; x < screenWidth; x++) {
        const cameraX = 2 * x / screenWidth - 1;
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

        if (rayDirX < 0) { 
          stepX = -1; 
          sideDistX = (p.x - mapX) * deltaDistX; 
        } else { 
          stepX = 1; 
          sideDistX = (mapX + 1.0 - p.x) * deltaDistX; 
        }

        if (rayDirY < 0) { 
          stepY = -1; 
          sideDistY = (p.y - mapY) * deltaDistY; 
        } else { 
          stepY = 1; 
          sideDistY = (mapY + 1.0 - p.y) * deltaDistY; 
        }

        // DDA
        let depth = 0;
        while (hit === 0 && depth < 100) {
          if (sideDistX < sideDistY) { 
            sideDistX += deltaDistX; 
            mapX += stepX; 
            side = 0; 
          } else { 
            sideDistY += deltaDistY; 
            mapY += stepY; 
            side = 1; 
          }

          if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
            hit = 1;
            break;
          }

          const mapTile = worldMap[mapX][mapY];
          if (mapTile > 0) hit = mapTile;
          depth++;
        }

        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else perpWallDist = (sideDistY - deltaDistY);

        zBuffer[x] = perpWallDist;

        const lineHeight = Math.floor(screenHeight / perpWallDist);
        const drawStart = Math.max(0, -lineHeight / 2 + halfHeight);
        const drawEnd = Math.min(screenHeight - 1, lineHeight / 2 + halfHeight);
        const actualHeight = drawEnd - drawStart;

        // Texture mapping
        const wallImg = textures.current[hit] || textures.current[1];

        if (wallImg && actualHeight > 0) {
          let wallX;
          if (side === 0) wallX = p.y + perpWallDist * rayDirY;
          else wallX = p.x + perpWallDist * rayDirX;
          wallX -= Math.floor(wallX);

          const texWidth = wallImg.width || 128;
          const texHeight = wallImg.height || 128;

          let texX = Math.floor(wallX * texWidth);

          if (side === 0 && rayDirX > 0) texX = texWidth - texX - 1;
          if (side === 1 && rayDirY < 0) texX = texWidth - texX - 1;

          ctx.drawImage(
            wallImg,
            texX, 0, 1, texHeight,
            x, drawStart, 1, actualHeight
          );

          // Enhanced depth shading
          const distance = Math.min(perpWallDist, 20);
          const shadeIntensity = Math.min(0.7, distance / 15);
          const sideShade = side === 1 ? 0.15 : 0;

          ctx.fillStyle = `rgba(0, 0, 0, ${shadeIntensity + sideShade})`;
          ctx.fillRect(x, drawStart, 1, actualHeight);
        }
      }

      // Sprite rendering (Goblin)
      if (goblin.current.loaded && sprite.current) {
        const g = goblin.current;
        const spriteImg = sprite.current;

        const spriteX = g.x - p.x;
        const spriteY = g.y - p.y;

        const invDet = 1.0 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const transformX = invDet * (p.dirY * spriteX - p.dirX * spriteY);
        const transformY = invDet * (-p.planeY * spriteX + p.planeX * spriteY);

        if (transformY > 0.1) {
          const spriteScreenX = Math.floor((screenWidth / 2) * (1 + transformX / transformY));
          const spriteHeight = Math.abs(Math.floor(screenHeight / transformY));
          const spriteWidth = spriteHeight;

          const drawStartY = Math.max(0, -spriteHeight / 2 + halfHeight + spriteHeight / 4);
          const drawEndY = Math.min(screenHeight - 1, spriteHeight / 2 + halfHeight + spriteHeight / 4);

          const drawStartX = Math.max(0, spriteScreenX - spriteWidth / 2);
          const drawEndX = Math.min(screenWidth - 1, spriteScreenX + spriteWidth / 2);

          const texWidth = spriteImg.width || 64;
          const texHeight = spriteImg.height || 64;

          for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
            const texX = Math.floor((stripe - (spriteScreenX - spriteWidth / 2)) * texWidth / spriteWidth);

            if (transformY < zBuffer[stripe]) {
              ctx.drawImage(
                spriteImg,
                texX, 0, 1, texHeight,
                stripe, drawStartY, 1, drawEndY - drawStartY
              );
            }
          }
        }
      }

      // Draw FPS counter
      ctx.fillStyle = '#0f0';
      ctx.font = '12px monospace';
      ctx.fillText(`FPS: ${fps}`, 10, 20);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [imagesLoaded, onEncounter, fps]);

  if (!imagesLoaded) {
    return (
      <div style={{ 
        width: '100%', 
        height: 'calc(100vh - 120px)', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#1a1208', 
        color: '#ff6600', 
        fontFamily: '"Press Start 2P", monospace' 
      }}>
        <h2>LOADING DUNGEON...</h2>
        <div style={{
          width: '200px',
          height: '20px',
          border: '2px solid #ff6600',
          marginTop: '20px',
          position: 'relative'
        }}>
          <div style={{
            width: '60%',
            height: '100%',
            backgroundColor: '#ff6600',
            animation: 'pulse 1s infinite'
          }}/>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <canvas 
        ref={canvasRef} 
        width="800" 
        height="600" 
        style={{ 
          width: '100%', 
          height: 'calc(100vh - 120px)', 
          display: 'block', 
          imageRendering: 'pixelated',
          cursor: 'crosshair'
        }} 
      />
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        color: '#888',
        fontFamily: 'monospace',
        fontSize: '12px',
        pointerEvents: 'none'
      }}>
        WASD/Arrows: Move | Mouse: Look (coming soon)
      </div>
    </div>
  );
}
