import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveArtists } from '../lib/resolver.js';
import type { Item, PurgeState } from '../types/index.js';

vi.mock('../lib/spotify.js', () => ({
  apiGET: vi.fn(),
}));

vi.mock('../lib/state.js', () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
}));

const spotify = await import('../lib/spotify.js');
const stateMod = await import('../lib/state.js');
const apiGET = vi.mocked(spotify.apiGET);
const loadState = vi.mocked(stateMod.loadState);
const saveState = vi.mocked(stateMod.saveState);

describe('resolveArtists', () => {
  beforeEach(() => {
    const baseState: PurgeState = {
      unfollowed: {},
      removedTracksByArtist: {},
      removedAlbumsByArtist: {},
      removedTracksByLabel: {},
      removedAlbumsByLabel: {},
      nameToId: {
        'cached artist': { id: 'artist-1', verifiedAt: '2024-01-01T00:00:00.000Z' },
        'Cached Artist': { id: 'artist-1', verifiedAt: '2024-01-01T00:00:00.000Z' },
      },
      ops: {},
    };
    loadState.mockResolvedValue(structuredClone(baseState));
    saveState.mockResolvedValue();
    apiGET.mockResolvedValue({ artists: { items: [] } });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('reuses cached ids and persists new matches', async () => {
    apiGET.mockResolvedValueOnce({
      artists: {
        items: [
          {
            id: 'artist-2',
            name: 'New Artist',
            followers: { total: 1234 },
            popularity: 55,
            images: [],
          },
        ],
      },
    });

    const items: Item[] = [
      { type: 'artist', name: 'Cached Artist' },
      { type: 'artist', name: 'New Artist' },
    ];

    const result = await resolveArtists(items);

    expect(result.resolved).toHaveLength(2);
    expect(apiGET).toHaveBeenCalledTimes(1);

    expect(saveState).toHaveBeenCalledTimes(1);
    const saved = saveState.mock.calls[0]?.[0];
    expect(saved?.nameToId['new artist']?.id).toBe('artist-2');
    expect(saved?.nameToId['New Artist']?.id).toBe('artist-2');
  });

  it('marks skipped entries when ambiguity handler declines choices', async () => {
    apiGET.mockResolvedValueOnce({
      artists: {
        items: [
          { id: 'artist-3', name: 'Ambiguous One' },
          { id: 'artist-4', name: 'Ambiguous Two' },
        ],
      },
    });

    const items: Item[] = [{ type: 'artist', name: 'Ambiguous' }];

    const result = await resolveArtists(items, {
      onAmbiguity: async () => ({ skipped: true, choice: null }),
    });

    expect(result.skipped).toEqual(['Ambiguous']);
    expect(result.resolved).toHaveLength(0);
    const saved = saveState.mock.calls[0]?.[0];
    expect(saved?.nameToId['ambiguous']?.id).toBe('__skip__');
  });
});
