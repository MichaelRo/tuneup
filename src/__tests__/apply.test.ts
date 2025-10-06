import { describe, expect, it, vi } from 'vitest';

import { runPlan } from '../lib/apply.js';
import type { Plan } from '../types/index.js';

vi.mock('../lib/spotify.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/spotify.js')>('../lib/spotify.js');
  return {
    ...actual,
    removeLikedTracksBatch: vi.fn(),
    removeSavedAlbumsBatch: vi.fn(),
    unfollowArtistsBatch: vi.fn(),
  };
});

const spotify = await import('../lib/spotify.js');
const unfollowArtistsBatch = vi.mocked(spotify.unfollowArtistsBatch);
const removeLikedTracksBatch = vi.mocked(spotify.removeLikedTracksBatch);
const removeSavedAlbumsBatch = vi.mocked(spotify.removeSavedAlbumsBatch);

describe('runPlan', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('processes phases sequentially and reports progress events', async () => {
    const progressEvents: Array<Record<string, unknown>> = [];

    unfollowArtistsBatch.mockImplementation(async (_ids, hooks) => {
      void _ids;
      hooks?.onRateLimit?.(12);
    });
    removeLikedTracksBatch.mockImplementation(async (_ids, hooks) => {
      void _ids;
      hooks?.onRetry?.(2, 429);
    });
    removeSavedAlbumsBatch.mockImplementation(async (_ids, _hooks) => {
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

    expect(unfollowArtistsBatch).toHaveBeenCalledWith(['a1', 'a2', 'a3'], expect.any(Object));
    expect(removeLikedTracksBatch).toHaveBeenCalledWith(['t1', 't2'], expect.any(Object));
    expect(removeSavedAlbumsBatch).toHaveBeenCalledWith(['al1'], expect.any(Object));

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
    expect(unfollowArtistsBatch).not.toHaveBeenCalled();
  });
});
