# MTG Turn Timer

A Magic: The Gathering life counter with a turn clock that rotates between players. Built to stop Commander games from running three hours.

Put one phone or tablet in the middle of the table. Each player gets a panel facing them; the active player's panel shows the clock and a **Hold to pass** button.

## Features

- 2–6 players, panels rotated for the far side of the table, seating order = turn order
- Player backgrounds: search any card's art (via [Scryfall](https://scryfall.com), artist credited) or upload a photo
- Commander, Standard and Custom presets; starting life 20/25/30/40
- Life: tap ±1, hold ±10, running change indicator
- Commander damage per opposing commander (partners tracked separately), 21 = out, optionally reduces life
- Poison (10 = out; shown on the panel once a player has any), energy, experience, rad, commander tax, monarch, initiative
- **Turn clock**, chosen per game:
  - **Per turn**: the same allowance every turn (1, 1:30, 2, 3, 5 min or custom)
  - **Chess clock**: a time bank per player for the whole game, plus seconds added each turn
  - **Off**: no limit, turn times still tracked
- Warnings at 30s and 10s; in overtime the panel flashes and it beeps/vibrates every 30s. It **never** passes the turn for you.
- Pause, reverse turn order, extra turns, eliminated players skipped
- Undo for every action (including an accidental pass), game log
- Turn stats: average, longest, total and overtime per player, with the slowest player flagged 🐢
- Dice, coin flip, random player
- Keeps the screen awake; game saved locally so a refresh loses nothing; installable and works offline

## Development

```bash
npm install
npm run dev          # local dev server
npm test             # game-engine tests (Vitest)
npm run build        # installable PWA → dist/
npm run build:single # one self-contained HTML file → dist-single/index.html
```

## Project layout

```
src/
  game/            Pure, framework-free game logic (fully unit tested)
    types.ts       State, config and action types
    engine.ts      createGame() and reduce(state, action, now)
    clock.ts       Timestamp-based turn clock maths (no drift when the screen sleeps)
    stats.ts       End-of-game turn stats
  store.ts         Zustand store: dispatch, undo history, local persistence
  hooks/           Hold/tap gestures, turn alerts, wake lock, sound and vibration
  components/      Setup screen, game board, player panels, modals
```

All rules live in `src/game/` and take `now` as a parameter, so they're deterministic and easy to test. The UI only dispatches actions.

## Roadmap

- Optional response clock (move the clock to an opponent while they respond on your turn)
- Life-over-time chart
- Day/night, storm count, custom counters
- Themes; player profiles with lifetime turn stats

## License

MIT

## Credits

Card art is fetched from the [Scryfall API](https://scryfall.com/docs/api). Artwork © its respective artists and Wizards of the Coast. This is unofficial Fan Content, not approved or endorsed by Wizards.
