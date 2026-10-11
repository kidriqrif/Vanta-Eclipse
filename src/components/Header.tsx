import React from 'react';
import { Settings, ShieldCheck, ShieldOff } from 'lucide-react';
import { selectHasRemovedAds } from '../game/selectors';
import { worldForLevel } from '../game/stats';
import { useGameState } from '../hooks/useGame';
import { useStore } from '../hooks/useMonetization';
import { formatNumber } from '../utils/numberFormat';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenNoAds: () => void;
}

/** A compact wallet: glyph, number, and the word for screen readers. */
const Wallet: React.FC<{ glyph: string; value: number; label: string; tone: string }> = ({ glyph, value, label, tone }) => (
  <span className="h-7 px-1.5 flex items-center gap-1 bg-abyss border border-line" title={label}>
    <span className={`text-[10px] ${tone}`} aria-hidden>
      {glyph}
    </span>
    <span className="text-[11px] font-mono-code font-bold text-ink leading-none">{formatNumber(value)}</span>
    <span className="sr-only"> {label}</span>
  </span>
);

/**
 * The top bar of the arena zone: world and level, the secondary wallets (essence lives in the
 * ticker), Remove Ads when it is for sale, and Settings.
 */
export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenNoAds }) => {
  const level = useGameState((s) => s.combat.level);
  const crystals = useGameState((s) => s.currencies.void_crystals);
  const scraps = useGameState((s) => s.currencies.void_scraps);
  const tokens = useGameState((s) => s.arcade.tokens);
  const ownsNoAds = useGameState(selectHasRemovedAds);
  const store = useStore();
  const price = store.available && !ownsNoAds ? store.priceOf('remove_ads') : undefined;
  const world = worldForLevel(level);

  return (
    <header className="relative z-30 shrink-0 h-11 bg-panel border-b-2 border-line px-2 flex items-center justify-between gap-1.5">
      <div className="flex items-stretch h-8 min-w-0 border border-neon/70 shadow-hard bg-abyss">
        <span className="min-w-0 px-2 self-center text-[10px] font-display font-bold tracking-wider text-neon uppercase truncate">
          {world.displayName}
        </span>
        <span className="shrink-0 flex items-center gap-1 px-1.5 bg-neon text-abyss">
          <span className="text-[9px] font-tech font-bold">LV</span>
          <span className="text-xs font-mono-code font-black leading-none">{formatNumber(level)}</span>
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Wallet glyph="◆" value={crystals} label="Void Crystals" tone="text-purple" />
        <Wallet glyph="⬢" value={scraps} label="Void Scraps" tone="text-gold" />
        <Wallet glyph="◈" value={tokens} label="Arcade Tokens" tone="text-toxic" />
        {store.available &&
          (ownsNoAds ? (
            <span className="h-8 px-1.5 flex items-center gap-1 border border-neon/60 text-neon" title="Ads removed">
              <ShieldCheck size={12} aria-hidden />
              <span className="text-[9px] font-tech font-bold tracking-wider">PRO</span>
              <span className="sr-only">: ads removed</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenNoAds}
              aria-label={price ? `Remove ads, ${price}` : 'Remove ads'}
              className="hud-btn-gold h-8 px-1.5 flex items-center gap-1 active:translate-y-0.5 active:border-amber-500 active:scale-[0.98]"
            >
              <ShieldOff size={12} className="shrink-0" aria-hidden />
              <span className="text-[9px] tracking-wider whitespace-nowrap">NO ADS</span>
            </button>
          ))}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="hud-btn-ghost w-8 h-8 shrink-0 flex items-center justify-center active:translate-y-0.5 active:border-amber-500 active:scale-[0.98]"
        >
          <Settings size={14} aria-hidden />
        </button>
      </div>
    </header>
  );
};
