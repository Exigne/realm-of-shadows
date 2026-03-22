import React, { useEffect, useRef, useState } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

// Define texture sources using direct SVG code (No downloads needed!)
const textureSources = {
  // 1: Grey Cobblestone
  1: "data:image/svg+xml;utf8,<svg width='64' height='64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' fill='%23888'/><path d='M0 32h64M32 0v32M16 32v32M48 32v32M0 16h64M0 48h64' stroke='%23444' stroke-width='2'/></svg>",
  // 3: Mossy Red Brick
  3: "data:image/svg+xml;utf8,<svg width='64' height='64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' fill='%23733'/><path d='M0 16h64M0 32h64M0 48h64M16 0v16M48 0v16M32 16v16M16 32v16M48 32v16M32 48v16' stroke='%23aaa' stroke-width='2'/><circle cx='20' cy='20' r='8' fill='%23363'/><circle cx='50' cy='45' r='10' fill='%23363'/></svg>",
  // 4: Wooden Dungeon Door with Iron Bands
  4: "data:image/svg+xml;utf8,<svg width='64' height='64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' fill='%23531'/><path d='M16 0v64M32 0v64M48 0v64' stroke='%23310' stroke-width='2'/><rect y='10' width='64' height='8' fill='%23222'/><rect y='46' width='64' height='8' fill='%23222'/><circle cx='12' cy='32' r='4' fill='%23da4'/></svg>"
};

// 2D Goblin Sprite with glowing red eyes
const spriteSource = "data:image/svg+xml;utf8,<svg width='64' height='64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' fill='transparent'/><path d='M16 48l16-32 16 32z' fill='%23383'/><circle cx='26' cy='36' r='3' fill='%23f00'/><circle cx='38' cy='36' r='3' fill='%23f00'/><path d='M28 44h8' stroke='%23000' stroke-width='2'/></svg>";

export default function Raycaster({ onEncounter }) {
  const canvasRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  // Image assets map
  const textures = useRef({});
  const sprite = useRef(null);

  // State management for rendering loop
  const player = useRef({
    x: 2.5, y: 2.5, // Start position
    dirX: -1, dirY: 0, // Initial direction vector
    planeX: 0, planeY: 0.66, // Camera plane (FOV)
    moveSpeed: 0.05, rotSpeed: 0.04
  });

  // Goblin Sprite location in map space
  const goblin = useRef({
    x: 5.5, y: 5.5, 
    loaded: false
  });

  const keys = useRef({});

  // 1. ASSET PRE-LOADING
  useEffect(() => {
    const loadImages = async () => {
      const texturePromises = Object.entries(textureSources).map(([id, src]) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            textures.current[id] = img;
            resolve();
          };
        });
      });

      const spritePromise = new Promise((resolve) => {
        const img = new Image();
        img.src = spriteSource;
        img.onload = () => {
          sprite.current = img;
          goblin.current.loaded = true;
          resolve();
        };
      });

      await Promise.all([...texturePromises, spritePromise]);
      setImagesLoaded(true);
    };

    loadImages();
  }, []);

  // 2. GAME INPUT & RENDER LOOP
  useEffect(() => {
    if (!imagesLoaded) return; // Wait for assets

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // Disable image smoothing for that crunchy retro pixel look
    ctx.imageSmoothingEnabled = false; 
    
    let animationFrameId;

    // Keyboard Listeners
    const handleKeyDown = (e) => { keys.current[e.key] = true; };
    const handleKeyUp = (e) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = () => {
      const p = player.current;

      // --- MOVEMENT LOGIC (Forward/Back + Strafing + Rotation) ---
      if (keys.current['w'] || keys.current['ArrowUp']) {
        if (worldMap[Math.floor(p.x + p.dirX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x += p.dirX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y + p.dirY * p.moveSpeed)] === 0) p.y += p.dirY * p.moveSpeed;
      }
      if (keys.current['s'] || keys.current['ArrowDown']) {
        if (worldMap[Math.floor(p.x - p.dirX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x -= p.dirX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y - p.dirY * p.moveSpeed)] === 0) p.y -= p.dirY * p.moveSpeed;
      }
      if (keys.current['d']) { // Strafe Right
        if (worldMap[Math.floor(p.x + p.planeX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x += p.planeX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y + p.planeY * p.moveSpeed)] === 0) p.y += p.planeY * p.moveSpeed;
      }
      if (keys.current['a']) { // Strafe Left
        if (worldMap[Math.floor(p.x - p.planeX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x -= p.planeX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y - p.planeY * p.moveSpeed)] === 0) p.y -= p.planeY * p.moveSpeed;
      }
      if (keys.current['ArrowRight']) { // Rotate Right
        const oldDirX = p.dirX; p.dirX = p.dirX * Math.cos(-p.rotSpeed) - p.dirY * Math.sin(-p.rotSpeed); p.dirY = oldDirX * Math.sin(-p.rotSpeed) + p.dirY * Math.cos(-p.rotSpeed);
        const oldPlaneX = p.planeX; p.planeX = p.planeX * Math.cos(-p.rotSpeed) - p.planeY * Math.sin(-p.rotSpeed); p.planeY = oldPlaneX * Math.sin(-p.rotSpeed) + p.planeY * Math.cos(-p.rotSpeed);
      }
      if (keys.current['ArrowLeft']) { // Rotate Left
        const oldDirX = p.dirX; p.dirX = p.dirX * Math.cos(p.rotSpeed) - p.dirY * Math.sin(p.rotSpeed); p.dirY = oldDirX * Math.sin(p.rotSpeed) + p.dirY * Math.cos(p.rotSpeed);
        const oldPlaneX = p.planeX; p.planeX = p.planeX * Math.cos(p.rotSpeed) - p.planeY * Math.sin(p.rotSpeed); p.planeY = oldPlaneX * Math.sin(p.rotSpeed) + p.planeY * Math.cos(p.rotSpeed);
      }

      // --- ENCOUNTER TRIGGER ---
      if (worldMap[Math.floor(p.x)][Math.floor(p.y)] === 2) {
        worldMap[Math.floor(p.x)][Math.floor(p.y)] = 0; // Clear map tile
        keys.current = {}; // Stop movement
        onEncounter();
        return; // Pause render loop
      }

      // --- 3. RENDERING: FLOOR & CEILING ---
      ctx.fillStyle = '#2a1e12'; // Ceiling color
      ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
      ctx.fillStyle = '#1a1208'; // Floor color
      ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

      // --- 4. RENDERING: WALL RAYCASTING (Textured) ---
      const zBuffer = new Array(canvas.width);

      for (let x = 0; x < canvas.width; x++) {
        const cameraX = 2 * x / canvas.width - 1;
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
          
          // Safety bounds check
          if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
             hit = 1; // Treat out of bounds as a normal wall
             break;
          }
          
          const mapTile = worldMap[mapX][mapY];
          if (mapTile === 1 || mapTile === 3 || mapTile === 4) hit = mapTile;
        }

        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else perpWallDist = (sideDistY - deltaDistY);
        
        // Store distance for sprites
        zBuffer[x] = perpWallDist;

        const lineHeight = Math.floor(canvas.height / perpWallDist);
        const drawStart = Math.max(0, -lineHeight / 2 + canvas.height / 2);
        const drawEnd = Math.min(canvas.height - 1, lineHeight / 2 + canvas.height / 2);
        const actualDrawHeight = drawEnd - drawStart;
        
        // -- TEXTURE CALCULATION --
        const wallImg = textures.current[hit] || textures.current[1]; // Fallback to 1 if missing
        
        if (wallImg && actualDrawHeight > 0) {
          let wallX; 
          if (side === 0) wallX = p.y + perpWallDist * rayDirY;
          else wallX = p.x + perpWallDist * rayDirX;
          wallX -= Math.floor(wallX);

          const texWidth = wallImg.width || 64;
          let texX = Math.floor(wallX * texWidth);
          
          if (side === 0 && rayDirX > 0) texX = texWidth - texX - 1;
          if (side === 1 && rayDirY < 0) texX = texWidth - texX - 1;

          ctx.drawImage(
            wallImg, 
            texX, 0, 1, wallImg.height || 64, 
            x, drawStart, 1, actualDrawHeight 
          );
          
          // Apply basic depth shading
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, perpWallDist / 8)})`;
          if (side === 1) ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, perpWallDist / 8 + 0.2)})`;
          ctx.fillRect(x, drawStart, 1, actualDrawHeight);
        }
      }

      // --- 5. RENDERING: GOBLIN SPRITE (Billboard) ---
      if (goblin.current.loaded) {
        const g = goblin.current;
        const spriteImg = sprite.current;

        const spriteX = g.x - p.x;
        const spriteY = g.y - p.y;

        const invDet = 1.0 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const transformX = invDet * (p.dirY * spriteX - p.dirX * spriteY);
        const transformY = invDet * (-p.planeY * spriteX + p.planeX * spriteY);

        if (transformY > 0.1) {
          const spriteScreenX = Math.floor((canvas.width / 2) * (1 + transformX / transformY));
          const spriteHeight = Math.abs(Math.floor(canvas.height / transformY));
          
          // Using a slight offset to ground the sprite
          const drawStartY = Math.max(0, -spriteHeight / 2 + canvas.height / 2 + (spriteHeight / 4));
          const drawEndY = Math.min(canvas.height - 1, spriteHeight / 2 + canvas.height / 2 + (spriteHeight / 4));
          const actualSpriteHeight = drawEndY - drawStartY;
          
          const spriteWidth = Math.abs(Math.floor(canvas.height / transformY)); 
          const drawStartX = Math.floor(spriteScreenX - spriteWidth / 2);

          if (actualSpriteHeight > 0) {
              for (let stripe = drawStartX; stripe < drawStartX + spriteWidth; stripe++) {
                const texX = Math.floor((stripe - (spriteScreenX - spriteWidth / 2)) * (spriteImg.width || 64) / spriteWidth);
                
                if (transformY < zBuffer[stripe] && stripe > 0 && stripe < canvas.width) {
                  ctx.drawImage(
                    spriteImg,
                    texX, 0, 1, spriteImg.height || 64, 
                    stripe, drawStartY, 1, actualSpriteHeight 
                  );
                }
              }
          }
        }
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    // 6. CLEANUP
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [imagesLoaded, onEncounter]);

  // Loading Screen
  if (!imagesLoaded) {
    return (
      <div style={{ width: '100%', height: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1208', color: '#ff3300', fontFamily: '"Press Start 2P", monospace' }}>
        <h2>LOADING ASSETS...</h2>
      </div>
    );
  }

  return (
    <canvas 
      ref={canvasRef} 
      width="640" 
      height="480" 
      style={{ width: '100%', height: 'calc(100vh - 120px)', display: 'block', imageRendering: 'pixelated' }} 
    />
  );
}
