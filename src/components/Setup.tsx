import { useState } from 'react';
import { FORMATS, MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLORS } from '../game/constants';
import type { Format, TimerMode } from '../game/types';
import { unlockAudio } from '../hooks/device';
import { useStore } from '../store';
import { BackgroundPicker } from './BackgroundPicker';

function Seg<T extends string | number>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Setup() {
  const setup = useStore((s) => s.setup);
  const update = useStore((s) => s.updateSetup);
  const startGame = useStore((s) => s.startGame);
  const fmt = FORMATS[setup.format];
  const players = setup.players.slice(0, setup.playerCount);
  const [picking, setPicking] = useState<number | null>(null);

  const counts: [number, string][] = [];
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) counts.push([n, String(n)]);

  return (
    <main className="setup">
      <h1>MTG Turn Timer</h1>
      <p className="sub">Life counter with a turn clock. Set it up, put it in the middle of the table, play faster.</p>

      <section className="field">
        <label>Format</label>
        <Seg<Format>
          options={Object.entries(FORMATS).map(([k, v]) => [k as Format, v.label])}
          value={setup.format}
          onChange={(v) => update((s) => { s.format = v; s.startingLife = FORMATS[v].life; })}
        />
      </section>

      <section className="field">
        <label>Players</label>
        <Seg options={counts} value={setup.playerCount} onChange={(v) => update((s) => { s.playerCount = v; if (typeof s.firstPlayer === 'number' && s.firstPlayer >= v) s.firstPlayer = 'random'; })} />
      </section>

      <section className="field">
        <label>Names &amp; colours</label>
        {players.map((p, i) => (
          <div className="pl-row" key={i}>
            <button
              className="swatch"
              aria-label={`Change colour for ${p.name}`}
              style={{ background: p.color }}
              onClick={() => update((s) => { s.players[i].color = PLAYER_COLORS[(PLAYER_COLORS.indexOf(p.color) + 1) % PLAYER_COLORS.length]; })}
            />
            <button
              className={`thumb${p.background ? ' has' : ''}`}
              aria-label={`Background for ${p.name}`}
              style={p.background ? { backgroundImage: `url("${p.background.url}")` } : undefined}
              onClick={() => setPicking(i)}
            >
              {!p.background && '🖼'}
            </button>
            <input type="text" value={p.name} maxLength={16} aria-label={`Player ${i + 1} name`} onChange={(e) => update((s) => { s.players[i].name = e.target.value; })} />
            {fmt.commanderDamage && (
              <label className="chk">
                <input type="checkbox" checked={p.hasPartner} onChange={(e) => update((s) => { s.players[i].hasPartner = e.target.checked; })} />
                Partners
              </label>
            )}
          </div>
        ))}
        <p className="hint">Enter players in seating order, going clockwise. That's also the turn order. Tap a colour to change it, or 🖼 for card art or a photo.</p>
      </section>

      <section className="field">
        <label>Starting life</label>
        <Seg options={[[20, '20'], [25, '25'], [30, '30'], [40, '40']]} value={setup.startingLife} onChange={(v) => update((s) => { s.startingLife = v; })} />
      </section>

      {fmt.commanderDamage && (
        <section className="field">
          <label className="chk big">
            <input type="checkbox" checked={setup.commanderDamageReducesLife} onChange={(e) => update((s) => { s.commanderDamageReducesLife = e.target.checked; })} />
            Commander damage also reduces life
          </label>
        </section>
      )}

      <section className="field">
        <label>Turn clock</label>
        <Seg<TimerMode>
          options={[['turn', 'Per turn'], ['bank', 'Chess clock'], ['off', 'Off']]}
          value={setup.timerMode}
          onChange={(v) => update((s) => { s.timerMode = v; })}
        />
        {setup.timerMode === 'turn' && (
          <div className="sub-opts">
            <Seg options={[[60, '1 min'], [90, '1:30'], [120, '2 min'], [180, '3 min'], [300, '5 min']]} value={setup.turnSeconds} onChange={(v) => update((s) => { s.turnSeconds = v; })} />
            <div className="inline">
              <span className="hint">Custom (seconds)</span>
              <input className="numin" type="number" min={10} value={setup.turnSeconds} onChange={(e) => update((s) => { s.turnSeconds = Math.max(10, parseInt(e.target.value) || 120); })} />
            </div>
            <p className="hint">Each turn gets the same amount of time. The clock resets when the turn passes.</p>
          </div>
        )}
        {setup.timerMode === 'bank' && (
          <div className="sub-opts">
            <Seg options={[[10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min']]} value={setup.bankMinutes} onChange={(v) => update((s) => { s.bankMinutes = v; })} />
            <div className="inline">
              <span className="hint">Seconds added each turn</span>
              <input className="numin" type="number" min={0} value={setup.incrementSeconds} onChange={(e) => update((s) => { s.incrementSeconds = Math.max(0, parseInt(e.target.value) || 0); })} />
            </div>
            <p className="hint">Each player has a time bank for the whole game. Time used on one turn is gone for later turns.</p>
          </div>
        )}
        {setup.timerMode === 'off' && <p className="hint">No limit, but turn times are still tracked for end-of-game stats.</p>}
      </section>

      <section className="field">
        <label>First player</label>
        <Seg<number | 'random'>
          options={[['random', 'Random'], ...players.map((p, i): [number, string] => [i, p.name || `Player ${i + 1}`])]}
          value={setup.firstPlayer}
          onChange={(v) => update((s) => { s.firstPlayer = v; })}
        />
      </section>

      <button className="primary" onClick={() => { unlockAudio(); startGame(); }}>
        Start game
      </button>

      {picking != null && (
        <BackgroundPicker
          playerName={players[picking]?.name || `Player ${picking + 1}`}
          current={players[picking]?.background ?? null}
          onPick={(bg) => update((s) => { s.players[picking].background = bg; })}
          onClose={() => setPicking(null)}
        />
      )}
    </main>
  );
}
