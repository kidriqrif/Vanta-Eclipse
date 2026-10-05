import type { GameSettings, Item } from '../types/game';
import type { TapSignal } from './tapGuard';

export type SoundId =
  | 'tap_hit'
  | 'crit_hit'
  | 'enemy_death'
  | 'boss_defeat'
  | 'boss_warn'
  | 'loot'
  | 'fanfare'
  | 'levelup'
  | 'click'
  | 'confirm'
  | 'claim'
  | 'goal'
  | 'eclipse'
  | 'fail'
  | 'whoosh';

export type ToastTone = 'info' | 'loot' | 'rare' | 'warn';

/**
 * Side effects requested by the reducer. The store runs them after the state is committed,
 * so nothing with a side effect ever runs inside a React state updater.
 */
export type FxEvent =
  | { type: 'sound'; id: SoundId }
  | { type: 'haptic'; strength: 'light' | 'medium' | 'heavy' }
  | { type: 'hit'; amount: number; crit: boolean; auto: boolean; x?: number; y?: number }
  | { type: 'shake' }
  | { type: 'toast'; text: string; tone: ToastTone }
  | { type: 'tapLocked'; until: number; signal: TapSignal }
  | { type: 'eclipse'; crystals: number }
  /** Persist now instead of waiting for the autosave (Eclipse, world unlock, purchases). */
  | { type: 'save' };

export type Action =
  | { type: 'TICK'; dtMs: number }
  | { type: 'TAP'; x: number; y: number; touch: boolean }
  | { type: 'CHALLENGE_BOSS' }
  | { type: 'LEAVE_BOSS' }
  | { type: 'SET_FARM'; on: boolean }
  | { type: 'BUY_UPGRADE'; id: string; count: number | 'max' }
  | { type: 'EQUIP_ITEM'; itemId: number }
  | { type: 'UNEQUIP_ITEM'; slot: string }
  | { type: 'SALVAGE_ITEM'; itemId: number }
  | { type: 'SALVAGE_COMMONS' }
  | { type: 'FORGE_ITEM'; slot: string }
  | { type: 'MARK_ITEMS_SEEN' }
  | { type: 'MARK_RELICS_SEEN' }
  | { type: 'MARK_PETS_SEEN' }
  | { type: 'ABSORB_CARD'; cardId: number }
  | { type: 'SET_ACTIVE_PET'; id: string }
  | { type: 'SET_ACTIVE_RELIC'; id: string | null }
  | { type: 'BUY_SKILL'; id: string }
  | { type: 'PERFORM_ECLIPSE' }
  | { type: 'ARCADE_START'; gameId: string }
  | { type: 'ARCADE_FINISH'; runId: number; won: boolean; performance: number; score: number }
  | { type: 'ARCADE_QUIT'; runId: number }
  | { type: 'CLAIM_QUEST'; id: string }
  | { type: 'CLAIM_ALL_CLEAR' }
  | { type: 'AD_REWARD'; placementId: string }
  /** A purchase Google Play confirmed. `transactionId` makes the grant idempotent. */
  | { type: 'PURCHASE_GRANTED'; productId: string; transactionId?: string }
  | { type: 'RESTORE_ENTITLEMENTS'; productIds: string[] }
  | { type: 'BUY_COSMETIC'; id: string }
  | { type: 'SET_COSMETIC'; id: string }
  | { type: 'UPDATE_SETTINGS'; partial: Partial<GameSettings> }
  | { type: 'APPLY_OFFLINE'; secondsAway: number }
  | { type: 'DISMISS_OFFLINE' }
  | { type: 'CLOSE_WORLD_MODAL' }
  | { type: 'MARK_TUTORIAL_SEEN'; id: string };

export interface ActionResult {
  ok: boolean;
  /** Why an action was refused, for UI copy ("not_enough", "locked", "capped", ...). */
  reason?: string;
  /** Amount granted or bought (essence paid, upgrade levels bought, scraps gained, ...). */
  value?: number;
  item?: Item;
  runId?: number;
  newRecord?: boolean;
}

export const OK: ActionResult = { ok: true };
export const fail = (reason: string): ActionResult => ({ ok: false, reason });
