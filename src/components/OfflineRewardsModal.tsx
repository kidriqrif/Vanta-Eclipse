import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Info, Loader2, Moon, Play, Zap } from 'lucide-react';
import { SKILLS } from '../data/definitions';
import { BASE_OFFLINE_CAP_HOURS } from '../game/offline';
import type { GameState, PendingOffline } from '../game/state';
import { skillStat } from '../game/stats';
import { useDispatch, useGameState } from '../hooks/useGame';
import { useArcadeOverlayOpen } from '../hooks/useArcadeOverlay';
import { useAdOffer } from '../hooks/useMonetization';
import { formatDuration, formatNumber } from '../utils/numberFormat';
import { Button, Modal } from './ui';

const LONG_SLUMBER = SKILLS.find((s) => s.id === 'long_slumber');

const selectCapHours = (s: GameState) => BASE_OFFLINE_CAP_HOURS + skillStat(s, 'offline_cap_hours');
const selectSlumberMaxed = (s: GameState) =>
  !LONG_SLUMBER || (s.skills[LONG_SLUMBER.id] || 0) >= LONG_SLUMBER.maxLevel;

/** Mounted only while a reward is pending, so the ad offer is only watched while it can matter. */
const OfflineBody: React.FC<{ pending: PendingOffline; onDismiss: () => void }> = ({ pending, onDismiss }) => {
  const offer = useAdOffer('offline_double');
  const capHours = useGameState(selectCapHours);
  const slumberMaxed = useGameState(selectSlumberMaxed);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const double = async () => {
    setFailed(false);
    const ok = await offer.claim();
    if (mounted.current && !ok) setFailed(true);
  };

  let offerBlock: React.ReactNode = null;
  if (pending.doubled) {
    offerBlock = (
      <p role="status" className="text-xs font-tech font-bold text-toxic flex items-center justify-center gap-1">
        <Check size={13} aria-hidden /> Doubled! +{formatNumber(pending.amount)} more
      </p>
    );
  } else if (offer.remaining <= 0) {
    offerBlock = (
      <p className="text-[10px] font-tech text-dim text-center">
        {formatNumber(offer.remaining)}/{formatNumber(offer.cap)} doubles left today · back tomorrow
      </p>
    );
  } else if (offer.canWatch) {
    offerBlock = (
      <div className="flex flex-col gap-1">
        <Button
          variant="gold"
          size="lg"
          block
          disabled={offer.busy}
          aria-busy={offer.busy}
          className="disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => void double()}
        >
          {offer.busy ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden /> {offer.instant ? 'DOUBLING…' : 'VIDEO PLAYING…'}
            </>
          ) : offer.instant ? (
            <>
              <Zap size={14} aria-hidden /> DOUBLE IT · INSTANT
            </>
          ) : (
            <>
              <Play size={14} aria-hidden /> WATCH · DOUBLE IT
            </>
          )}
        </Button>
        <p className="text-[10px] font-tech text-dim text-center">
          Optional · {formatNumber(offer.remaining)}/{formatNumber(offer.cap)} left today
        </p>
      </div>
    );
  }
  // Otherwise ads cannot be shown on this device: no offer, nothing to explain.

  return (
    <>
      <p className="text-[11px] font-tech text-dim text-center leading-tight">Your hero kept fighting while you were away.</p>

      <div className="bg-panel2 border border-line p-3 flex flex-col items-center gap-0.5">
        <span className="text-lg font-mono-code font-bold text-neon leading-tight">+{formatNumber(pending.amount)} Essence</span>
        <span className="text-[10px] font-tech text-dim">added to your total</span>
      </div>

      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-[11px] font-tech text-ink">Away for {formatDuration(pending.secondsAway)}</span>
        {pending.wasCapped && (
          <span className="text-[10px] font-tech text-gold leading-tight flex items-center gap-1">
            <Info size={11} className="shrink-0" aria-hidden />
            Offline earnings cap at {formatNumber(capHours)}h{slumberMaxed ? '' : ' — Long Slumber raises it'}
          </span>
        )}
      </div>

      {offerBlock}

      {failed && !pending.doubled && (
        <p role="status" className="text-[10px] font-tech text-gold text-center leading-tight">
          Not doubled. Your essence is kept and no offer was used up.
        </p>
      )}

      <Button variant="primary" size="lg" block onClick={onDismiss}>
        OK
      </Button>
    </>
  );
};

/**
 * "Welcome back": the reducer has already granted the offline essence (APPLY_OFFLINE), so this
 * only reports it and offers the optional double. It can always be dismissed in one tap.
 */
export const OfflineRewardsModal: React.FC = () => {
  const pending = useGameState((s) => s.ui.pendingOffline);
  // The reward is already granted; the modal just waits until no minigame covers the screen.
  const runOpen = useGameState((s) => s.ui.activeRun !== null);
  const arcadeOpen = useArcadeOverlayOpen();
  const inRun = runOpen || arcadeOpen;
  const dispatch = useDispatch();
  const dismiss = useCallback(() => {
    dispatch({ type: 'DISMISS_OFFLINE' });
  }, [dispatch]);

  return (
    <Modal open={!!pending && !inRun} onClose={dismiss} title="Welcome back" icon={<Moon size={14} className="text-neon" aria-hidden />}>
      {pending && <OfflineBody pending={pending} onDismiss={dismiss} />}
    </Modal>
  );
};
