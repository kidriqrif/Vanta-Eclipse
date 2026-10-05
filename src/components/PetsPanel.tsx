import React, { useEffect, useState } from 'react';
import { Check, Cpu, Layers, Lock, Sparkles } from 'lucide-react';
import { PETS } from '../data/definitions';
import type { OwnedPet, PetDefinition } from '../types/game';
import type { GameState } from '../game/state';
import { WORLD_TWO_FIRST_LEVEL } from '../game/state';
import { PET_ABSORB_CAP, PET_XP_PER_LEVEL, petBonusValue, petDisplayName, petLevelFromXp, petSprite, petStage } from '../game/stats';
import { FROSTLING_DROP_CHANCE, PET_XP_PER_KILL } from '../game/reducer';
import { useDispatch, useGameState } from '../hooks/useGame';
import { formatNumber, formatPercent } from '../utils/numberFormat';
import { Button, PanelHeader, TabBody } from './ui';

/** How each pet bonus reads in a sentence. */
const BONUS_NOUN: Record<string, string> = {
  essence: 'essence',
  tap_pct: 'tap damage',
};

/** How an undiscovered companion is obtained. */
const HOW_TO_GET: Record<string, string> = {
  ember: 'Granted on reaching the Frozen Ruins',
  frostling: `${Math.round(FROSTLING_DROP_CHANCE * 100)}% chance from Frozen Ruins bosses`,
};

const selectAwakened = (s: GameState) => s.relicsAwakened;
const selectPets = (s: GameState) => s.pets;
const selectActivePetId = (s: GameState) => s.activePetId;
const selectBestLevel = (s: GameState) => s.lifetimePeakLevel;

const bonusText = (def: PetDefinition, value: number) => `${formatPercent(value)} ${BONUS_NOUN[def.bonusStat] ?? def.bonusStat}`;

const OwnedPetCard: React.FC<{ def: PetDefinition; pet: OwnedPet; active: boolean; isNew: boolean }> = ({ def, pet, active, isNew }) => {
  const dispatch = useDispatch();
  const level = petLevelFromXp(def.id, pet.xp);
  const name = petDisplayName(def.id, level);
  const stage = petStage(def.id, level);
  const maxed = level >= def.maxLevel;
  const xpInto = Math.max(0, pet.xp - (level - 1) * PET_XP_PER_LEVEL);
  const xpPct = maxed ? 100 : Math.min(100, (xpInto / PET_XP_PER_LEVEL) * 100);
  const nextEvolution = def.evolutionLevels.find((l) => level < l);
  const nextName = def.stageNames[Math.min(stage + 1, def.stageNames.length - 1)];
  const fromLevel = level * def.bonusPerLevel;
  const fromCards = Math.min(PET_ABSORB_CAP, pet.absorbed || 0);

  return (
    <div className={`bg-panel border p-2.5 flex flex-col gap-2 ${active ? 'border-neon' : 'border-line'}`}>
      <div className="flex items-center gap-2.5">
        <div className="relative w-14 h-14 shrink-0 bg-panel2 border border-line flex items-center justify-center p-1">
          <img src={petSprite(def.id, level)} alt={name} className="w-full h-full object-contain pixelated" />
          {stage > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-purple text-void text-[9px] font-mono-code font-black px-1 leading-4">EVO</span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-xs font-display font-bold text-ink uppercase tracking-wide leading-tight">{name}</span>
            <span key={level} className="animate-fade-in text-[10px] font-mono-code font-bold text-dim border border-line px-1 leading-4">
              LV {formatNumber(level)}/{formatNumber(def.maxLevel)}
            </span>
            {isNew && (
              <span className="text-[9px] font-mono-code font-black text-void bg-gold px-1 leading-4">
                NEW
              </span>
            )}
          </div>
          <span className="text-[11px] font-mono-code font-bold text-neon leading-tight">{bonusText(def, petBonusValue(def.id, pet))}</span>
          <span className="text-[10px] font-tech text-dim leading-tight">
            {formatPercent(fromLevel)} from level
            {fromCards > 0 && ` · ${formatPercent(fromCards)} from cards`}
            {!active && ' · applies only while active'}
          </span>
        </div>

        <div className="shrink-0 w-[92px]">
          {active ? (
            <div className="min-h-[40px] border border-neon bg-neon/10 text-neon text-[10px] font-display font-bold flex items-center justify-center gap-1">
              <Check size={12} aria-hidden /> ACTIVE
            </div>
          ) : (
            <Button variant="primary" size="md" block onClick={() => dispatch({ type: 'SET_ACTIVE_PET', id: def.id })}>
              SET ACTIVE
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-2 text-[10px] font-mono-code text-dim">
          <span>{maxed ? 'MAX LEVEL' : `XP to Lv ${formatNumber(level + 1)}`}</span>
          {!maxed && (
            <span>
              {formatNumber(xpInto)} / {formatNumber(PET_XP_PER_LEVEL)}
            </span>
          )}
        </div>
        <div
          className="w-full h-1.5 bg-void border border-line overflow-hidden"
          role="progressbar"
          aria-label={`${name} experience`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(xpPct)}
        >
          <div className={`h-full ${maxed ? 'bg-gold' : 'bg-neon'}`} style={{ width: `${xpPct}%` }} />
        </div>
        <span className="text-[10px] font-tech text-dim leading-tight">
          {nextEvolution !== undefined
            ? `Evolves into ${nextName} at Lv ${formatNumber(nextEvolution)}`
            : 'Fully evolved'}
          {` · ${formatPercent(def.bonusPerLevel)} ${BONUS_NOUN[def.bonusStat] ?? def.bonusStat} per level`}
        </span>
      </div>
    </div>
  );
};

const UnknownPetCard: React.FC<{ def: PetDefinition }> = ({ def }) => (
  <div className="bg-panel border border-dashed border-line p-2.5 flex items-center gap-2.5">
    <div className="w-14 h-14 shrink-0 bg-void border border-line flex items-center justify-center p-1">
      <img src={petSprite(def.id, 1)} alt="" className="w-full h-full object-contain pixelated brightness-0 opacity-60" />
    </div>
    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
      <span className="text-xs font-display font-bold text-dim uppercase tracking-wide flex items-center gap-1">
        <Lock size={11} aria-hidden /> Not found yet
      </span>
      <span className="text-[10px] font-tech text-ink leading-tight">{HOW_TO_GET[def.id] ?? 'Found in the Frozen Ruins'}</span>
      <span className="text-[10px] font-tech text-dim leading-tight">
        Boosts {BONUS_NOUN[def.bonusStat] ?? def.bonusStat} by {formatPercent(def.bonusPerLevel)} per level
      </span>
    </div>
  </div>
);

/** The BEAST tab: companions, their levels and bonuses, and which one is active. */
export const PetsPanel: React.FC = () => {
  const dispatch = useDispatch();
  const awakened = useGameState(selectAwakened);
  const pets = useGameState(selectPets);
  const activePetId = useGameState(selectActivePetId);
  const bestLevel = useGameState(selectBestLevel);

  // Pets unseen when the tab opened keep their NEW label for the whole visit.
  const [newAtEntry] = useState(() => new Set(Object.keys(pets).filter((id) => !pets[id].seen)));

  // Leaving the tab marks every companion seen.
  useEffect(
    () => () => {
      dispatch({ type: 'MARK_PETS_SEEN' });
    },
    [dispatch],
  );

  const ownedCount = PETS.filter((p) => pets[p.id]).length;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PanelHeader
        icon={<Cpu size={16} className="text-neon" aria-hidden />}
        title="COMPANIONS"
        subtitle={awakened ? 'Only the active companion’s bonus applies.' : 'Locked until the Frozen Ruins.'}
        right={
          awakened ? (
            <span className="text-[10px] font-mono-code font-bold text-dim border border-line px-1.5 py-1">
              {formatNumber(ownedCount)} / {formatNumber(PETS.length)} found
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
              Companions awaken when you reach the Frozen Ruins (level {formatNumber(WORLD_TWO_FIRST_LEVEL)}).
            </p>
            <p className="text-[10px] font-tech text-dim">
              Best level so far: {formatNumber(bestLevel)} / {formatNumber(WORLD_TWO_FIRST_LEVEL)}
            </p>
          </div>
        ) : (
          <>
            {PETS.map((def) => {
              const pet = pets[def.id];
              return pet ? (
                <OwnedPetCard
                  key={def.id}
                  def={def}
                  pet={pet}
                  active={activePetId === def.id}
                  isNew={!pet.seen || newAtEntry.has(def.id)}
                />
              ) : (
                <UnknownPetCard key={def.id} def={def} />
              );
            })}

            <div className="bg-panel border border-line p-2.5 flex flex-col gap-1.5">
              <span className="text-[10px] font-display font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-gold" aria-hidden /> How companions grow
              </span>
              <span className="text-[10px] font-tech text-dim leading-snug">
                The active companion gains {formatNumber(PET_XP_PER_KILL)} XP for every kill, and levels up every{' '}
                {formatNumber(PET_XP_PER_LEVEL)} XP.
              </span>
              <span className="text-[10px] font-tech text-dim leading-snug flex items-start gap-1">
                <Layers size={11} className="shrink-0 mt-px text-neon" aria-hidden />
                <span>Absorbing boss cards (CARDS tab) gives a big chunk of XP plus a small permanent bonus.</span>
              </span>
            </div>
          </>
        )}
      </TabBody>
    </div>
  );
};
