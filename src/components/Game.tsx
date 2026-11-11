import { useState } from 'react';
import { formatDuration, gameDurationMs, isRunning } from '../game/clock';
import type { GameState } from '../game/types';
import { unlockAudio, useNow, useWakeLock } from '../hooks/device';
import { useTurnAlerts } from '../hooks/useTurnAlerts';
import { useStore } from '../store';
import { CommanderDamageModal, CountersModal, MenuModal, type MenuView } from './modals';
import { PlayerPanel, type PanelModal } from './PlayerPanel';

/**
 * Seating, clockwise from the bottom-left: the bottom row reads left→right,
 * the top row (rotated to face the far side) continues right→left.
 */
export function seating(n: number) {
  const bottomCount = Math.ceil(n / 2);
  const bottom = Array.from({ length: bottomCount }, (_, i) => i);
  const top = Array.from({ length: n - bottomCount }, (_, i) => bottomCount + i).reverse();
  return { top, bottom };
}

type OpenModal = { kind: PanelModal; player: number } | { kind: 'menu'; view: MenuView } | null;

export function Game({ game }: { game: GameState }) {
  const dispatch = useStore((s) => s.dispatch);
  const undo = useStore((s) => s.undo);
  const canUndo = useStore((s) => s.history.length > 0);
  const [modal, setModal] = useState<OpenModal>(null);
  const { top, bottom } = seating(game.players.length);
  const running = isRunning(game);

  useWakeLock(!game.ended);
  useTurnAlerts(game);

  const panel = (i: number, flipped: boolean) => (
    <PlayerPanel key={i} game={game} index={i} flipped={flipped} onOpen={(kind) => setModal({ kind, player: i })} />
  );
  const close = () => setModal(null);

  return (
    <div className="game">
      {top.length > 0 && <div className="row top">{top.map((i) => panel(i, true))}</div>}

      <div className="bar">
        <div className="grp">
          <button className={`icon${running ? '' : ' on'}`} aria-label={running ? 'Pause' : 'Start clock'} onClick={() => { unlockAudio(); dispatch({ type: 'togglePause' }); }}>
            {running ? '❚❚' : '▶'}
          </button>
          <button className="icon" aria-label="Undo" disabled={!canUndo} onClick={undo}>↶</button>
        </div>
        <div className="mid num">
          <b>Turn {game.turn}{game.extraTurnQueued ? ' · extra next' : ''}</b>
          <GameClock game={game} />
        </div>
        <div className="grp">
          <button className="icon" aria-label="Reverse turn order" onClick={() => dispatch({ type: 'reverseDirection' })}>
            {game.direction === 1 ? '↻' : '↺'}
          </button>
          <button className="icon" aria-label="Menu" onClick={() => setModal({ kind: 'menu', view: 'menu' })}>☰</button>
        </div>
      </div>

      <div className="row bottom">{bottom.map((i) => panel(i, false))}</div>

      {!running && !game.ended && !modal && (
        <div className="banner">{game.started ? 'PAUSED' : 'TAP ▶ TO START THE CLOCK'}</div>
      )}

      {modal?.kind === 'commander' && <CommanderDamageModal game={game} index={modal.player} flip={top.includes(modal.player)} onClose={close} />}
      {modal?.kind === 'counters' && <CountersModal game={game} index={modal.player} flip={top.includes(modal.player)} onClose={close} />}
      {modal?.kind === 'menu' && <MenuModal game={game} view={modal.view} setView={(view) => setModal({ kind: 'menu', view })} onClose={close} />}
    </div>
  );
}

function GameClock({ game }: { game: GameState }) {
  const now = useNow(1000);
  return <span>{formatDuration(gameDurationMs(game, now))}</span>;
}
