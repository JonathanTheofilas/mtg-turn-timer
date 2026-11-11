import { FORMATS, LETHAL_COMMANDER_DAMAGE, LETHAL_POISON, LIFE_LOG_MERGE_MS, MAX_LOG } from './constants';
import { turnElapsedMs, turnLimitMs } from './clock';
import type { Action, GameSetup, GameState, LogEntry, Player } from './types';

export const cmdKey = (source: number, slot: 0 | 1) => `${source}:${slot}`;

export function createGame(setup: GameSetup, now: number, random: () => number = Math.random): GameState {
  const fmt = FORMATS[setup.format];
  const players: Player[] = setup.players.slice(0, setup.playerCount).map((p, i) => ({
    id: i,
    name: p.name.trim() || `Player ${i + 1}`,
    color: p.color,
    life: setup.startingLife,
    poison: 0,
    energy: 0,
    experience: 0,
    rad: 0,
    casts: [0, 0],
    hasPartner: fmt.commanderDamage && p.hasPartner,
    commanderDamage: {},
    bankMs: setup.bankMinutes * 60_000,
    turns: [],
    eliminated: false,
  }));
  const first =
    setup.firstPlayer === 'random'
      ? Math.floor(random() * players.length)
      : Math.min(Math.max(0, setup.firstPlayer), players.length - 1);

  const state: GameState = {
    config: {
      format: setup.format,
      commanderDamage: fmt.commanderDamage,
      commanderDamageReducesLife: setup.commanderDamageReducesLife,
      timerMode: setup.timerMode,
      turnMs: setup.turnSeconds * 1000,
      bankMs: setup.bankMinutes * 60_000,
      incrementMs: setup.incrementSeconds * 1000,
    },
    players,
    activeIndex: first,
    turn: 1,
    direction: 1,
    extraTurnQueued: false,
    clock: { runningSince: null, accumulatedMs: 0 },
    started: false,
    startedAt: now,
    pausedAt: null,
    pausedTotalMs: 0,
    markers: { monarch: null, initiative: null },
    log: [],
    ended: false,
  };
  note(state, now, `Game started. ${players[first].name} goes first.`, first);
  return state;
}

export function isEliminated(p: Player): boolean {
  if (p.life <= 0 || p.poison >= LETHAL_POISON) return true;
  return Object.values(p.commanderDamage).some((d) => d >= LETHAL_COMMANDER_DAMAGE);
}

/** Next player in turn order, skipping eliminated players. Stays put if nobody else is alive. */
export function nextActiveIndex(s: GameState): number {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (((s.activeIndex + s.direction * k) % n) + n) % n;
    if (!s.players[i].eliminated) return i;
  }
  return s.activeIndex;
}

/** Actions that change the game itself (and so can be undone). Pausing is not one of them. */
export function isUndoable(a: Action): boolean {
  return a.type !== 'togglePause' && a.type !== 'endGame';
}

export function reduce(prev: GameState, action: Action, now: number): GameState {
  if (prev.ended) return prev;
  const s = structuredClone(prev);

  switch (action.type) {
    case 'adjustLife': {
      const p = s.players[action.player];
      p.life += action.delta;
      logLife(s, now, action.player, action.delta);
      break;
    }

    case 'adjustCommanderDamage': {
      const target = s.players[action.target];
      const key = cmdKey(action.source, action.slot);
      const current = target.commanderDamage[key] ?? 0;
      const delta = Math.max(-current, action.delta);
      if (!delta) return prev;
      target.commanderDamage[key] = current + delta;
      if (s.config.commanderDamageReducesLife) target.life -= delta;
      const src = s.players[action.source];
      const label = src.hasPartner ? `${src.name} (${action.slot ? 'partner' : 'commander'})` : src.name;
      note(s, now, `${target.name} ${delta > 0 ? 'took' : 'removed'} ${Math.abs(delta)} commander damage from ${label} → ${current + delta}`, action.target);
      break;
    }

    case 'adjustCounter': {
      const p = s.players[action.player];
      const next = Math.max(0, p[action.counter] + action.delta);
      if (next === p[action.counter]) return prev;
      p[action.counter] = next;
      note(s, now, `${p.name} ${action.counter} → ${next}`, action.player);
      break;
    }

    case 'adjustCasts': {
      const p = s.players[action.player];
      const next = Math.max(0, p.casts[action.slot] + action.delta);
      if (next === p.casts[action.slot]) return prev;
      p.casts[action.slot] = next;
      note(s, now, `${p.name} commander tax → ${next * 2}`, action.player);
      break;
    }

    case 'setMarker': {
      s.markers[action.marker] = action.player;
      if (action.player != null) note(s, now, `${s.players[action.player].name} has the ${action.marker === 'monarch' ? 'monarch' : 'initiative'}.`, action.player);
      else note(s, now, `${action.marker === 'monarch' ? 'Monarch' : 'Initiative'} cleared.`);
      break;
    }

    case 'passTurn': {
      const p = s.players[s.activeIndex];
      const elapsed = turnElapsedMs(s, now);
      const limit = turnLimitMs(s);
      const overtime = limit == null ? 0 : Math.max(0, elapsed - limit);
      p.turns.push({ durationMs: elapsed, overtimeMs: overtime });
      if (s.config.timerMode === 'bank') p.bankMs = p.bankMs - elapsed + s.config.incrementMs;

      if (s.extraTurnQueued) {
        s.extraTurnQueued = false;
        note(s, now, `${p.name} takes an extra turn.`, p.id);
      } else {
        s.activeIndex = nextActiveIndex(s);
      }
      s.turn += 1;
      // Passing always (re)starts the clock for the next player.
      if (!s.started) {
        s.started = true;
        s.startedAt = now;
      }
      if (s.pausedAt != null) {
        s.pausedTotalMs += now - s.pausedAt;
        s.pausedAt = null;
      }
      s.clock = { runningSince: now, accumulatedMs: 0 };
      note(s, now, `${p.name} passed after ${Math.round(elapsed / 1000)}s${overtime ? ` (${Math.round(overtime / 1000)}s over)` : ''}.`, p.id);
      break;
    }

    case 'togglePause': {
      if (s.clock.runningSince != null) {
        s.clock = { runningSince: null, accumulatedMs: turnElapsedMs(s, now) };
        s.pausedAt = now;
      } else {
        if (!s.started) {
          s.started = true;
          s.startedAt = now;
        } else if (s.pausedAt != null) {
          s.pausedTotalMs += now - s.pausedAt;
        }
        s.pausedAt = null;
        s.clock = { ...s.clock, runningSince: now };
      }
      break;
    }

    case 'reverseDirection':
      s.direction = s.direction === 1 ? -1 : 1;
      note(s, now, `Turn order reversed (${s.direction === 1 ? 'clockwise' : 'anticlockwise'}).`);
      break;

    case 'toggleExtraTurn':
      s.extraTurnQueued = !s.extraTurnQueued;
      note(s, now, s.extraTurnQueued ? `Extra turn queued for ${s.players[s.activeIndex].name}.` : 'Extra turn cancelled.');
      break;

    case 'note':
      note(s, now, action.text);
      break;

    case 'endGame': {
      if (s.clock.runningSince != null) {
        s.clock = { runningSince: null, accumulatedMs: turnElapsedMs(s, now) };
        s.pausedAt = now;
      }
      s.ended = true;
      note(s, now, 'Game ended.');
      break;
    }
  }

  refreshEliminations(s, now);
  return s;
}

function refreshEliminations(s: GameState, now: number) {
  for (const p of s.players) {
    const out = isEliminated(p);
    if (out && !p.eliminated) note(s, now, `${p.name} is out.`, p.id);
    if (!out && p.eliminated) note(s, now, `${p.name} is back in.`, p.id);
    p.eliminated = out;
  }
}

function push(s: GameState, entry: LogEntry) {
  s.log.unshift(entry);
  if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
}

function note(s: GameState, now: number, text: string, player?: number) {
  push(s, { kind: 'text', at: now, turn: s.turn, text, player });
}

/** Rapid taps on the same player merge into one "+5 → 45" style entry. */
function logLife(s: GameState, now: number, player: number, delta: number) {
  const last = s.log[0];
  const total = s.players[player].life;
  if (last && last.kind === 'life' && last.player === player && now - last.at < LIFE_LOG_MERGE_MS) {
    last.delta += delta;
    last.total = total;
    last.at = now;
    if (last.delta === 0) s.log.shift();
    return;
  }
  push(s, { kind: 'life', at: now, turn: s.turn, player, delta, total });
}
