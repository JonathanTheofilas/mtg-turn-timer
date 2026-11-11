import { turnElapsedMs, turnLimitMs } from './clock';
import type { GameState, Player } from './types';

export interface PlayerStats {
  player: Player;
  turns: number;
  averageMs: number;
  longestMs: number;
  totalMs: number;
  overtimeMs: number;
  slowest: boolean;
}

/** Per-player turn stats. The turn in progress counts toward totals but not the average. */
export function computeStats(s: GameState, now: number): PlayerStats[] {
  const rows = s.players.map((player, i) => {
    const done = player.turns;
    let totalMs = done.reduce((a, t) => a + t.durationMs, 0);
    let overtimeMs = done.reduce((a, t) => a + t.overtimeMs, 0);
    let longestMs = done.reduce((a, t) => Math.max(a, t.durationMs), 0);
    if (i === s.activeIndex && !s.ended && s.started) {
      const live = turnElapsedMs(s, now);
      const limit = turnLimitMs(s);
      totalMs += live;
      overtimeMs += limit == null ? 0 : Math.max(0, live - limit);
      longestMs = Math.max(longestMs, live);
    }
    return {
      player,
      turns: done.length,
      averageMs: done.length ? done.reduce((a, t) => a + t.durationMs, 0) / done.length : 0,
      longestMs,
      totalMs,
      overtimeMs,
      slowest: false,
    };
  });
  const ranked = rows.filter((r) => r.turns > 0);
  if (ranked.length > 1) ranked.reduce((a, b) => (b.averageMs > a.averageMs ? b : a)).slowest = true;
  return rows;
}
