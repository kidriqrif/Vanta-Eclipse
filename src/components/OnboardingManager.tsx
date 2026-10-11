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

/**
 * The guide's tips, one at a time, each when the player first meets what it teaches (src/game/guide.ts).
 * A tip waits while another screen owns the game; once on screen it stays until acknowledged, and a
 * boss fight is held behind it. A tip about a tab offers to open it.
 */
export const OnboardingManager: React.FC<{ onOpenTab: (tab: GuideTab) => void }> = ({ onOpenTab }) => {
  const dispatch = useDispatch();
  const pendingId = useGameState(selectPendingId);
  const stateBlocked = useGameState(isGuideBlocked);
  const arcadeOpen = useArcadeOverlayOpen();
  const blocked = stateBlocked || arcadeOpen;

  const [shown, setShown] = useState<{ id: string; at: number } | null>(null);
  const [restUntil, setRestUntil] = useState(0);
  const [armed, setArmed] = useState(false);
  const [, setWake] = useState(0);

  // Start the next tip when one is due, nothing else owns the screen, and the rest is over.
  const now = Date.now();
  const resting = now < restUntil;
  useEffect(() => {
    if (shown || !pendingId || blocked) return;
    if (resting) {
      const t = setTimeout(() => setWake((n) => n + 1), restUntil - Date.now());
      return () => clearTimeout(t);
    }
    setShown({ id: pendingId, at: Date.now() });
  }, [shown, pendingId, blocked, resting, restUntil]);

  // A tip marked seen some other way (a loaded save, a replay) closes instead of lingering.
  const shownId = shown?.id ?? null;
  const shownSeen = useGameState(useCallback((s: GameState) => (shownId ? !!s.tutorialsSeen[shownId] : false), [shownId]));
  useEffect(() => {
    if (shownSeen) setShown(null);
  }, [shownSeen]);

  // The reducer holds a boss fight while a tip is up.
  const open = shown !== null;
  useEffect(() => {
    dispatch({ type: 'SET_GUIDE_OPEN', open });
  }, [open, dispatch]);
  useEffect(() => () => void dispatch({ type: 'SET_GUIDE_OPEN', open: false }), [dispatch]);

  useEffect(() => {
    if (!shown) return;
    setArmed(false);
    const t = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(t);
  }, [shown]);

  const step = shown ? GUIDE.find((g) => g.id === shown.id) : undefined;
  if (!shown || !step) return null;

  const finish = (tab?: GuideTab) => {
    if (Date.now() - shown.at < ARM_MS) return;
    dispatch({ type: 'MARK_TUTORIAL_SEEN', id: step.id });
    setShown(null);
    setRestUntil(Date.now() + GUIDE_GAP_MS);
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
