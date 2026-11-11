import { describe, expect, it } from 'vitest';
import { defaultSetup } from './constants';
import { createGame, reduce } from './engine';
import { gameDurationMs, turnElapsedMs, turnRemainingMs } from './clock';
import { computeStats } from './stats';
import type { Action, GameSetup, GameState } from './types';

const T0 = 1_000_000;
const setup = (over: Partial<GameSetup> = {}): GameSetup => ({ ...defaultSetup(), firstPlayer: 0, ...over });
const run = (s: GameState, at: number, ...actions: Action[]) => actions.reduce((st, a) => reduce(st, a, at), s);
const started = (over: Partial<GameSetup> = {}) => run(createGame(setup(over), T0), T0, { type: 'togglePause' });

describe('setup', () => {
  it('creates players from the setup', () => {
    const s = createGame(setup({ playerCount: 3 }), T0);
    expect(s.players).toHaveLength(3);
    expect(s.players.every((p) => p.life === 40)).toBe(true);
    expect(s.started).toBe(false);
    expect(s.clock.runningSince).toBeNull();
  });

  it('picks a random first player', () => {
    const s = createGame(setup({ firstPlayer: 'random' }), T0, () => 0.6);
    expect(s.activeIndex).toBe(2);
  });

  it('only allows partners in commander formats', () => {
    const base = setup();
    base.players[0].hasPartner = true;
    expect(createGame(base, T0).players[0].hasPartner).toBe(true);
    expect(createGame({ ...base, format: 'standard' }, T0).players[0].hasPartner).toBe(false);
  });
});

describe('backgrounds', () => {
  it('carries backgrounds from setup and can change them in game', () => {
    const base = setup();
    base.players[0].background = { url: 'https://img/x.jpg', credit: 'Artist' };
    let s = createGame(base, T0);
    expect(s.players[0].background?.credit).toBe('Artist');
    expect(s.players[1].background).toBeNull();
    s = run(s, T0, { type: 'setBackground', player: 1, background: { url: 'data:image/jpeg;base64,AA' } });
    expect(s.players[1].background?.url).toMatch(/^data:/);
    s = run(s, T0, { type: 'setBackground', player: 0, background: null });
    expect(s.players[0].background).toBeNull();
  });
});

describe('life and damage', () => {
  it('adjusts life and merges rapid changes in the log', () => {
    let s = started();
    s = run(s, T0 + 100, { type: 'adjustLife', player: 1, delta: -1 });
    s = run(s, T0 + 500, { type: 'adjustLife', player: 1, delta: -1 });
    s = run(s, T0 + 900, { type: 'adjustLife', player: 1, delta: -1 });
    expect(s.players[1].life).toBe(37);
    expect(s.log[0]).toMatchObject({ kind: 'life', player: 1, delta: -3, total: 37 });
  });

  it('eliminates at 0 life and brings the player back if healed', () => {
    let s = run(started(), T0, { type: 'adjustLife', player: 2, delta: -40 });
    expect(s.players[2].eliminated).toBe(true);
    s = run(s, T0, { type: 'adjustLife', player: 2, delta: 5 });
    expect(s.players[2].eliminated).toBe(false);
  });

  it('tracks commander damage per commander and reduces life', () => {
    const base = setup();
    base.players[1].hasPartner = true;
    let s = run(createGame(base, T0), T0,
      { type: 'adjustCommanderDamage', target: 0, source: 1, slot: 0, delta: 15 },
      { type: 'adjustCommanderDamage', target: 0, source: 1, slot: 1, delta: 15 });
    expect(s.players[0].life).toBe(10);
    expect(s.players[0].eliminated).toBe(false); // partners count separately
    s = run(s, T0, { type: 'adjustCommanderDamage', target: 0, source: 1, slot: 0, delta: 6 });
    expect(s.players[0].commanderDamage['1:0']).toBe(21);
    expect(s.players[0].eliminated).toBe(true);
  });

  it('can leave life alone for commander damage', () => {
    const s = run(createGame(setup({ commanderDamageReducesLife: false }), T0), T0,
      { type: 'adjustCommanderDamage', target: 0, source: 1, slot: 0, delta: 5 });
    expect(s.players[0].life).toBe(40);
  });

  it('never takes commander damage below zero', () => {
    const s0 = createGame(setup(), T0);
    expect(run(s0, T0, { type: 'adjustCommanderDamage', target: 0, source: 1, slot: 0, delta: -1 })).toBe(s0);
  });

  it('eliminates at 10 poison', () => {
    const s = run(started(), T0, { type: 'adjustCounter', player: 0, counter: 'poison', delta: 10 });
    expect(s.players[0].eliminated).toBe(true);
  });

  it('keeps one monarch at a time', () => {
    let s = run(started(), T0, { type: 'setMarker', marker: 'monarch', player: 1 });
    s = run(s, T0, { type: 'setMarker', marker: 'monarch', player: 3 });
    expect(s.markers.monarch).toBe(3);
  });
});

describe('turns', () => {
  it('rotates clockwise and skips eliminated players', () => {
    let s = run(started(), T0, { type: 'adjustLife', player: 1, delta: -40 });
    s = run(s, T0 + 1000, { type: 'passTurn' });
    expect(s.activeIndex).toBe(2);
    expect(s.turn).toBe(2);
  });

  it('wraps around and can reverse', () => {
    let s = run(started(), T0, { type: 'reverseDirection' }, { type: 'passTurn' });
    expect(s.activeIndex).toBe(3);
  });

  it('gives an extra turn once', () => {
    let s = run(started(), T0, { type: 'toggleExtraTurn' }, { type: 'passTurn' });
    expect(s.activeIndex).toBe(0);
    s = run(s, T0, { type: 'passTurn' });
    expect(s.activeIndex).toBe(1);
  });

  it('records turn duration and overtime', () => {
    const s = run(started({ turnSeconds: 60 }), T0 + 75_000, { type: 'passTurn' });
    expect(s.players[0].turns[0]).toEqual({ durationMs: 75_000, overtimeMs: 15_000 });
  });
});

describe('clock', () => {
  it('does not run until started', () => {
    const s = createGame(setup(), T0);
    expect(turnElapsedMs(s, T0 + 10_000)).toBe(0);
  });

  it('counts down and goes negative in overtime', () => {
    const s = started({ turnSeconds: 120 });
    expect(turnRemainingMs(s, T0 + 20_000)).toBe(100_000);
    expect(turnRemainingMs(s, T0 + 130_000)).toBe(-10_000);
  });

  it('pauses and resumes without losing time', () => {
    let s = started({ turnSeconds: 120 });
    s = run(s, T0 + 30_000, { type: 'togglePause' });
    expect(turnElapsedMs(s, T0 + 90_000)).toBe(30_000);
    s = run(s, T0 + 90_000, { type: 'togglePause' });
    expect(turnElapsedMs(s, T0 + 100_000)).toBe(40_000);
    expect(gameDurationMs(s, T0 + 100_000)).toBe(40_000);
  });

  it('resets each turn in per-turn mode', () => {
    const s = run(started(), T0 + 50_000, { type: 'passTurn' });
    expect(turnRemainingMs(s, T0 + 50_000)).toBe(120_000);
  });

  it('spends and refills the bank in chess clock mode', () => {
    let s = started({ timerMode: 'bank', bankMinutes: 10, incrementSeconds: 10 });
    expect(turnRemainingMs(s, T0)).toBe(600_000);
    s = run(s, T0 + 100_000, { type: 'passTurn' });
    expect(s.players[0].bankMs).toBe(510_000);
    expect(turnRemainingMs(s, T0 + 100_000)).toBe(600_000); // player 2's untouched bank
  });

  it('has no limit when the clock is off', () => {
    expect(turnRemainingMs(started({ timerMode: 'off' }), T0 + 5000)).toBeNull();
  });

  it('starts the clock when the first turn is passed even if never started', () => {
    const s = run(createGame(setup(), T0), T0 + 5000, { type: 'passTurn' });
    expect(s.clock.runningSince).toBe(T0 + 5000);
    expect(s.started).toBe(true);
  });
});

describe('end and stats', () => {
  it('freezes the game when ended', () => {
    const s = run(started(), T0 + 1000, { type: 'endGame' });
    expect(s.ended).toBe(true);
    expect(run(s, T0 + 2000, { type: 'adjustLife', player: 0, delta: -5 })).toBe(s);
  });

  it('flags the slowest player', () => {
    let s = started();
    s = run(s, T0 + 30_000, { type: 'passTurn' });
    s = run(s, T0 + 150_000, { type: 'passTurn' });
    const stats = computeStats(s, T0 + 150_000);
    expect(stats[1].slowest).toBe(true);
    expect(stats[1].averageMs).toBe(120_000);
    expect(stats[2].totalMs).toBe(0);
  });
});
