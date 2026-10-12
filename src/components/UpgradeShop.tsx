import React, { useCallback, useState } from 'react';
import { Crosshair, Flame, Gem, Target, Zap, type LucideIcon } from 'lucide-react';
import { UPGRADES } from '../data/definitions';
import type { UpgradeDefinition } from '../types/game';
import { affordableUpgrades, upgradeCost } from '../game/reducer';
import type { GameState } from '../game/state';
import { shallowEqual, useDispatch, useGameState, useStats } from '../hooks/useGame';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { PanelHeader, TabBody } from './ui';

type Want = 1 | 10 | 25 | 'max';

const WANTS: { want: Want; label: string }[] = [
  { want: 1, label: 'x1' },
  { want: 10, label: 'x10' },
  { want: 25, label: 'x25' },
  { want: 'max', label: 'MAX' },
];

/** The buy size survives tab switches for the session. */
let lastWant: Want = 1;

const SORTED_UPGRADES = [...UPGRADES].sort((a, b) => a.sortOrder - b.sortOrder);

/** How each upgrade stat reads in a sentence, and its accent. Unknown stats fall back to the display name. */
const STAT_COPY: Record<string, { noun: string; icon: LucideIcon; tone: string }> = {
  'tap_damage:ADDITIVE': { noun: 'tap damage', icon: Zap, tone: 'text-neon border-neon/50 bg-neon/10' },
  'tap_damage:PERCENT': { noun: 'tap damage', icon: Flame, tone: 'text-purple border-purple/50 bg-purple/10' },
  'crit_chance:ADDITIVE': { noun: 'crit chance', icon: Target, tone: 'text-gold border-gold/50 bg-gold/10' },
  'crit_damage:ADDITIVE': { noun: 'crit damage', icon: Crosshair, tone: 'text-crimson border-crimson/50 bg-crimson/10' },
  'essence_gain:PERCENT': { noun: 'essence from kills', icon: Gem, tone: 'text-toxic border-toxic/50 bg-toxic/10' },
};
const FALLBACK_TONE = 'text-neon border-neon/50 bg-neon/10';

/** "+10%", "+0.5%": a decimal only when the value needs one. */
function pct(v: number): string {
  const hundredths = Math.round(v * 10000);
  return formatPercent(v, hundredths % 100 === 0 ? 0 : 1);
}

/** "+1 tap damage per level · total +12", read from the definition rather than hard-coded. */
function effectText(def: UpgradeDefinition, level: number): string {
  const asPercent = def.modifierType === 'PERCENT' || def.displayAsPercent;
  const fmt = (v: number) => (asPercent ? pct(v) : `+${formatNumber(v)}`);
  const noun = STAT_COPY[`${def.stat}:${def.modifierType}`]?.noun ?? def.displayName.toLowerCase();
  const per = `${fmt(def.valuePerLevel)} ${noun} per level`;
  return level > 0 ? `${per} · total ${fmt(def.valuePerLevel * level)}` : per;
}

const selectEssence = (s: GameState) => s.currencies.essence;

const UpgradeRow: React.FC<{ def: UpgradeDefinition; want: Want }> = React.memo(({ def, want }) => {
  const dispatch = useDispatch();
  const level = useGameState(useCallback((s: GameState) => s.upgrades[def.id] || 0, [def.id]));
  const essence = useGameState(selectEssence);
  const offer = useGameState(
    useCallback((s: GameState) => affordableUpgrades(s, def.id, want), [def.id, want]),
    shallowEqual,
  );

  const copy = STAT_COPY[`${def.stat}:${def.modifierType}`];
  const Icon = copy?.icon ?? Zap;
  const maxed = def.maxLevel > 0 && level >= def.maxLevel;
  const isMax = want === 'max';
  // x1/x10/x25 are all or nothing (shrinking only to the room under maxLevel); MAX buys what it can.
  const canBuy = isMax ? offer.count > 0 : offer.limit > 0 && offer.count === offer.limit;
  const buyCount = isMax ? Math.max(1, offer.count) : offer.limit;
  const price = canBuy ? offer.cost : upgradeCost(level, def.id, buyCount);
  const shortBy = canBuy ? 0 : Math.max(0, Math.ceil(price - essence));

  const buy = () => {
    dispatch({ type: 'BUY_UPGRADE', id: def.id, count: want });
  };

  const per = `${def.modifierType === 'PERCENT' || def.displayAsPercent ? pct(def.valuePerLevel) : `+${formatNumber(def.valuePerLevel)}`} ${
    STAT_COPY[`${def.stat}:${def.modifierType}`]?.noun ?? def.displayName.toLowerCase()
  }/lv`;

  return (
    <div
      className={`shrink-0 h-11 flex items-stretch bg-panel border shadow-hard ${maxed ? 'border-line/60' : 'border-line'}`}
      title={effectText(def, level)}
    >
      <div className={`w-11 shrink-0 border-r flex items-center justify-center ${copy?.tone ?? FALLBACK_TONE}`}>
        <Icon size={20} aria-hidden />
      </div>

      <div className="flex-1 min-w-0 px-2 flex flex-col justify-center gap-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="min-w-0 truncate text-xs font-tech font-bold text-ink uppercase tracking-wide leading-none">{def.displayName}</span>
          <span key={level} className="animate-fade-in shrink-0 text-[10px] font-mono-code font-bold text-dim leading-none">
            LV {formatNumber(level)}
            {def.maxLevel > 0 && `/${formatNumber(def.maxLevel)}`}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 min-w-0 leading-none">
          {maxed ? (
            <span className="text-[11px] font-tech font-bold text-dim">MAXED</span>
          ) : (
            <span className={`shrink-0 text-[11px] font-mono-code font-bold ${canBuy ? 'text-neon' : 'text-crimson'}`}>
              {/* ● is essence; ◆ is Void Crystals, so the two never differ by colour alone. */}
              <span aria-hidden>● </span>
              {formatNumber(price)}
              {!canBuy && <span className="font-tech font-normal"> · need {formatNumber(shortBy)}</span>}
            </span>
          )}
          <span className="min-w-0 truncate text-[10px] font-tech text-dim">{per}</span>
        </div>
      </div>

      {maxed ? (
        <div className="w-[64px] shrink-0 border-l border-line bg-panel2 flex items-center justify-center text-[10px] font-tech font-bold text-dim">
          MAX
        </div>
      ) : (
        <button
          type="button"
          disabled={!canBuy}
          onClick={buy}
          aria-label={`Buy ${buyCount} ${def.displayName} for ${formatNumber(price)} essence${canBuy ? '' : ', not enough essence'}`}
          className={`w-[64px] shrink-0 border-l-2 flex flex-col items-center justify-center gap-0.5 font-tech font-bold uppercase transition-colors active:translate-y-0.5 active:border-amber-500 active:scale-[0.98] disabled:cursor-not-allowed ${
            canBuy ? 'bg-neon text-abyss border-neon hover:bg-neon-bright' : 'bg-panel2 text-faint border-line'
          }`}
        >
          <span className="text-xs leading-none">BUY</span>
          <span className="text-[10px] font-mono-code leading-none">×{formatNumber(buyCount)}</span>
        </button>
      )}
    </div>
  );
});
UpgradeRow.displayName = 'UpgradeRow';

const StatCell: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div className="bg-abyss border border-line px-1.5 h-9 flex flex-col items-center justify-center min-w-0">
    <span className="text-[8px] font-tech text-dim uppercase tracking-wider leading-none">{label}</span>
    <span className={`text-xs font-mono-code font-bold truncate max-w-full leading-tight ${tone}`}>{value}</span>
  </div>
);

/** The UPGRADES tab: run upgrades bought with essence. An Eclipse resets them. */
export const UpgradeShop: React.FC = () => {
  const stats = useStats();
  const [want, setWant] = useState<Want>(lastWant);

  const choose = (w: Want) => {
    lastWant = w;
    setWant(w);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<Zap size={16} className="text-neon" aria-hidden />}
        title="UPGRADES"
        subtitle="Spend essence. Eclipse resets them."
      />

      <TabBody>
        <div className="grid grid-cols-4 gap-1.5" aria-label="Current stats">
          <StatCell label="Tap" value={formatNumber(stats.tapDamage)} tone="text-neon" />
          <StatCell label="Crit" value={formatPercent(stats.critChance).replace(/^\+/, '')} tone="text-gold" />
          <StatCell label="Crit dmg" value={`×${formatNumber(stats.critDamage)}`} tone="text-crimson" />
          <StatCell label="Essence" value={`×${formatNumber(stats.essenceMultiplier)}`} tone="text-toxic" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-tech text-dim uppercase tracking-wider shrink-0">Buy amount</span>
          <div className="flex-1 grid grid-cols-4 border border-line bg-panel shadow-hard divide-x divide-line" role="group" aria-label="Buy amount">
            {WANTS.map(({ want: w, label }) => {
              const active = w === want;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(w)}
                  className={`min-h-[32px] text-[11px] font-mono-code font-bold transition-colors active:translate-y-0.5 ${
                    active ? 'bg-neon text-abyss' : 'text-dim hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {SORTED_UPGRADES.map((def) => (
          <UpgradeRow key={def.id} def={def} want={want} />
        ))}
      </TabBody>
    </div>
  );
};
