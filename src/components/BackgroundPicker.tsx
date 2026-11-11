import { useEffect, useRef, useState } from 'react';
import { photoToBackground, searchCardArt, type ArtResult } from '../backgrounds';
import type { Background } from '../game/types';
import { Modal } from './Modal';

interface Props {
  playerName: string;
  current: Background | null;
  /** Rotate for a player on the far side of the table. */
  flip?: boolean;
  onPick: (bg: Background | null) => void;
  onClose: () => void;
}

export function BackgroundPicker({ playerName, current, flip, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArtResult[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const search = async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStatus('loading');
    try {
      const r = await searchCardArt(query, ctrl.signal);
      setResults(r);
      setStatus('idle');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setStatus('error');
      setError("Couldn't reach Scryfall. Check the connection, or upload a photo instead.");
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      onPick(await photoToBackground(file));
      onClose();
    } catch {
      setStatus('error');
      setError("That file couldn't be read as an image.");
    }
  };

  return (
    <Modal title={`${playerName}: background`} subtitle="Search any Magic card for its art, or use a photo." flip={flip} onClose={onClose}>
      <form
        className="art-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          type="search"
          placeholder="Card name, e.g. Atraxa"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search card art"
        />
        <button type="submit" disabled={!query.trim() || status === 'loading'}>
          {status === 'loading' ? '…' : 'Search'}
        </button>
      </form>

      {status === 'error' && <p className="hint bad">{error}</p>}
      {results && results.length === 0 && status === 'idle' && <p className="hint">No cards found. Try a different name.</p>}

      {results && results.length > 0 && (
        <div className="art-grid">
          {results.map((r) => (
            <button
              key={r.url}
              className={`art-tile${current?.url === r.url ? ' on' : ''}`}
              onClick={() => {
                onPick({ url: r.url, credit: r.credit });
                onClose();
              }}
              aria-label={`${r.name}, ${r.set}, art by ${r.credit ?? 'unknown'}`}
            >
              <img src={r.url} alt="" loading="lazy" />
              <span>
                {r.name}
                <small>{r.set}{r.credit ? ` · ${r.credit}` : ''}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="menu-grid" style={{ marginTop: 14 }}>
        <button onClick={() => fileInput.current?.click()}>
          Upload photo<small>From this device</small>
        </button>
        <button disabled={!current} onClick={() => { onPick(null); onClose(); }}>
          Remove<small>Back to plain colour</small>
        </button>
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <p className="hint">Card art from Scryfall. Artwork © its artists and Wizards of the Coast.</p>
    </Modal>
  );
}
