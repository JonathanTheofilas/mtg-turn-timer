import { useState } from 'react';
import { formatDuration, gameDurationMs } from '../game/clock';
import { LETHAL_COMMANDER_DAMAGE, LETHAL_POISON } from '../game/constants';
import { cmdKey } from '../game/engine';
import { computeStats } from '../game/stats';
import type { Counter, GameState, LogEntry } from '../game/types';
import { useNow } from '../hooks/device';
import { useStore } from '../store';
import { Modal, Stepper } from './Modal';

interface PlayerModalProps {
  game: GameState;
  index: number;
  flip: boolean;
  onClose: () => void;
}

export function CommanderDamageModal({ game, index, flip, onClose }: PlayerModalProps) {
  const dispatch = useStore((s) => s.dispatch);
  const p = game.players[index];
  return (
    <Modal
      title={`${p.name}: commander damage`}
      subtitle={`Damage taken from each commander. ${LETHAL_COMMANDER_DAMAGE} from one commander knocks you out.${game.config.commanderDamageReducesLife ? ' Changes here also update life.' : ''}`}
      flip={flip}
      onClose={onClose}
    >
      {game.players.flatMap((src, j) =>
        j === index
          ? []
          : ([0, 1] as const)
              .filter((slot) => slot === 0 || src.hasPartner)
              .map((slot) => {
                const v = p.commanderDamage[cmdKey(j, slot)] ?? 0;
                return (
                  <div className="crow" key={`${j}:${slot}`}>
                    <div className="who">
                      <span className="dot" style={{ background: src.color }} />
                      {src.name}
                      {src.hasPartner && <small>{slot ? 'partner' : 'commander'}</small>}
                    </div>
                    <Stepper
                      label={`damage from ${src.name}`}
                      value={v}
                      hot={v >= LETHAL_COMMANDER_DAMAGE}
                      onChange={(d) => dispatch({ type: 'adjustCommanderDamage', target: index, source: j, slot, delta: d })}
                    />
                  </div>
                );
              }),
      )}
    </Modal>
  );
}

const COUNTERS: [Counter, string][] = [
  ['poison', '☠ Poison'],
  ['energy', '⚡ Energy'],
  ['experience', '✦ Experience'],
  ['rad', '☢ Rad'],
];

export function CountersModal({ game, index, flip, onClose }: PlayerModalProps) {
  const dispatch = useStore((s) => s.dispatch);
  const p = game.players[index];
  return (
    <Modal title={p.name} subtitle="Counters" flip={flip} onClose={onClose}>
      {COUNTERS.map(([c, label]) => (
        <div className="crow" key={c}>
          <div className="who">{label}</div>
          <Stepper label={c} value={p[c]} hot={c === 'poison' && p.poison >= LETHAL_POISON} onChange={(d) => dispatch({ type: 'adjustCounter', player: index, counter: c, delta: d })} />
        </div>
      ))}
      {game.config.commanderDamage &&
        ([0, 1] as const)
          .filter((slot) => slot === 0 || p.hasPartner)
          .map((slot) => (
            <div className="crow" key={`tax${slot}`}>
              <div className="who">
                {slot ? 'Partner casts' : 'Commander casts'} <small>tax {p.casts[slot] * 2}</small>
              </div>
              <Stepper label="casts" value={p.casts[slot]} onChange={(d) => dispatch({ type: 'adjustCasts', player: index, slot, delta: d })} />
            </div>
          ))}
      {(['monarch', 'initiative'] as const).map((m) => {
        const has = game.markers[m] === index;
        return (
          <div className="crow" key={m}>
            <div className="who">{m === 'monarch' ? '👑 Monarch' : '🏰 Initiative'}</div>
            <button className="pill wide" onClick={() => dispatch({ type: 'setMarker', marker: m, player: has ? null : index })}>
              {has ? 'Remove' : 'Take it'}
            </button>
          </div>
        );
      })}
    </Modal>
  );
}

export type MenuView = 'menu' | 'stats' | 'log' | 'dice' | 'end';

export function MenuModal({ game, view, setView, onClose }: { game: GameState; view: MenuView; setView: (v: MenuView) => void; onClose: () => void }) {
  const dispatch = useStore((s) => s.dispatch);
  const exitToSetup = useStore((s) => s.exitToSetup);
  const active = game.players[game.activeIndex];
  const back = (
    <button className="close" onClick={() => setView('menu')}>
      Back
    </button>
  );

  if (view === 'stats') return <Modal title="Turn stats" subtitle={<StatsSubtitle game={game} />} onClose={onClose} footer={back}><StatsTable game={game} /></Modal>;
  if (view === 'log') return <Modal title="Game log" onClose={onClose} footer={back}><Log game={game} /></Modal>;
  if (view === 'dice') return <Modal title="Roll / flip" onClose={onClose} footer={back}><Dice game={game} /></Modal>;
  if (view === 'end')
    return (
      <Modal
        title="End game?"
        subtitle="Final stats are below. The game can't be resumed after this."
        onClose={onClose}
        footer={
          <div className="menu-grid" style={{ marginTop: 14 }}>
            <button onClick={() => setView('menu')}>Keep playing</button>
            <button className="danger" onClick={() => { dispatch({ type: 'endGame' }); onClose(); exitToSetup(); }}>End game</button>
          </div>
        }
      >
        <StatsTable game={game} />
      </Modal>
    );

  return (
    <Modal title="Menu" subtitle={`Turn ${game.turn} · ${active.name} is active`} onClose={onClose}>
      <div className="menu-grid">
        <button onClick={() => dispatch({ type: 'toggleExtraTurn' })}>
          Extra turn<small>{game.extraTurnQueued ? `Queued for ${active.name}` : `${active.name} goes again`}</small>
        </button>
        <button onClick={() => dispatch({ type: 'reverseDirection' })}>
          Reverse order<small>Now {game.direction === 1 ? 'clockwise' : 'anticlockwise'}</small>
        </button>
        <button onClick={() => setView('stats')}>Turn stats<small>Who's slowest?</small></button>
        <button onClick={() => setView('log')}>Game log<small>Every change</small></button>
        <button onClick={() => setView('dice')}>Roll / flip<small>d6, d20, coin, player</small></button>
        <button onClick={() => setView('end')}>End game<small>Stats, then back to setup</small></button>
      </div>
    </Modal>
  );
}

function StatsSubtitle({ game }: { game: GameState }) {
  const now = useNow(1000);
  return <>Game time {formatDuration(gameDurationMs(game, now))} (excluding pauses) · {game.turn - 1} turns completed</>;
}

function StatsTable({ game }: { game: GameState }) {
  const now = useNow(1000);
  const rows = computeStats(game, now);
  return (
    <table className="num">
      <thead>
        <tr><th>Player</th><th>Turns</th><th>Avg</th><th>Longest</th><th>Total</th><th>Over</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.player.id}>
            <td><span className="dot" style={{ background: r.player.color }} /> {r.player.name}{r.slowest && ' 🐢'}</td>
            <td>{r.turns}</td>
            <td>{r.turns ? formatDuration(r.averageMs) : '–'}</td>
            <td>{formatDuration(r.longestMs)}</td>
            <td>{formatDuration(r.totalMs)}</td>
            <td className={r.overtimeMs ? 'bad' : ''}>{r.overtimeMs ? formatDuration(r.overtimeMs) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function logText(game: GameState, e: LogEntry) {
  if (e.kind === 'text') return e.text;
  const p = game.players[e.player];
  return `${p.name} ${e.delta > 0 ? '+' : ''}${e.delta} life → ${e.total}`;
}

function Log({ game }: { game: GameState }) {
  return (
    <div className="log">
      {game.log.map((e, i) => (
        <div key={i}>
          <span className="num">T{e.turn}</span> · {logText(game, e)}
        </div>
      ))}
    </div>
  );
}

function Dice({ game }: { game: GameState }) {
  const dispatch = useStore((s) => s.dispatch);
  const [result, setResult] = useState<string>('–');
  const roll = (kind: 'd6' | 'd20' | 'coin' | 'player') => {
    let out: string;
    if (kind === 'coin') out = Math.random() < 0.5 ? 'Heads' : 'Tails';
    else if (kind === 'player') {
      const alive = game.players.filter((p) => !p.eliminated);
      out = alive[Math.floor(Math.random() * alive.length)].name;
    } else out = String(1 + Math.floor(Math.random() * (kind === 'd6' ? 6 : 20)));
    setResult(out);
    dispatch({ type: 'note', text: `Rolled ${kind === 'player' ? 'random player' : kind}: ${out}` });
  };
  return (
    <>
      <div className="bigresult num">{result}</div>
      <div className="menu-grid">
        <button onClick={() => roll('d6')}>d6</button>
        <button onClick={() => roll('d20')}>d20</button>
        <button onClick={() => roll('coin')}>Coin</button>
        <button onClick={() => roll('player')}>Random player</button>
      </div>
    </>
  );
}
