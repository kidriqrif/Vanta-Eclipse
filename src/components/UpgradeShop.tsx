import React, { useCallback, useState } from 'react';
import { Crosshair, Flame, Gem, Target, Zap, type LucideIcon } from 'lucide-react';
import { UPGRADES } from '../data/definitions';
import type { UpgradeDefinition } from '../types/game';
import { affordableUpgrades, upgradeCost } from '../game/reducer';
import type { GameState } from '../game/state';
import { shallowEqual, useDispatch, useGameState, useStats } from '../hooks/useGame';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Button, PanelHeader, TabBody } from './ui';

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

  return (
    <div className={`bg-panel border p-2 flex items-center gap-2.5 ${maxed ? 'border-line/60' : 'border-line'}`}>
      <div className={`w-9 h-9 shrink-0 border flex items-center justify-center ${copy?.tone ?? FALLBACK_TONE}`}>
        <Icon size={16} aria-hidden />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-display font-bold text-ink uppercase tracking-wide truncate">{def.displayName}</span>
          <span key={level} className="animate-fade-in shrink-0 text-[10px] font-mono-code font-bold text-dim border border-line px-1 leading-4">
            LV {formatNumber(level)}
            {def.maxLevel > 0 && `/${formatNumber(def.maxLevel)}`}
          </span>
        </div>
        <span className="text-[10px] font-tech text-dim leading-tight">{effectText(def, level)}</span>
        {!maxed && !canBuy && (
          <span className="text-[10px] font-tech text-crimson leading-tight">Need {formatNumber(shortBy)} more essence</span>
        )}
      </div>

      <div className="shrink-0 w-[96px]">
        {maxed ? (
          <div className="min-h-[44px] border border-line bg-panel2 flex flex-col items-center justify-center text-[10px] font-display font-bold text-dim">
            MAXED
          </div>
        ) : (
          <Button
            variant={canBuy ? 'primary' : 'ghost'}
            size="md"
            block
            disabled={!canBuy}
            onClick={buy}
            aria-label={`Buy ${buyCount} ${def.displayName} for ${formatNumber(price)} essence${canBuy ? '' : ', not enough essence'}`}
          >
            <span className="flex flex-col items-center leading-tight">
              <span>BUY {formatNumber(buyCount)}</span>
              <span className="font-mono-code text-[10px] text-ink">
                <span className="text-neon" aria-hidden>
                  ◆{' '}
                </span>
                {formatNumber(price)}
              </span>
            </span>
          </Button>
        )}
      </div>
    </div>
  );
});
UpgradeRow.displayName = 'UpgradeRow';

const StatCell: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div className="bg-panel border border-line px-1.5 py-1 flex flex-col items-center min-w-0">
    <span className="text-[9px] font-tech text-dim uppercase tracking-wider">{label}</span>
    <span className={`text-xs font-mono-code font-bold truncate max-w-full ${tone}`}>{value}</span>
  </div>
);

/** The FORGE tab: run upgrades bought with essence. An Eclipse resets them. */
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
        title="FORGE"
        subtitle="Upgrades bought with essence. An Eclipse resets them."
        right={
          <div className="flex border border-line bg-void" role="group" aria-label="Buy amount">
            {WANTS.map(({ want: w, label }) => {
              const active = w === want;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(w)}
                  className={`min-w-[34px] min-h-[32px] px-1.5 text-[10px] font-mono-code font-bold transition-colors ${
                    active ? 'bg-neon text-void' : 'text-dim hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        }
      />

      <TabBody>
        <div className="grid grid-cols-4 gap-1.5" aria-label="Current stats">
          <StatCell label="Tap" value={formatNumber(stats.tapDamage)} tone="text-neon" />
          <StatCell label="Crit %" value={formatPercent(stats.critChance).replace(/^\+/, '')} tone="text-gold" />
          <StatCell label="Crit ×" value={`×${formatNumber(stats.critDamage)}`} tone="text-crimson" />
          <StatCell label="Essence ×" value={`×${formatNumber(stats.essenceMultiplier)}`} tone="text-toxic" />
        </div>

        {SORTED_UPGRADES.map((def) => (
          <UpgradeRow key={def.id} def={def} want={want} />
        ))}
      </TabBody>
    </div>
  );
};
