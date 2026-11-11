import type { GameState } from './types';

/** Time spent on the current turn. Derived from timestamps so it never drifts. */
export function turnElapsedMs(s: GameState, now: number): number {
  const { runningSince, accumulatedMs } = s.clock;
  return accumulatedMs + (runningSince != null ? Math.max(0, now - runningSince) : 0);
}

/** Time allowed for the current turn, or null when the clock is off. */
export function turnLimitMs(s: GameState): number | null {
  switch (s.config.timerMode) {
    case 'turn':
      return s.config.turnMs;
    case 'bank':
      return s.players[s.activeIndex].bankMs;
    default:
      return null;
  }
}

/** Remaining time (negative = overtime), or null when the clock is off. */
export function turnRemainingMs(s: GameState, now: number): number | null {
  const limit = turnLimitMs(s);
  return limit == null ? null : limit - turnElapsedMs(s, now);
}

export function isRunning(s: GameState): boolean {
  return s.clock.runningSince != null;
}

/** Wall-clock game length, excluding pauses. */
export function gameDurationMs(s: GameState, now: number): number {
  if (!s.started) return 0;
  const paused = s.pausedTotalMs + (s.pausedAt != null ? now - s.pausedAt : 0);
  return Math.max(0, now - s.startedAt - paused);
}

export function formatDuration(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Countdown display: rounds up so "0:00" only shows once time has actually run out. */
export function formatCountdown(ms: number): string {
  return ms >= 0 ? formatDuration(Math.ceil(ms / 1000) * 1000) : `+${formatDuration(ms)}`;
}
