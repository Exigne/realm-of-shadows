import React, { useEffect, useRef } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

export default function Raycaster({ onEncounter }) {
  const canvasRef = useRef(null);
  
  const player = useRef({
    x: 2.5, y: 2.5, 
    dirX: -1, dirY: 0, 
    planeX: 0, planeY: 0.66, 
    moveSpeed: 0.06, rotSpeed: 0.05
  });

  const keys = useRef({});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const handleKeyDown = (e) => { keys.current[e.key] = true; };
    const handleKeyUp = (e) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = () => {
      const p = player.current;

      // --- MOVEMENT: FORWARD/BACK (W, S, Up, Down) ---
      if (keys.current['w'] || keys.current['ArrowUp']) {
        if (worldMap[Math.floor(p.x + p.dirX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x += p.dirX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y + p.dirY * p.moveSpeed)] === 0) p.y += p.dirY * p.moveSpeed;
      }
      if (keys.current['s'] || keys.current['ArrowDown']) {
        if (worldMap[Math.floor(p.x - p.dirX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x -= p.dirX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y - p.dirY * p.moveSpeed)] === 0) p.y -= p.dirY * p.moveSpeed;
      }

      // --- MOVEMENT: STRAFE LEFT/RIGHT (A, D) ---
      // Uses the camera plane vector (planeX/planeY) which is perpendicular to direction
      if (keys.current['d']) {
        if (worldMap[Math.floor(p.x + p.planeX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x += p.planeX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y + p.planeY * p.moveSpeed)] === 0) p.y += p.planeY * p.moveSpeed;
      }
      if (keys.current['a']) {
        if (worldMap[Math.floor(p.x - p.planeX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x -= p.planeX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y - p.planeY * p.moveSpeed)] === 0) p.y -= p.planeY * p.moveSpeed;
      }

      // --- ROTATION: TURN LEFT/RIGHT (Left/Right Arrows) ---
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

      // --- ENCOUNTER TRIGGER ---
      if (worldMap[Math.floor(p.x)][Math.floor(p.y)] === 2) {
        worldMap[Math.floor(p.x)][Math.floor(p.y)] = 0; 
        keys.current = {}; 
        onEncounter();
        return; 
      }

      // --- RENDERING: FLOOR & CEILING WITH DEPTH ---
      const gradientCeil = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
      gradientCeil.addColorStop(0, '#111');
      gradientCeil.addColorStop(1, '#333');
      ctx.fillStyle = gradientCeil;
      ctx.fillRect(0, 0, canvas.width, canvas.height / 2);

      const gradientFloor = ctx.createLinearGradient(0, canvas.height / 2, 0, canvas.height);
      gradientFloor.addColorStop(0, '#222');
      gradientFloor.addColorStop(1, '#000');
      ctx.fillStyle = gradientFloor;
      ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

      // --- RENDERING: RAYCASTING & WALLS ---
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
          if (worldMap[mapX][mapY] > 0 && worldMap[mapX][mapY] !== 2) hit = 1;
        }

        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else perpWallDist = (sideDistY - deltaDistY);

        const lineHeight = Math.floor(canvas.height / perpWallDist);
        const drawStart = Math.max(0, -lineHeight / 2 + canvas.height / 2);
        const drawEnd = Math.min(canvas.height - 1, lineHeight / 2 + canvas.height / 2);
        
        // -- DYNAMIC WALL COLORS & FAUX TEXTURES --
        const wallType = worldMap[mapX][mapY];
        
        // Calculate exact where the wall was hit (for drawing lines/borders)
        let wallX;
        if (side === 0) wallX = p.y + perpWallDist * rayDirY;
        else wallX = p.x + perpWallDist * rayDirX;
        wallX -= Math.floor(wallX); // Gives a value between 0.0 and 1.0

        // Determine base color based on map number
        let r, g, b;
        if (wallType === 1) { r = 120; g = 120; b = 130; } // Grey Stone
        else if (wallType === 3) { r = 60; g = 80; b = 140; }  // Blue Dungeon
        else if (wallType === 4) { r = 140; g = 60; b = 60; }  // Red Brick
        else { r = 100; g = 100; b = 100; } // Fallback

        // Darken walls on the Y axis for fake lighting depth
        if (side === 1) { r /= 1.5; g /= 1.5; b /= 1.5; }

        // Distance shading (fade to black the further away it is)
        const shadow = Math.max(0.2, 1 - (perpWallDist / 12)); 
        r *= shadow; g *= shadow; b *= shadow;

        // Draw panel borders: if the hit is very close to the edge of a block, draw it dark
        if (wallX < 0.05 || wallX > 0.95 || drawStart > (canvas.height/2 - 5)) {
           r *= 0.5; g *= 0.5; b *= 0.5; // Darken the borders heavily
        }

        // Draw the vertical strip
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [onEncounter]);

  return (
    <canvas 
      ref={canvasRef} 
      width="640" 
      height="480" 
      style={{ width: '100%', height: 'calc(100vh - 120px)', display: 'block', imageRendering: 'pixelated' }} 
    />
  );
}
