import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Lock, Moon, RotateCcw, ShieldCheck } from 'lucide-react';
import { SKILLS } from '../data/definitions';
import type { SkillNodeDefinition } from '../types/game';
import { eclipsePayout, skillBlocker, skillCost } from '../game/reducer';
import { AUTO_ATTACK_UNLOCK_LEVEL, ECLIPSE_UNLOCK_LEVEL, type GameState } from '../game/state';
import { useDispatch, useGameState } from '../hooks/useGame';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Button, PanelHeader, TabBody, TwoTapButton } from './ui';

type BranchId = SkillNodeDefinition['branch'];
type Filter = 'ALL' | BranchId;

const BRANCHES: { id: BranchId; blurb: string }[] = [
  { id: 'Fortune', blurb: 'Essence and offline earnings' },
  { id: 'Ascendance', blurb: 'Crystal payout and boss damage' },
  { id: 'Automation', blurb: 'Auto-attack' },
  { id: 'Might', blurb: 'Tap and crit damage' },
];
const FILTERS: Filter[] = ['ALL', ...BRANCHES.map((b) => b.id)];

/** The branch filter survives tab switches for the session. */
let lastFilter: Filter = 'ALL';

const NOTICE_MS = 3500;

/** How each skill stat reads. Crit damage is shown as a percent, like the upgrades tab. */
const STAT_COPY: Record<string, { noun: string; unit: 'percent' | 'hours' }> = {
  essence: { noun: 'essence', unit: 'percent' },
  crystal_gain: { noun: 'Eclipse crystals', unit: 'percent' },
  tap_pct: { noun: 'tap damage', unit: 'percent' },
  offline_efficiency: { noun: 'offline efficiency', unit: 'percent' },
  boss: { noun: 'boss damage', unit: 'percent' },
  crit_damage: { noun: 'crit damage', unit: 'percent' },
  attack_speed: { noun: 'auto-attack speed', unit: 'percent' },
  offline_cap_hours: { noun: 'max offline time', unit: 'hours' },
};

/** Skills that switch a behaviour on rather than adding to a stat. */
const FLAG_COPY: Record<string, string> = {
  auto_attack_start: 'Auto-attack from the start of every run',
};

/** "+10%", "+0.5%": a decimal only when the value needs one. */
function pct(v: number): string {
  const hundredths = Math.round(v * 10000);
  return formatPercent(v, hundredths % 100 === 0 ? 0 : 1);
}

function statValue(def: SkillNodeDefinition, level: number): string {
  const v = def.valuePerLevel * level;
  const unit = STAT_COPY[def.effectStat]?.unit ?? (def.displayAsPercent ? 'percent' : 'number');
  if (unit === 'percent') return pct(v);
  if (unit === 'hours') return `+${formatNumber(v)} ${v === 1 ? 'hour' : 'hours'}`;
  return `+${formatNumber(v)}`;
}

/** "+20% → +30% essence", "Off → Auto-attack from the start of every run", or the maxed value. */
function effectLine(def: SkillNodeDefinition, level: number): string {
  const maxed = level >= def.maxLevel;
  if (def.effectKind === 1) {
    const on = FLAG_COPY[def.effectStat] ?? def.description;
    return level > 0 ? on : `Off → ${on}`;
  }
  const noun = STAT_COPY[def.effectStat]?.noun ?? def.displayName.toLowerCase();
  if (maxed) return `${statValue(def, level)} ${noun}`;
  return `${statValue(def, level)} → ${statValue(def, level + 1)} ${noun}`;
}

const SKILLS_BY_BRANCH: Record<BranchId, SkillNodeDefinition[]> = {
  Fortune: [],
  Ascendance: [],
  Automation: [],
  Might: [],
};
for (const s of [...SKILLS].sort((a, b) => a.sortOrder - b.sortOrder)) SKILLS_BY_BRANCH[s.branch].push(s);

const selectCrystals = (s: GameState) => s.currencies.void_crystals;
const selectPeakRun = (s: GameState) => s.peakRunLevel;
const selectPeakLifetime = (s: GameState) => s.lifetimePeakLevel;
const selectEclipseCount = (s: GameState) => s.eclipseCount;
const selectPayout = (s: GameState) => eclipsePayout(s);
/** What an Eclipse would pay at the unlock level, with the powers the player owns now. */
const selectPayoutAtUnlock = (s: GameState) =>
  eclipsePayout({ ...s, peakRunLevel: Math.max(s.peakRunLevel, ECLIPSE_UNLOCK_LEVEL) });
const selectHasReflex = (s: GameState) => (s.skills['eternal_reflex'] || 0) > 0;

const REFUSALS: Record<string, string> = {
  not_enough: 'Not enough Void Crystals',
  prereq: 'Buy the required power first',
  max_level: 'Already maxed',
};

const SkillNode: React.FC<{ def: SkillNodeDefinition; onRefused: (text: string) => void }> = React.memo(({ def, onRefused }) => {
  const dispatch = useDispatch();
  const level = useGameState(useCallback((s: GameState) => s.skills[def.id] || 0, [def.id]));
  const cost = useGameState(useCallback((s: GameState) => skillCost(s, def.id), [def.id]));
  const blocker = useGameState(useCallback((s: GameState) => skillBlocker(s, def.id), [def.id]));
  const crystals = useGameState(selectCrystals);

  const prereq = def.prereqId ? SKILLS.find((s) => s.id === def.prereqId) : undefined;
  const prereqText = prereq ? `Requires ${prereq.displayName} Lv ${formatNumber(def.prereqLevel || 1)}` : 'Requires another power first';
  const locked = blocker === 'prereq';
  const shortBy = Math.max(0, cost - crystals);
  const maxed = blocker === 'max_level';

  const buy = () => {
    const r = dispatch({ type: 'BUY_SKILL', id: def.id });
    if (!r.ok) onRefused(`${def.displayName}: ${r.reason === 'prereq' ? prereqText : REFUSALS[r.reason ?? ''] ?? 'Could not buy'}`);
  };

  return (
    <div className={`bg-panel border p-2 flex items-center gap-2.5 ${locked ? 'border-dashed border-line' : maxed ? 'border-purple/50' : 'border-line'}`}>
      <div className={`flex-1 min-w-0 flex flex-col gap-0.5 ${locked ? 'opacity-70' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-xs font-display font-bold text-ink uppercase tracking-wide leading-tight">{def.displayName}</span>
          <span key={level} className="animate-fade-in text-[10px] font-mono-code font-bold text-dim border border-line px-1 leading-4">
            LV {formatNumber(level)}/{formatNumber(def.maxLevel)}
          </span>
        </div>
        <span className="text-[11px] font-mono-code font-bold text-neon leading-tight">{effectLine(def, level)}</span>
        {locked && (
          <span className="text-[10px] font-tech text-gold leading-tight flex items-center gap-1">
            <Lock size={10} aria-hidden /> {prereqText}
          </span>
        )}
        {blocker === 'not_enough' && (
          <span className="text-[10px] font-tech text-crimson leading-tight">
            Need {formatNumber(shortBy)} more {shortBy === 1 ? 'crystal' : 'crystals'}
          </span>
        )}
      </div>

      <div className="shrink-0 w-[96px]">
        {maxed ? (
          <div className="min-h-[44px] border border-purple/50 bg-panel2 flex items-center justify-center text-[10px] font-display font-bold text-purple">
            ● MAXED
          </div>
        ) : locked ? (
          <div className="min-h-[44px] border border-line bg-panel2 flex items-center justify-center gap-1 text-[10px] font-display font-bold text-dim">
            <Lock size={11} aria-hidden /> LOCKED
          </div>
        ) : (
          <Button
            variant={blocker ? 'ghost' : 'primary'}
            size="md"
            block
            disabled={blocker !== null}
            onClick={buy}
            aria-label={`${blocker ? 'Need' : 'Buy'} ${def.displayName} level ${level + 1} for ${formatNumber(cost)} Void Crystals`}
          >
            <span className="flex flex-col items-center leading-tight">
              <span>{blocker ? 'NEED' : 'BUY'}</span>
              <span className="font-mono-code text-[10px] text-ink">
                <span className="text-purple" aria-hidden>
                  ◆{' '}
                </span>
                {formatNumber(cost)}
              </span>
            </span>
          </Button>
        )}
      </div>
    </div>
  );
});
SkillNode.displayName = 'SkillNode';

const ListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="text-[10px] font-tech text-ink leading-snug pl-2 border-l border-line">{children}</li>
);

/** The ECLIPSE tab: collapse the run for Void Crystals, and spend them on Ascendant Powers. */
export const EclipsePanel: React.FC = () => {
  const dispatch = useDispatch();
  const crystals = useGameState(selectCrystals);
  const peakRun = useGameState(selectPeakRun);
  const peakLifetime = useGameState(selectPeakLifetime);
  const eclipseCount = useGameState(selectEclipseCount);
  const payout = useGameState(selectPayout);
  const payoutAtUnlock = useGameState(selectPayoutAtUnlock);
  const hasReflex = useGameState(selectHasReflex);

  const [filter, setFilter] = useState<Filter>(lastFilter);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    },
    [],
  );

  const flash = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      noticeTimer.current = null;
      setNotice(null);
    }, NOTICE_MS);
  }, []);

  const choose = (f: Filter) => {
    lastFilter = f;
    setFilter(f);
  };

  const unlocked = peakRun >= ECLIPSE_UNLOCK_LEVEL;
  const progress = Math.min(100, (peakRun / ECLIPSE_UNLOCK_LEVEL) * 100);

  const commit = () => {
    const r = dispatch({ type: 'PERFORM_ECLIPSE' });
    if (!r.ok) {
      flash(
        r.reason === 'busy'
          ? 'The last Eclipse is still settling. Try again in a moment.'
          : `Reach level ${formatNumber(ECLIPSE_UNLOCK_LEVEL)} in this run first.`,
      );
    }
  };

  const shownBranches = filter === 'ALL' ? BRANCHES : BRANCHES.filter((b) => b.id === filter);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<Moon size={16} className="text-crimson" aria-hidden />}
        tone="crimson"
        title="ECLIPSE"
        subtitle="Trade this run for permanent powers."
        right={
          <span className="text-[11px] font-mono-code font-bold text-purple border border-purple/50 px-1.5 py-1">
            <span aria-hidden>◆ </span>
            {formatNumber(crystals)}
            <span className="sr-only"> Void Crystals</span>
          </span>
        }
      />

      <TabBody>
        <section className="bg-panel border border-crimson/60 p-2.5 flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Run peak', value: `Lv ${formatNumber(peakRun)}` },
              { label: 'Best ever', value: `Lv ${formatNumber(peakLifetime)}` },
              { label: 'Eclipses', value: formatNumber(eclipseCount) },
            ].map((s) => (
              <div key={s.label} className="bg-panel2 border border-line px-1.5 py-1 flex flex-col items-center min-w-0">
                <span className="text-[9px] font-tech text-dim uppercase tracking-wider">{s.label}</span>
                <span className="text-xs font-mono-code font-bold text-ink truncate max-w-full">{s.value}</span>
              </div>
            ))}
          </div>

          {unlocked ? (
            <p className="text-[11px] font-tech text-ink leading-snug">
              Collapsing now yields{' '}
              <span className="font-mono-code font-bold text-purple">◆ {formatNumber(payout)} Void Crystals</span>. A higher run peak pays
              more.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-display font-bold text-gold uppercase tracking-wide flex items-center gap-1.5">
                <Lock size={12} aria-hidden /> Reach level {formatNumber(ECLIPSE_UNLOCK_LEVEL)} in this run
              </span>
              <div
                className="w-full h-1.5 bg-void border border-line overflow-hidden"
                role="progressbar"
                aria-label="Run peak toward the Eclipse"
                aria-valuemin={0}
                aria-valuemax={ECLIPSE_UNLOCK_LEVEL}
                aria-valuenow={Math.min(peakRun, ECLIPSE_UNLOCK_LEVEL)}
              >
                <div className="h-full bg-gold" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] font-tech text-dim leading-snug">
                Run peak Lv {formatNumber(peakRun)} / {formatNumber(ECLIPSE_UNLOCK_LEVEL)}. At level{' '}
                {formatNumber(ECLIPSE_UNLOCK_LEVEL)} an Eclipse pays ◆ {formatNumber(payoutAtUnlock)}; deeper peaks pay more.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-display font-bold text-crimson uppercase tracking-wider flex items-center gap-1">
                <RotateCcw size={11} aria-hidden /> Reset
              </span>
              <ul className="flex flex-col gap-1">
                <ListItem>Essence → 0</ListItem>
                <ListItem>Every upgrade (UPGRADES tab)</ListItem>
                <ListItem>Level → 1 (Dark Forest)</ListItem>
                <ListItem>World unlocks re-lock</ListItem>
                {!hasReflex && (
                  <ListItem>
                    Auto-attack re-locks until level {formatNumber(AUTO_ATTACK_UNLOCK_LEVEL)} unless you own Eternal Reflex
                  </ListItem>
                )}
              </ul>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-display font-bold text-toxic uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={11} aria-hidden /> Kept
              </span>
              <ul className="flex flex-col gap-1">
                <ListItem>Void Crystals and every Ascendant Power</ListItem>
                <ListItem>All equipment and boss cards</ListItem>
                <ListItem>Relics</ListItem>
                <ListItem>Companions and their levels</ListItem>
                <ListItem>Scraps and shards</ListItem>
                <ListItem>Lifetime stats and settings</ListItem>
                {hasReflex && <ListItem>Auto-attack from the start (Eternal Reflex)</ListItem>}
              </ul>
            </div>
          </div>

          <TwoTapButton
            size="lg"
            block
            variant="gold"
            disabled={!unlocked}
            label={unlocked ? 'COLLAPSE THE RUN' : `LOCKED UNTIL LEVEL ${formatNumber(ECLIPSE_UNLOCK_LEVEL)}`}
            armedLabel={`TAP AGAIN: +${formatNumber(payout)} CRYSTALS, RESET RUN`}
            onConfirm={commit}
          />
        </section>

        <div aria-live="polite">
          {notice && (
            <div className="animate-fade-in border border-crimson/60 bg-crimson/10 p-2 text-[11px] font-tech text-ink flex items-start gap-1.5">
              <AlertTriangle size={13} className="text-crimson shrink-0 mt-px" aria-hidden />
              <span>{notice}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider">Ascendant Powers</h3>
            <span className="text-[10px] font-tech text-dim">Permanent. Kept through every Eclipse.</span>
          </div>
          <div className="grid grid-cols-5 border border-line bg-panel" role="group" aria-label="Filter powers by branch">
            {FILTERS.map((f) => {
              const active = f === filter;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(f)}
                  className={`min-h-[32px] px-0.5 text-[9px] font-mono-code font-bold uppercase transition-colors ${
                    active ? 'bg-neon text-void underline underline-offset-2' : 'text-dim hover:text-ink'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {shownBranches.map((b) => (
          <div key={b.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2 px-0.5 pt-1">
              <span className="text-[11px] font-display font-bold text-neon uppercase tracking-wider">{b.id}</span>
              <span className="text-[10px] font-tech text-dim truncate">{b.blurb}</span>
            </div>
            {SKILLS_BY_BRANCH[b.id].map((def) => (
              <SkillNode key={def.id} def={def} onRefused={flash} />
            ))}
          </div>
        ))}
      </TabBody>
    </div>
  );
};
