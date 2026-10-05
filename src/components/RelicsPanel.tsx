import React, { useEffect, useState } from 'react';
import { Check, Lock, Sword } from 'lucide-react';
import { RELICS } from '../data/definitions';
import type { RelicDefinition } from '../types/game';
import type { GameState } from '../game/state';
import { WORLD_TWO_FIRST_LEVEL } from '../game/state';
import { RELIC_DROP_CHANCE } from '../game/reducer';
import { useDispatch, useGameState } from '../hooks/useGame';
import { formatNumber } from '../utils/numberFormat';
import { Button, PanelHeader, TabBody } from './ui';

const selectAwakened = (s: GameState) => s.relicsAwakened;
const selectRelics = (s: GameState) => s.relics;
const selectActiveRelicId = (s: GameState) => s.activeRelicId;
const selectBestLevel = (s: GameState) => s.lifetimePeakLevel;

const OwnedRelicCard: React.FC<{ def: RelicDefinition; active: boolean; isNew: boolean }> = ({ def, active, isNew }) => {
  const dispatch = useDispatch();
  return (
    <div className={`bg-panel border p-2.5 flex items-center gap-2.5 ${active ? 'border-gold' : 'border-line'}`}>
      <div className="w-14 h-14 shrink-0 bg-panel2 border border-line flex items-center justify-center p-1.5">
        <img src={def.sigil} alt={def.displayName} className="w-full h-full object-contain pixelated" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-xs font-display font-bold text-ink uppercase tracking-wide leading-tight">{def.displayName}</span>
          {active && (
            <span className="text-[9px] font-mono-code font-black text-void bg-gold px-1 leading-4 flex items-center gap-0.5">
              <Check size={9} aria-hidden /> ATTUNED
            </span>
          )}
          {isNew && (
            <span className="text-[9px] font-mono-code font-black text-void bg-neon px-1 leading-4">
              NEW
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono-code font-bold text-neon leading-tight">{def.effectDescription}</span>
        <span className="text-[10px] font-tech text-dim italic leading-tight">“{def.flavor}”</span>
      </div>

      <div className="shrink-0 w-[84px]">
        {active ? (
          <Button variant="ghost" size="md" block onClick={() => dispatch({ type: 'SET_ACTIVE_RELIC', id: null })}>
            DETACH
          </Button>
        ) : (
          <Button variant="gold" size="md" block onClick={() => dispatch({ type: 'SET_ACTIVE_RELIC', id: def.id })}>
            ATTUNE
          </Button>
        )}
      </div>
    </div>
  );
};

const UnknownRelicCard: React.FC<{ def: RelicDefinition }> = ({ def }) => (
  <div className="bg-panel border border-dashed border-line p-2.5 flex items-center gap-2.5">
    <div className="w-14 h-14 shrink-0 bg-void border border-line flex items-center justify-center p-1.5">
      <img src={def.sigil} alt="" className="w-full h-full object-contain pixelated brightness-0 opacity-60" />
    </div>
    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
      <span className="text-xs font-display font-bold text-dim uppercase tracking-wide flex items-center gap-1">
        <Lock size={11} aria-hidden /> Undiscovered relic
      </span>
      <span className="text-[10px] font-tech text-dim leading-tight">Drops from a Frozen Ruins boss.</span>
    </div>
  </div>
);

/** The RELICS tab: the relic collection. One relic is attuned at a time; swapping is free. */
export const RelicsPanel: React.FC = () => {
  const dispatch = useDispatch();
  const awakened = useGameState(selectAwakened);
  const relics = useGameState(selectRelics);
  const activeRelicId = useGameState(selectActiveRelicId);
  const bestLevel = useGameState(selectBestLevel);

  // Relics unseen when the tab opened keep their NEW label for the whole visit.
  const [newAtEntry] = useState(() => new Set(relics.filter((r) => !r.seen).map((r) => r.id)));

  // Leaving the tab marks every relic seen.
  useEffect(
    () => () => {
      dispatch({ type: 'MARK_RELICS_SEEN' });
    },
    [dispatch],
  );

  const owned = RELICS.filter((def) => relics.some((r) => r.id === def.id));
  const missing = RELICS.filter((def) => !relics.some((r) => r.id === def.id));
  const active = RELICS.find((def) => def.id === activeRelicId) ?? null;
  const isNew = (id: string) => newAtEntry.has(id) || relics.some((r) => r.id === id && !r.seen);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<Sword size={16} className="text-gold" aria-hidden />}
        tone="gold"
        title="RELICS"
        subtitle={awakened ? 'One relic attuned at a time. Swapping is free.' : 'Locked until the Frozen Ruins.'}
        right={
          awakened ? (
            <span className="text-[10px] font-mono-code font-bold text-dim border border-line px-1.5 py-1">
              {formatNumber(owned.length)} / {formatNumber(RELICS.length)} found
            </span>
          ) : undefined
        }
      />

      <TabBody>
        {!awakened ? (
          <div className="bg-panel border border-line p-4 flex flex-col items-center gap-2 text-center">
            <Lock size={22} className="text-gold" aria-hidden />
            <p className="text-xs font-display font-bold text-ink uppercase tracking-wide">Locked</p>
            <p className="text-[11px] font-tech text-ink leading-snug">
              Relics awaken when you reach the Frozen Ruins (level {formatNumber(WORLD_TWO_FIRST_LEVEL)}).
            </p>
            <p className="text-[10px] font-tech text-dim">
              Best level so far: {formatNumber(bestLevel)} / {formatNumber(WORLD_TWO_FIRST_LEVEL)}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-panel border border-line p-2.5 flex flex-col gap-0.5" aria-live="polite">
              <span className="text-[9px] font-tech text-dim uppercase tracking-wider">Attuned now</span>
              {active ? (
                <span className="text-[11px] font-tech text-ink leading-tight">
                  <span className="font-display font-bold text-gold uppercase">{active.displayName}</span> — {active.effectDescription}
                </span>
              ) : (
                <span className="text-[11px] font-tech text-dim leading-tight">
                  {owned.length > 0 ? 'No relic attuned. Tap ATTUNE on one below.' : 'No relic yet.'}
                </span>
              )}
            </div>

            {owned.map((def) => (
              <OwnedRelicCard key={def.id} def={def} active={def.id === activeRelicId} isNew={isNew(def.id)} />
            ))}
            {missing.map((def) => (
              <UnknownRelicCard key={def.id} def={def} />
            ))}

            <p className="text-[10px] font-tech text-dim leading-snug px-0.5">
              Relics drop from Frozen Ruins bosses ({formatNumber(Math.round(RELIC_DROP_CHANCE * 100))}% per boss) until you have all {formatNumber(RELICS.length)}. Each one is a
              single permanent power; only the attuned relic is active.
            </p>
          </>
        )}
      </TabBody>
    </div>
  );
};
