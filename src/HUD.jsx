/**
 * HUD.jsx — Candy Island
 *
 * A fixed bottom bar containing:
 *  • Player portrait + stats (bells, fruit, time)
 *  • Dialogue panel that slides up above the bar when an NPC is talking
 *  • Typewriter effect with skip-on-click
 *  • NPC portrait, name badge, progress dots, and continue/close prompt
 */

import React, { useState, useEffect, useRef } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const FF   = '"Comic Sans MS", cursive';
const MONO = '"Press Start 2P", "Courier New", monospace';

// Emoji portrait per NPC name — add new NPCs here
const NPC_PORTRAITS = {
  Barnaby: '🐻',
  Luna:    '🐱',
  Pip:     '🐰',
  Coco:    '🐻',
  Rosie:   '🐰',
  Maple:   '🐱',
  Bubbles: '🐻',
};

const PLAYER_PORTRAIT = '🐱';

function formatTime(gameTime) {
  const h    = Math.floor(gameTime % 12) || 12;
  const ampm = gameTime >= 12 ? 'PM' : 'AM';
  return `${String(h).padStart(2, '0')}:00 ${ampm}`;
}

// ─── Typewriter hook ─────────────────────────────────────────────────────────

function useTypewriter(text, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done,      setDone]      = useState(false);
  const timerRef = useRef(null);

  // Reset and restart whenever text changes
  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(false); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timerRef.current);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timerRef.current);
  }, [text, speed]);

  const skip = () => {
    clearInterval(timerRef.current);
    setDisplayed(text);
    setDone(true);
  };

  return { displayed, done, skip };
}

// ─── Dialogue Panel ───────────────────────────────────────────────────────────

function DialoguePanel({ dialogue, onNext }) {
  const currentText = dialogue.texts[dialogue.step];
  const { displayed, done, skip } = useTypewriter(currentText, 28);
  const isLast = dialogue.step === dialogue.texts.length - 1;

  const handleClick = () => {
    if (!done) { skip(); }
    else       { onNext(); }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        margin:        '0 32px',
        background:    'rgba(255, 252, 240, 0.97)',
        border:        `4px solid ${dialogue.color}`,
        borderBottom:  'none',
        borderRadius:  '18px 18px 0 0',
        padding:       '16px 20px 10px',
        cursor:        'pointer',
        boxShadow:     '0 -6px 24px rgba(0,0,0,0.12)',
        display:       'flex',
        gap:           16,
        alignItems:    'flex-start',
        userSelect:    'none',
        // Animate in from bottom
        animation:     'slideUp 0.22s ease-out',
      }}
    >
      {/* NPC portrait bubble */}
      <div style={{
        width:          68,
        height:         68,
        borderRadius:   14,
        background:     `linear-gradient(135deg, ${dialogue.color}cc, ${dialogue.color})`,
        border:         '3px solid rgba(255,255,255,0.7)',
        boxShadow:      `0 4px 16px ${dialogue.color}55`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       38,
        flexShrink:     0,
        marginTop:      2,
      }}>
        {NPC_PORTRAITS[dialogue.name] || '🐾'}
      </div>

      {/* Text area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name badge */}
        <div style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          background:     dialogue.color,
          color:          '#fff',
          padding:        '3px 12px',
          borderRadius:   20,
          fontFamily:     FF,
          fontWeight:     'bold',
          fontSize:       13,
          marginBottom:   8,
          letterSpacing:  0.5,
          boxShadow:      `0 2px 8px ${dialogue.color}44`,
        }}>
          {NPC_PORTRAITS[dialogue.name] || '🐾'} {dialogue.name}
        </div>

        {/* Dialogue text — typewriter */}
        <div style={{
          fontFamily:  FF,
          fontSize:    15,
          lineHeight:  1.7,
          color:       '#3a2a18',
          minHeight:   52,
          paddingBottom: 4,
        }}>
          {displayed}
          {/* Blinking cursor while typing */}
          {!done && (
            <span style={{ 
              display:    'inline-block',
              width:      2,
              height:     16,
              background: dialogue.color,
              marginLeft: 2,
              verticalAlign: 'middle',
              animation:  'blink 0.5s step-end infinite',
            }} />
          )}
        </div>

        {/* Footer row — progress dots + prompt */}
        {done && (
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            marginTop:      4,
          }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {dialogue.texts.map((_, i) => (
                <div key={i} style={{
                  width:        8,
                  height:       8,
                  borderRadius: '50%',
                  background:   i === dialogue.step ? dialogue.color : `${dialogue.color}44`,
                  transition:   'background 0.2s',
                }} />
              ))}
            </div>

            {/* Continue or close prompt */}
            <div style={{
              fontFamily:    FF,
              fontSize:      11,
              color:         dialogue.color,
              fontWeight:    'bold',
              display:       'flex',
              alignItems:    'center',
              gap:           4,
              opacity:       0.85,
            }}>
              {isLast ? (
                <><span style={{ fontSize: 14 }}>✕</span> close</>
              ) : (
                <>next <span style={{ fontSize: 14 }}>▶</span></>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ icon, label, value, color }) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      background:    'rgba(255,255,255,0.55)',
      border:        `2px solid ${color}55`,
      borderRadius:  12,
      padding:       '5px 14px',
      minWidth:      74,
    }}>
      <div style={{ fontSize: 9, color: '#8a6a40', fontFamily: FF, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color, fontFamily: FF }}>
        {icon} {value}
      </div>
    </div>
  );
}

// ─── Main HUD ─────────────────────────────────────────────────────────────────

export default function HUD({ bells, fruit, gameTime, dialogue, onDialogueNext, locked }) {
  return (
    <>
      {/* Inject keyframe animations */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Bottom stack — dialogue panel sits directly on top of the bar */}
      <div style={{
        position:      'absolute',
        bottom:        0,
        left:          0,
        right:         0,
        zIndex:        20,
        fontFamily:    FF,
        pointerEvents: 'none',   // let canvas clicks through by default
      }}>

        {/* Dialogue panel — pointer events on when active */}
        {dialogue && (
          <div style={{ pointerEvents: 'auto' }}>
            <DialoguePanel dialogue={dialogue} onNext={onDialogueNext} />
          </div>
        )}

        {/* Main bar */}
        <div style={{
          background:    'linear-gradient(180deg, #f7ecce 0%, #ecdbb0 100%)',
          borderTop:     '4px solid #c8a060',
          height:        84,
          display:       'flex',
          alignItems:    'center',
          padding:       '0 22px',
          gap:           16,
          boxShadow:     '0 -3px 14px rgba(0,0,0,0.18)',
          pointerEvents: 'auto',
        }}>

          {/* Player portrait */}
          <div style={{
            width:          62,
            height:         62,
            borderRadius:   12,
            background:     'linear-gradient(135deg, #ffccd8, #ff9ab0)',
            border:         '3px solid rgba(255,255,255,0.8)',
            boxShadow:      '0 3px 10px rgba(0,0,0,0.18)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       34,
            flexShrink:     0,
          }}>
            {PLAYER_PORTRAIT}
          </div>

          {/* Divider */}
          <div style={{ width: 2, height: 46, background: '#c8a060', opacity: 0.45, borderRadius: 2, flexShrink: 0 }} />

          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
            <StatChip icon="🔔" label="BELLS"  value={bells.toLocaleString()} color="#b8860b" />
            <StatChip icon="🍎" label="FRUIT"  value={fruit}                  color="#cc3333" />
            <StatChip icon="🕐" label="TIME"   value={formatTime(gameTime)}   color="#4a7c99" />
          </div>

          {/* Divider */}
          <div style={{ width: 2, height: 46, background: '#c8a060', opacity: 0.45, borderRadius: 2, flexShrink: 0 }} />

          {/* Controls hint */}
          <div style={{
            fontFamily: FF,
            fontSize:   9,
            lineHeight: 1.9,
            color:      '#8B6914',
            textAlign:  'right',
            flexShrink: 0,
          }}>
            {locked ? (
              <>
                <div>🎮 WASD · Wander</div>
                <div>💬 Click NPC · Talk</div>
                <div style={{ color: '#bbb' }}>ESC · Unlock</div>
              </>
            ) : (
              <div style={{ color: '#cc6600', lineHeight: 2 }}>
                🖱️ Click world<br/>to look around
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
