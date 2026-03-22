import React from 'react';

export default function HUD({ hp, maxHp, gold, zoneName }) {
  const isLowHp = hp < maxHp * 0.3;

  return (
    <div style={{
      height: '120px',
      backgroundColor: '#2b2b2b',
      borderTop: '4px solid #555',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '0 20px',
      fontFamily: '"Press Start 2P", monospace',
      color: '#ff3300',
      textShadow: '2px 2px 0px #000'
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#aaa', fontSize: '10px' }}>HEALTH</p>
        <h2 style={{ color: isLowHp ? '#ff0000' : '#ff3300' }}>{hp}%</h2>
      </div>

      <div style={{
        width: '80px',
        height: '80px',
        backgroundColor: '#111',
        border: '3px inset #444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Replace with an actual sprite image later */}
        <span style={{ fontSize: '30px' }}>{isLowHp ? '🤕' : '😎'}</span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#aaa', fontSize: '10px' }}>GOLD</p>
        <h2>{gold}</h2>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#aaa', fontSize: '10px' }}>ZONE</p>
        <p style={{ fontSize: '14px', color: '#fff' }}>{zoneName}</p>
      </div>
    </div>
  );
}
