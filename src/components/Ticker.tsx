import React from 'react';
import { AUTO_ATTACK_UNLOCK_LEVEL, type GameState } from '../game/state';
import { useGameState, useStats } from '../hooks/useGame';
import { formatNumber } from '../utils/numberFormat';

const selectEssence = (s: GameState) => s.currencies.essence;

const Cell: React.FC<{ label: string; value: string; tone: string; wide?: boolean }> = ({ label, value, tone, wide }) => (
  <div className={`min-w-0 flex items-baseline justify-center gap-1.5 px-1.5 border-r border-line last:border-r-0 ${wide ? 'flex-[1.4]' : 'flex-1'}`}>
    <span className="shrink-0 text-[9px] font-tech text-dim tracking-wider">{label}</span>
    <span className={`min-w-0 truncate font-mono-code font-bold leading-none ${wide ? 'text-sm' : 'text-xs'} ${tone}`}>{value}</span>
  </div>
);

/**
 * The data ticker between the arena and the tabs: essence in the bank, what it earns per second,
 * damage per second and per tap. One thin, high-contrast ribbon that never scrolls.
 */
export const Ticker: React.FC = () => {
  const essence = useGameState(selectEssence);
  const stats = useStats();
  return (
    <div
      role="group"
      aria-label="Stats"
      className="min-h-[36px] h-full flex items-center bg-abyss border-y-2 border-line shadow-[inset_0_2px_0_0_rgba(0,0,0,0.6)]"
    >
      <Cell label="ESSENCE" value={formatNumber(essence)} tone="text-neon" wide />
      {/* Before auto-attack, the cells say when it arrives instead of showing zeros. */}
      <Cell label="/SEC" value={stats.autoAttackUnlocked ? formatNumber(stats.liveEssenceRate) : '—'} tone="text-toxic" />
      <Cell
        label="DPS"
        value={stats.autoAttackUnlocked ? formatNumber(stats.dps) : `LV${formatNumber(AUTO_ATTACK_UNLOCK_LEVEL)}`}
        tone={stats.autoAttackUnlocked ? 'text-gold' : 'text-dim'}
      />
      <Cell label="TAP" value={formatNumber(stats.tapDamage)} tone="text-ink" />
    </div>
  );
};
