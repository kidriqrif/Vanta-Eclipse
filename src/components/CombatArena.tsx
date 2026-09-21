import React, { useRef, useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { PETS, RELICS } from '../data/definitions';
import { ShieldAlert, Crosshair, RefreshCw, Zap, Activity } from 'lucide-react';

export const CombatArena: React.FC = () => {
  const {
    enemyLevel,
    combatState,
    currentEnemy,
    enemyHp,
    enemyMaxHp,
    bossTimer,
    handleTap,
    startBossFight,
    leaveBossFight,
    toggleFarmMode,
    damageNumbers,
    isEnemyHit,
    tapDamage,
    critChance,
    critDamage,
    autoAttackUnlocked,
    autoAttackInterval,
    activePetId,
    activeRelicId,
    activeCosmeticId,
  } = useGame();

  const arenaRef = useRef<HTMLDivElement>(null);
  const [ghostHpPercent, setGhostHpPercent] = useState<number>(100);
  const [comboCount, setComboCount] = useState<number>(0);
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  
  // Autoclicker Penalty State
  const [clickTimestamps, setClickTimestamps] = useState<number[]>([]);
  const [penaltyUntil, setPenaltyUntil] = useState<number>(0);
  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState<number>(0);

  const hpPercent = Math.max(0, Math.min(100, (enemyHp / enemyMaxHp) * 100));
  const bossTimePercent = Math.max(0, Math.min(100, (bossTimer / 30.0) * 100));

  // Ghost health bar animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setGhostHpPercent(hpPercent);
    }, 150);
    return () => clearTimeout(timer);
  }, [hpPercent]);

  // Combo decay & penalty timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastTapTime > 1500 && comboCount > 0) {
        setComboCount(0);
      }
      if (penaltyUntil > now) {
        setPenaltyTimeLeft(Math.ceil((penaltyUntil - now) / 1000));
      } else if (penaltyTimeLeft > 0) {
        setPenaltyTimeLeft(0);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [comboCount, lastTapTime, penaltyUntil, penaltyTimeLeft]);

  const onArenaTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (penaltyUntil > now) return; // Block clicks during penalty

    // Track clicks for autoclicker detection (limit 15 CPS)
    setClickTimestamps((prev) => {
      const recent = prev.filter(t => now - t < 1000);
      recent.push(now);
      if (recent.length >= 15) {
        // Trigger Penalty (10 seconds)
        setPenaltyUntil(now + 10000);
        setPenaltyTimeLeft(10);
        return [];
      }
      return recent;
    });

    setLastTapTime(now);
    setComboCount((prev) => Math.min(999, prev + 1));
    handleTap(e);
  };

  const activePetDef = PETS.find((p) => p.id === activePetId);
  const activeRelicDef = RELICS.find((r) => r.id === activeRelicId);

  return (
    <div
      ref={arenaRef}
      onClick={onArenaTap}
      className="relative w-full h-[280px] sm:h-[310px] bg-[#080A12] border-b border-[#30395C] overflow-hidden flex flex-col justify-between p-3 select-none cursor-crosshair shrink-0 "
    >
      {/* 1px Neon Tactical Grid Lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: 'linear-gradient(rgba(48, 57, 92, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(48, 57, 92, 0.25) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Combat Telemetry Bar */}
      <div className="relative z-10 flex items-center justify-between w-full">
        {/* Left: Player Combat Telemetry */}
        <div className="flex items-center gap-2 bg-[#080A12] border border-[#30395C] px-3 py-1 rounded-full shadow-[0_0_10px_rgba(54,217,255,0.1)]">
          <div className="flex items-center gap-1 text-[#E8EDF7]">
            <span className="text-[10px] font-tech text-[#36D9FF]">DPS:</span>
            <span className="text-xs font-mono-code font-bold text-[#E8EDF7]">
              {autoAttackUnlocked ? formatNumber(tapDamage * (1 / autoAttackInterval)) : 0}
            </span>
          </div>
          <span className="text-[#30395C]">|</span>
          <div className="flex items-center gap-1 text-[#E8EDF7]">
            <span className="text-[10px] font-tech text-[#36D9FF]">TAP:</span>
            <span className="text-xs font-mono-code font-bold text-[#E8EDF7]">{formatNumber(tapDamage)}</span>
          </div>
        </div>

        {/* Right: Crit Stats */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 pointer-events-auto bg-[#080A12] border border-[#FF4268]/50 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(255,66,104,0.15)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 text-[#E8EDF7]">
              <span className="text-[10px] font-tech text-[#FFC857]">CRIT:</span>
              <span className="text-xs font-mono-code font-bold text-[#FFC857]">{(critChance * 100).toFixed(1)}%</span>
              <span className="text-[10px] font-mono-code font-bold text-[#FF4268] ml-1">x{critDamage.toFixed(1)}</span>
            </div>
          </div>
          
          {/* Right: Combat State Buttons */}
          <div className="flex items-center gap-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {combatState === 'NORMAL' && enemyLevel % 10 === 9 && (
              <button
                onClick={startBossFight}
                className="px-3 py-1 text-xs bg-[#171D35] hover:bg-[#FF4268] hover:text-[#080A12] border border-[#FF4268] text-[#FF4268] font-display font-bold flex items-center gap-1 shadow-[0_0_10px_rgba(255,66,104,0.4)] animate-pulse transition-colors"
              >
                <ShieldAlert size={12} />
                <span>ENGAGE BOSS</span>
              </button>
            )}

            {combatState === 'FARM_MODE' ? (
              <button
                onClick={startBossFight}
                className="px-3 py-1 text-xs bg-[#171D35] hover:bg-[#FF4268] hover:text-[#080A12] border border-[#FF4268] text-[#FF4268] font-display font-bold flex items-center gap-1 transition-colors"
              >
                <ShieldAlert size={12} />
                <span>RETRY BOSS</span>
              </button>
            ) : (
              <button
                onClick={toggleFarmMode}
                className="px-2.5 py-1 text-[9px] bg-[#101426] hover:bg-[#17283A] active:bg-[#36D9FF] active:text-[#080A12] border border-[#36D9FF] hover:border-[#7CF2FF] text-[#36D9FF] hover:text-[#7CF2FF] font-display font-bold flex items-center gap-1 transition-all rounded-none"
                title="Toggle Farm Mode"
              >
                <span>{combatState === 'BOSS_FIGHT' ? 'ABORT' : 'AUTO'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Auxiliary Loadout Tags */}
      <div className="absolute left-3 bottom-14 z-10 flex flex-col gap-1 pointer-events-none">
        {activePetDef && (
          <div className="flex items-center gap-1.5 bg-[#101426] border border-[#30395C] px-1.5 py-0.5 rounded-none">
            <span className="text-[8px] font-tech text-[#8993B2]">PET:</span>
            <span className="text-[9px] font-mono-code font-bold text-[#36D9FF]">{activePetDef.stageNames[0]}</span>
          </div>
        )}
        {activeRelicDef && (
          <div className="flex items-center gap-1.5 bg-[#101426] border border-[#30395C] px-1.5 py-0.5 rounded-none">
            <span className="text-[8px] font-tech text-[#8993B2]">RELIC:</span>
            <span className="text-[9px] font-mono-code font-bold text-[#FFC857] truncate max-w-[90px]">
              {activeRelicDef.displayName}
            </span>
          </div>
        )}
      </div>

      {/* Dynamic Hit Combo */}
      {comboCount >= 3 && (
        <div className="absolute right-3 top-12 z-10 flex flex-col items-end pointer-events-none">
          <div className="bg-[#101426] border border-[#FFC857] px-2 py-0.5 rounded-none flex items-center gap-1 shadow-[0_0_8px_rgba(255,200,87,0.3)]">
            <span className="text-[10px] font-display font-black text-[#FFC857] uppercase tracking-wider">
              {comboCount} STRIKES
            </span>
          </div>
          <span className="text-[8px] font-mono-code text-[#8993B2] mt-0.5">
            +{Math.min(25, Math.floor(comboCount / 3) * 2)}% DAMAGE
          </span>
        </div>
      )}

      {/* Center Target Sprite & Frameless Identifier */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto pointer-events-none mt-6">
        <div className="relative flex items-center justify-center w-40 h-40">
          {/* Subtle cyan/indigo radial glow behind monster */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none transition-all duration-300"
            style={{
              background: currentEnemy.isBoss
                ? 'radial-gradient(circle, rgba(255, 66, 104, 0.22) 0%, rgba(255, 200, 87, 0.12) 35%, rgba(16, 20, 38, 0.6) 60%, transparent 75%)'
                : 'radial-gradient(circle, rgba(54, 217, 255, 0.2) 0%, rgba(48, 57, 92, 0.15) 40%, transparent 75%)',
              filter: 'blur(8px)',
            }}
          />

          {/* Dotted/Dashed Rings */}
          <div className="absolute w-[130%] h-[130%] rounded-full border-[1.5px] border-dashed border-[#FF4268]/60 animate-[spin_20s_linear_infinite]" />
          <div className="absolute w-[110%] h-[110%] rounded-full border border-[#36D9FF]/40" />

          {/* Sprite image with shape-following hit reactions and boss aura */}
          <img
            src={currentEnemy.texture}
            alt={currentEnemy.displayName}
            className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 object-contain pixelated transition-transform duration-75 select-none ${
              currentEnemy.isBoss
                ? isEnemyHit
                  ? 'anim-boss-hit'
                  : 'anim-boss-idle'
                : isEnemyHit
                ? 'anim-enemy-hit'
                : 'anim-enemy-idle'
            }`}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Frameless Enemy Identification Text */}
        <div className="mt-6 flex flex-col items-center justify-center gap-1.5 text-center">
          <div className="flex items-center gap-2 border border-[#FF4268]/40 rounded-full px-3 py-1 bg-[#080A12]/80">
            <span className="w-1.5 h-1.5 bg-[#FF4268] rounded-full shadow-[0_0_6px_#FF4268]"></span>
            <span className="text-[8px] font-tech text-[#8993B2] uppercase tracking-[0.15em]">
              TIER {(currentEnemy as any).tier || 'II'} // {currentEnemy.isBoss ? 'BOSS ANOMALY' : 'ELITE ANOMALY'}
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-display font-bold text-[#E8EDF7] tracking-[0.15em] uppercase"
                style={{ 
                  WebkitTextStroke: '1px #36D9FF', 
                  color: 'transparent',
                  textShadow: '0 0 12px rgba(54, 217, 255, 0.4)'
                }}>
            {currentEnemy.displayName}
          </span>
        </div>
      </div>

      {/* Floating Damage Readouts */}
      {damageNumbers.map((num) => (
        <div
          key={num.id}
          className="absolute z-20 pointer-events-none font-display font-bold text-xs sm:text-sm anim-damage"
          style={{
            left: `${num.x}px`,
            top: `${num.y}px`,
            color: num.isCrit ? '#FFC857' : '#36D9FF',
            textShadow: num.isCrit
              ? '0 0 10px #FFC857, 0 0 20px rgba(255, 200, 87, 0.7)'
              : '0 0 8px rgba(54, 217, 255, 0.8)',
          }}
        >
          {num.isCrit ? `CRITICAL! -${formatNumber(num.amount)}` : `-${formatNumber(num.amount)}`}
        </div>
      ))}

      {/* Autoclicker Penalty Overlay */}
      {penaltyTimeLeft > 0 && (
        <div className="absolute inset-0 z-50 bg-[#080A12]/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center pointer-events-auto">
          <ShieldAlert size={32} className="text-[#FF4268] mb-2 animate-pulse" />
          <h3 className="font-display font-bold text-lg text-[#FF4268] mb-1">UNAUTHORIZED OVERRIDE</h3>
          <p className="font-tech text-xs text-[#8993B2] max-w-[250px] mb-4">
            Autoclicker detected. Engaging neural dampener. Wait for system calibration.
          </p>
          <div className="font-mono-code font-bold text-2xl text-[#FFC857]">
            {penaltyTimeLeft}s
          </div>
        </div>
      )}

      {/* Bottom Health Gauge Matrix */}
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-1.5 mt-2">
        <div className="flex justify-between items-end px-1">
          <span className="text-[10px] font-tech text-[#36D9FF] tracking-widest uppercase">INTEGRITY MATRIX</span>
          <span className="text-[10px] font-mono-code text-[#E8EDF7]">
            <span className="text-[#36D9FF] font-bold">{formatNumber(enemyHp)}</span> / {formatNumber(enemyMaxHp)} <span className="text-[#FF4268]">({hpPercent.toFixed(0)}%)</span>
          </span>
        </div>

        {/* Sharp Rectangular Tactical HP Bar with chamfer */}
        <div 
          className="relative w-full h-3 bg-[#080A12] border border-[#30395C] shadow-[inset_0_0_10px_rgba(48,57,92,0.8)]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}
        >
          {/* Ghost Trail */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#E8EDF7]/20 transition-all duration-300"
            style={{ width: `${ghostHpPercent}%` }}
          />

          {/* Primary HP Fill - Gradient */}
          <div
            className="absolute left-0 top-0 bottom-0 transition-all duration-75 shadow-[0_0_10px_#36D9FF]"
            style={{ 
              width: `${hpPercent}%`,
              background: 'linear-gradient(90deg, #36D9FF 0%, #A78BFA 50%, #FF4268 100%)'
            }}
          />
        </div>

        {/* Status Effects / Debuffs */}
        <div className="flex items-center gap-2 mt-0.5">
          {/* Example static status effects based on design - we'll just show active pet/relic buffs here if possible, or static placeholders if empty */}
          {activePetId && (
            <div className="flex items-center gap-1 border border-[#FF4268]/40 bg-[#101426] px-2 py-0.5" style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}>
              <Zap size={8} className="text-[#FF4268]" />
              <span className="text-[7px] font-tech text-[#FF4268] uppercase tracking-wider">VOID CORROSION</span>
            </div>
          )}
          {activeRelicId && (
            <div className="flex items-center gap-1 border border-[#36D9FF]/40 bg-[#101426] px-2 py-0.5" style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}>
              <Zap size={8} className="text-[#36D9FF]" />
              <span className="text-[7px] font-tech text-[#36D9FF] uppercase tracking-wider">PHASE LOCK</span>
            </div>
          )}
        </div>

        {/* Boss Timer Gauge */}
        {combatState === 'BOSS_FIGHT' && (
          <div className="w-full flex items-center gap-2 mt-1">
            <span className="text-[9px] font-tech font-bold text-[#FF4268] shrink-0">
              LOCKOUT: {bossTimer.toFixed(1)}s
            </span>
            <div className="w-full h-1 bg-[#171D35] border border-[#FF4268]/40 overflow-hidden">
              <div
                className="h-full bg-[#FF4268] shadow-[0_0_6px_#FF4268]"
                style={{ width: `${bossTimePercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
