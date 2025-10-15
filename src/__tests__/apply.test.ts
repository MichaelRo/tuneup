import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/state');
vi.mock('../app/routing');
vi.mock('../lib/state', () => ({
  loadState: vi.fn(),
  saveState: vi.fn(),
}));
vi.mock('../spotify/api', async () => {
  const actual = await vi.importActual<typeof import('../spotify/api.js')>('../spotify/api');
  return {
    ...actual,
    removeLikedTracks: vi.fn(),
    removeSavedAlbums: vi.fn(),
    unfollowArtists: vi.fn(),
  };
});

import { runPlan } from '../lib/apply.js';
import type { ApiHooks, Plan } from '../types/index.js';

const spotify = await import('../spotify/api.js');
const unfollowArtists = vi.mocked(spotify.unfollowArtists);
const removeLikedTracks = vi.mocked(spotify.removeLikedTracks);
const removeSavedAlbums = vi.mocked(spotify.removeSavedAlbums);

describe('runPlan', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('processes phases sequentially and reports progress events', async () => {
    const progressEvents: Array<Record<string, unknown>> = [];

    unfollowArtists.mockImplementation(async (_ids: string[], hooks?: ApiHooks) => {
      void _ids;
      hooks?.onRateLimit?.(12);
    });
    removeLikedTracks.mockImplementation(async (_ids: string[], hooks?: ApiHooks) => {
      void _ids;
      hooks?.onRetry?.(2, 429);
    });
    removeSavedAlbums.mockImplementation(async (_ids: string[], _hooks?: ApiHooks) => {
      void _ids;
      void _hooks;
    });

    const plan: Plan = {
      artistsToUnfollow: ['a1', 'a2', 'a3'],
      trackIdsToRemove: ['t1', 't2'],
      albumIdsToRemove: ['al1'],
      tracksToRemove: [],
      albumsToRemove: [],
      evidence: [],
    };

    const onProgress = vi.fn(evt => {
      progressEvents.push({ ...evt });
    });

    await runPlan(plan, onProgress);

    expect(unfollowArtists).toHaveBeenCalledWith(['a1', 'a2', 'a3'], expect.any(Object));
    expect(removeLikedTracks).toHaveBeenCalledWith(['t1', 't2'], expect.any(Object));
    expect(removeSavedAlbums).toHaveBeenCalledWith(['al1'], expect.any(Object));

    expect(onProgress).toHaveBeenCalledTimes(5);
    expect(progressEvents[0]).toEqual({
      phase: 'unfollow',
      done: 0,
      total: 3,
      retries: 1,
      retryAfter: 12,
    });
    expect(progressEvents[1]).toEqual({ phase: 'unfollow', done: 3, total: 3, retries: 1 });
    expect(progressEvents[2]).toEqual({ phase: 'tracks', done: 0, total: 2, retries: 2 });
    expect(progressEvents[3]).toEqual({ phase: 'tracks', done: 2, total: 2, retries: 2 });
    expect(progressEvents[4]).toEqual({ phase: 'albums', done: 1, total: 1, retries: 0 });
  });

  it('short-circuits when plan is null', async () => {
    await runPlan(null, vi.fn());
    expect(unfollowArtists).not.toHaveBeenCalled();
  });
});
