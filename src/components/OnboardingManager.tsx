import React, { useEffect, useState } from 'react';
import { Bot, Gamepad2, Moon, Skull, Snowflake, Swords, Zap, type LucideIcon } from 'lucide-react';
import {
  ARCADE_UNLOCK_LEVEL,
  AUTO_ATTACK_UNLOCK_LEVEL,
  BOSS_FIGHT_SECONDS,
  ECLIPSE_UNLOCK_LEVEL,
  TOKEN_CAP,
  TOKEN_REGEN_MS,
  WORLD_TWO_FIRST_LEVEL,
  type GameState,
} from '../game/state';
import { useDispatch, useGameState } from '../hooks/useGame';
import { formatNumber } from '../utils/numberFormat';
import { Button, Modal } from './ui';

interface Tip {
  id: string;
  /** Shown once state.lifetimePeakLevel reaches this. */
  level: number;
  title: string;
  icon: LucideIcon;
  lines: string[];
}

/** A short breath between two tips, so a double tap on ACKNOWLEDGE cannot skip the next one unread. */
const TIP_GAP_MS = 700;

const TIPS: Tip[] = [
  {
    id: 'welcome',
    level: 1,
    title: 'WELCOME TO VANTA ECLIPSE',
    icon: Swords,
    lines: ['Tap the enemy to attack it.', 'Every kill gives you essence and moves you up one level.'],
  },
  {
    id: 'forge',
    level: 5,
    title: 'UPGRADES',
    icon: Zap,
    lines: [
      'Spend essence in the UPGRADES tab: more tap damage, more critical hits and more essence per kill.',
    ],
  },
  {
    id: 'bosses',
    level: 9,
    title: 'BOSSES',
    icon: Skull,
    lines: [
      `Every 10th level is a boss. You have ${formatNumber(BOSS_FIGHT_SECONDS)} seconds to beat it.`,
      'If time runs out, you farm the level below instead. Grow stronger, then press CHALLENGE to fight it again.',
      'Bosses always drop a piece of gear and a card.',
    ],
  },
  {
    id: 'auto',
    level: AUTO_ATTACK_UNLOCK_LEVEL,
    title: 'AUTO-ATTACK ONLINE',
    icon: Bot,
    lines: [
      'You now attack on your own, even while you browse the other tabs. Tapping still adds damage.',
      `Each run, auto-attack switches on at level ${formatNumber(AUTO_ATTACK_UNLOCK_LEVEL)}.`,
    ],
  },
  {
    id: 'arcade',
    level: ARCADE_UNLOCK_LEVEL,
    title: 'THE ARCADE',
    icon: Gamepad2,
    lines: [
      'The ARCADE tab has short minigames that pay essence. Wins pay the most, but every game pays something.',
      `Each game costs a token. Tokens refill at 1 every ${formatNumber(TOKEN_REGEN_MS / 60_000)} minutes, up to ${formatNumber(TOKEN_CAP)}.`,
    ],
  },
  {
    id: 'eclipse',
    level: ECLIPSE_UNLOCK_LEVEL,
    title: 'THE ECLIPSE',
    icon: Moon,
    lines: [
      `Once a run reaches level ${formatNumber(ECLIPSE_UNLOCK_LEVEL)}, the ECLIPSE tab can end it.`,
      'You restart at level 1 and lose your essence and upgrades. In return you get Void Crystals: the higher you climbed, the more.',
      'Crystals buy permanent skills. Gear, cards, companions and relics are always kept.',
    ],
  },
  {
    id: 'ruins',
    level: WORLD_TWO_FIRST_LEVEL,
    title: 'FROZEN RUINS',
    icon: Snowflake,
    lines: [
      'Your companion grows stronger from every kill. Check on it, and feed it cards, in the BEAST tab.',
      'Bosses here can drop relics. Attune one in the RELICS tab for its bonus.',
    ],
  },
].sort((a, b) => a.level - b.level);

/** The lowest-level tip the player has reached and not yet acknowledged. */
const selectTipId = (s: GameState): string | null => {
  for (const t of TIPS) {
    if (t.level > s.lifetimePeakLevel) return null;
    if (!s.tutorialsSeen[t.id]) return t.id;
  }
  return null;
};

/**
 * Tips wait while something else owns the screen: the offline reward, the world unlock, a
 * minigame, or a timed boss fight (a tip would cover the boss while its timer runs).
 */
const selectBlocked = (s: GameState) =>
  !!s.ui.pendingOffline || !!s.ui.worldUnlockModal || !!s.ui.activeRun || s.combat.mode === 'BOSS_FIGHT';

/** One-time tips as the player reaches each system, one at a time. Seen tips live in the save. */
export const OnboardingManager: React.FC = () => {
  const dispatch = useDispatch();
  const tipId = useGameState(selectTipId);
  const blocked = useGameState(selectBlocked);
  const [resting, setResting] = useState(false);

  useEffect(() => {
    if (!resting) return;
    const t = setTimeout(() => setResting(false), TIP_GAP_MS);
    return () => clearTimeout(t);
  }, [resting]);

  const tip = tipId ? TIPS.find((t) => t.id === tipId) : undefined;
  if (!tip || blocked || resting) return null;

  const acknowledge = () => {
    dispatch({ type: 'MARK_TUTORIAL_SEEN', id: tip.id });
    setResting(true);
  };
  const Icon = tip.icon;

  return (
    <Modal open onClose={acknowledge} title={tip.title} icon={<Icon size={16} className="text-neon" aria-hidden />}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 border border-neon/60 bg-neon/10 flex items-center justify-center text-neon">
          <Icon size={24} aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          {tip.lines.map((line) => (
            <p key={line} className="text-xs font-tech text-ink leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
      <Button variant="solid" size="lg" block onClick={acknowledge}>
        ACKNOWLEDGE
      </Button>
    </Modal>
  );
};
