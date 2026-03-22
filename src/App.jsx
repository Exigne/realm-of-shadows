import React, { useState, useEffect, useRef } from "react";
import Raycaster from './Raycaster';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');`;

const CLASSES = {
  knight: { name: "Knight", icon: "⚔️", color: "#C8A96E", stats: { hp: 120, maxHp: 120, mp: 30, maxMp: 30, attack: 18, defense: 14, xp: 0, level: 1, gold: 50 }, abilities: ["Slash", "Shield Bash", "War Cry"], desc: "Stalwart defender, master of steel" },
  mage: { name: "Mage", icon: "🔮", color: "#9B7FD4", stats: { hp: 70, maxHp: 70, mp: 120, maxMp: 120, attack: 22, defense: 6, xp: 0, level: 1, gold: 50 }, abilities: ["Fireball", "Ice Lance", "Arcane Burst"], desc: "Wielder of arcane forces" },
  archer: { name: "Archer", icon: "🏹", color: "#6DAF7C", stats: { hp: 90, maxHp: 90, mp: 60, maxMp: 60, attack: 20, defense: 9, xp: 0, level: 1, gold: 50 }, abilities: ["Arrow Shot", "Poison Arrow", "Eagle Eye"], desc: "Swift and deadly from afar" },
};

const ENEMIES = [
  { name: "Goblin Scout", icon: "👺", hp: 30, maxHp: 30, attack: 8, xpReward: 25, goldReward: 10 },
  { name: "Dark Wolf", icon: "🐺", hp: 45, maxHp: 45, attack: 12, xpReward: 40, goldReward: 15 },
  { name: "Skeleton Knight", icon: "💀", hp: 60, maxHp: 60, attack: 16, xpReward: 60, goldReward: 25 },
  { name: "Stone Golem", icon: "🗿", hp: 90, maxHp: 90, attack: 20, xpReward: 90, goldReward: 40 },
  { name: "Shadow Dragon", icon: "🐉", hp: 150, maxHp: 150, attack: 28, xpReward: 150, goldReward: 80 },
];

const ZONES = [
  { id: "forest", name: "Whispering Forest", icon: "🌲", enemies: [0, 1], unlocked: true },
  { id: "ruins", name: "Ancient Ruins", icon: "🏚️", enemies: [1, 2], unlocked: true },
  { id: "mountains", name: "Frostpeak Mountains", icon: "⛰️", enemies: [2, 3], unlocked: false },
  { id: "swamp", name: "Cursed Swamp", icon: "🌿", enemies: [2, 3], unlocked: false },
  { id: "castle", name: "Shadow Keep", icon: "🏰", enemies: [3, 4], unlocked: false },
];

const INVENTORY_ITEMS = [
  { id: "sword", name: "Iron Sword", icon: "⚔️", type: "weapon", bonus: "+5 ATK" },
  { id: "potion", name: "Health Potion", icon: "🧪", type: "consumable", bonus: "+30 HP" },
  { id: "shield", name: "Wooden Shield", icon: "🛡️", type: "armor", bonus: "+3 DEF" },
];

const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood", icon: "🩸", desc: "Win your first battle", unlocked: false },
  { id: "level5", name: "Rising Hero", icon: "⭐", desc: "Reach level 5", unlocked: false },
  { id: "explorer", name: "Explorer", icon: "🗺️", desc: "Visit 3 different zones", unlocked: false },
  { id: "rich", name: "Coin Hoarder", icon: "💰", desc: "Collect 200 gold", unlocked: false },
];

function StatBar({ value, max, color, label }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#A89060", fontFamily: "'Crimson Text', serif", marginBottom: 3 }}>
        <span>{label}</span><span>{value}/{max}</span>
      </div>
      <div style={{ background: "#1A1410", borderRadius: 2, height: 8, overflow: "hidden", border: "1px solid #3A2E1E" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.4s ease", borderRadius: 2 }} />
      </div>
    </div>
  );
}

function BattleLog({ logs }) {
  const ref = useRef();
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{ background: "#0D0A07", border: "1px solid #3A2E1E", borderRadius: 4, padding: "10px 12px", height: 110, overflowY: "auto", fontFamily: "'Crimson Text', serif", fontSize: 13, color: "#C8A96E", lineHeight: 1.7 }}>
      {logs.map((l, i) => <div key={i} style={{ color: l.type === "hero" ? "#E8C87A" : l.type === "enemy" ? "#D46060" : l.type === "system" ? "#9B7FD4" : "#6DAF7C" }}>{l.text}</div>)}
    </div>
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

  const notify = (msg, color = "#C8A96E") => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 2500);
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
    setBattleLog([{ text: `⚔ Entering ${z.name}...`, type: "system" }, { text: `A wild ${e.name} ${e.icon} appears!`, type: "system" }]);
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
      if (ach) notify(`🏆 Achievement: ${ach.name}!`, "#F0C040");
      return prev.map(a => a.id === id ? { ...a, unlocked: true } : a);
    });
  };

  const heroAttack = (ability) => {
    if (battlePhase !== "player" || !enemy || !hero) return;
    const dmg = hero.stats.attack + Math.floor(Math.random() * 8) - 3;
    const newEnemyHp = Math.max(0, enemy.hp - dmg);
    const log = [{ text: `You use ${ability}! Deals ${dmg} damage.`, type: "hero" }];
    setEnemy(prev => ({ ...prev, hp: newEnemyHp }));

    if (newEnemyHp <= 0) {
      const xpGain = enemy.xpReward;
      const goldGain = enemy.goldReward;
      log.push({ text: `${enemy.name} is defeated! +${xpGain} XP, +${goldGain} Gold 💰`, type: "system" });
      setBattleLog(prev => [...prev, ...log]);
      setBattlePhase("end");
      setHero(prev => {
        const newXp = prev.stats.xp + xpGain;
        const newGold = prev.stats.gold + goldGain;
        const levelUp = newXp >= prev.stats.level * 100;
        const newLevel = levelUp ? prev.stats.level + 1 : prev.stats.level;
        const newMaxHp = levelUp ? prev.stats.maxHp + 10 : prev.stats.maxHp;
        const newHp = levelUp ? newMaxHp : prev.stats.hp;
        if (levelUp) {
          setTimeout(() => notify(`⬆️ Level Up! Now level ${newLevel}!`, "#F0C040"), 300);
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
        setBattleLog(prev => [...prev, { text: `${enemy.name} strikes back for ${eDmg} damage!`, type: "enemy" }]);
        setHero(prev2 => ({ ...prev2, stats: { ...prev2.stats, hp: newHp } }));
        if (newHp <= 0) {
          setBattleLog(prev => [...prev, { text: "⚰ You have fallen... Rest and try again.", type: "system" }]);
          setBattlePhase("end");
          setTimeout(() => {
            setHero(prev2 => ({ ...prev2, stats: { ...prev2.stats, hp: prev2.stats.maxHp } }));
            setScreen("map");
            notify("Defeated... but you rise again.", "#D46060");
          }, 2000);
        } else {
          setBattlePhase("player");
        }
      }, 800);
    }
  };

  const usePotion = () => {
    const potion = inventory.find(i => i.id === "potion");
    if (!potion) { notify("No potions left!", "#D46060"); return; }
    setHero(prev => ({ ...prev, stats: { ...prev.stats, hp: Math.min(prev.stats.maxHp, prev.stats.hp + 30) } }));
    setInventory(prev => prev.filter(i => i.id !== "potion"));
    notify("Used Health Potion! +30 HP 🧪", "#6DAF7C");
  };

  const s = {
    root: { fontFamily: "'Cinzel', serif", background: "#080604", minHeight: "100vh", color: "#C8A96E", position: "relative", overflow: "hidden" },
    overlay: { position: "fixed", inset: 0, background: "radial-gradient(ellipse at 50% 0%, #1A1005 0%, #080604 70%)", pointerEvents: "none", zIndex: 0 },
    content: { position: "relative", zIndex: 1, minHeight: "100vh" },
  };

  return (
    <>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0D0A07; }
        ::-webkit-scrollbar-thumb { background: #3A2E1E; border-radius: 2px; }
        @keyframes flicker { 0%,100%{opacity:1} 50%{opacity:.85} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 8px #C8A96E44} 50%{box-shadow:0 0 20px #C8A96E88} }
        @keyframes shimmer { from{background-position:200% center} to{background-position:-200% center} }
        .notif { animation: fadeIn 0.3s ease; }
        .ability-btn:hover { background: #3A2E1E !important; border-color: #C8A96E !important; }
        .class-card:hover { border-color: #C8A96E !important; transform: translateY(-4px); }
        .class-card { transition: border-color 0.2s, transform 0.2s; }
        .nav-btn:hover { background: #2A1E0E !important; }
        .action-btn:hover { opacity: 0.85; }
        .gold-shimmer { background: linear-gradient(90deg, #C8A96E, #F0D090, #C8A96E); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 3s linear infinite; }
      `}</style>

      {notification && (
        <div className="notif" style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#1A1410", border: `1px solid ${notification.color}`, color: notification.color, padding: "10px 20px", borderRadius: 4, fontFamily: "'Crimson Text', serif", fontSize: 14, zIndex: 1000, boxShadow: `0 0 20px ${notification.color}44` }}>{notification.msg}</div>
      )}

      <div style={s.root}>
        <div style={s.overlay} />
        <div style={s.content}>

          {screen === "select" && (
            <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ textAlign: "center", marginBottom: 40, animation: "fadeIn 0.6s ease" }}>
                <div style={{ fontSize: 11, letterSpacing: 6, color: "#6A5030", marginBottom: 12, fontFamily: "'Crimson Text', serif" }}>— ANNO DOMINI —</div>
                <h1 className="gold-shimmer" style={{ fontSize: 42, fontFamily: "'Cinzel Decorative', serif", fontWeight: 700, lineHeight: 1.1 }}>REALM OF<br />SHADOWS</h1>
                <div style={{ width: 80, height: 1, background: "linear-gradient(90deg, transparent, #C8A96E, transparent)", margin: "16px auto" }} />
                <p style={{ fontFamily: "'Crimson Text', serif", color: "#8A7050", fontSize: 16, fontStyle: "italic" }}>Choose your path, brave adventurer</p>
              </div>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 700 }}>
                {Object.entries(CLASSES).map(([key, cls]) => (
                  <div key={key} className="class-card" onClick={() => startGame(key)} style={{ background: "#0F0C09", border: `1px solid #3A2E1E`, borderRadius: 8, padding: "28px 24px", width: 200, cursor: "pointer", textAlign: "center", animation: "fadeIn 0.6s ease" }}>
                    <div style={{ fontSize: 44, marginBottom: 12, animation: "flicker 3s ease-in-out infinite" }}>{cls.icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: cls.color, marginBottom: 6, letterSpacing: 1 }}>{cls.name}</div>
                    <div style={{ fontFamily: "'Crimson Text', serif", fontSize: 13, color: "#8A7050", fontStyle: "italic", marginBottom: 16 }}>{cls.desc}</div>
                    <div style={{ textAlign: "left" }}>
                      {[["HP", cls.stats.hp], ["MP", cls.stats.mp], ["ATK", cls.stats.attack], ["DEF", cls.stats.defense]].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'Crimson Text', serif", color: "#7A6040", marginBottom: 3 }}><span>{k}</span><span style={{ color: "#C8A96E" }}>{v}</span></div>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, padding: "8px 0", background: cls.color + "22", borderRadius: 3, fontSize: 12, color: cls.color, letterSpacing: 1 }}>SELECT</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {screen !== "select" && hero && (
            <div style={{ display: "flex", minHeight: "100vh" }}>
              <div style={{ width: 220, background: "#0A0806", borderRight: "1px solid #2A1E0E", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ textAlign: "center", paddingBottom: 12, borderBottom: "1px solid #2A1E0E" }}>
                  <div style={{ fontSize: 40, animation: "flicker 4s ease-in-out infinite", marginBottom: 6 }}>{CLASSES[heroClass]?.icon}</div>
                  <div style={{ fontSize: 14, color: CLASSES[heroClass]?.color, letterSpacing: 1, fontWeight: 600 }}>{hero.name}</div>
                  <div style={{ fontSize: 11, color: "#5A4020", fontFamily: "'Crimson Text', serif", marginBottom: 8 }}>Level {hero.stats.level} {CLASSES[heroClass]?.name}</div>
                  <StatBar value={hero.stats.hp} max={hero.stats.maxHp} color="#C0392B" label="HP" />
                  <StatBar value={hero.stats.mp} max={hero.stats.maxMp} color="#5B7BD4" label="MP" />
                  <StatBar value={hero.stats.xp} max={hero.stats.level * 100} color="#C8A96E" label="XP" />
                </div>
                <div style={{ fontSize: 11, fontFamily: "'Crimson Text', serif" }}>
                  {[["⚔ Attack", hero.stats.attack], ["🛡 Defense", hero.stats.defense], ["💰 Gold", hero.stats.gold]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", color: "#7A6040", marginBottom: 4 }}><span>{k}</span><span style={{ color: "#C8A96E" }}>{v}</span></div>
                  ))}
                </div>
                <div style={{ paddingTop: 8, borderTop: "1px solid #2A1E0E" }}>
                  <div style={{ fontSize: 9, letterSpacing: 4, color: "#4A3820", marginBottom: 8 }}>ABILITIES</div>
                  {CLASSES[heroClass]?.abilities.map(a => <div key={a} style={{ fontSize: 12, fontFamily: "'Crimson Text', serif", color: "#8A7050", padding: "3px 6px", marginBottom: 2 }}>· {a}</div>)}
                </div>
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {[["🗺 3D World", "map"], ["🎒 Inventory", "inventory"], ["🏆 Achievements", "achievements"]].map(([label, sc]) => (
                    <button key={sc} className="nav-btn" onClick={() => setScreen(sc)} style={{ background: screen === sc ? "#2A1E0E" : "transparent", border: `1px solid ${screen === sc ? "#C8A96E" : "#2A1E0E"}`, color: screen === sc ? "#C8A96E" : "#6A5030", fontFamily: "'Cinzel', serif", fontSize: 11, padding: "8px 10px", borderRadius: 3, cursor: "pointer", textAlign: "left", letterSpacing: 0.5 }}>{label}</button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 24px", borderBottom: "1px solid #1A1208", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 9, letterSpacing: 5, color: "#4A3820", textTransform: "uppercase" }}>
                    {screen === "map" ? "REALM OF SHADOWS — 3D LABYRINTH" : screen === "battle" ? `⚔ BATTLE — ${zone?.name}` : screen === "inventory" ? "🎒 INVENTORY" : "🏆 ACHIEVEMENTS"}
                  </div>
                </div>

                {screen === "map" && (
                  <div style={{ flex: 1, position: "relative", background: "#000" }}>
                    <Raycaster onEncounter={triggerRandomEncounter} />
                    <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", padding: "10px 20px", borderRadius: "8px", border: "1px solid #3A2E1E" }}>
                      <p style={{ fontFamily: "'Crimson Text', serif", color: "#C8A96E", fontSize: 14, fontStyle: "italic", textAlign: "center", margin: 0 }}>Use W, A, S, D or Arrows to explore. Find the hidden enemy to engage!</p>
                    </div>
                  </div>
                )}

                {screen === "battle" && enemy && (
                  <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.4s ease" }}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ flex: 1, background: "#0D0A07", border: "1px solid #2A1E0E", borderRadius: 8, padding: 20, textAlign: "center" }}>
                        <div style={{ fontSize: 9, letterSpacing: 4, color: "#4A3820", marginBottom: 12 }}>ENEMY</div>
                        <div style={{ fontSize: 64, animation: enemy.hp > 0 ? "flicker 2s ease-in-out infinite" : "none", opacity: enemy.hp <= 0 ? 0.3 : 1 }}>{enemy.icon}</div>
                        <div style={{ fontSize: 16, color: "#D46060", marginTop: 8, marginBottom: 12, letterSpacing: 1 }}>{enemy.name}</div>
                        <StatBar value={enemy.hp} max={enemy.maxHp} color="#C0392B" label="HP" />
                        <div style={{ fontSize: 11, fontFamily: "'Crimson Text', serif", color: "#5A4020", marginTop: 8 }}>⚔ ATK: {enemy.attack}</div>
                      </div>
                      <div style={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 12 }}>
                        <BattleLog logs={battleLog} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 9, letterSpacing: 4, color: "#4A3820", marginBottom: 2 }}>YOUR ABILITIES</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {CLASSES[heroClass]?.abilities.map(ab => (
                              <button key={ab} className="ability-btn action-btn" onClick={() => heroAttack(ab)} disabled={battlePhase !== "player" || enemy.hp <= 0} style={{ background: "#15100A", border: "1px solid #3A2E1E", color: battlePhase === "player" && enemy.hp > 0 ? "#C8A96E" : "#4A3820", fontFamily: "'Cinzel', serif", fontSize: 12, padding: "10px 16px", borderRadius: 3, cursor: battlePhase === "player" && enemy.hp > 0 ? "pointer" : "not-allowed", letterSpacing: 0.5, flex: 1 }}>{ab}</button>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="action-btn" onClick={usePotion} style={{ background: "#0D1A0D", border: "1px solid #2A4020", color: "#6DAF7C", fontFamily: "'Cinzel', serif", fontSize: 11, padding: "8px 14px", borderRadius: 3, cursor: "pointer", flex: 1 }}>🧪 Use Potion {inventory.find(i => i.id === "potion") ? "" : "(0)"}</button>
                            <button className="action-btn" onClick={() => setScreen("map")} style={{ background: "#1A0D0D", border: "1px solid #3A2020", color: "#D46060", fontFamily: "'Cinzel', serif", fontSize: 11, padding: "8px 14px", borderRadius: 3, cursor: "pointer", flex: 1 }}>🚪 Flee to Maze</button>
                          </div>
                        </div>
                        {battlePhase === "end" && enemy.hp <= 0 && <button className="action-btn" onClick={() => setScreen("map")} style={{ background: "#1A1A0A", border: "1px solid #C8A96E", color: "#C8A96E", fontFamily: "'Cinzel', serif", fontSize: 13, padding: "12px", borderRadius: 3, cursor: "pointer", animation: "pulse 2s infinite", letterSpacing: 1 }}>RETURN TO EXPLORATION →</button>}
                      </div>
                    </div>
                  </div>
                )}

                {screen === "inventory" && (
                  <div style={{ flex: 1, padding: 24, animation: "fadeIn 0.4s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      {inventory.map(item => (
                        <div key={item.id} style={{ background: "#0D0A07", border: "1px solid #2A1E0E", borderRadius: 6, padding: 16, textAlign: "center" }}>
                          <div style={{ fontSize: 36, marginBottom: 8 }}>{item.icon}</div>
                          <div style={{ fontSize: 13, color: "#C8A96E", marginBottom: 4, letterSpacing: 0.5 }}>{item.name}</div>
                          <div style={{ fontSize: 11, fontFamily: "'Crimson Text', serif", color: "#5A9060" }}>{item.bonus}</div>
                          <div style={{ fontSize: 10, color: "#4A3820", marginTop: 4, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Crimson Text', serif" }}>{item.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {screen === "achievements" && (
                  <div style={{ flex: 1, padding: 24, animation: "fadeIn 0.4s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                      {achievements.map(a => (
                        <div key={a.id} style={{ background: "#0D0A07", border: `1px solid ${a.unlocked ? "#C8A96E44" : "#2A1E0E"}`, borderRadius: 6, padding: 16, display: "flex", gap: 12, alignItems: "center", opacity: a.unlocked ? 1 : 0.5 }}>
                          <div style={{ fontSize: 30, filter: a.unlocked ? "none" : "grayscale(1)" }}>{a.icon}</div>
                          <div>
                            <div style={{ fontSize: 13, color: a.unlocked ? "#C8A96E" : "#5A4020", letterSpacing: 0.5, marginBottom: 4 }}>{a.name}</div>
                            <div style={{ fontSize: 12, fontFamily: "'Crimson Text', serif", color: "#5A4020", fontStyle: "italic" }}>{a.desc}</div>
                            {a.unlocked && <div style={{ fontSize: 10, color: "#6DAF7C", marginTop: 4, letterSpacing: 2 }}>UNLOCKED ✓</div>}
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
