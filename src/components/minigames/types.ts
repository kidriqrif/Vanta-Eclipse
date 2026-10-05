/**
 * The contract between the Arcade host and a minigame (design/ux/milestone-9-minigame-framework.md §3).
 *
 * A game never touches currency, tokens or saves. It plays, then calls `onFinish` exactly
 * once. The host latches on the first call and ignores any later one, unmounts the game (so
 * every timer must be cleared in an effect cleanup), pays out, and shows the result banner.
 */
export interface MinigameResult {
  won: boolean;
  /** 0..1 quality of play (accuracy, speed, margin). Payout = live rate × reward seconds × performance. */
  performance: number;
  /** The game's record value, in its definition's `scoreUnit` and `lowerIsBetter` direction. */
  score: number;
  /** One short line for the result banner, e.g. "4 of 5 · avg 312ms". */
  detail: string;
}

export interface MinigameProps {
  onFinish: (result: MinigameResult) => void;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
