import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  BookOpen,
  Gamepad2,
  Gem,
  Hammer,
  Layers,
  Moon,
  PawPrint,
  ShieldPlus,
  Skull,
  Sparkles,
  Swords,
  TrendingUp,
  Wand2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { GUIDE, MORE_TABS, TAB_LABEL, isGuideBlocked, nextGuideStep, type GuideTab } from '../game/guide';
import type { GameState } from '../game/state';
import { useArcadeOverlayOpen } from '../hooks/useArcadeOverlay';
import { useDispatch, useGameState } from '../hooks/useGame';
import { Button, Modal } from './ui';

/** A dismiss within this long of a tip appearing is ignored, so a double tap on whatever was under it never skips it unread. */
const ARM_MS = 650;
/** The quiet time after a tip before the next one may show, so tips never arrive as a wall. */
export const GUIDE_GAP_MS = 6000;
/** The Eclipse flash lets taps through; no tip starts until it has played. */
const ECLIPSE_FLASH_MS = 2600;

/** Monotonic milliseconds: a device clock set back can never strand a tip or stretch the rest. */
const clock = () => performance.now();

const ICONS: Record<string, LucideIcon> = {
  welcome: Swords,
  forge: Zap,
  bosses: Skull,
  first_gear: ShieldPlus,
  farm: TrendingUp,
  codex: BookOpen,
  auto: Bot,
  boss_cards: Layers,
  salvage: Hammer,
  arcade: Gamepad2,
  eclipse: Moon,
  ruins: PawPrint,
  relic: Gem,
  powers: Sparkles,
  trails: Wand2,
};

const selectPendingId = (s: GameState) => nextGuideStep(s)?.id ?? null;
/** A game dialog is up (offline report, world unlock, a run): an open tip steps aside for it. */
const selectDialogUp = (s: GameState) => s.ui.pendingOffline !== null || s.ui.worldUnlockModal !== null || s.ui.activeRun !== null;
const selectEclipseAt = (s: GameState) => s.ui.eclipseAt;

/**
 * The guide's tips, one at a time, each when the player first meets what it teaches (src/game/guide.ts).
 * A tip waits while another screen owns the game (and while `paused`, e.g. Settings is open). Once on
 * screen it stays until acknowledged and a boss fight is held behind it; if a game dialog opens over
 * it, the tip steps aside and comes back afterwards. A tip about a tab offers to open it.
 */
export const OnboardingManager: React.FC<{ onOpenTab: (tab: GuideTab) => void; paused?: boolean }> = ({ onOpenTab, paused = false }) => {
  const dispatch = useDispatch();
  const pendingId = useGameState(selectPendingId);
  const stateBlocked = useGameState(isGuideBlocked);
  const dialogState = useGameState(selectDialogUp);
  const eclipseAt = useGameState(selectEclipseAt);
  const arcadeOpen = useArcadeOverlayOpen();
  const blocked = stateBlocked || arcadeOpen || paused;
  const dialogUp = dialogState || arcadeOpen;

  const [shownId, setShownId] = useState<string | null>(null);
  const [restUntil, setRestUntil] = useState(0);
  const [armed, setArmed] = useState(false);
  const [wake, setWake] = useState(0);

  // An Eclipse starts a rest, so the next tip never opens under its flash.
  useEffect(() => {
    if (eclipseAt) setRestUntil((r) => Math.max(r, clock() + ECLIPSE_FLASH_MS));
  }, [eclipseAt]);

  // Start the next tip when one is due, nothing else owns the screen, and the rest is over. Every
  // wake re-reads the clock: a timer may fire a hair early, and then it simply waits again.
  useEffect(() => {
    if (shownId || !pendingId || blocked) return;
    const wait = restUntil - clock();
    if (wait > 0) {
      const t = setTimeout(() => setWake((n) => n + 1), Math.ceil(wait) + 1);
      return () => clearTimeout(t);
    }
    setShownId(pendingId);
  }, [shownId, pendingId, blocked, restUntil, wake]);

  // A tip marked seen some other way (a loaded save, a replay) closes instead of lingering.
  const shownSeen = useGameState(useCallback((s: GameState) => (shownId ? !!s.tutorialsSeen[shownId] : false), [shownId]));
  useEffect(() => {
    if (shownSeen) setShownId(null);
  }, [shownSeen]);

  // The reducer holds a boss fight while a tip is up.
  const open = shownId !== null;
  useEffect(() => {
    dispatch({ type: 'SET_GUIDE_OPEN', open });
  }, [open, dispatch]);
  useEffect(() => () => void dispatch({ type: 'SET_GUIDE_OPEN', open: false }), [dispatch]);

  // The dismiss guard re-arms every time the tip (re)appears, including after a dialog that covered it.
  const visible = open && !dialogUp;
  useEffect(() => {
    setArmed(false);
    if (!visible) return;
    const t = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(t);
  }, [visible, shownId]);

  const step = shownId ? GUIDE.find((g) => g.id === shownId) : undefined;
  if (!step || !visible) return null;

  const finish = (tab?: GuideTab) => {
    if (!armed) return;
    dispatch({ type: 'MARK_TUTORIAL_SEEN', id: step.id });
    setShownId(null);
    setRestUntil(clock() + GUIDE_GAP_MS);
    if (tab) onOpenTab(tab);
  };
  const Icon = ICONS[step.id] ?? Sparkles;
  const tab = step.tab;
  const where = tab && MORE_TABS.includes(tab) ? `${TAB_LABEL[tab]} (MORE)` : tab ? TAB_LABEL[tab] : '';

  return (
    <Modal open onClose={() => finish()} title={step.title} icon={<Icon size={16} className="text-neon" aria-hidden />}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 border border-neon/60 bg-neon/10 flex items-center justify-center text-neon">
          <Icon size={24} aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          {step.lines.map((line) => (
            <p key={line} className="text-xs font-tech text-ink leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
      {tab ? (
        <div className="flex flex-col gap-2">
          <Button variant="solid" size="lg" block disabled={!armed} onClick={() => finish(tab)}>
            OPEN {where}
          </Button>
          <Button variant="ghost" size="md" block disabled={!armed} onClick={() => finish()}>
            GOT IT
          </Button>
        </div>
      ) : (
        <Button variant="solid" size="lg" block disabled={!armed} onClick={() => finish()}>
          GOT IT
        </Button>
      )}
      <p className="text-[10px] font-tech text-dim text-center">Read any tip again in Settings → GUIDE.</p>
    </Modal>
  );
};
