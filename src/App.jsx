import React, { useState } from 'react';
import Raycaster from './Raycaster';
import HUD from './HUD';

export default function App() {
  const [gameState, setGameState] = useState('EXPLORING'); // 'EXPLORING' or 'BATTLE'
  const [playerStats, setPlayerStats] = useState({ hp: 100, maxHp: 100, gold: 0 });

  const handleEncounter = () => {
    setGameState('BATTLE');
  };

  const winBattle = () => {
    setPlayerStats(prev => ({ ...prev, gold: prev.gold + 50 }));
    setGameState('EXPLORING');
  };

  return (
    <div style={{ backgroundColor: '#000', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Viewport Area */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        {gameState === 'EXPLORING' ? (
          <Raycaster onEncounter={handleEncounter} />
        ) : (
          <div style={{ 
            height: '100%', display: 'flex', flexDirection: 'column', 
            justifyContent: 'center', alignItems: 'center', color: '#fff' 
          }}>
            <h1>⚔️ ENEMY ENCOUNTERED! ⚔️</h1>
            <p>Battle mechanics go here...</p>
            <button 
              onClick={winBattle}
              style={{ padding: '20px', fontSize: '20px', cursor: 'pointer', marginTop: '20px' }}
            >
              Defeat Enemy & Return to Map
            </button>
          </div>
        )}
      </div>

      {/* Doom HUD always stays at the bottom */}
      <HUD 
        hp={playerStats.hp} 
        maxHp={playerStats.maxHp} 
        gold={playerStats.gold} 
        zoneName="DUNGEON LEVEL 1" 
      />
    </div>
  );
}
