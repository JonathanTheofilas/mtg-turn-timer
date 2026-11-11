import type { Format, GameSetup } from './types';

export const PLAYER_COLORS = ['#e94f4f', '#4f9de9', '#5cc77a', '#e9c14f', '#a86ee9', '#e98a4f', '#4fd6d0', '#e96fb5'];

export const FORMATS: Record<Format, { label: string; life: number; commanderDamage: boolean }> = {
  commander: { label: 'Commander', life: 40, commanderDamage: true },
  standard: { label: 'Standard', life: 20, commanderDamage: false },
  custom: { label: 'Custom', life: 30, commanderDamage: false },
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const LETHAL_POISON = 10;
export const LETHAL_COMMANDER_DAMAGE = 21;

/** Life changes to the same player within this window merge into one log line. */
export const LIFE_LOG_MERGE_MS = 3000;
export const MAX_LOG = 500;

export const ALERT_WARNINGS_MS = [30_000, 10_000];
export const OVERTIME_NAG_INTERVAL_MS = 30_000;

export const defaultSetup = (): GameSetup => ({
  format: 'commander',
  playerCount: 4,
  startingLife: 40,
  commanderDamageReducesLife: true,
  timerMode: 'turn',
  turnSeconds: 120,
  bankMinutes: 20,
  incrementSeconds: 10,
  firstPlayer: 'random',
  players: PLAYER_COLORS.slice(0, 6).map((color, i) => ({ name: `Player ${i + 1}`, color, hasPartner: false })),
});
