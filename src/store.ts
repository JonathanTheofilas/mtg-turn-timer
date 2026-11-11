import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultSetup } from './game/constants';
import { createGame, isUndoable, reduce } from './game/engine';
import type { Action, GameSetup, GameState } from './game/types';

const MAX_HISTORY = 300;

interface Store {
  setup: GameSetup;
  game: GameState | null;
  /** Previous game states for undo (not persisted). */
  history: GameState[];
  updateSetup: (fn: (s: GameSetup) => void) => void;
  startGame: () => void;
  dispatch: (action: Action) => void;
  undo: () => void;
  exitToSetup: () => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = '__probe__';
    localStorage.setItem(k, k);
    localStorage.removeItem(k);
    return {
      getItem: (key: string) => localStorage.getItem(key),
      // Never let a full storage quota (e.g. several large photos) break the game.
      setItem: (key: string, v: string) => {
        try {
          localStorage.setItem(key, v);
        } catch {
          /* quota exceeded: keep playing from memory */
        }
      },
      removeItem: (key: string) => localStorage.removeItem(key),
    };
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      setup: defaultSetup(),
      game: null,
      history: [],

      updateSetup: (fn) => {
        const next = structuredClone(get().setup);
        fn(next);
        set({ setup: next });
      },

      startGame: () => set({ game: createGame(get().setup, Date.now()), history: [] }),

      dispatch: (action) => {
        const { game, history } = get();
        if (!game) return;
        const next = reduce(game, action, Date.now());
        if (next === game) return;
        set({
          game: next,
          history: isUndoable(action) ? [...history.slice(-MAX_HISTORY + 1), game] : history,
        });
      },

      undo: () => {
        const { game, history } = get();
        const prev = history.at(-1);
        if (!game || !prev) return;
        // Within the same turn, undo only the game change: keep the clock exactly as it is now.
        // Undoing a pass restores the previous turn, clock included, so no time is lost.
        const restored: GameState =
          prev.turn === game.turn
            ? { ...prev, clock: game.clock, started: game.started, startedAt: game.startedAt, pausedAt: game.pausedAt, pausedTotalMs: game.pausedTotalMs }
            : prev;
        set({ game: restored, history: history.slice(0, -1) });
      },

      exitToSetup: () => set({ game: null, history: [] }),
    }),
    {
      name: 'mtg-turn-timer',
      version: 1,
      storage: safeStorage,
      partialize: (s) => ({ setup: s.setup, game: s.game }),
    },
  ),
);
