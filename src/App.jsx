import React, { useState, useEffect, useRef } from "react";
import Raycaster from './Raycaster';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=UnifrakturMaguntia&display=swap');`;

const CLASSES = {
  knight: { name: "Knight", icon: "⚔️", color: "#C8A96E", glowColor: "#C8A96E55", stats: { hp: 120, maxHp: 120, mp: 30, maxMp: 30, attack: 18, defense: 14, xp: 0, level: 1, gold: 50 }, abilities: ["Slash", "Shield Bash", "War Cry"], desc: "Stalwart defender, master of steel", lore: "Born of iron and oath, the Knight stands unyielding where others flee." },
  mage: { name: "Mage", icon: "🔮", color: "#9B7FD4", glowColor: "#9B7FD455", stats: { hp: 70, maxHp: 70, mp: 120, maxMp: 120, attack: 22, defense: 6, xp: 0, level: 1, gold: 50 }, abilities: ["Fireball", "Ice Lance", "Arcane Burst"], desc: "Wielder of arcane forces", lore: "Reality bends to their will. The Mage reshapes the world with whispered words." },
  archer: { name: "Archer", icon: "🏹", color: "#6DAF7C", glowColor: "#6DAF7C55", stats: { hp: 90, maxHp: 90, mp: 60, maxMp: 60, attack: 20, defense: 9, xp: 0, level: 1, gold: 50 }, abilities: ["Arrow Shot", "Poison Arrow", "Eagle Eye"], desc: "Swift and deadly from afar", lore: "Silent as dusk, precise as fate. The Archer's arrow finds its mark through storm and shadow." },
};

const ENEMIES = [
  { name: "Goblin Scout", icon: "👺", hp: 30, maxHp: 30, attack: 8, xpReward: 25, goldReward: 10, desc: "Cunning and cowardly" },
  { name: "Dark Wolf", icon: "🐺", hp: 45, maxHp: 45, attack: 12, xpReward: 40, goldReward: 15, desc: "Relentless predator" },
  { name: "Skeleton Knight", icon: "💀", hp: 60, maxHp: 60, attack: 16, xpReward: 60, goldReward: 25, desc: "Undead champion" },
  { name: "Stone Golem", icon: "🗿", hp: 90, maxHp: 90, attack: 20, xpReward: 90, goldReward: 40, desc: "Ancient earth spirit" },
  { name: "Shadow Dragon", icon: "🐉", hp: 150, maxHp: 150, attack: 28, xpReward: 150, goldReward: 80, desc: "Terror of the abyss" },
];

const ZONES = [
  { id: "forest", name: "Whispering Forest", icon: "🌲", enemies: [0, 1], unlocked: true },
  { id: "ruins", name: "Ancient Ruins", icon: "🏚️", enemies: [1, 2], unlocked: true },
  { id: "mountains", name: "Frostpeak Mountains", icon: "⛰️", enemies: [2, 3], unlocked: false },
  { id: "swamp", name: "Cursed Swamp", icon: "🌿", enemies: [2, 3], unlocked: false },
  { id: "castle", name: "Shadow Keep", icon: "🏰", enemies: [3, 4], unlocked: false },
];

const INVENTORY_ITEMS = [
  { id: "sword", name: "Iron Sword", icon: "⚔️", type: "weapon", bonus: "+5 ATK", rarity: "common", desc: "A reliable blade forged by village smiths." },
  { id: "potion", name: "Health Potion", icon: "🧪", type: "consumable", bonus: "+30 HP", rarity: "uncommon", desc: "A crimson elixir brewed from moonflower and bone ash." },
  { id: "shield", name: "Wooden Shield", icon: "🛡️", type: "armor", bonus: "+3 DEF", rarity: "common", desc: "Carved oak reinforced with iron bands." },
];

const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood", icon: "🩸", desc: "Win your first battle", unlocked: false },
  { id: "level5", name: "Rising Hero", icon: "⭐", desc: "Reach level 5", unlocked: false },
  { id: "explorer", name: "Explorer", icon: "🗺️", desc: "Visit 3 different zones", unlocked: false },
  { id: "rich", name: "Coin Hoarder", icon: "💰", desc: "Collect 200 gold", unlocked: false },
];

const RARITY_COLORS = { common: "#8A9BAE", uncommon: "#4CAF82", rare: "#5B8ED4", epic: "#9B7FD4" };

// ─── Ornamental Divider ────────────────────────────────────────────────────
function OrnaDivider({ color = "#3A2E1E", width = "100%" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width, margin: "6px 0" }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${color})` }} />
      <div style={{ color, fontSize: 10, opacity: 0.8 }}>✦</div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </div>
  );
}

// ─── Corner Frame ──────────────────────────────────────────────────────────
function CornerFrame({ color = "#3A2E1E", size = 12, style: extraStyle = {} }) {
  const corner = (top, right, bottom, left) => ({
    position: "absolute", width: size, height: size,
    borderTop: top ? `1px solid ${color}` : "none",
    borderRight: right ? `1px solid ${color}` : "none",
    borderBottom: bottom ? `1px solid ${color}` : "none",
    borderLeft: left ? `1px solid ${color}` : "none",
  });
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", ...extraStyle }}>
      <div style={{ ...corner(true, false, false, true), top: 4, left: 4 }} />
      <div style={{ ...corner(true, true, false, false), top: 4, right: 4 }} />
      <div style={{ ...corner(false, false, true, true), bottom: 4, left: 4 }} />
      <div style={{ ...corner(false, true, true, false), bottom: 4, right: 4 }} />
    </div>
  );
}

// ─── Stat Bar ──────────────────────────────────────────────────────────────
function StatBar({ value, max, color, label, glowColor }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const glow = glowColor || color + "66";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#7A6040", fontFamily: "'Crimson Text', serif", marginBottom: 4, letterSpacing: 1 }}>
        <span style={{ textTransform: "uppercase" }}>{label}</span>
        <span style={{ color: "#A89060" }}>{value}<span style={{ color: "#4A3820" }}>/{max}</span></span>
      </div>
      <div style={{ background: "#0D0A07", borderRadius: 1, height: 6, overflow: "visible", border: "1px solid #2A1E0E", position: "relative" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}99, ${color})`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", borderRadius: 1, boxShadow: `0 0 8px ${glow}, 0 0 2px ${color}` }} />
        {/* tick marks */}
        {[25, 50, 75].map(t => (
          <div key={t} style={{ position: "absolute", top: 0, left: `${t}%`, width: 1, height: "100%", background: "#1A1208", opacity: 0.6 }} />
        ))}
      </div>
    </div>
  );
}

// ─── Battle Log ────────────────────────────────────────────────────────────
function BattleLog({ logs }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  const colors = { hero: "#E8C87A", enemy: "#E05555", system: "#9B7FD4", reward: "#6DAF7C" };
  const prefixes = { hero: "⚔", enemy: "💢", system: "◆", reward: "✦" };
  return (
    <div ref={ref} style={{ background: "#07050300", border: "1px solid #2A1E0E", borderRadius: 2, padding: "10px 14px", height: 130, overflowY: "auto", fontFamily: "'Crimson Text', serif", fontSize: 13, lineHeight: 1.8, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #0D0A0755 0%, transparent 20%, transparent 80%, #0D0A0788 100%)", pointerEvents: "none", zIndex: 1 }} />
      {logs.map((l, i) => (
        <div key={i} style={{ color: colors[l.type] || "#C8A96E", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <span style={{ opacity: 0.5, fontSize: 9, paddingTop: 3 }}>{prefixes[l.type] || "·"}</span>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Floating Particles ────────────────────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * -20,
    opacity: Math.random() * 0.4 + 0.1,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          background: "#C8A96E", borderRadius: "50%",
          opacity: p.opacity,
          animation: `float ${p.duration}s ${p.delay}s ease-in-out infinite alternate`,
        }} />
      ))}
    </div>
  );
}

// ─── HP Flash Overlay ──────────────────────────────────────────────────────
function DamageFlash({ active }) {
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999,
      background: "radial-gradient(ellipse at center, transparent 40%, #C0392B44 100%)",
      opacity: active ? 1 : 0,
      transition: "opacity 0.15s ease",
    }} />
  );
}

export default function App() {
  const [screen, setScreen] = useState("select");
  const [heroClass, setHeroClass] = useState(null);
  const [hero, setHero] = useState(null);
  const [zone, setZone] = useState(null);
  const [enemy, setEnemy] = useState(null);
  const [battleLog, setBattleLog] = useState([]);
  const [battlePhase, setBattlePhase] = useState("player");
  const [inventory, setInventory] = useState(INVENTORY_ITEMS);
  const [achievements, setAchievements] = useState(ACHIEVEMENTS);
  const [visitedZones, setVisitedZones] = useState([]);
  const [zones, setZones] = useState(ZONES);
  const [notification, setNotification] = useState(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [enemyShake, setEnemyShake] = useState(false);
  const [hoveredClass, setHoveredClass] = useState(null);
  const [attackAnim, setAttackAnim] = useState(false);

  const notify = (msg, color = "#C8A96E") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 2800);
  };

  const startGame = (cls) => {
    setHeroClass(cls);
    setHero({ ...CLASSES[cls], stats: { ...CLASSES[cls].stats } });
    setScreen("map");
  };

  const enterZone = (z) => {
    if (!z.unlocked) { notify("Zone locked! Defeat more enemies to unlock.", "#D46060"); return; }
    setZone(z);
    const enemyIdx = z.enemies[Math.floor(Math.random() * z.enemies.length)];
    const e = { ...ENEMIES[enemyIdx], hp: ENEMIES[enemyIdx].maxHp };
    setEnemy(e);
    setBattleLog([{ text: `Entering ${z.name}...`, type: "system" }, { text: `A ${e.name} emerges from the darkness!`, type: "system" }]);
    setBattlePhase("player");
    setScreen("battle");
    const nv = visitedZones.includes(z.id) ? visitedZones : [...visitedZones, z.id];
    setVisitedZones(nv);
    if (nv.length >= 3) unlockAchievement("explorer");
  };

  const triggerRandomEncounter = () => {
    const unlockedZones = zones.filter(z => z.unlocked);
    const randomZone = unlockedZones[Math.floor(Math.random() * unlockedZones.length)];
    enterZone(randomZone);
  };

  const unlockAchievement = (id) => {
    setAchievements(prev => {
      if (prev.find(a => a.id === id)?.unlocked) return prev;
      const ach = prev.find(a => a.id === id);
      if (ach) notify(`🏆 Achievement Unlocked: ${ach.name}!`, "#F0C040");
      return prev.map(a => a.id === id ? { ...a, unlocked: true } : a);
    });
  };

  const heroAttack = (ability) => {
    if (battlePhase !== "player" || !enemy || !hero) return;
    const dmg = hero.stats.attack + Math.floor(Math.random() * 8) - 3;
    const newEnemyHp = Math.max(0, enemy.hp - dmg);

    // Attack animation
    setAttackAnim(true);
    setTimeout(() => setAttackAnim(false), 400);
    setEnemyShake(true);
    setTimeout(() => setEnemyShake(false), 400);

    const log = [{ text: `${ability} — ${dmg} damage dealt!`, type: "hero" }];
    setEnemy(prev => ({ ...prev, hp: newEnemyHp }));

    if (newEnemyHp <= 0) {
      log.push({ text: `${enemy.name} has been slain!`, type: "system" });
      log.push({ text: `+${enemy.xpReward} XP  ·  +${enemy.goldReward} Gold`, type: "reward" });
      setBattleLog(prev => [...prev, ...log]);
      setBattlePhase("end");
      setHero(prev => {
        const newXp = prev.stats.xp + enemy.xpReward;
        const newGold = prev.stats.gold + enemy.goldReward;
        const levelUp = newXp >= prev.stats.level * 100;
        const newLevel = levelUp ? prev.stats.level + 1 : prev.stats.level;
        const newMaxHp = levelUp ? prev.stats.maxHp + 10 : prev.stats.maxHp;
        const newHp = levelUp ? newMaxHp : prev.stats.hp;
        if (levelUp) {
          setTimeout(() => notify(`⬆ Level Up! Now level ${newLevel}!`, "#F0C040"), 300);
          if (newLevel >= 5) unlockAchievement("level5");
        }
        if (newGold >= 200) unlockAchievement("rich");
        return { ...prev, stats: { ...prev.stats, xp: newXp % (prev.stats.level * 100), level: newLevel, gold: newGold, hp: newHp, maxHp: newMaxHp } };
      });
      unlockAchievement("first_blood");
      setZones(prev => prev.map((z2, i) => i <= visitedZones.length ? { ...z2, unlocked: true } : z2));
    } else {
      setBattleLog(prev => [...prev, ...log]);
      setBattlePhase("enemy");
      setTimeout(() => {
        const eDmg = Math.max(1, enemy.attack - hero.stats.defense + Math.floor(Math.random() * 6) - 3);
        const newHp = Math.max(0, hero.stats.hp - eDmg);
        setDamageFlash(true);
        setTimeout(() => setDamageFlash(false), 300);
        setBattleLog(prev => [...prev, { text: `${enemy.name} strikes for ${eDmg} damage!`, type: "enemy" }]);
        setHero(prev2 => ({ ...prev2, stats: { ...prev2.stats, hp: newHp } }));
        if (newHp <= 0) {
          setBattleLog(prev => [...prev, { text: "You have fallen... Rise and try again.", type: "system" }]);
          setBattlePhase("end");
          setTimeout(() => {
            setHero(prev2 => ({ ...prev2, stats: { ...prev2.stats, hp: prev2.stats.maxHp } }));
            setScreen("map");
            notify("Defeated... but you rise again.", "#D46060");
          }, 2000);
        } else {
          setBattlePhase("player");
        }
      }, 900);
    }
  };

  const usePotion = () => {
    const potion = inventory.find(i => i.id === "potion");
    if (!potion) { notify("No potions remain!", "#D46060"); return; }
    setHero(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.min(prev.stats.maxHp, prev.stats.hp + 30) } }));
    setInventory(prev => prev.filter(i => i.id !== "potion"));
    notify("Health Potion consumed · +30 HP", "#6DAF7C");
  };

  const cls = heroClass ? CLASSES[heroClass] : null;

  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #070504; }
        ::-webkit-scrollbar-thumb { background: #2A1E0E; border-radius: 2px; }

        @keyframes flicker { 0%,100%{opacity:1;filter:brightness(1)} 48%{opacity:0.92;filter:brightness(0.95)} 50%{opacity:1;filter:brightness(1.05)} 96%{opacity:0.95} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 12px #C8A96E33} 50%{box-shadow:0 0 28px #C8A96E77, 0 0 60px #C8A96E22} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes float { 0%{transform:translateY(0) translateX(0)} 100%{transform:translateY(-30px) translateX(12px)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes attack { 0%,100%{transform:translateX(0)} 50%{transform:translateX(18px)} }
        @keyframes glow-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
        @keyframes borderGlow { 0%,100%{box-shadow:0 0 8px #C8A96E22, inset 0 0 8px transparent} 50%{box-shadow:0 0 20px #C8A96E44, inset 0 0 12px #C8A96E11} }
        @keyframes notifIn { from{opacity:0;transform:translateX(-50%) translateY(-12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes scanlines { 0%{background-position:0 0} 100%{background-position:0 4px} }

        .enemy-shake { animation: shake 0.35s ease !important; }
        .hero-attack { animation: attack 0.4s ease !important; }
        .gold-shimmer {
          background: linear-gradient(90deg, #8A6020, #E8C87A, #C8A96E, #F0D090, #C8A96E, #8A6020);
          background-size: 300% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .class-card { transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s; }
        .class-card:hover { transform: translateY(-6px); }
        .nav-btn { transition: background 0.2s, color 0.2s, border-color 0.2s; }
        .nav-btn:hover { background: #1E1508 !important; border-color: #5A4020 !important; color: #C8A96E !important; }
        .ability-btn { transition: all 0.18s; position: relative; overflow: hidden; }
        .ability-btn:hover:not(:disabled) { background: #2A1E0E !important; border-color: #C8A96E !important; color: #F0D090 !important; }
        .ability-btn::after { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.04) 100%); pointer-events: none; }
        .zone-card { transition: all 0.22s; cursor: pointer; }
        .zone-card:hover { transform: translateY(-3px); border-color: #5A4020 !important; background: #161008 !important; }
        .inv-card { transition: all 0.2s; }
        .inv-card:hover { transform: translateY(-3px); border-color: #5A4020 !important; }
        .screen-enter { animation: fadeUp 0.45s cubic-bezier(0.4,0,0.2,1) both; }
      `}</style>

      {/* Damage Flash */}
      <DamageFlash active={damageFlash} />

      {/* Floating embers */}
      <Particles />

      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: 24, left: "50%",
          transform: "translateX(-50%)",
          background: "linear-gradient(135deg, #120E08, #1A1410)",
          border: `1px solid ${notification.color}66`,
          color: notification.color,
          padding: "12px 24px 12px 16px",
          borderRadius: 3,
          fontFamily: "'Crimson Text', serif",
          fontSize: 14, letterSpacing: 0.5,
          zIndex: 1000,
          boxShadow: `0 0 30px ${notification.color}33, 0 8px 32px rgba(0,0,0,0.6)`,
          animation: "notifIn 0.3s ease both",
          display: "flex", alignItems: "center", gap: 10,
          minWidth: 220,
        }}>
          <div style={{ width: 3, height: "100%", background: notification.color, position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: "3px 0 0 3px" }} />
          {notification.msg}
        </div>
      )}

      <div style={{ fontFamily: "'Cinzel', serif", background: "#060403", minHeight: "100vh", color: "#C8A96E", position: "relative", overflow: "hidden" }}>

        {/* Background texture */}
        <div style={{ position: "fixed", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C8A96E' fill-opacity='0.015'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")", zIndex: 0, pointerEvents: "none" }} />
        <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1A0E0444 0%, transparent 70%)", zIndex: 0, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>

          {/* ─── CLASS SELECT ─────────────────────────────────── */}
          {screen === "select" && (
            <div className="screen-enter" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>

              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 52 }}>
                <div style={{ fontSize: 10, letterSpacing: 8, color: "#4A3010", marginBottom: 16, fontFamily: "'Crimson Text', serif", textTransform: "uppercase" }}>— Anno Domini · The Age of Shadows —</div>
                <h1 className="gold-shimmer" style={{ fontSize: "clamp(36px, 6vw, 64px)", fontFamily: "'Cinzel Decorative', serif", fontWeight: 900, lineHeight: 1.05, marginBottom: 16 }}>
                  REALM OF<br />SHADOWS
                </h1>
                <OrnaDivider color="#5A4020" width="280px" />
                <div style={{ marginTop: 16, fontFamily: "'Crimson Text', serif", color: "#6A5030", fontSize: 17, fontStyle: "italic", letterSpacing: 0.5 }}>
                  Choose your path, brave adventurer
                </div>
              </div>

              {/* Class Cards */}
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 820 }}>
                {Object.entries(CLASSES).map(([key, c], idx) => (
                  <div
                    key={key}
                    className="class-card"
                    onClick={() => startGame(key)}
                    onMouseEnter={() => setHoveredClass(key)}
                    onMouseLeave={() => setHoveredClass(null)}
                    style={{
                      background: hoveredClass === key
                        ? `linear-gradient(160deg, #12100A, #1A1508)`
                        : "linear-gradient(160deg, #0C0906, #100D08)",
                      border: `1px solid ${hoveredClass === key ? c.color + "66" : "#2A1E0E"}`,
                      borderRadius: 6,
                      padding: "32px 24px 24px",
                      width: 220,
                      cursor: "pointer",
                      textAlign: "center",
                      position: "relative",
                      overflow: "hidden",
                      animation: `fadeUp 0.5s ${idx * 0.1}s ease both`,
                      boxShadow: hoveredClass === key ? `0 8px 40px ${c.glowColor}, 0 0 0 1px ${c.color}22` : "0 4px 20px rgba(0,0,0,0.4)",
                    }}
                  >
                    <CornerFrame color={hoveredClass === key ? c.color + "88" : "#2A1E0E"} size={14} />

                    {/* Glow orb */}
                    <div style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", width: 80, height: 80, background: c.glowColor, borderRadius: "50%", filter: "blur(30px)", opacity: hoveredClass === key ? 0.6 : 0.2, transition: "opacity 0.3s" }} />

                    <div style={{ fontSize: 52, marginBottom: 14, position: "relative", animation: "flicker 4s ease-in-out infinite" }}>{c.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c.color, marginBottom: 4, letterSpacing: 2, textTransform: "uppercase" }}>{c.name}</div>
                    <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 12, color: "#5A4020", fontStyle: "italic", marginBottom: 4 }}>{c.desc}</div>

                    <OrnaDivider color="#2A1E0E" />

                    {/* Lore */}
                    <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 11.5, color: "#4A3818", fontStyle: "italic", lineHeight: 1.6, marginBottom: 16, minHeight: 46 }}>
                      {hoveredClass === key ? c.lore : ""}
                    </div>

                    {/* Stats */}
                    <div style={{ textAlign: "left" }}>
                      {[["HP", c.stats.hp, "#C0392B"], ["MP", c.stats.mp, "#5B7BD4"], ["ATK", c.stats.attack, "#C8A96E"], ["DEF", c.stats.defense, "#6DAF7C"]].map(([k, v, col]) => (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                          <span style={{ fontSize: 9, color: "#4A3820", width: 26, letterSpacing: 1 }}>{k}</span>
                          <div style={{ flex: 1, height: 3, background: "#1A1208", borderRadius: 1, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, (v / 120) * 100)}%`, height: "100%", background: col, borderRadius: 1 }} />
                          </div>
                          <span style={{ fontSize: 10, color: "#8A7050", width: 20, textAlign: "right" }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 20, padding: "9px 0", background: c.color + (hoveredClass === key ? "22" : "11"), border: `1px solid ${c.color}${hoveredClass === key ? "44" : "22"}`, borderRadius: 2, fontSize: 11, color: hoveredClass === key ? c.color : c.color + "88", letterSpacing: 3, transition: "all 0.25s" }}>
                      SELECT
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 48, fontFamily: "'Crimson Text', serif", fontSize: 12, color: "#2A1E0E", letterSpacing: 2 }}>
                ✦ &nbsp; YOUR LEGEND AWAITS &nbsp; ✦
              </div>
            </div>
          )}

          {/* ─── MAIN GAME LAYOUT ─────────────────────────────── */}
          {screen !== "select" && hero && (
            <div style={{ display: "flex", minHeight: "100vh" }}>

              {/* Sidebar */}
              <div style={{ width: 232, background: "linear-gradient(180deg, #080604 0%, #060402 100%)", borderRight: "1px solid #1A1208", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 0, flexShrink: 0, position: "relative" }}>

                {/* Sidebar top glow */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: `linear-gradient(180deg, ${cls?.glowColor || "#C8A96E22"} 0%, transparent 100%)`, pointerEvents: "none" }} />

                {/* Hero portrait */}
                <div style={{ textAlign: "center", paddingBottom: 16, marginBottom: 12, position: "relative" }}>
                  <div style={{ position: "relative", display: "inline-block", marginBottom: 10 }}>
                    <div style={{ width: 72, height: 72, background: "#0C0906", border: `1px solid ${cls?.color}44`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle, ${cls?.glowColor} 0%, transparent 70%)`, animation: "glow-pulse 3s ease-in-out infinite" }} />
                      <div style={{ fontSize: 40, animation: "flicker 4s ease-in-out infinite", position: "relative" }}>{cls?.icon}</div>
                    </div>
                    <CornerFrame color={cls?.color + "55"} size={10} />
                  </div>

                  <div style={{ fontSize: 15, color: cls?.color, letterSpacing: 2, fontWeight: 700, marginBottom: 2 }}>{hero.name}</div>
                  <div style={{ fontSize: 10, color: "#4A3018", fontFamily: "'Crimson Text', serif", marginBottom: 12, letterSpacing: 1 }}>
                    LVL {hero.stats.level} &nbsp;·&nbsp; {cls?.name}
                  </div>

                  <StatBar value={hero.stats.hp} max={hero.stats.maxHp} color="#C0392B" label="Health" glowColor="#C0392B55" />
                  <StatBar value={hero.stats.mp} max={hero.stats.maxMp} color="#5B7BD4" label="Mana" glowColor="#5B7BD455" />
                  <StatBar value={hero.stats.xp} max={hero.stats.level * 100} color="#C8A96E" label="Experience" glowColor="#C8A96E44" />
                </div>

                <OrnaDivider color="#1E1608" />

                {/* Stats grid */}
                <div style={{ padding: "10px 0", marginBottom: 8 }}>
                  {[["⚔", "Attack", hero.stats.attack], ["🛡", "Defense", hero.stats.defense], ["💰", "Gold", hero.stats.gold]].map(([icon, k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", marginBottom: 2, borderRadius: 2 }}>
                      <span style={{ fontFamily: "'Crimson Text', serif", fontSize: 12, color: "#5A4020", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11 }}>{icon}</span>{k}
                      </span>
                      <span style={{ fontSize: 13, color: "#C8A96E", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <OrnaDivider color="#1E1608" />

                {/* Abilities */}
                <div style={{ padding: "10px 0 4px", marginBottom: 8 }}>
                  <div style={{ fontSize: 8, letterSpacing: 5, color: "#3A2810", marginBottom: 10, textAlign: "center" }}>ABILITIES</div>
                  {cls?.abilities.map((a, i) => (
                    <div key={a} style={{ fontSize: 12, fontFamily: "'Crimson Text', serif", color: "#7A5830", padding: "4px 8px", marginBottom: 1, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: cls?.color + "66", fontSize: 9 }}>{"I".repeat(i + 1)}</span>
                      <span>{a}</span>
                    </div>
                  ))}
                </div>

                {/* Nav */}
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
                  <OrnaDivider color="#1E1608" />
                  {[["🗺", "3D Labyrinth", "map"], ["🎒", "Inventory", "inventory"], ["🏆", "Achievements", "achievements"]].map(([icon, label, sc]) => (
                    <button
                      key={sc}
                      className="nav-btn"
                      onClick={() => setScreen(sc)}
                      style={{
                        background: screen === sc ? "#161008" : "transparent",
                        border: `1px solid ${screen === sc ? "#C8A96E33" : "#1E1608"}`,
                        color: screen === sc ? "#C8A96E" : "#4A3018",
                        fontFamily: "'Cinzel', serif",
                        fontSize: 10,
                        padding: "9px 12px",
                        borderRadius: 2,
                        cursor: "pointer",
                        textAlign: "left",
                        letterSpacing: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        position: "relative",
                      }}
                    >
                      {screen === sc && <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: 2, background: "#C8A96E", borderRadius: 1 }} />}
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* Topbar */}
                <div style={{ padding: "10px 24px", borderBottom: "1px solid #120E08", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#060402", flexShrink: 0 }}>
                  <div style={{ fontSize: 9, letterSpacing: 6, color: "#3A2810", textTransform: "uppercase", fontFamily: "'Crimson Text', serif" }}>
                    {screen === "map" ? "Realm of Shadows · 3D Labyrinth" :
                      screen === "battle" ? `⚔  Combat · ${zone?.name}` :
                        screen === "inventory" ? "🎒  Armoury & Inventory" :
                          "🏆  Hall of Achievements"}
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontFamily: "'Crimson Text', serif", color: "#3A2810" }}>
                      LVL {hero.stats.level}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: "'Crimson Text', serif", color: "#3A2810" }}>
                      💰 {hero.stats.gold}
                    </span>
                  </div>
                </div>

                {/* ─── 3D MAP ─── */}
                {screen === "map" && (
                  <div className="screen-enter" style={{ flex: 1, position: "relative", background: "#000" }}>
                    <Raycaster onEncounter={triggerRandomEncounter} />
                    <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(6,4,2,0.85)", padding: "10px 24px", borderRadius: 3, border: "1px solid #2A1E0E", backdropFilter: "blur(4px)" }}>
                      <p style={{ fontFamily: "'Crimson Text', serif", color: "#8A6840", fontSize: 13, fontStyle: "italic", textAlign: "center", margin: 0, letterSpacing: 0.5 }}>
                        W · A · S · D &nbsp;|&nbsp; Seek the enemy to engage in combat
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── BATTLE ─── */}
                {screen === "battle" && enemy && (
                  <div className="screen-enter" style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>

                    <div style={{ display: "flex", gap: 20 }}>

                      {/* Enemy panel */}
                      <div style={{ width: 240, flexShrink: 0, background: "linear-gradient(160deg, #0C0806, #100A06)", border: "1px solid #2A1A10", borderRadius: 6, padding: 24, textAlign: "center", position: "relative", overflow: "hidden" }}>
                        <CornerFrame color="#3A1E10" size={12} />

                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: "linear-gradient(180deg, #C0392B0D 0%, transparent 100%)" }} />

                        <div style={{ fontSize: 9, letterSpacing: 5, color: "#5A2820", marginBottom: 16 }}>ADVERSARY</div>

                        <div
                          className={enemyShake ? "enemy-shake" : ""}
                          style={{ fontSize: 72, lineHeight: 1, marginBottom: 12, animation: enemy.hp > 0 ? "flicker 2.5s ease-in-out infinite" : "none", opacity: enemy.hp <= 0 ? 0.2 : 1, filter: enemy.hp <= 0 ? "grayscale(1)" : "none", transition: "filter 0.5s, opacity 0.5s" }}
                        >
                          {enemy.icon}
                        </div>

                        <div style={{ fontSize: 17, color: "#D46060", marginBottom: 4, letterSpacing: 1, fontWeight: 600 }}>{enemy.name}</div>
                        <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 12, color: "#5A3020", fontStyle: "italic", marginBottom: 14 }}>{enemy.desc}</div>

                        <OrnaDivider color="#3A1E10" />
                        <div style={{ marginTop: 10 }}>
                          <StatBar value={enemy.hp} max={enemy.maxHp} color="#C0392B" label="Vitality" glowColor="#C0392B55" />
                        </div>

                        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, fontFamily: "'Crimson Text', serif", fontSize: 11, color: "#5A3020" }}>
                          <span>⚔ {enemy.attack} ATK</span>
                          <span>· XP {enemy.xpReward}</span>
                          <span>· 💰 {enemy.goldReward}</span>
                        </div>
                      </div>

                      {/* Battle right panel */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                        <BattleLog logs={battleLog} />

                        {/* Abilities */}
                        <div>
                          <div style={{ fontSize: 8, letterSpacing: 5, color: "#3A2810", marginBottom: 8 }}>CHOOSE YOUR ACTION</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {cls?.abilities.map((ab, i) => (
                              <button
                                key={ab}
                                className={`ability-btn ${attackAnim && "hero-attack"}`}
                                onClick={() => heroAttack(ab)}
                                disabled={battlePhase !== "player" || enemy.hp <= 0}
                                style={{
                                  background: "linear-gradient(135deg, #100C08, #181208)",
                                  border: `1px solid ${battlePhase === "player" && enemy.hp > 0 ? "#3A2E1E" : "#1A1208"}`,
                                  color: battlePhase === "player" && enemy.hp > 0 ? "#C8A96E" : "#2A1E0E",
                                  fontFamily: "'Cinzel', serif",
                                  fontSize: 11,
                                  padding: "11px 18px",
                                  borderRadius: 3,
                                  cursor: battlePhase === "player" && enemy.hp > 0 ? "pointer" : "not-allowed",
                                  letterSpacing: 1,
                                  flex: 1,
                                  minWidth: 100,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 8,
                                }}
                              >
                                <span style={{ fontSize: 9, color: cls?.color + "88" }}>{"I".repeat(i + 1)}</span>
                                {ab}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={usePotion}
                            style={{
                              background: "#080F09", border: "1px solid #1A3020", color: inventory.find(i => i.id === "potion") ? "#6DAF7C" : "#2A4020",
                              fontFamily: "'Cinzel', serif", fontSize: 10, padding: "10px 16px",
                              borderRadius: 3, cursor: "pointer", flex: 1, letterSpacing: 1,
                              transition: "all 0.2s",
                            }}
                          >
                            🧪 Potion {inventory.find(i => i.id === "potion") ? "(1)" : "(0)"}
                          </button>
                          <button
                            onClick={() => setScreen("map")}
                            style={{
                              background: "#0F0808", border: "1px solid #2A1818", color: "#804040",
                              fontFamily: "'Cinzel', serif", fontSize: 10, padding: "10px 16px",
                              borderRadius: 3, cursor: "pointer", flex: 1, letterSpacing: 1,
                              transition: "all 0.2s",
                            }}
                          >
                            ↩ Flee
                          </button>
                        </div>

                        {/* Continue button */}
                        {battlePhase === "end" && enemy.hp <= 0 && (
                          <button
                            onClick={() => setScreen("map")}
                            style={{
                              background: "linear-gradient(135deg, #161008, #201608)",
                              border: "1px solid #C8A96E55",
                              color: "#C8A96E",
                              fontFamily: "'Cinzel', serif",
                              fontSize: 12,
                              padding: "14px",
                              borderRadius: 3,
                              cursor: "pointer",
                              letterSpacing: 2,
                              animation: "borderGlow 2s ease-in-out infinite",
                            }}
                          >
                            CONTINUE EXPLORATION  →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── INVENTORY ─── */}
                {screen === "inventory" && (
                  <div className="screen-enter" style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 9, letterSpacing: 5, color: "#3A2810", marginBottom: 6 }}>CARRIED ITEMS</div>
                      <OrnaDivider color="#2A1E0E" width="100%" />
                    </div>

                    {inventory.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'Crimson Text', serif", color: "#2A1E0E", fontStyle: "italic", fontSize: 15 }}>
                        Your pack is empty, wanderer.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                        {inventory.map(item => (
                          <div key={item.id} className="inv-card" style={{ background: "linear-gradient(160deg, #0C0906, #0F0C08)", border: `1px solid ${RARITY_COLORS[item.rarity] || "#2A1E0E"}22`, borderRadius: 5, padding: "20px 16px", textAlign: "center", position: "relative", overflow: "hidden" }}>
                            <CornerFrame color={RARITY_COLORS[item.rarity] + "44"} size={10} />

                            <div style={{ position: "absolute", top: 6, right: 8, fontSize: 8, letterSpacing: 2, color: RARITY_COLORS[item.rarity], textTransform: "uppercase" }}>{item.rarity}</div>

                            <div style={{ fontSize: 42, marginBottom: 10 }}>{item.icon}</div>
                            <div style={{ fontSize: 13, color: "#C8A96E", marginBottom: 5, letterSpacing: 0.5, fontWeight: 600 }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: RARITY_COLORS[item.rarity] || "#5A9060", marginBottom: 8, fontFamily: "'Crimson Text', serif" }}>{item.bonus}</div>
                            <OrnaDivider color="#2A1E0E" />
                            <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 12, color: "#4A3818", fontStyle: "italic", marginTop: 8, lineHeight: 1.5 }}>{item.desc}</div>
                            <div style={{ marginTop: 10, fontSize: 9, letterSpacing: 3, color: "#3A2810", textTransform: "uppercase" }}>{item.type}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── ACHIEVEMENTS ─── */}
                {screen === "achievements" && (
                  <div className="screen-enter" style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 9, letterSpacing: 5, color: "#3A2810", marginBottom: 6 }}>HALL OF GLORY</div>
                      <OrnaDivider color="#2A1E0E" width="100%" />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                      {achievements.map(a => (
                        <div key={a.id} style={{
                          background: a.unlocked ? "linear-gradient(135deg, #12100A, #1A1508)" : "linear-gradient(135deg, #0A0806, #0C0A07)",
                          border: `1px solid ${a.unlocked ? "#C8A96E33" : "#1A1208"}`,
                          borderRadius: 5,
                          padding: "18px 16px",
                          display: "flex",
                          gap: 14,
                          alignItems: "flex-start",
                          opacity: a.unlocked ? 1 : 0.45,
                          position: "relative",
                          overflow: "hidden",
                          transition: "all 0.3s",
                          boxShadow: a.unlocked ? "0 4px 20px rgba(0,0,0,0.4)" : "none",
                        }}>
                          {a.unlocked && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #C8A96E66, transparent)" }} />}

                          <div style={{ fontSize: 34, filter: a.unlocked ? "none" : "grayscale(1)", flexShrink: 0 }}>{a.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: a.unlocked ? "#C8A96E" : "#3A2810", letterSpacing: 1, marginBottom: 5, fontWeight: 600 }}>{a.name}</div>
                            <div style={{ fontSize: 12, fontFamily: "'Crimson Text', serif", color: "#4A3820", fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>{a.desc}</div>
                            {a.unlocked ? (
                              <div style={{ fontSize: 9, color: "#6DAF7C", letterSpacing: 3, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ display: "inline-block", width: 6, height: 6, background: "#6DAF7C", borderRadius: "50%" }} />
                                UNLOCKED
                              </div>
                            ) : (
                              <div style={{ fontSize: 9, color: "#2A1E0E", letterSpacing: 3 }}>LOCKED</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
