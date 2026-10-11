import React, { useCallback, useState } from 'react';
import { Check, CircleHelp, Flag, X } from 'lucide-react';
import { QUESTS } from '../data/definitions';
import { TAB_HELP, tabHelpKey, type GuideTab } from '../game/guide';
import { canClaimQuest, getQuestProgress, isQuestClaimed } from '../game/quests';
import type { GameState } from '../game/state';
import { shallowEqual, useDispatch, useGameState } from '../hooks/useGame';
import { formatNumber } from '../utils/numberFormat';
import { preferCodexSection } from './JournalPanel';

const CHAIN = QUESTS.filter((q) => q.kind === 'CHAIN').sort((a, b) => a.sortOrder - b.sortOrder);

/** The story goal the player is on: the first chain quest not yet claimed. */
const selectGoal = (s: GameState) => {
  const q = CHAIN.find((c) => !isQuestClaimed(s, c));
  if (!q) return null;
  return {
    name: q.displayName,
    text: q.description,
    progress: Math.min(getQuestProgress(s, q), q.targetValue),
    target: q.targetValue,
    ready: canClaimQuest(s, q),
  };
};

/**
 * The strip above the tabs: the current story goal (tap to see it in CODEX) and the ? that opens the
 * active tab's "how it works" card. That card also opens by itself on a tab's first visit.
 */
export const GuideBar: React.FC<{ tab: GuideTab; onOpenTab: (tab: GuideTab) => void }> = ({ tab, onOpenTab }) => {
  const dispatch = useDispatch();
  const goal = useGameState(selectGoal, shallowEqual);
  const helpSeen = useGameState(useCallback((s: GameState) => !!s.tutorialsSeen[tabHelpKey(tab)], [tab]));
  /** The tab whose card the player reopened with ?, if any. */
  const [reopened, setReopened] = useState<GuideTab | null>(null);
  const helpOpen = !helpSeen || reopened === tab;
  const help = TAB_HELP[tab];

  const closeHelp = () => {
    if (!helpSeen) dispatch({ type: 'MARK_TUTORIAL_SEEN', id: tabHelpKey(tab) });
    setReopened(null);
  };
  const toggleHelp = () => (helpOpen ? closeHelp() : setReopened(tab));
  const openGoal = () => {
    preferCodexSection('CHAIN');
    onOpenTab('JOURNAL');
  };

  return (
    <div className="shrink-0 flex flex-col bg-void">
      <div className="flex items-stretch border-b border-line">
        {goal ? (
          <button
            type="button"
            onClick={openGoal}
            aria-label={`Goal: ${goal.name}. ${goal.text} ${goal.ready ? 'Done: claim it in CODEX.' : `${goal.progress} of ${goal.target}.`}`}
            className={`flex-1 min-w-0 min-h-[32px] px-2.5 flex items-center gap-2 text-left transition-colors ${
              goal.ready ? 'bg-gold/10 hover:bg-gold/15' : 'hover:bg-panel'
            }`}
          >
            {goal.ready ? (
              <Check size={12} className="shrink-0 text-gold" aria-hidden />
            ) : (
              <Flag size={12} className="shrink-0 text-neon" aria-hidden />
            )}
            <span className={`shrink-0 text-[9px] font-tech font-bold tracking-wider ${goal.ready ? 'text-gold' : 'text-neon'}`}>
              {goal.ready ? 'GOAL DONE' : 'GOAL'}
            </span>
            <span className="flex-1 min-w-0 truncate text-[10px] font-tech text-ink">
              {goal.ready ? `${goal.name}: claim it in CODEX` : goal.text}
            </span>
            {!goal.ready && (
              <span className="shrink-0 text-[10px] font-mono-code font-bold text-dim">
                {formatNumber(goal.progress)}/{formatNumber(goal.target)}
              </span>
            )}
          </button>
        ) : (
          <span className="flex-1 min-h-[32px] px-2.5 flex items-center text-[10px] font-tech text-dim">Every story goal is done.</span>
        )}
        <button
          type="button"
          onClick={toggleHelp}
          aria-expanded={helpOpen}
          aria-label={helpOpen ? `Hide how ${tab.toLowerCase()} works` : `How this screen works`}
          className={`shrink-0 w-10 min-h-[32px] flex items-center justify-center border-l border-line transition-colors ${
            helpOpen ? 'bg-active text-neon' : 'text-dim hover:text-ink hover:bg-panel'
          }`}
        >
          <CircleHelp size={15} aria-hidden />
        </button>
      </div>

      {helpOpen && (
        <section
          aria-label={help.title}
          className="animate-fade-in mx-2.5 mt-2 bg-panel border border-neon/50 border-l-4 border-l-neon p-2.5 flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-display font-bold text-neon tracking-wider">{help.title}</h3>
            <button
              type="button"
              onClick={closeHelp}
              aria-label="Close"
              className="w-8 h-8 -m-1 shrink-0 flex items-center justify-center text-dim hover:text-ink"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {help.lines.map((line) => (
              <li key={line} className="text-[11px] font-tech text-ink leading-snug flex gap-1.5">
                <span className="text-neon shrink-0" aria-hidden>
                  ▸
                </span>
                {line}
              </li>
            ))}
          </ul>
          {!helpSeen && (
            <button
              type="button"
              onClick={closeHelp}
              className="self-end min-h-[32px] px-3 border border-neon text-neon text-[10px] font-tech font-bold tracking-wider hover:bg-active"
            >
              GOT IT
            </button>
          )}
        </section>
      )}
    </div>
  );
};
