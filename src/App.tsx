import { Game } from './components/Game';
import { Setup } from './components/Setup';
import { useStore } from './store';

export function App() {
  const game = useStore((s) => s.game);
  return game && !game.ended ? <Game game={game} /> : <Setup />;
}
