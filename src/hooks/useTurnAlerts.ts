import { useEffect, useRef } from 'react';
import { ALERT_WARNINGS_MS, OVERTIME_NAG_INTERVAL_MS } from '../game/constants';
import { isRunning, turnElapsedMs, turnLimitMs, turnRemainingMs } from '../game/clock';
import type { GameState } from '../game/types';
import { beep, vibrate } from './device';

/**
 * Warns as time runs low and nags in overtime. Never passes the turn:
 * there are always exceptions (a huge combo, a judge call), so players decide.
 */
export function useTurnAlerts(game: GameState | null) {
  const gameRef = useRef(game);
  gameRef.current = game;
  const fired = useRef({ turn: -1, warnings: new Set<number>(), expired: false, lastNagAt: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g || g.ended || !isRunning(g)) return;
      const f = fired.current;
      if (f.turn !== g.turn) {
        fired.current = { turn: g.turn, warnings: new Set(), expired: false, lastNagAt: 0 };
        return;
      }
      const now = Date.now();
      const remaining = turnRemainingMs(g, now);
      const limit = turnLimitMs(g);
      if (remaining == null || limit == null) return;
      const elapsed = turnElapsedMs(g, now);

      ALERT_WARNINGS_MS.forEach((w, i) => {
        // Skip warnings that were already past when the turn began (e.g. a nearly empty bank).
        if (remaining <= w && remaining > 0 && limit > w + 2000 && !f.warnings.has(w)) {
          f.warnings.add(w);
          beep(660 + i * 110, 0.1, i + 1);
          if (i > 0) vibrate(80);
        }
      });
      if (remaining <= 0 && !f.expired) {
        f.expired = true;
        f.lastNagAt = elapsed;
        beep(990, 0.25, 3, 0.1);
        vibrate([200, 100, 200, 100, 400]);
      } else if (f.expired && elapsed - f.lastNagAt >= OVERTIME_NAG_INTERVAL_MS) {
        f.lastNagAt = elapsed;
        beep(990, 0.18, 2);
        vibrate([150, 80, 150]);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);
}
