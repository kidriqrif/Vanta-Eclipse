import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastTone } from '../game/actions';
import { selectHasRemovedAds } from '../game/selectors';
import { useFx, useGameState } from '../hooks/useGame';
import { useBannerHeight } from '../hooks/useMonetization';
import { BANNER_GAP_PX } from './BannerSlot';

interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

const TONE: Record<ToastTone, string> = {
  info: 'border-neon/70 text-neon',
  loot: 'border-line text-ink',
  rare: 'border-gold text-gold',
  warn: 'border-crimson text-crimson',
};
const MAX_VISIBLE = 3;
const LIFETIME_MS = 2600;
/** Height of the bottom nav bar plus a little air. */
const NAV_OFFSET_PX = 76;

/** Short, non-blocking notices from the game (loot, unlocks, boss results). Never steals input. */
export const ToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);

  const push = useCallback((text: string, tone: ToastTone) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.filter((t) => t.text !== text), { id, text, tone }].slice(-MAX_VISIBLE));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, LIFETIME_MS);
    timers.current.add(timer);
  }, []);

  useFx((fx) => {
    if (fx.type === 'toast') push(fx.text, fx.tone);
  });

  // Toasts sit above the nav bar, and above the banner strip when one is showing.
  const removed = useGameState(selectHasRemovedAds);
  const banner = useBannerHeight();
  const bottom = NAV_OFFSET_PX + (removed || banner <= 0 ? 0 : banner + BANNER_GAP_PX);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute left-2 right-2 z-[55] flex flex-col items-center gap-1" style={{ bottom }} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`anim-toast max-w-full bg-panel/95 border px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wide ${TONE[t.tone]}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
};
