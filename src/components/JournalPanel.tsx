import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen, Calendar, Check, Clock, Gift, Link, Lock, Trophy, type LucideIcon } from 'lucide-react';
import { DAILY_ALL_CLEAR_REWARDS, QUESTS } from '../data/definitions';
import type { QuestDefinition } from '../types/game';
import {
  activeDailies,
  canClaimAllClear,
  canClaimQuest,
  getQuestProgress,
  isQuestClaimed,
  isQuestLocked,
} from '../game/quests';
import { localDateKey, type GameState } from '../game/state';
import { shallowEqual, useDispatch, useGameState, useNow } from '../hooks/useGame';
import { formatDuration, formatNumber } from '../utils/numberFormat';
import { Button, PanelHeader, TabBody } from './ui';

type Section = 'DAILY' | 'CHAIN' | 'FEATS';
type RewardKind = QuestDefinition['rewardKind'];
type QuestStatus = 'ready' | 'progress' | 'locked' | 'done';

/** The open section survives tab switches for the session. */
let lastSection: Section = 'DAILY';

const byOrder = (a: QuestDefinition, b: QuestDefinition) => a.sortOrder - b.sortOrder;
const CHAIN = QUESTS.filter((q) => q.kind === 'CHAIN').sort(byOrder);
const FEATS = QUESTS.filter((q) => q.kind === 'ACHIEVEMENT').sort(byOrder);
const QUEST_NAMES = new Map(QUESTS.map((q) => [q.id, q.displayName]));

/** formatNumber without trailing zeros: 3000 → "3K", 1500 → "1.5K", 50 → "50". */
function amount(n: number): string {
  return formatNumber(n).replace(/\.?0+([A-Za-z]+)$/, '$1');
}

const REWARD: Record<RewardKind, { one: string; many: string; tone: string }> = {
  ESSENCE: { one: 'ESSENCE', many: 'ESSENCE', tone: 'text-neon' },
  CRYSTALS: { one: 'CRYSTAL', many: 'CRYSTALS', tone: 'text-purple' },
  SHARDS: { one: 'SHARD', many: 'SHARDS', tone: 'text-gold' },
  TOKENS: { one: 'TOKEN', many: 'TOKENS', tone: 'text-crimson' },
};

/** "+2 TOKENS", "+5 CRYSTALS", "+3K ESSENCE". */
function rewardText(kind: RewardKind, n: number): string {
  const r = REWARD[kind];
  return `+${amount(n)} ${n === 1 ? r.one : r.many}`;
}

/** Adding a reward to DAILY_ALL_CLEAR_REWARDS without naming it here is a compile error. */
const ALL_CLEAR_KIND: Record<keyof typeof DAILY_ALL_CLEAR_REWARDS, RewardKind> = {
  crystals: 'CRYSTALS',
  shards: 'SHARDS',
  tokens: 'TOKENS',
  essence: 'ESSENCE',
};
const ALL_CLEAR_LINES = (Object.keys(ALL_CLEAR_KIND) as (keyof typeof DAILY_ALL_CLEAR_REWARDS)[]).map((k) => ({
  kind: ALL_CLEAR_KIND[k],
  n: DAILY_ALL_CLEAR_REWARDS[k],
}));

/** A tag for quests whose definition has no category. */
const METRIC_TAG: Record<string, string> = {
  kills: 'COMBAT',
  taps: 'STRIKE',
  boss_wins: 'BOSS',
  enemy_level: 'CLIMB',
  upgrades_bought: 'FORGE',
  items_dropped: 'GEAR',
  eclipses: 'ECLIPSE',
  minigame_wins: 'ARCADE',
  minigame_played: 'ARCADE',
  pets_owned: 'COMPANION',
  relics_owned: 'RELIC',
  skills_bought: 'SKILL',
  crystals_earned: 'RESOURCE',
};

function questStatus(s: GameState, q: QuestDefinition): QuestStatus {
  if (isQuestClaimed(s, q)) return 'done';
  if (isQuestLocked(s, q)) return 'locked';
  return canClaimQuest(s, q) ? 'ready' : 'progress';
}

function msUntilLocalMidnight(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now;
}

const selectDailyDate = (s: GameState) => s.quests.daily.date;
const selectAllClearClaimed = (s: GameState) => s.quests.daily.allClearClaimed;
const selectDailyClaimedCount = (s: GameState) =>
  activeDailies(s).reduce((n, q) => n + (s.quests.daily.claimed.includes(q.id) ? 1 : 0), 0);
const selectFeatsDone = (s: GameState) => FEATS.reduce((n, q) => n + (isQuestClaimed(s, q) ? 1 : 0), 0);
/** One character per chain quest (d = done, l = locked, o = open), so the selector returns a primitive. */
const selectChainKey = (s: GameState) =>
  CHAIN.map((q) => (isQuestClaimed(s, q) ? 'd' : isQuestLocked(s, q) ? 'l' : 'o')).join('');
/** Rewards ready to claim per section: [daily (incl. the all-clear), chain, feats]. */
const selectReady = (s: GameState): number[] => [
  activeDailies(s).reduce((n, q) => n + (canClaimQuest(s, q) ? 1 : 0), 0) + (canClaimAllClear(s) ? 1 : 0),
  CHAIN.reduce((n, q) => n + (canClaimQuest(s, q) ? 1 : 0), 0),
  FEATS.reduce((n, q) => n + (canClaimQuest(s, q) ? 1 : 0), 0),
];

const StateChip: React.FC<{ icon: LucideIcon; label: string; tone: string; className?: string }> = ({
  icon: Icon,
  label,
  tone,
  className = '',
}) => (
  <span
    className={`min-h-[32px] w-full px-1.5 flex items-center justify-center gap-1 border border-line bg-panel2 text-[10px] font-display font-bold ${tone} ${className}`}
  >
    <Icon size={12} aria-hidden />
    {label}
  </span>
);

const QuestRow: React.FC<{ quest: QuestDefinition }> = React.memo(({ quest }) => {
  const dispatch = useDispatch();
  const progress = useGameState(useCallback((s: GameState) => getQuestProgress(s, quest), [quest]));
  const status = useGameState(useCallback((s: GameState) => questStatus(s, quest), [quest]));
  const [justClaimed, setJustClaimed] = useState(false);

  const target = quest.targetValue;
  // A claimed quest was complete when claimed; show it full even if an old save's counter is lower.
  const shown = status === 'done' ? target : Math.min(progress, target);
  const pct = target > 0 ? Math.min(100, (shown / target) * 100) : 100;
  const reward = rewardText(quest.rewardKind, quest.rewardAmount);
  const tag = quest.category ?? METRIC_TAG[quest.metric];
  const prereqName = (quest.prereqId && QUEST_NAMES.get(quest.prereqId)) || 'the previous quest';

  const claim = () => {
    const r = dispatch({ type: 'CLAIM_QUEST', id: quest.id });
    if (r.ok) setJustClaimed(true);
  };

  const spine = status === 'ready' ? 'border-l-neon' : status === 'done' ? 'border-l-line' : 'border-l-neon/30';

  return (
    <div
      className={`bg-panel border border-line border-l-4 ${spine} p-2 flex flex-col gap-1.5 ${
        status === 'done' ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-xs font-display font-bold text-ink uppercase tracking-wide leading-tight">
              {quest.displayName}
            </span>
            {tag && (
              <span className="text-[9px] font-mono-code text-dim border border-line bg-panel2 px-1 leading-4 uppercase">
                {tag}
              </span>
            )}
          </div>
          <p className="text-[10px] font-tech text-dim leading-tight">{quest.description}</p>
        </div>
        <span className={`shrink-0 text-[10px] font-mono-code font-bold ${REWARD[quest.rewardKind].tone}`}>{reward}</span>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[10px] font-mono-code text-dim">
            {amount(shown)} / {amount(target)}
          </span>
          <div
            role="progressbar"
            aria-label={`${quest.displayName} progress`}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={shown}
            aria-valuetext={`${amount(shown)} of ${amount(target)}`}
            className="h-1.5 bg-panel2 border border-line overflow-hidden"
          >
            <div
              className={`h-full transition-[width] duration-150 ${status === 'locked' ? 'bg-faint' : 'bg-neon'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 w-[88px]" aria-live="polite">
          {status === 'ready' && (
            <Button
              variant="solid"
              size="md"
              block
              onClick={claim}
              className="motion-safe:animate-pulse"
              aria-label={`Claim ${reward} for ${quest.displayName}`}
            >
              CLAIM
            </Button>
          )}
          {status === 'done' && (
            <StateChip icon={Check} label="DONE" tone="text-neon" className={justClaimed ? 'animate-fade-in' : ''} />
          )}
          {status === 'locked' && <StateChip icon={Lock} label="LOCKED" tone="text-dim" />}
        </div>
      </div>

      {status === 'locked' && (
        <p className="text-[10px] font-tech text-dim leading-tight flex items-center gap-1">
          <Lock size={10} aria-hidden className="shrink-0" />
          Complete {prereqName} first
        </p>
      )}
    </div>
  );
});
QuestRow.displayName = 'QuestRow';

/** "Resets in 5h 12m", to local midnight — the moment the dailies reroll. */
const ResetsIn: React.FC = () => {
  const now = useNow(1000);
  const dailyDate = useGameState(selectDailyDate);
  const text =
    dailyDate === localDateKey(now)
      ? `Resets in ${formatDuration(Math.max(0, Math.ceil(msUntilLocalMidnight(now) / 1000)))}`
      : 'New dailies arriving…';
  return (
    <span className="text-[10px] font-tech text-dim flex items-center gap-1">
      <Clock size={11} aria-hidden />
      {text}
    </span>
  );
};

const AllClearBanner: React.FC<{ total: number; claimed: number }> = ({ total, claimed }) => {
  const dispatch = useDispatch();
  const ready = useGameState(canClaimAllClear);
  const done = useGameState(selectAllClearClaimed);
  const left = Math.max(0, total - claimed);

  const status = done
    ? 'Claimed for today.'
    : ready
      ? 'Every daily is claimed. Your bonus is ready.'
      : `Claim all of today's dailies to unlock it (${amount(left)} to go).`;

  return (
    <section
      aria-label="Daily all-clear bonus"
      className={`bg-panel border border-l-4 p-2 flex flex-col gap-1.5 ${
        ready ? 'border-gold border-l-gold' : 'border-gold/40 border-l-gold/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 shrink-0 border border-gold bg-void flex items-center justify-center">
          <Gift size={15} className="text-gold" aria-hidden />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-[11px] font-display font-bold text-gold uppercase tracking-wide">ALL-CLEAR BONUS</span>
          <span className="text-[10px] font-tech text-dim leading-tight">{status}</span>
        </div>
        <div className="shrink-0 w-[88px]" aria-live="polite">
          {done ? (
            <StateChip icon={Check} label="DONE" tone="text-gold" />
          ) : (
            <Button
              variant="gold"
              size="md"
              block
              disabled={!ready}
              onClick={() => dispatch({ type: 'CLAIM_ALL_CLEAR' })}
              className={ready ? 'motion-safe:animate-pulse' : ''}
              aria-label={ready ? 'Claim the all-clear bonus' : 'All-clear bonus, not ready yet'}
            >
              CLAIM
            </Button>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-2.5 gap-y-0.5" aria-label="Bonus rewards">
        {ALL_CLEAR_LINES.map((l) => (
          <li key={l.kind} className={`text-[10px] font-mono-code font-bold ${REWARD[l.kind].tone}`}>
            {rewardText(l.kind, l.n)}
          </li>
        ))}
      </ul>
    </section>
  );
};

const DailySection: React.FC = () => {
  const dailies = useGameState(activeDailies, shallowEqual);
  const claimed = useGameState(selectDailyClaimedCount);
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <ResetsIn />
        <span className="text-[10px] font-mono-code text-dim">
          {amount(claimed)}/{amount(dailies.length)} CLAIMED
        </span>
      </div>
      <p className="text-[10px] font-tech text-dim leading-tight px-0.5">
        New goals every day. Rewards not claimed by the reset are lost.
      </p>
      <AllClearBanner total={dailies.length} claimed={claimed} />
      {dailies.map((q) => (
        <QuestRow key={q.id} quest={q} />
      ))}
    </>
  );
};

/** The chain reads as a path: the current quest, the next one (locked), then what is done. */
const ChainSection: React.FC = () => {
  const key = useGameState(selectChainKey);
  const view = useMemo(() => {
    const open: QuestDefinition[] = [];
    const locked: QuestDefinition[] = [];
    const done: QuestDefinition[] = [];
    CHAIN.forEach((q, i) => (key[i] === 'd' ? done : key[i] === 'l' ? locked : open).push(q));
    return { open, next: locked[0] ?? null, hidden: Math.max(0, locked.length - 1), done };
  }, [key]);

  return (
    <>
      <p className="text-[10px] font-tech text-dim leading-tight px-0.5">
        Story quests unlock one at a time, in order. {amount(view.done.length)}/{amount(CHAIN.length)} complete.
      </p>
      {view.open.map((q) => (
        <QuestRow key={q.id} quest={q} />
      ))}
      {view.next && <QuestRow key={view.next.id} quest={view.next} />}
      {view.hidden > 0 && (
        <p className="text-[10px] font-tech text-dim text-center py-1">
          {amount(view.hidden)} more {view.hidden === 1 ? 'quest unlocks' : 'quests unlock'} after that.
        </p>
      )}
      {view.open.length === 0 && !view.next && (
        <p className="text-[10px] font-tech text-neon text-center py-1">Every story quest is complete.</p>
      )}
      {view.done.length > 0 && (
        <>
          <h3 className="text-[10px] font-display font-bold text-dim uppercase tracking-wider mt-1 px-0.5">Completed</h3>
          {view.done.map((q) => (
            <QuestRow key={q.id} quest={q} />
          ))}
        </>
      )}
    </>
  );
};

const FeatsSection: React.FC = () => {
  const done = useGameState(selectFeatsDone);
  return (
    <>
      <p className="text-[10px] font-tech text-dim leading-tight px-0.5">
        Lifetime milestones. They are kept through every Eclipse. {amount(done)}/{amount(FEATS.length)} claimed.
      </p>
      {FEATS.map((q) => (
        <QuestRow key={q.id} quest={q} />
      ))}
    </>
  );
};

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'DAILY', label: 'DAILY', icon: Calendar },
  { id: 'CHAIN', label: 'CHAIN', icon: Link },
  { id: 'FEATS', label: 'FEATS', icon: Trophy },
];

/** The CODEX tab: daily goals, the story chain and lifetime feats, all claimed by hand. */
export const JournalPanel: React.FC = () => {
  const [section, setSection] = useState<Section>(lastSection);
  const ready = useGameState(selectReady, shallowEqual);
  const totalReady = ready.reduce((a, b) => a + b, 0);

  const choose = (s: Section) => {
    lastSection = s;
    setSection(s);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<BookOpen size={16} className="text-neon" aria-hidden />}
        title="CODEX"
        subtitle="Goals and their rewards. Claim each one when it is done."
        right={
          totalReady > 0 ? (
            <span className="px-1.5 py-1 border border-gold/60 text-[10px] font-display font-bold text-gold">
              {amount(totalReady)} READY
            </span>
          ) : undefined
        }
      />

      <div className="px-2.5 pt-2 bg-void">
        <div className="grid grid-cols-3 border border-line bg-panel" role="tablist" aria-label="Codex sections">
          {SECTIONS.map(({ id, label, icon: Icon }, i) => {
            const active = id === section;
            const n = ready[i] ?? 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => choose(id)}
                className={`min-h-[40px] px-1 flex items-center justify-center gap-1.5 text-[11px] font-display font-bold tracking-wider border-b-2 transition-colors ${
                  active ? 'bg-active text-neon border-b-neon' : 'text-dim border-b-transparent hover:text-ink'
                }`}
              >
                <Icon size={12} aria-hidden />
                {label}
                {n > 0 && (
                  <>
                    <span
                      aria-hidden
                      className="min-w-[16px] h-4 px-1 bg-gold text-void text-[9px] font-mono-code font-black leading-none flex items-center justify-center"
                    >
                      {amount(n)}
                    </span>
                    <span className="sr-only">, {amount(n)} ready to claim</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <TabBody>
        <div role="tabpanel" aria-label={section} className="flex flex-col gap-2">
          {section === 'DAILY' && <DailySection />}
          {section === 'CHAIN' && <ChainSection />}
          {section === 'FEATS' && <FeatsSection />}
        </div>
      </TabBody>
    </div>
  );
};
