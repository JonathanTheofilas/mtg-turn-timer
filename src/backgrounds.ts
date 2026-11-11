import type { Background } from './game/types';

export interface ArtResult extends Background {
  name: string;
  set: string;
}

interface ScryfallCard {
  name: string;
  set_name: string;
  artist?: string;
  image_uris?: { art_crop?: string };
  card_faces?: { name: string; artist?: string; image_uris?: { art_crop?: string } }[];
}

/**
 * Card art search via the Scryfall API (https://scryfall.com/docs/api).
 * Returns one result per unique artwork. Artist credit is kept so we can display it.
 */
export async function searchCardArt(query: string, signal?: AbortSignal): Promise<ArtResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://api.scryfall.com/cards/search?unique=art&order=released&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
  const body: { data: ScryfallCard[] } = await res.json();
  const out: ArtResult[] = [];
  for (const card of body.data) {
    const faces = card.image_uris?.art_crop ? [{ ...card, image_uris: card.image_uris }] : (card.card_faces ?? []);
    for (const f of faces) {
      if (f.image_uris?.art_crop) out.push({ url: f.image_uris.art_crop, credit: f.artist ?? card.artist, name: f.name, set: card.set_name });
    }
    if (out.length >= 24) break;
  }
  return out;
}

/**
 * Shrinks a photo to fit within maxSize px and re-encodes it as JPEG, so it can be
 * saved with the game without filling the browser's storage.
 */
export async function photoToBackground(file: File, maxSize = 900, quality = 0.78): Promise<Background> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { url: canvas.toDataURL('image/jpeg', quality) };
}
