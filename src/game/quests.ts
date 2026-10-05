import { QUESTS } from '../data/definitions';
import type { QuestDefinition } from '../types/game';
import type { GameState } from './state';

/**
 * Current progress toward a quest. This is the single definition used by the claim logic,
 * the Journal and the navigation badge, so what the player sees is what they can claim.
 */
export function getQuestProgress(state: GameState, quest: QuestDefinition): number {
  if (quest.kind === 'DAILY') return state.quests.daily.counters[quest.metric] || 0;
  switch (quest.metric) {
    case 'enemy_level':
      return state.lifetimePeakLevel;
    case 'relics_owned':
      return state.relics.length;
    case 'pets_owned':
      return Object.keys(state.pets).length;
    case 'skills_bought':
      return Object.values(state.skills).reduce((a, b) => a + (b || 0), 0);
    default:
      return state.quests.counters[quest.metric] || 0;
  }
}

export function isQuestClaimed(state: GameState, quest: QuestDefinition): boolean {
  return quest.kind === 'DAILY'
    ? state.quests.daily.claimed.includes(quest.id)
    : state.quests.claimed.includes(quest.id);
}

/** A chain quest stays locked until the one before it has been claimed. */
export function isQuestLocked(state: GameState, quest: QuestDefinition): boolean {
  return !!quest.prereqId && !state.quests.claimed.includes(quest.prereqId);
}

export function isQuestActive(state: GameState, quest: QuestDefinition): boolean {
  return quest.kind !== 'DAILY' || state.quests.daily.ids.includes(quest.id);
}

export function canClaimQuest(state: GameState, quest: QuestDefinition): boolean {
  return (
    isQuestActive(state, quest) &&
    !isQuestClaimed(state, quest) &&
    !isQuestLocked(state, quest) &&
    getQuestProgress(state, quest) >= quest.targetValue
  );
}

export function activeDailies(state: GameState): QuestDefinition[] {
  return QUESTS.filter((q) => q.kind === 'DAILY' && state.quests.daily.ids.includes(q.id));
}

/** The all-clear unlocks once every one of today's dailies has been claimed. */
export function canClaimAllClear(state: GameState): boolean {
  const dailies = activeDailies(state);
  return (
    !state.quests.daily.allClearClaimed &&
    dailies.length > 0 &&
    dailies.every((q) => state.quests.daily.claimed.includes(q.id))
  );
}

export function hasClaimableQuest(state: GameState): boolean {
  return QUESTS.some((q) => canClaimQuest(state, q)) || canClaimAllClear(state);
}

/** Adds to a lifetime counter and to today's matching daily counter. Mutates a draft. */
export function bumpCounter(draft: GameState, metric: string, amount = 1): void {
  if (!(amount > 0)) return;
  draft.quests.counters[metric] = (draft.quests.counters[metric] || 0) + amount;
  const dailyKey = `daily_${metric}`;
  draft.quests.daily.counters[dailyKey] = (draft.quests.daily.counters[dailyKey] || 0) + amount;
}
