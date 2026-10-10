import React, { useCallback } from 'react';
import { Gem, Mountain, PawPrint, Skull, TrendingUp, type LucideIcon } from 'lucide-react';
import { WORLDS } from '../data/definitions';
import { WORLD_TWO_FIRST_LEVEL, type GameState } from '../game/state';
import { useDispatch, useGameState } from '../hooks/useGame';
import { useArcadeOverlayOpen } from '../hooks/useArcadeOverlay';
import { formatNumber } from '../utils/numberFormat';
import { Button, Modal } from './ui';

const selectWorldId = (s: GameState) => s.ui.worldUnlockModal;
/** Waits behind a minigame, and behind the Welcome-back report (offline first). */
const selectWaiting = (s: GameState) => s.ui.activeRun !== null || s.ui.pendingOffline !== null;
/**
 * The world can reopen after an Eclipse; Ember only joins the first time. The 'ruins' tip
 * (OnboardingManager) waits behind this modal, so it is still unseen on the first visit.
 */
const selectFirstVisit = (s: GameState) => !s.tutorialsSeen['ruins'];

const Change: React.FC<{ icon: LucideIcon; title: string; detail: string }> = ({ icon: Icon, title, detail }) => (
  <li className="flex items-start gap-2">
    <span className="w-7 h-7 shrink-0 border border-gold/50 bg-gold/10 flex items-center justify-center text-gold">
      <Icon size={14} aria-hidden />
    </span>
    <span className="flex flex-col min-w-0">
      <span className="text-[11px] font-display font-bold text-ink uppercase tracking-wide leading-tight">{title}</span>
      <span className="text-[10px] font-tech text-dim leading-tight">{detail}</span>
    </span>
  </li>
);

/** Shown once per climb when a world boss falls and the next world opens. */
export const WorldUnlockModal: React.FC = () => {
  const dispatch = useDispatch();
  const worldId = useGameState(selectWorldId);
  const stateWaiting = useGameState(selectWaiting);
  const arcadeOpen = useArcadeOverlayOpen();
  const waiting = stateWaiting || arcadeOpen;
  const firstVisit = useGameState(selectFirstVisit);
  const close = useCallback(() => {
    dispatch({ type: 'CLOSE_WORLD_MODAL' });
  }, [dispatch]);

  if (!worldId || waiting) return null;

  const world = WORLDS.find((w) => w.id === worldId);
  const name = world?.displayName ?? worldId.replace(/_/g, ' ');
  // Companions and relics awaken with the second world (see unlockFrozenRuins in the reducer).
  const awakens = world?.firstLevel === WORLD_TWO_FIRST_LEVEL;

  return (
    <Modal
      open
      onClose={close}
      tone="gold"
      title="WORLD UNLOCKED"
      icon={<Mountain size={16} className="text-gold" aria-hidden />}
    >
      <div className="flex flex-col items-center text-center gap-0.5">
        <span className="text-[10px] font-display font-bold text-dim tracking-widest uppercase">You have reached</span>
        <span className="text-xl font-display font-black text-gold uppercase tracking-wider">{name}</span>
        {world && (
          <span className="text-[10px] font-tech text-dim">From level {formatNumber(world.firstLevel)} onward</span>
        )}
        {world?.description && <span className="text-[10px] font-tech text-dim mt-1">{world.description}</span>}
      </div>

      <ul className="bg-panel2 border border-line p-2 flex flex-col gap-2" aria-label="What changes">
        {world && (
          <Change
            icon={TrendingUp}
            title={`Essence ×${formatNumber(world.essenceMultiplier)}`}
            detail="Every kill in this world pays more essence."
          />
        )}
        <Change icon={Skull} title="New enemies" detail="A new set of enemies and bosses to fight." />
        {awakens && (
          <>
            <Change
              icon={PawPrint}
              title={firstVisit ? 'Companions awaken' : 'Companions'}
              detail={
                firstVisit
                  ? 'Ember joins you and grows stronger from your kills. See the BEAST tab.'
                  : 'Your companions keep growing from your kills. See the BEAST tab.'
              }
            />
            <Change icon={Gem} title="Relics" detail="Relics now drop from bosses. Attune one in the RELICS tab." />
          </>
        )}
      </ul>

      <Button variant="gold" size="lg" block onClick={close}>
        CONTINUE
      </Button>
    </Modal>
  );
};
