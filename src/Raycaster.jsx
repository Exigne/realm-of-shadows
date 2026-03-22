import React, { useEffect, useRef, useState } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

export default function Raycaster({ onEncounter }) {
  const canvasRef = useRef(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  // Image assets map
  const textures = useRef({});
  const sprite = useRef(null);

  // Define texture sources (make sure filenames in /public match exactly)
  const textureSources = {
    1: '/wall_stone.png',
    3: '/wall_moss.png',
    4: '/wall_door.png',
  };

  const spriteSource = '/goblin_sprite.png';

  // State management for rendering loop
  const player = useRef({
    x: 2.5, y: 2.5, // Start position
    dirX: -1, dirY: 0, // Initial direction vector
    planeX: 0, planeY: 0.66, // Camera plane (FOV)
    moveSpeed: 0.05, rotSpeed: 0.04
  });

  // Example Goblin Sprite location (move trigger '2' to here)
  const goblin = useRef({
    x: 5.5, y: 5.5, // Location in map space
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


2. GAME INPUT & RENDER LOOP
  useEffect(() => {
    if (!imagesLoaded) return; // Wait for assets

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
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
      // We store Z-Buffer for sprite rendering later
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
          const mapTile = worldMap[mapX][mapY];
          // We hit a textured wall type (1, 3, or 4)
          if (mapTile === 1 || mapTile === 3 || mapTile === 4) hit = mapTile;
        }

        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else perpWallDist = (sideDistY - deltaDistY);
        
        // Store distance for sprites
        zBuffer[x] = perpWallDist;

        const lineHeight = Math.floor(canvas.height / perpWallDist);
        const drawStart = -lineHeight / 2 + canvas.height / 2;
        
        // -- TEXTURE CALCULATION --
        const wallImg = textures.current[hit];
        if (wallImg) {
          // Calculate exactly where the wall was hit (wallX)
          let wallX; 
          if (side === 0) wallX = p.y + perpWallDist * rayDirY;
          else wallX = p.x + perpWallDist * rayDirX;
          wallX -= Math.floor(wallX); // Value between 0.0 and 1.0

          // Calculate source x coordinate in the texture image
          const texWidth = wallImg.width;
          let texX = Math.floor(wallX * texWidth);
          
          // Flip texture on certain sides to prevent repeating issues
          if (side === 0 && rayDirX > 0) texX = texWidth - texX - 1;
          if (side === 1 && rayDirY < 0) texX = texWidth - texX - 1;

          // Scale and draw the vertical strip from the texture PNG
          ctx.drawImage(
            wallImg, 
            texX, 0, 1, wallImg.height, // Source: x, y, width, height (one pixel wide slice)
            x, drawStart, 1, lineHeight // Destination: x, y, width, height (scaled)
          );
          
          // Apply basic depth shading (darken vertical walls, and far walls)
          ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, perpWallDist / 8)})`;
          if (side === 1) ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, perpWallDist / 8 + 0.2)})`; // Darker on y-axis
          ctx.fillRect(x, drawStart, 1, lineHeight);

        }
      }

      // --- 5. RENDERING: GOBLIN SPRITE (Billboard) ---
      if (goblin.current.loaded) {
        const g = goblin.current;
        const spriteImg = sprite.current;

        // Translate goblin position to relative camera position
        const spriteX = g.x - p.x;
        const spriteY = g.y - p.y;

        // Required transform matrix division
        const invDet = 1.0 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const transformX = invDet * (p.dirY * spriteX - p.dirX * spriteY);
        const transformY = invDet * (-p.planeY * spriteX + p.planeX * spriteY); // Depth

        // Don't render if behind the camera
        if (transformY > 0.1) {
          const spriteScreenX = Math.floor((canvas.width / 2) * (1 + transformX / transformY));
          
          // Calculate height/width scaling (keep aspect ratio)
          const spriteHeight = Math.abs(Math.floor(canvas.height / transformY));
          const drawStartY = -spriteHeight / 2 + canvas.height / 2;
          const spriteWidth = Math.abs(Math.floor(canvas.height / transformY)); // Keep square aspect
          const drawStartX = Math.floor(spriteScreenX - spriteWidth / 2);

          // Draw sprite pixel column by pixel column
          for (let stripe = drawStartX; stripe < drawStartX + spriteWidth; stripe++) {
            // Calculate source x in sprite PNG
            const texX = Math.floor((stripe - (spriteScreenX - spriteWidth / 2)) * spriteImg.width / spriteWidth);
            
            // Validate: check if in front of walls (zBuffer) and within screen bounds
            if (transformY < zBuffer[stripe] && stripe > 0 && stripe < canvas.width) {
              ctx.drawImage(
                spriteImg,
                texX, 0, 1, spriteImg.height, // Source slice
                stripe, drawStartY, 1, spriteHeight // Destination
              );
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
      <div style={{ width: '640px', height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1208', color: '#ff3300', fontFamily: '"Press Start 2P", monospace' }}>
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
