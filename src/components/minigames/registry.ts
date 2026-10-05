import type React from 'react';
import type { MinigameProps } from './types';
import { VoidReflexGame } from './VoidReflexGame';
import { MemoryMatchGame } from './MemoryMatchGame';
import { ConnectFourGame } from './ConnectFourGame';
import { BattleshipGame } from './BattleshipGame';
import { LightsOutGame } from './LightsOutGame';
import { SequenceEchoGame } from './SequenceEchoGame';
import { RuneSweeperGame } from './RuneSweeperGame';

/** Minigame id (from MINIGAMES in src/data/definitions.ts) → component. Adding a game = one line here. */
export const MINIGAME_COMPONENTS: Record<string, React.FC<MinigameProps>> = {
  void_reflex: VoidReflexGame,
  memory_match: MemoryMatchGame,
  connect_four: ConnectFourGame,
  battleship: BattleshipGame,
  lights_out: LightsOutGame,
  sequence_echo: SequenceEchoGame,
  rune_sweeper: RuneSweeperGame,
};
