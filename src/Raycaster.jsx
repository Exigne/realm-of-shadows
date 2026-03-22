import React, { useEffect, useRef } from 'react';
import { worldMap, mapWidth, mapHeight } from './gameMap';

export default function Raycaster({ onEncounter }) {
  const canvasRef = useRef(null);
  
  // Player State
  const player = useRef({
    x: 2.5, y: 2.5, // Start position
    dirX: -1, dirY: 0, // Initial direction vector
    planeX: 0, planeY: 0.66, // Camera plane (FOV)
    moveSpeed: 0.05, rotSpeed: 0.04
  });

  const keys = useRef({});

  useEffect(() => {
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

      // --- MOVEMENT LOGIC ---
      if (keys.current['w'] || keys.current['ArrowUp']) {
        if (worldMap[Math.floor(p.x + p.dirX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x += p.dirX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y + p.dirY * p.moveSpeed)] === 0) p.y += p.dirY * p.moveSpeed;
      }
      if (keys.current['s'] || keys.current['ArrowDown']) {
        if (worldMap[Math.floor(p.x - p.dirX * p.moveSpeed)][Math.floor(p.y)] === 0) p.x -= p.dirX * p.moveSpeed;
        if (worldMap[Math.floor(p.x)][Math.floor(p.y - p.dirY * p.moveSpeed)] === 0) p.y -= p.dirY * p.moveSpeed;
      }
      // Rotation
      if (keys.current['d'] || keys.current['ArrowRight']) {
        const oldDirX = p.dirX;
        p.dirX = p.dirX * Math.cos(-p.rotSpeed) - p.dirY * Math.sin(-p.rotSpeed);
        p.dirY = oldDirX * Math.sin(-p.rotSpeed) + p.dirY * Math.cos(-p.rotSpeed);
        const oldPlaneX = p.planeX;
        p.planeX = p.planeX * Math.cos(-p.rotSpeed) - p.planeY * Math.sin(-p.rotSpeed);
        p.planeY = oldPlaneX * Math.sin(-p.rotSpeed) + p.planeY * Math.cos(-p.rotSpeed);
      }
      if (keys.current['a'] || keys.current['ArrowLeft']) {
        const oldDirX = p.dirX;
        p.dirX = p.dirX * Math.cos(p.rotSpeed) - p.dirY * Math.sin(p.rotSpeed);
        p.dirY = oldDirX * Math.sin(p.rotSpeed) + p.dirY * Math.cos(p.rotSpeed);
        const oldPlaneX = p.planeX;
        p.planeX = p.planeX * Math.cos(p.rotSpeed) - p.planeY * Math.sin(p.rotSpeed);
        p.planeY = oldPlaneX * Math.sin(p.rotSpeed) + p.planeY * Math.cos(p.rotSpeed);
      }

      // --- ENCOUNTER TRIGGER ---
      // If player steps on a '2', clear the tile and trigger battle
      if (worldMap[Math.floor(p.x)][Math.floor(p.y)] === 2) {
        worldMap[Math.floor(p.x)][Math.floor(p.y)] = 0; // Remove enemy from map
        keys.current = {}; // Reset keys so they don't keep moving
        onEncounter();
        return; // Pause rendering loop
      }

      // --- RENDERING LOGIC (Simplified Raycaster) ---
      ctx.fillStyle = '#333'; // Ceiling
      ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
      ctx.fillStyle = '#111'; // Floor
      ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

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
          if (worldMap[mapX][mapY] === 1) hit = 1;
        }

        if (side === 0) perpWallDist = (sideDistX - deltaDistX);
        else perpWallDist = (sideDistY - deltaDistY);

        const lineHeight = Math.floor(canvas.height / perpWallDist);
        const drawStart = -lineHeight / 2 + canvas.height / 2;
        
        // Draw the vertical strip
        ctx.fillStyle = side === 1 ? '#555' : '#666'; // Simple shading
        ctx.fillRect(x, drawStart, 1, lineHeight);
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
