export type Format = 'commander' | 'standard' | 'custom';
export type TimerMode = 'turn' | 'bank' | 'off';
export type Counter = 'poison' | 'energy' | 'experience' | 'rad';
export type Marker = 'monarch' | 'initiative';

export interface GameConfig {
  format: Format;
  commanderDamage: boolean;
  /** When true, commander damage also reduces life (the normal rule). */
  commanderDamageReducesLife: boolean;
  timerMode: TimerMode;
  /** Per-turn allowance, used in 'turn' mode. */
  turnMs: number;
  /** Starting bank per player, used in 'bank' mode. */
  bankMs: number;
  /** Added to a player's bank when they pass, used in 'bank' mode. */
  incrementMs: number;
}

/** A player's panel background: card art (remote URL) or an uploaded photo (data URL). */
export interface Background {
  url: string;
  /** Artist credit for card art. */
  credit?: string;
}

export interface TurnRecord {
  durationMs: number;
  overtimeMs: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  rad: number;
  /** Number of times each commander has been cast from the command zone (tax = 2 × casts). */
  casts: [number, number];
  hasPartner: boolean;
  background: Background | null;
  /** Damage taken, keyed by `${sourcePlayerId}:${commanderSlot}`. */
  commanderDamage: Record<string, number>;
  /** Remaining time bank (bank mode). */
  bankMs: number;
  turns: TurnRecord[];
  eliminated: boolean;
}

export interface Clock {
  /** Epoch ms when the clock last started running; null while paused. */
  runningSince: number | null;
  /** Time already spent on the current turn before runningSince. */
  accumulatedMs: number;
}

export type LogEntry =
  | { kind: 'life'; at: number; turn: number; player: number; delta: number; total: number }
  | { kind: 'text'; at: number; turn: number; text: string; player?: number };

export interface GameState {
  config: GameConfig;
  players: Player[];
  activeIndex: number;
  turn: number;
  direction: 1 | -1;
  extraTurnQueued: boolean;
  clock: Clock;
  /** False until the clock has been started for the first time. */
  started: boolean;
  startedAt: number;
  pausedAt: number | null;
  pausedTotalMs: number;
  markers: Record<Marker, number | null>;
  log: LogEntry[];
  ended: boolean;
}

export interface PlayerSetup {
  name: string;
  color: string;
  hasPartner: boolean;
  background?: Background | null;
}

export interface GameSetup {
  format: Format;
  playerCount: number;
  startingLife: number;
  commanderDamageReducesLife: boolean;
  timerMode: TimerMode;
  turnSeconds: number;
  bankMinutes: number;
  incrementSeconds: number;
  /** Index of the first player, or 'random'. */
  firstPlayer: number | 'random';
  players: PlayerSetup[];
}

export type Action =
  | { type: 'adjustLife'; player: number; delta: number }
  | { type: 'adjustCommanderDamage'; target: number; source: number; slot: 0 | 1; delta: number }
  | { type: 'adjustCounter'; player: number; counter: Counter; delta: number }
  | { type: 'adjustCasts'; player: number; slot: 0 | 1; delta: number }
  | { type: 'setMarker'; marker: Marker; player: number | null }
  | { type: 'setBackground'; player: number; background: Background | null }
  | { type: 'passTurn' }
  | { type: 'togglePause' }
  | { type: 'reverseDirection' }
  | { type: 'toggleExtraTurn' }
  | { type: 'note'; text: string }
  | { type: 'endGame' };
