import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy } from 'lucide-react';
import { minigameDef } from '../../game/arcade';
import { useDispatch, useGameState } from '../../hooks/useGame';
import { useBackHandler } from '../../hooks/useBackHandler';
import { formatNumber } from '../../utils/numberFormat';
import { Button } from '../ui';
import { MINIGAME_COMPONENTS } from './registry';
import type { MinigameResult } from './types';

/** How long an armed QUIT waits for the second tap (the shared Two-Tap Arm timing). */
const ARM_MS = 2500;
/** CONTINUE ignores taps this long after the banner appears. */
const CONTINUE_GUARD_MS = 600;

interface Banner {
  /** False when the run had already been closed, so nothing was paid. */
  paid: boolean;
  won: boolean;
  essence: number;
  detail: string;
  newRecord: boolean;
  /** The game's record just before this run finished, to spot a first record. */
  recordBefore: number | undefined;
}

/**
 * The frame around a minigame (spec M9 §4): the header with a two-tap QUIT, the game itself,
 * and the result banner. The host owns the payout: the first `onFinish` wins and dispatches
 * ARCADE_FINISH; anything after that (or after QUIT) is ignored.
 */
export const MinigameHost: React.FC<{ gameId: string; runId: number; onClose: () => void }> = ({ gameId, runId, onClose }) => {
  const dispatch = useDispatch();
  const def = minigameDef(gameId);
  const Game = MINIGAME_COMPONENTS[gameId];
  const record = useGameState((s) => s.arcade.records[gameId]);

  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  /** Set by the first finish or quit; nothing pays after it. */
  const latched = useRef(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  const handleFinish = useCallback(
    (result: MinigameResult) => {
      if (latched.current) return;
      latched.current = true;
      const recordBefore = recordRef.current;
      const r = dispatch({ type: 'ARCADE_FINISH', runId, won: result.won, performance: result.performance, score: result.score });
      setArmed(false);
      setBanner({
        paid: r.ok,
        won: result.won,
        essence: r.ok ? (r.value ?? 0) : 0,
        detail: result.detail,
        newRecord: !!r.newRecord,
        recordBefore,
      });
    },
    [dispatch, runId],
  );

  const forfeit = useCallback(() => {
    if (latched.current) return;
    latched.current = true;
    dispatch({ type: 'ARCADE_QUIT', runId });
    onClose();
  }, [dispatch, runId, onClose]);

  const pressQuit = () => {
    if (armed) forfeit();
    else setArmed(true);
  };

  // Android back: arms QUIT, then forfeits on the second press; on the banner it continues.
  useBackHandler(true, () => {
    if (banner) onClose();
    else pressQuit();
  });

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const name = def?.displayName ?? 'Arcade';
  const firstRecord = !!banner?.won && banner.recordBefore === undefined && record !== undefined;
  const isRecord = !!banner && (banner.newRecord || firstRecord);

  const overlay = (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={name}
      data-testid="minigame-host"
      className="fixed inset-0 z-[70] bg-void text-ink font-mono-code select-none outline-none flex justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <div className="w-full max-w-md h-full flex flex-col bg-void bg-grid-pattern">
        <header className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 bg-panel border-b border-line">
          <div className="justify-self-start">
            {!banner && (
              <Button variant={armed ? 'danger' : 'ghost'} size="md" onClick={pressQuit} aria-live="polite" className="max-w-[132px]">
                <span className="text-[10px] leading-tight">{armed ? 'TAP AGAIN: FORFEIT RUN' : 'QUIT'}</span>
              </Button>
            )}
          </div>
          <h2 className="text-sm font-display font-bold uppercase tracking-wider text-ink truncate text-center">{name}</h2>
          <div className="justify-self-end text-right">
            {armed && !banner && <span className="text-[9px] font-tech text-crimson leading-tight block">Token is not refunded</span>}
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {banner ? (
            <ResultBanner banner={banner} isRecord={isRecord} onContinue={onClose} />
          ) : Game ? (
            <Game key={runId} onFinish={handleFinish} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-xs font-tech text-dim">This game could not be loaded.</p>
              <Button variant="primary" size="md" onClick={forfeit}>
                LEAVE
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

const ResultBanner: React.FC<{ banner: Banner; isRecord: boolean; onContinue: () => void }> = ({ banner, isRecord, onContinue }) => {
  // A short guard so a finger still hammering the game cannot dismiss the result unread.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), CONTINUE_GUARD_MS);
    return () => clearTimeout(t);
  }, []);
  const title = !banner.paid ? 'RUN CLOSED' : banner.won ? 'YOU WON' : 'RUN OVER';
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-xs bg-panel border-2 p-4 flex flex-col items-center gap-3 text-center animate-fade-in ${
          banner.won && banner.paid ? 'border-neon shadow-[0_0_24px] shadow-neon/25' : 'border-line'
        }`}
      >
        <div role="status" className="w-full flex flex-col items-center gap-3">
          <h3 className={`text-xl font-display font-black tracking-wider ${banner.won && banner.paid ? 'text-neon' : 'text-ink'}`}>
            {banner.won && banner.paid ? '✓ ' : ''}
            {title}
          </h3>
          <p className="text-xs font-mono-code text-ink">{banner.detail}</p>

          {isRecord && (
            <span className="flex items-center gap-1.5 px-2 py-1 border border-gold text-gold bg-gold/10 text-[11px] font-display font-bold tracking-wider">
              <Trophy size={13} aria-hidden /> NEW RECORD
            </span>
          )}

          {banner.paid ? (
            <div className="w-full bg-panel2 border border-line p-2 flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-tech text-dim uppercase tracking-wider">Essence earned</span>
              <span className="text-base font-mono-code font-bold text-neon">
                <span aria-hidden>◆ </span>+{formatNumber(banner.essence)} essence
              </span>
              {!banner.won && <span className="text-[10px] font-tech text-dim">A loss still pays part of a win.</span>}
            </div>
          ) : (
            <p className="text-[11px] font-tech text-dim">This run had already ended, so nothing was paid.</p>
          )}
        </div>

        <Button variant={banner.won && banner.paid ? 'solid' : 'primary'} size="lg" block disabled={!ready} onClick={onContinue}>
          CONTINUE
        </Button>
      </div>
    </div>
  );
};
