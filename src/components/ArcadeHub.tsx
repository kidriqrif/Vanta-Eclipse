import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Gamepad2, Lock, Trophy, Tv } from 'lucide-react';
import { MINIGAMES } from '../data/definitions';
import type { MinigameDefinition } from '../types/game';
import { isMinigameUnlocked } from '../game/arcade';
import { selectNextTokenMs } from '../game/selectors';
import { ARCADE_UNLOCK_LEVEL, TOKEN_CAP, type GameState } from '../game/state';
import { selectStats } from '../game/stats';
import { shallowEqual, useDispatch, useGameState, useGameStore, useNow } from '../hooks/useGame';
import { useAdOffer } from '../hooks/useMonetization';
import { formatDuration, formatNumber } from '../utils/numberFormat';
import { Button, Panel, PanelHeader, TabBody } from './ui';
import { MinigameHost } from './minigames/MinigameHost';
import { MINIGAME_COMPONENTS } from './minigames/registry';

const SORTED_MINIGAMES = [...MINIGAMES].sort((a, b) => a.sortOrder - b.sortOrder);
const NOTICE_MS = 5000;

interface OpenRun {
  gameId: string;
  runId: number;
}

interface Notice {
  text: string;
  tone: 'good' | 'bad';
}

const selectPeak = (s: GameState) => s.lifetimePeakLevel;
const selectTokens = (s: GameState) => s.arcade.tokens;
const selectRecords = (s: GameState) => s.arcade.records;
const selectActiveRun = (s: GameState) => s.ui.activeRun;
const selectRewardRate = (s: GameState) => selectStats(s).rewardRate;
const selectUnlocked = (s: GameState) => SORTED_MINIGAMES.map((def) => isMinigameUnlocked(s, def));

/** "12m 5s" until the next token; never "0s" while one is still on its way. */
const untilNext = (ms: number) => formatDuration(Math.max(1, Math.ceil(ms / 1000)));

function refusalText(reason: string | undefined, def: MinigameDefinition, nextMs: number): string {
  switch (reason) {
    case 'no_tokens':
      return `Out of tokens. The next one arrives in ${untilNext(nextMs)}.`;
    case 'locked':
      return `${def.displayName} opens when you reach level ${formatNumber(def.unlockLevel)}.`;
    case 'busy':
      return 'Another game is still open.';
    default:
      return `${def.displayName} is not available right now.`;
  }
}

const GameCard: React.FC<{
  def: MinigameDefinition;
  unlocked: boolean;
  best: number | undefined;
  tokens: number;
  nextMs: number;
  rewardRate: number;
  onPlay: (def: MinigameDefinition) => void;
}> = ({ def, unlocked, best, tokens, nextMs, rewardRate, onPlay }) => {
  const playable = !!MINIGAME_COMPONENTS[def.id];
  const affordable = tokens >= def.tokenCost;

  let button: React.ReactNode;
  if (!playable) {
    button = (
      <Button variant="ghost" size="md" block disabled>
        UNAVAILABLE
      </Button>
    );
  } else if (!unlocked) {
    button = (
      <Button variant="ghost" size="md" block disabled aria-label={`Locked. Opens when you reach level ${formatNumber(def.unlockLevel)}`}>
        <Lock size={12} aria-hidden className="shrink-0" />
        <span className="leading-tight">REACHES Lv. {formatNumber(def.unlockLevel)}</span>
      </Button>
    );
  } else if (!affordable) {
    button = (
      <Button variant="ghost" size="md" block disabled aria-label={`Out of tokens. Next token in ${untilNext(nextMs)}`}>
        <span className="flex flex-col items-center leading-tight">
          <span>NEXT TOKEN</span>
          <span className="font-mono-code text-[10px]">{untilNext(nextMs)}</span>
        </span>
      </Button>
    );
  } else {
    button = (
      <Button
        variant="primary"
        size="md"
        block
        onClick={() => onPlay(def)}
        aria-label={`Play ${def.displayName} for ${formatNumber(def.tokenCost)} token${def.tokenCost === 1 ? '' : 's'}`}
      >
        PLAY <span className="font-mono-code">◈ {formatNumber(def.tokenCost)}</span>
      </Button>
    );
  }

  return (
    <article
      data-testid={`minigame-card-${def.id}`}
      className={`border border-line border-l-4 p-2 flex items-center gap-2.5 ${
        unlocked ? 'bg-panel border-l-toxic/70' : 'bg-panel/55 border-l-line'
      }`}
    >
      <div className="w-12 h-12 shrink-0 border border-line bg-void flex items-center justify-center">
        <img src={def.icon} alt="" draggable={false} className={`w-10 h-10 object-contain ${unlocked ? '' : 'opacity-40 grayscale'}`} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wide leading-tight">{def.displayName}</h3>
        <p className="text-[10px] font-tech text-dim leading-snug">{def.description}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {best !== undefined && (
            <span className="text-[10px] font-mono-code font-bold text-gold flex items-center gap-1">
              <Trophy size={10} aria-hidden />
              Best: {formatNumber(best)} {def.scoreUnit}
            </span>
          )}
          {unlocked && (
            <span className="text-[10px] font-mono-code text-dim">
              Win: up to <span className="text-neon">◆ {formatNumber(Math.round(rewardRate * def.rewardSeconds))}</span>
            </span>
          )}
          {!unlocked && <span className="text-[10px] font-tech text-dim">Locked</span>}
        </div>
      </div>

      <div className="shrink-0 w-[104px]">{button}</div>
    </article>
  );
};

/** The ARCADE tab: the token meter and one card per minigame. */
export const ArcadeHub: React.FC = () => {
  const dispatch = useDispatch();
  const store = useGameStore();
  const now = useNow(1000);
  const peak = useGameState(selectPeak);
  const tokens = useGameState(selectTokens);
  const records = useGameState(selectRecords);
  const activeRun = useGameState(selectActiveRun);
  const rewardRate = useGameState(selectRewardRate);
  const gameUnlocked = useGameState(selectUnlocked, shallowEqual);
  const nextMs = useGameState((s) => selectNextTokenMs(s, now));
  const tokenOffer = useAdOffer('arcade_token');

  const [open, setOpen] = useState<OpenRun | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  // A run with no host on screen (a hot reload, a remount) would hold the boss fight forever.
  useEffect(() => {
    if (activeRun && activeRun.runId !== open?.runId) dispatch({ type: 'ARCADE_QUIT', runId: activeRun.runId });
  }, [activeRun, open, dispatch]);

  // Leaving the Arcade with a run still open (the host lives inside this tab) forfeits it.
  // The run is read from the store at cleanup time, never from a stale render.
  useEffect(() => {
    return () => {
      const run = store.getState().ui.activeRun;
      if (run) store.dispatch({ type: 'ARCADE_QUIT', runId: run.runId });
    };
  }, [store]);

  const play = (def: MinigameDefinition) => {
    if (open) return;
    const r = dispatch({ type: 'ARCADE_START', gameId: def.id });
    if (r.ok && r.runId !== undefined) {
      setNotice(null);
      setOpen({ gameId: def.id, runId: r.runId });
    } else {
      setNotice({ text: refusalText(r.reason, def, nextMs), tone: 'bad' });
    }
  };

  const close = useCallback(() => setOpen(null), []);
  // The same element object lets React skip the open game when the hub re-renders for its clock.
  const hostElement = useMemo(
    () => (open ? <MinigameHost key={open.runId} gameId={open.gameId} runId={open.runId} onClose={close} /> : null),
    [open, close],
  );

  const claimToken = async () => {
    const ok = await tokenOffer.claim();
    if (!mounted.current) return;
    setNotice(
      ok
        ? { text: '+1 token added.', tone: 'good' }
        : {
            text: tokenOffer.instant
              ? 'No token added. Try again in a moment.'
              : 'No token added: the ad was closed early or could not load.',
            tone: 'bad',
          },
    );
  };

  const unlocked = peak >= ARCADE_UNLOCK_LEVEL;
  const full = tokens >= TOKEN_CAP;

  const meter = (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-sm font-mono-code font-bold text-toxic">
        <span aria-hidden>◈ </span>
        {formatNumber(tokens)} / {formatNumber(TOKEN_CAP)}
        <span className="sr-only"> tokens</span>
      </span>
      <span className="text-[10px] font-tech text-dim flex items-center gap-1">
        {full ? (
          'FULL'
        ) : (
          <>
            <Clock size={10} aria-hidden /> next in {untilNext(nextMs)}
          </>
        )}
      </span>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<Gamepad2 size={16} className="text-neon" aria-hidden />}
        title="ARCADE"
        subtitle="Spend a token on a short game. Wins pay essence."
        right={unlocked ? meter : undefined}
      />

      <TabBody>
        {!unlocked ? (
          <Panel className="items-center text-center py-6">
            <div className="w-12 h-12 border border-line bg-void flex items-center justify-center text-dim">
              <Lock size={20} aria-hidden />
            </div>
            <p className="text-sm font-display font-bold text-ink uppercase tracking-wider">
              The Arcade opens at level {formatNumber(ARCADE_UNLOCK_LEVEL)}
            </p>
            <p className="text-[11px] font-tech text-dim">
              Your best level so far: {formatNumber(peak)} of {formatNumber(ARCADE_UNLOCK_LEVEL)}
            </p>
            <div
              className="w-full max-w-[220px] h-2 bg-void border border-line"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={ARCADE_UNLOCK_LEVEL}
              aria-valuenow={Math.min(peak, ARCADE_UNLOCK_LEVEL)}
              aria-label="Progress to the Arcade"
            >
              <div className="h-full bg-neon" style={{ width: `${Math.min(100, (peak / ARCADE_UNLOCK_LEVEL) * 100)}%` }} />
            </div>
          </Panel>
        ) : (
          <>
            <p className="text-[10px] font-tech text-dim leading-snug px-0.5">
              Each game costs a token. Payouts scale with your current essence rate; a loss still pays a little. Tokens refill over time, up
              to {formatNumber(TOKEN_CAP)}.
            </p>

            {tokens < 1 && (
              <Panel tone="gold">
                <p className="text-xs font-display font-bold text-ink uppercase tracking-wider">Out of tokens</p>
                <p className="text-[11px] font-tech text-dim flex items-center gap-1">
                  <Clock size={11} aria-hidden /> The next token arrives in {untilNext(nextMs)}.
                </p>
                {tokenOffer.canWatch ? (
                  <div className="flex items-center gap-2">
                    <Button variant="gold" size="md" onClick={claimToken} disabled={tokenOffer.busy}>
                      {!tokenOffer.instant && <Tv size={12} aria-hidden />}
                      {tokenOffer.busy ? 'LOADING…' : tokenOffer.instant ? 'CLAIM +1 TOKEN' : 'WATCH AD · +1 TOKEN'}
                    </Button>
                    <span className="text-[10px] font-tech text-dim">
                      {tokenOffer.instant ? 'No ad with Remove Ads. ' : 'Optional. '}
                      {formatNumber(tokenOffer.remaining)} of {formatNumber(tokenOffer.cap)} left today
                    </span>
                  </div>
                ) : (
                  tokenOffer.cap > 0 &&
                  tokenOffer.remaining === 0 && <p className="text-[10px] font-tech text-dim">Today's bonus tokens are used up.</p>
                )}
              </Panel>
            )}

            <div role="status" aria-live="polite" className="empty:hidden">
              {notice && (
                <p
                  className={`text-[11px] font-tech border px-2 py-1.5 ${
                    notice.tone === 'good' ? 'text-toxic border-toxic/40 bg-toxic/5' : 'text-crimson border-crimson/40 bg-crimson/5'
                  }`}
                >
                  {notice.tone === 'good' ? '✓ ' : '✕ '}
                  {notice.text}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {SORTED_MINIGAMES.map((def, i) => (
                <GameCard
                  key={def.id}
                  def={def}
                  unlocked={gameUnlocked[i]}
                  best={records[def.id]}
                  tokens={tokens}
                  nextMs={nextMs}
                  rewardRate={rewardRate}
                  onPlay={play}
                />
              ))}
            </div>
          </>
        )}
      </TabBody>

      {hostElement}
    </div>
  );
};
