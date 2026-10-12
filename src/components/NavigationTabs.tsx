import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  BookOpen,
  Ellipsis,
  Gamepad2,
  Gem,
  Layers,
  Lock,
  Moon,
  PawPrint,
  Shield,
  ShoppingBag,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  selectHasClaimableQuest,
  selectUnseenItemCount,
  selectUnseenPetCount,
  selectUnseenRelicCount,
} from '../game/selectors';
import { isEclipseTabOpen, isTabNew, type GuideTab } from '../game/guide';
import { ARCADE_UNLOCK_LEVEL, ECLIPSE_UNLOCK_LEVEL, WORLD_TWO_FIRST_LEVEL, type GameState } from '../game/state';
import { useBackHandler } from '../hooks/useBackHandler';
import { shallowEqual, useGameState } from '../hooks/useGame';
import { formatNumber } from '../utils/numberFormat';

export type TabType = GuideTab;

interface NavigationTabsProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

/** neon/gold badges ask for attention; info badges (the card count) only inform. */
type BadgeTone = 'neon' | 'gold' | 'info';

interface Badge {
  text: string;
  /** What the badge means, for screen readers. */
  spoken: string;
  tone: BadgeTone;
}

interface TabSpec {
  label: string;
  icon: LucideIcon;
  badge: Badge | null;
  /** Why the feature is still locked, or null. Locked tabs still open: their panels explain. */
  locked: { short: string; long: string } | null;
}

const PRIMARY: TabType[] = ['UPGRADES', 'GEAR', 'ARCADE', 'JOURNAL'];
const SECONDARY: TabType[] = ['CARDS', 'PETS', 'RELICS', 'ECLIPSE', 'SHOP'];

const BADGE_TONE: Record<BadgeTone, string> = {
  neon: 'bg-neon text-abyss border border-abyss',
  gold: 'bg-gold text-abyss border border-abyss',
  info: 'bg-panel2 text-ink border border-line',
};

const selectNav = (s: GameState) => ({
  unseenItems: selectUnseenItemCount(s),
  unseenRelics: selectUnseenRelicCount(s),
  unseenPets: selectUnseenPetCount(s),
  claimable: selectHasClaimableQuest(s),
  tokens: s.arcade.tokens,
  arcadeOpen: s.lifetimePeakLevel >= ARCADE_UNLOCK_LEVEL,
  cards: s.cards.length,
  relicsAwakened: s.relicsAwakened,
  eclipseOpen: isEclipseTabOpen(s),
  newArcade: isTabNew(s, 'ARCADE'),
  newCards: isTabNew(s, 'CARDS'),
  newPets: isTabNew(s, 'PETS'),
  newRelics: isTabNew(s, 'RELICS'),
  newEclipse: isTabNew(s, 'ECLIPSE'),
  newShop: isTabNew(s, 'SHOP'),
});
type NavState = ReturnType<typeof selectNav>;

const short = (n: number) => (n > 99 ? '99+' : formatNumber(n));

/** `noun` is singular; the spoken label adds the plural "s". */
function countBadge(n: number, noun: string, tone: BadgeTone): Badge | null {
  return n > 0 ? { text: short(n), spoken: `${formatNumber(n)} ${noun}${n === 1 ? '' : 's'}`, tone } : null;
}

/** A tab that just started to matter and has not been opened since (src/game/guide.ts). */
const NEW_BADGE: Badge = { text: 'NEW', spoken: 'new, not opened yet', tone: 'gold' };
const withNew = (isNew: boolean, other: Badge | null): Badge | null => (isNew ? NEW_BADGE : other);

const RUINS_LOCK = {
  short: `LV ${formatNumber(WORLD_TWO_FIRST_LEVEL)}`,
  long: `unlocks in the Frozen Ruins, level ${formatNumber(WORLD_TWO_FIRST_LEVEL)}`,
};

function buildTabs(n: NavState): Record<TabType, TabSpec> {
  return {
    UPGRADES: { label: 'UPGRADES', icon: Zap, badge: null, locked: null },
    GEAR: { label: 'ARMOR', icon: Shield, badge: countBadge(n.unseenItems, 'new item', 'neon'), locked: null },
    ARCADE: {
      label: 'ARCADE',
      icon: Gamepad2,
      badge: withNew(n.newArcade, n.arcadeOpen ? countBadge(n.tokens, 'token', 'info') : null),
      locked: n.arcadeOpen
        ? null
        : { short: `LV ${formatNumber(ARCADE_UNLOCK_LEVEL)}`, long: `unlocks at level ${formatNumber(ARCADE_UNLOCK_LEVEL)}` },
    },
    JOURNAL: {
      label: 'CODEX',
      icon: BookOpen,
      badge: n.claimable ? { text: '!', spoken: 'rewards ready to claim', tone: 'gold' } : null,
      locked: null,
    },
    CARDS: { label: 'CARDS', icon: Layers, badge: withNew(n.newCards, countBadge(n.cards, 'card', 'info')), locked: null },
    PETS: {
      label: 'BEAST',
      icon: PawPrint,
      badge: withNew(n.newPets, countBadge(n.unseenPets, 'new companion', 'neon')),
      locked: n.relicsAwakened ? null : RUINS_LOCK,
    },
    RELICS: {
      label: 'RELICS',
      icon: Gem,
      badge: withNew(n.newRelics, countBadge(n.unseenRelics, 'new relic', 'neon')),
      locked: n.relicsAwakened ? null : RUINS_LOCK,
    },
    ECLIPSE: {
      label: 'ECLIPSE',
      icon: Moon,
      badge: withNew(n.newEclipse, null),
      locked: n.eclipseOpen
        ? null
        : {
            short: `LV ${formatNumber(ECLIPSE_UNLOCK_LEVEL)}`,
            long: `unlocks when a run reaches level ${formatNumber(ECLIPSE_UNLOCK_LEVEL)}`,
          },
    },
    SHOP: { label: 'BAZAAR', icon: ShoppingBag, badge: withNew(n.newShop, null), locked: null },
  };
}

function spokenLabel(t: TabSpec): string {
  return [t.label, t.badge?.spoken, t.locked ? `locked, ${t.locked.long}` : null].filter(Boolean).join(', ');
}

const BadgeChip: React.FC<{ badge: Badge; className?: string }> = ({ badge, className = '' }) => (
  <span
    aria-hidden
    className={`min-w-[16px] h-4 px-1 text-[9px] font-mono-code font-black leading-none flex items-center justify-center shadow-hard ${BADGE_TONE[badge.tone]} ${className}`}
  >
    {badge.text}
  </span>
);

const slotClass = (lit: boolean) =>
  `relative min-h-[50px] px-1 py-1.5 flex flex-col items-center justify-center gap-1 border-t-2 border-r border-r-line last:border-r-0 transition-colors active:translate-y-0.5 active:scale-[0.98] ${
    lit ? 'text-neon bg-abyss border-t-amber' : 'text-dim bg-panel border-t-transparent hover:text-ink'
  }`;

const SlotLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] font-tech font-bold uppercase tracking-wider leading-none">{children}</span>
);

/**
 * The bottom bar: four primary tabs and MORE, which opens a small sheet with the rest.
 * Badges are read from state, so nothing new can be missed.
 */
export const NavigationTabs: React.FC<NavigationTabsProps> = ({ activeTab, onSelectTab }) => {
  const nav = useGameState(selectNav, shallowEqual);
  const tabs = buildTabs(nav);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();

  const close = useCallback(() => setOpen(false), []);
  useBackHandler(open, close);

  // A tab change from anywhere (the back button, a shop link) closes the sheet.
  useEffect(() => {
    setOpen(false);
  }, [activeTab]);

  // An outside tap closes it, and the tap still reaches what it landed on. Escape needs nothing
  // here: on the web it runs the back handler above, so one press closes only the sheet.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const select = (id: TabType) => {
    setOpen(false);
    onSelectTab(id);
  };

  const secondaryActive = SECONDARY.includes(activeTab);
  const moreNews = SECONDARY.some((id) => {
    const b = tabs[id].badge;
    return !!b && b.tone !== 'info';
  });
  const moreLabel = [
    'More tabs',
    // Names no tab, so finding a tab by its name never lands on MORE.
    secondaryActive ? 'the open tab is in this list' : null,
    moreNews ? 'something new inside' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div ref={wrapRef} className="relative shrink-0 select-none">
      {open && (
        <div
          id={sheetId}
          role="group"
          aria-label="More tabs"
          className="absolute bottom-full right-0 z-[58] w-60 max-w-full bg-panel border-2 border-line border-b-0 shadow-hard-lg flex flex-col animate-fade-in"
        >
          {SECONDARY.map((id) => {
            const t = tabs[id];
            const Icon = t.icon;
            const active = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => select(id)}
                aria-label={spokenLabel(t)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[48px] px-3 flex items-center gap-2.5 border-b border-line border-l-2 text-left transition-colors active:bg-abyss ${
                  active ? 'bg-abyss text-neon border-l-amber' : 'text-ink border-l-transparent hover:bg-panel2'
                }`}
              >
                <Icon size={16} aria-hidden className={active ? 'text-neon' : 'text-dim'} />
                <span className="flex-1 text-xs font-tech font-bold uppercase tracking-wider">{t.label}</span>
                {t.locked && (
                  <span aria-hidden className="flex items-center gap-1 text-[9px] font-mono-code text-dim">
                    <Lock size={10} />
                    {t.locked.short}
                  </span>
                )}
                {t.badge && <BadgeChip badge={t.badge} />}
              </button>
            );
          })}
        </div>
      )}

      <nav aria-label="Game sections" className="w-full grid grid-cols-5 bg-panel border-t-2 border-line">
        {PRIMARY.map((id) => {
          const t = tabs[id];
          const Icon = t.icon;
          const active = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => select(id)}
              aria-label={spokenLabel(t)}
              aria-current={active ? 'page' : undefined}
              className={slotClass(active)}
            >
              <span className="relative">
                <Icon size={18} aria-hidden />
                {t.locked && (
                  <span aria-hidden className="absolute -bottom-1 -left-2 bg-void text-dim leading-none">
                    <Lock size={10} />
                  </span>
                )}
                {t.badge && <BadgeChip badge={t.badge} className="absolute -top-2 left-3" />}
              </span>
              <SlotLabel>{t.label}</SlotLabel>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={moreLabel}
          aria-expanded={open}
          aria-controls={open ? sheetId : undefined}
          className={slotClass(secondaryActive || open)}
        >
          <span className="relative">
            <Ellipsis size={18} aria-hidden />
            {moreNews && (
              <span aria-hidden className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-gold border border-abyss" />
            )}
          </span>
          <SlotLabel>MORE</SlotLabel>
        </button>
      </nav>
    </div>
  );
};
