import React, { useRef } from 'react';
import { useGame } from '../context/GameContext';
import { formatNumber } from '../utils/numberFormat';
import { PETS, RELICS } from '../data/definitions';
import { ShieldAlert, Swords, Zap, Crosshair, RefreshCw } from 'lucide-react';

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
    autoAttackUnlocked,
    autoAttackInterval,
    activePetId,
    activeRelicId,
    activeCosmeticId,
  } = useGame();

  const arenaRef = useRef<HTMLDivElement>(null);
  const hpPercent = Math.max(0, Math.min(100, (enemyHp / enemyMaxHp) * 100));
  const bossTimePercent = Math.max(0, Math.min(100, (bossTimer / 30.0) * 100));

  const activePetDef = PETS.find((p) => p.id === activePetId);
  const activeRelicDef = RELICS.find((r) => r.id === activeRelicId);

  // Cosmetic Trail Color
  const getTrailColor = () => {
    switch (activeCosmeticId) {
      case 'trail_ember': return '#FF8A28';
      case 'trail_frost': return '#3EDCFA';
      case 'trail_crystal': return '#FF6EC0';
      case 'trail_verdant': return '#6ADC3E';
      case 'trail_aureate': return '#FFD23C';
      default: return '#A85CFF'; // void
    }
  };

  return (
    <div
      ref={arenaRef}
      onClick={handleTap}
      className="relative w-full h-[290px] sm:h-[330px] bg-[#08080C] border-b border-[#4E4E66] overflow-hidden flex flex-col justify-between p-3 select-none cursor-crosshair shrink-0"
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 60%, #171722 0%, #08080C 75%)',
      }}
    >
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#4E4E66 1px, transparent 1px), linear-gradient(90deg, #4E4E66 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Combat State & Controls */}
      <div className="relative z-10 flex items-center justify-between w-full">
        {/* Left: Quick Player Stats HUD */}
        <div className="flex items-center gap-2 bg-[#171722]/90 border border-[#4E4E66] px-2 py-1 text-[11px]">
          <div className="flex items-center gap-1 text-[#F6F6FC]">
            <Swords size={12} className="text-[#FF3A46]" />
            <span>{formatNumber(tapDamage)}</span>
          </div>
          <span className="text-[#4E4E66]">|</span>
          <div className="flex items-center gap-1 text-[#FFD23C]">
            <Crosshair size={12} />
            <span>{(critChance * 100).toFixed(1)}%</span>
          </div>
          {autoAttackUnlocked && (
            <>
              <span className="text-[#4E4E66]">|</span>
              <div className="flex items-center gap-1 text-[#6ADC3E]" title="Auto Attack">
                <Zap size={12} />
                <span>{(1 / autoAttackInterval).toFixed(1)}/s</span>
              </div>
            </>
          )}
        </div>

        {/* Right: Boss / Farm Mode Actions */}
        <div className="flex items-center gap-1.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {combatState === 'NORMAL' && enemyLevel % 10 === 9 && (
            <button
              onClick={startBossFight}
              className="px-2 py-1 text-xs bg-[#B01228] border border-[#FF3A46] text-[#F6F6FC] font-bold hover:bg-[#FF3A46] transition-colors flex items-center gap-1"
            >
              <ShieldAlert size={13} /> CHALLENGE GATE
            </button>
          )}

          {combatState === 'FARM_MODE' ? (
            <button
              onClick={startBossFight}
              className="px-2.5 py-1 text-xs bg-[#B01228] border border-[#FF3A46] text-[#F6F6FC] font-bold hover:bg-[#FF3A46] transition-colors flex items-center gap-1"
            >
              <ShieldAlert size={13} /> RETRY BOSS
            </button>
          ) : (
            <button
              onClick={toggleFarmMode}
              className="px-2 py-1 text-xs bg-[#2C2C3C] border border-[#4E4E66] text-[#8686A2] hover:text-[#F6F6FC] hover:border-[#8686A2] transition-colors flex items-center gap-1"
              title="Toggle Farm Mode"
            >
              <RefreshCw size={12} /> {combatState === 'BOSS_FIGHT' ? 'FALLBACK' : 'FARM'}
            </button>
          )}
        </div>
      </div>

      {/* Floating Active Pet / Relic badges */}
      <div className="absolute left-3 bottom-14 z-10 flex flex-col gap-1.5 pointer-events-none">
        {activePetDef && (
          <div className="flex items-center gap-1.5 bg-[#171722]/80 border border-[#4E4E66] px-1.5 py-0.5">
            <img
              src={activePetDef.stageSprites[0]}
              alt={activePetDef.id}
              className="w-5 h-5 object-contain pixelated"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-[10px] text-[#C8C8DA]">{activePetDef.stageNames[0]}</span>
          </div>
        )}
        {activeRelicDef && (
          <div className="flex items-center gap-1.5 bg-[#171722]/80 border border-[#4E4E66] px-1.5 py-0.5">
            <img
              src={activeRelicDef.sigil}
              alt={activeRelicDef.id}
              className="w-4 h-4 object-contain pixelated"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-[10px] text-[#3EDCFA] truncate max-w-[80px]">{activeRelicDef.displayName}</span>
          </div>
        )}
      </div>

      {/* Center Enemy Sprite & Visuals */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div
          className={`relative transition-transform duration-100 flex items-center justify-center ${
            isEnemyHit ? 'anim-enemy-hit scale-95' : ''
          } ${currentEnemy.isBoss ? 'anim-boss-glow' : ''}`}
        >
          {/* Sprite image */}
          <img
            src={currentEnemy.texture}
            alt={currentEnemy.displayName}
            className="w-28 h-28 sm:w-32 sm:h-32 object-contain pixelated drop-shadow-2xl"
            onError={(e) => {
              // Fallback placeholder if texture not ready
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          {/* Hit flare ring effect */}
          {isEnemyHit && (
            <div
              className="absolute inset-0 rounded-full opacity-60 pointer-events-none animate-ping"
              style={{ backgroundColor: getTrailColor() }}
            />
          )}
        </div>

        {/* Enemy Name & Boss indicator */}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-xs sm:text-sm font-bold text-[#F6F6FC] tracking-wide">
            {currentEnemy.displayName}
          </span>
          {currentEnemy.isBoss && (
            <span className="bg-[#FF3A46] text-[#08080C] text-[9px] font-bold px-1 py-0.2">
              BOSS
            </span>
          )}
        </div>
      </div>

      {/* Floating Damage Numbers */}
      {damageNumbers.map((num) => (
        <div
          key={num.id}
          className="absolute z-20 pointer-events-none font-bold text-sm sm:text-base anim-damage"
          style={{
            left: `${num.x}px`,
            top: `${num.y}px`,
            color: num.isCrit ? '#FFD23C' : getTrailColor(),
            textShadow: num.isCrit ? '0 0 6px #FF3A46' : '0 0 4px #08080C',
          }}
        >
          {num.isCrit ? `CRIT! -${formatNumber(num.amount)}` : `-${formatNumber(num.amount)}`}
        </div>
      ))}

      {/* Bottom Health Bar & Boss Timer */}
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-1">
        {/* Boss countdown timer bar */}
        {combatState === 'BOSS_FIGHT' && (
          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] text-[#FF3A46] font-bold shrink-0">
              TIME: {bossTimer.toFixed(1)}s
            </span>
            <div className="w-full h-1.5 bg-[#08080C] border border-[#B01228] overflow-hidden">
              <div
                className="h-full bg-[#FF3A46] transition-all duration-100 ease-linear"
                style={{ width: `${bossTimePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* HP Bar */}
        <div className="relative w-full h-5 bg-[#08080C] border border-[#4E4E66] overflow-hidden flex items-center justify-center">
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#B01228] border-r border-[#FF3A46] transition-all duration-75 ease-out"
            style={{ width: `${hpPercent}%` }}
          />
          <span className="relative z-10 text-[11px] font-bold text-[#F6F6FC] drop-shadow">
            {formatNumber(enemyHp)} / {formatNumber(enemyMaxHp)} ({hpPercent.toFixed(0)}%)
          </span>
        </div>
      </div>
    </div>
  );
};
