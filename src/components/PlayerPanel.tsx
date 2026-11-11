import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { formatCountdown, formatDuration, isRunning, turnElapsedMs, turnRemainingMs } from '../game/clock';
import { LETHAL_POISON } from '../game/constants';
import type { GameState } from '../game/types';
import { beep, unlockAudio, useNow, vibrate } from '../hooks/device';
import { useHoldPress } from '../hooks/useHoldPress';
import { useStore } from '../store';

export type PanelModal = 'commander' | 'counters';

interface Props {
  game: GameState;
  index: number;
  flipped: boolean;
  onOpen: (modal: PanelModal) => void;
}

export function PlayerPanel({ game, index, flipped, onOpen }: Props) {
  const dispatch = useStore((s) => s.dispatch);
  const p = game.players[index];
  const active = index === game.activeIndex && !game.ended;
  const delta = useLifeDelta(p.life);

  const minus = useHoldPress({
    onTap: () => dispatch({ type: 'adjustLife', player: index, delta: -1 }),
    onHold: () => dispatch({ type: 'adjustLife', player: index, delta: -10 }),
    repeatMs: 450,
  });
  const plus = useHoldPress({
    onTap: () => dispatch({ type: 'adjustLife', player: index, delta: 1 }),
    onHold: () => dispatch({ type: 'adjustLife', player: index, delta: 10 }),
    repeatMs: 450,
  });

  const maxCmd = Math.max(0, ...Object.values(p.commanderDamage));
  const badges = [game.markers.monarch === index && '👑', game.markers.initiative === index && '🏰'].filter(Boolean).join(' ');

  return (
    <div
      className={`panel${active ? ' active' : ''}${p.eliminated ? ' out' : ''}`}
      style={{ '--c': p.color } as CSSProperties}
      data-player={index}
      onPointerDown={unlockAudio}
    >
      <div className={`pin${flipped ? ' flipped' : ''}`}>
        <div className="pname">
          {p.name}
          {badges && <span className="badge"> {badges}</span>}
        </div>

        {active ? <ActiveTimer game={game} /> : game.config.timerMode === 'bank' && <div className="timerbox idle num">{formatDuration(p.bankMs)}</div>}

        <button className="half minus" aria-label={`${p.name} lose life`} {...minus}><span>−</span></button>
        <button className="half plus" aria-label={`${p.name} gain life`} {...plus}><span>+</span></button>

        <div className="life num" aria-live="polite">{p.life}</div>
        <div className="delta num">{delta ? (delta > 0 ? `+${delta}` : delta) : p.eliminated ? 'OUT' : ''}</div>

        <div className="pills">
          {game.config.commanderDamage && (
            <button className={`pill${maxCmd >= 15 ? ' hot' : ''}`} onClick={() => onOpen('commander')} aria-label="Commander damage">⚔ {maxCmd}</button>
          )}
          <button className={`pill${p.poison >= LETHAL_POISON - 3 ? ' hot' : ''}`} onClick={() => onOpen('counters')} aria-label="Poison">☠ {p.poison}</button>
          {p.energy > 0 && <button className="pill" onClick={() => onOpen('counters')}>⚡ {p.energy}</button>}
          {p.experience > 0 && <button className="pill" onClick={() => onOpen('counters')}>✦ {p.experience}</button>}
          {p.rad > 0 && <button className="pill" onClick={() => onOpen('counters')}>☢ {p.rad}</button>}
          {game.config.commanderDamage && (p.casts[0] > 0 || p.casts[1] > 0) && (
            <button className="pill" onClick={() => onOpen('counters')}>Tax {p.casts[0] * 2}{p.hasPartner ? `/${p.casts[1] * 2}` : ''}</button>
          )}
          <button className="pill" onClick={() => onOpen('counters')} aria-label="More counters">⋯</button>
        </div>

        {active && <PassButton />}
      </div>
    </div>
  );
}

function ActiveTimer({ game }: { game: GameState }) {
  const now = useNow(200);
  const remaining = turnRemainingMs(game, now);
  const running = isRunning(game);
  let text: string, label: string, cls = '';
  if (remaining == null) {
    text = formatDuration(turnElapsedMs(game, now));
    label = 'this turn';
  } else {
    text = formatCountdown(remaining);
    label = remaining < 0 ? 'overtime' : game.config.timerMode === 'bank' ? 'time bank' : 'remaining';
    cls = remaining < 0 ? ' over' : remaining <= 30_000 ? ' warn' : '';
  }
  // The flashing border lives on the panel; toggle it from here so only this leaf re-renders each tick.
  const ref = useRef<HTMLDivElement>(null);
  const overtime = remaining != null && remaining < 0 && running;
  useEffect(() => {
    ref.current?.closest('.panel')?.classList.toggle('overtime', overtime);
  }, [overtime]);
  useEffect(() => () => ref.current?.closest('.panel')?.classList.remove('overtime'), []);

  return (
    <div className="timerbox" ref={ref}>
      <div className={`tval num${cls}`}>{text}</div>
      <div className="tlabel">{running ? label : 'paused'}</div>
    </div>
  );
}

function PassButton() {
  const dispatch = useStore((s) => s.dispatch);
  const [holding, setHolding] = useState(false);
  const handlers = useHoldPress({
    holdMs: 500,
    onPressChange: setHolding,
    onHold: () => {
      beep(520, 0.06);
      vibrate(40);
      dispatch({ type: 'passTurn' });
    },
  });
  return (
    <button className={`passbtn${holding ? ' holding' : ''}`} aria-label="Hold to pass turn" {...handlers}>
      <span className="fill" />
      <span className="lbl">HOLD<br />TO PASS</span>
    </button>
  );
}

/** Running "+3" / "−7" indicator that resets after a short pause in changes. */
function useLifeDelta(life: number) {
  const prev = useRef(life);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const d = life - prev.current;
    prev.current = life;
    if (!d) return;
    setDelta((x) => x + d);
    const t = setTimeout(() => setDelta(0), 1600);
    return () => clearTimeout(t);
  }, [life]);
  return delta;
}
