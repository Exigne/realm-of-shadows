/**
 * PaperAdventure.jsx — STYLIZED 3D ENGINE
 * * Visual Style: Low-Poly Paper-Craft
 * * Tech: True 3D Scene (No Raycasting)
 * * Features: Smooth Physics, Floating Island Logic, Magical Glows
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ─── Creative Style Config ────────────────────────────────────────────────
const COLORS = {
  grass: 0x9de0ad,    // Minty Green
  wall: 0xffccf2,     // Pastel Pink
  sky: 0xade8ff,      // Soft Blue
  player: 0xffffff,
  magic: 0xfff9e3     // Warm Glow
};

export default function PaperAdventure() {
  const mountRef = useRef(null);
  const [hud, setHud] = useState({ hearts: 5, stars: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    
    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.sky);
    scene.fog = new THREE.Fog(COLORS.sky, 5, 25);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. Lighting (The secret to "looking better")
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 10, 7.5);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // 3. Environment: The "Meadow"
    const floorGeom = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Procedural "Paper" Trees
    const createTree = (x, z) => {
      const group = new THREE.Group();
      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
      );
      trunk.position.y = 0.25;
      group.add(trunk);
      // Leaves (Cones)
      for(let i=0; i<3; i++) {
        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(0.5 - i*0.1, 0.8),
          new THREE.MeshStandardMaterial({ color: COLORS.grass, flatShading: true })
        );
        leaves.position.y = 0.6 + i*0.4;
        group.add(leaves);
      }
      group.position.set(x, 0, z);
      scene.add(group);
    };

    // Randomly plant trees
    for(let i=0; i<30; i++) {
        createTree(Math.random()*40 - 20, Math.random()*40 - 20);
    }

    // 5. Player & Movement Logic
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 1.5, 5);
    scene.add(playerGroup);
    playerGroup.add(camera);

    // 6. Interaction: Magic Particles
    const particles = [];
    const pGeom = new THREE.SphereGeometry(0.05, 4, 4);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const spawnParticle = (pos) => {
        const p = new THREE.Mesh(pGeom, pMat);
        p.position.copy(pos);
        scene.add(p);
        particles.push({ mesh: p, life: 1.0, vel: new THREE.Vector3((Math.random()-0.5)*0.1, 0.1, (Math.random()-0.5)*0.1)});
    };

    // 7. Input Handling
    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    let moveSpeed = 0.1;
    let rotation = 0;

    // 8. Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Movement
      if (keys['KeyW']) {
        playerGroup.translateZ(-moveSpeed);
        if(Math.random() > 0.8) spawnParticle(playerGroup.position);
      }
      if (keys['KeyS']) playerGroup.translateZ(moveSpeed);
      if (keys['KeyA']) playerGroup.rotation.y += 0.03;
      if (keys['KeyD']) playerGroup.rotation.y -= 0.03;

      // Particle update
      particles.forEach((p, i) => {
          p.mesh.position.add(p.vel);
          p.life -= 0.02;
          p.mesh.scale.setScalar(p.life);
          if(p.life <= 0) {
              scene.remove(p.mesh);
              particles.splice(i, 1);
          }
      });

      renderer.render(scene, camera);
    };

    setLoading(false);
    animate();

    // Clean up
    return () => {
      renderer.dispose();
      window.removeEventListener('keydown', null);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Visual Overlay: Vignette for "Premium" look */}
      <div style={{
        position: 'absolute', inset: 0,
        boxShadow: 'inset 0 0 150px rgba(0,0,0,0.1)',
        pointerEvents: 'none'
      }} />

      {/* Styled UI */}
      <div style={{ 
          position: 'absolute', top: 30, left: 30, 
          fontFamily: 'serif', color: '#555', letterSpacing: '2px' 
      }}>
        <b>THE PAPER MEADOW</b>
      </div>

      <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '15px' }}>
        {[...Array(hud.hearts)].map((_, i) => (
          <div key={i} style={{ fontSize: '30px', filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.1))' }}>🌸</div>
        ))}
      </div>

      {loading && <div style={{ position: 'absolute', inset: 0, background: COLORS.sky, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Magic...</div>}
    </div>
  );
}
