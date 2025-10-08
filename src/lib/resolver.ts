import type { Item, ResolvedArtist } from '../types/index.js';

import { apiGET } from './spotify.js';
import { loadState, saveState } from './state.js';

const SEARCH_LIMIT = 5;
const SKIP_SENTINELS = new Set(['__skip__', '__missing__']);

type SearchArtistResponse = {
  artists: {
    items: Array<{
      id: string;
      name: string;
      followers?: { total?: number };
      popularity?: number;
      images?: Array<{ url: string }>;
    }>;
  };
};

export type ArtistCandidate = {
  id: string;
  name: string;
  followers?: number;
  popularity?: number;
  images?: Array<{ url: string }>;
};

type AmbiguityResult = {
  choice: ArtistCandidate | null;
  skipped?: boolean;
  cancel?: boolean;
};

type AmbiguityHandler = (input: string, choices: ArtistCandidate[]) => Promise<AmbiguityResult>;

export function canonicalName(input: string): string {
  if (!input) return '';
  let value = String(input).toLowerCase();
  try {
    value = value.normalize('NFKD');
  } catch {
    // ignore older engines without normalize support
  }
  return value
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toResolvedArtist(
  inputName: string,
  artist: ArtistCandidate | null,
): ResolvedArtist | null {
  if (!artist) return null;
  return {
    input: inputName,
    id: artist.id,
    name: artist.name,
    followers: artist.followers,
    imageUrl: artist.images?.[0]?.url,
  };
}

async function searchArtist(name: string): Promise<Array<ArtistCandidate>> {
  const query = new URLSearchParams({ q: name, type: 'artist', limit: String(SEARCH_LIMIT) });
  const result = await apiGET<SearchArtistResponse>(`/search?${query.toString()}`);
  return (result?.artists?.items ?? []).map(artist => ({
    id: artist.id,
    name: artist.name,
    followers: artist.followers?.total ?? 0,
    popularity: artist.popularity ?? 0,
    images: artist.images ?? [],
  }));
}

function findCachedId(
  name: string,
  cache: Record<string, { id: string; verifiedAt: string }>,
): string | null {
  const key = canonicalName(name);
  if (cache[key]) return cache[key].id;
  const exact = cache[name];
  return exact ? exact.id : null;
}

export type ResolveArtistsResult = {
  resolved: ResolvedArtist[];
  skipped: string[];
  unresolved: string[];
  cancelled?: boolean;
};
type IncrementalResolveResult = ResolveArtistsResult & {
  changed: boolean;
  resolvedCount: number;
  skippedCount: number;
  unresolvedCount: number;
  cancelled: boolean;
};

function isSkipId(id: string | null | undefined): boolean {
  if (!id) return false;
  return SKIP_SENTINELS.has(id);
}

export async function resolveArtists(
  items: Item[],
  options: {
    onAmbiguity?: AmbiguityHandler;
  } = {},
  onIncrement?: (result: ResolveArtistsResult) => Promise<IncrementalResolveResult>,
): Promise<ResolveArtistsResult & IncrementalResolveResult> {
  const { onAmbiguity } = options;
  const state = await loadState();
  const cache = state.nameToId ?? {};
  const resolved: ResolvedArtist[] = [];
  const skipped: string[] = [];
  const unresolved: string[] = [];
  const seenIds = new Set<string>();
  const now = new Date().toISOString();
  let cancelled = false;
  let finalOutcome: IncrementalResolveResult | null = null;

  for (const item of items) {
    if (!item || item.type !== 'artist') continue;
    const inputName = item.name?.trim();
    if (!inputName) continue;

    let chosenId = item.spotifyId ?? null;
    let chosenMeta: ArtistCandidate | null = null;

    if (!chosenId || isSkipId(chosenId)) {
      const cachedId = findCachedId(inputName, cache);
      if (cachedId) {
        if (isSkipId(cachedId)) {
          skipped.push(inputName);
          continue;
        }
        chosenId = cachedId;
      }
    }

    if (!chosenId || isSkipId(chosenId)) {
      const candidates = await searchArtist(inputName);
      if (!candidates.length) {
        cache[inputName] = { id: '__missing__', verifiedAt: now };
        cache[canonicalName(inputName)] = { id: '__missing__', verifiedAt: now };
        skipped.push(inputName);
        continue;
      }
      const canonicalInput = canonicalName(inputName);
      const exactMatch = candidates.find(
        candidate => canonicalName(candidate.name) === canonicalInput,
      );
      if (exactMatch) {
        chosenId = exactMatch.id;
        chosenMeta = exactMatch;
      } else if (typeof onAmbiguity === 'function') {
        const result = await onAmbiguity(inputName, candidates.slice(0, SEARCH_LIMIT));
        if (result.cancel) {
          unresolved.push(inputName);
          cancelled = true;
          break;
        }
        if (result.skipped) {
          cache[inputName] = { id: '__skip__', verifiedAt: now };
          cache[canonicalName(inputName)] = { id: '__skip__', verifiedAt: now };
          skipped.push(inputName);
          continue;
        }
        if (result.choice?.id) {
          chosenId = result.choice.id;
          chosenMeta = result.choice;
        }
      }
      if (!chosenId) {
        cache[inputName] = { id: '__skip__', verifiedAt: now };
        cache[canonicalName(inputName)] = { id: '__skip__', verifiedAt: now };
        skipped.push(inputName);
        continue;
      }
    }

    if (!chosenId || isSkipId(chosenId) || seenIds.has(chosenId)) {
      if (!chosenId || isSkipId(chosenId)) {
        skipped.push(inputName);
      }
      continue;
    }
    seenIds.add(chosenId);

    const resolvedArtist = toResolvedArtist(
      inputName,
      chosenMeta ?? { id: chosenId, name: inputName },
    );
    if (resolvedArtist) {
      resolved.push(resolvedArtist);
    }

    const key = canonicalName(inputName);
    cache[key] = { id: chosenId, verifiedAt: now };
    cache[inputName] = { id: chosenId, verifiedAt: now };
  }

  state.nameToId = cache;
  await saveState(state);

  if (onIncrement) {
    finalOutcome = await onIncrement({ resolved, skipped, unresolved, cancelled });
  }

  return (
    finalOutcome ?? {
      resolved,
      skipped,
      unresolved,
      changed: resolved.length > 0 || skipped.length > 0,
      resolvedCount: resolved.length,
      skippedCount: skipped.length,
      unresolvedCount: unresolved.length,
      cancelled: !!cancelled,
    }
  );
}
