import React from 'react';
import { Globe, Settings, ShieldCheck, ShieldOff } from 'lucide-react';
import { selectHasRemovedAds } from '../game/selectors';
import { worldForLevel } from '../game/stats';
import { useGameState } from '../hooks/useGame';
import { useStore } from '../hooks/useMonetization';
import { formatNumber } from '../utils/numberFormat';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenNoAds: () => void;
}

const CurrencyTile: React.FC<{ label: string; glyph: string; value: number; accent: string }> = ({ label, glyph, value, accent }) => (
  <div className={`min-w-0 border-l-2 pl-2 flex flex-col justify-center ${accent}`}>
    <div className="flex items-center gap-1 leading-none mb-0.5">
      <span className="text-[9px] shrink-0" aria-hidden>
        {glyph}
      </span>
      <span className="text-[9px] font-tech tracking-wider text-dim uppercase truncate">{label}</span>
    </div>
    <span className="text-xs font-mono-code font-bold text-ink leading-tight truncate">{formatNumber(value)}</span>
  </div>
);

/** World, level, the four wallets, the Remove Ads entry point and settings. */
export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onOpenNoAds }) => {
  const level = useGameState((s) => s.combat.level);
  const essence = useGameState((s) => s.currencies.essence);
  const crystals = useGameState((s) => s.currencies.void_crystals);
  const scraps = useGameState((s) => s.currencies.void_scraps);
  const tokens = useGameState((s) => s.arcade.tokens);
  const ownsNoAds = useGameState(selectHasRemovedAds);
  const store = useStore();
  const price = store.available && !ownsNoAds ? store.priceOf('remove_ads') : undefined;
  const world = worldForLevel(level);

  return (
    <header className="relative z-30 w-full shrink-0 bg-void border-b border-line px-2.5 py-1.5 flex flex-col gap-1.5 select-none">
      <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
        <div className="flex items-stretch h-8 min-w-0 bg-panel border border-neon shadow-[0_0_8px] shadow-neon/15">
          <span className="w-6 shrink-0 flex items-center justify-center border-r border-neon text-neon" aria-hidden>
            <Globe size={11} />
          </span>
          <span className="min-w-0 px-2 self-center text-[10px] font-display font-bold tracking-wider text-neon uppercase truncate">
            {world.displayName}
          </span>
          <span className="shrink-0 flex flex-col justify-center gap-0.5 px-1.5 bg-panel2 border-l border-neon">
            <span className="text-[9px] text-dim font-tech tracking-wider leading-none">Lv.</span>
            <span className="text-[11px] font-mono-code font-bold text-ink leading-none">{formatNumber(level).padStart(3, '0')}</span>
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {store.available &&
            (ownsNoAds ? (
              <span className="h-8 px-2 flex items-center gap-1 bg-panel border border-neon/60 text-neon" title="Ads removed">
                <ShieldCheck size={12} aria-hidden />
                <span className="text-[9px] font-display font-bold tracking-wider">PRO</span>
                <span className="sr-only">: ads removed</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenNoAds}
                aria-label={price ? `Remove ads, ${price}` : 'Remove ads'}
                className="hud-btn-gold h-8 px-2 flex items-center gap-1 active:scale-95"
              >
                <ShieldOff size={12} className="shrink-0" aria-hidden />
                <span className="text-[9px] tracking-wider whitespace-nowrap">NO ADS</span>
                {price && <span className="text-[9px] font-mono-code font-bold whitespace-nowrap">{price}</span>}
              </button>
            ))}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="w-8 h-8 shrink-0 flex items-center justify-center bg-panel border border-line text-dim hover:text-neon-bright hover:border-neon hover:bg-active active:scale-95 transition-colors"
          >
            <Settings size={14} aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <CurrencyTile label="Essence" glyph="◆" value={essence} accent="border-l-neon text-neon" />
        <CurrencyTile label="Crystals" glyph="◆" value={crystals} accent="border-l-purple text-purple" />
        <CurrencyTile label="Scraps" glyph="⬢" value={scraps} accent="border-l-gold text-gold" />
        <CurrencyTile label="Tokens" glyph="✦" value={tokens} accent="border-l-crimson text-crimson" />
      </div>
    </header>
  );
};
