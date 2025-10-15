import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPlan } from '../lib/planner';
import type { Album, PlanOptions, Track } from '../types';

// Mock the spotify module
vi.mock('../spotify/api.js', () => ({
  meFollowingArtists: vi.fn(),
  meLikedTracks: vi.fn(),
  meSavedAlbums: vi.fn(),
  albumsFull: vi.fn(),
}));

const spotify = await import('../spotify/api.js');
const meFollowingArtists = vi.mocked(spotify.meFollowingArtists);
const meLikedTracks = vi.mocked(spotify.meLikedTracks);
const meSavedAlbums = vi.mocked(spotify.meSavedAlbums);
const albumsFull = vi.mocked(spotify.albumsFull);

const MOCK_ARTIST_1 = 'artist-1-id'; // Banned
const MOCK_ARTIST_2 = 'artist-2-id'; // Safe

const MOCK_LIKED_TRACKS: Track[] = [
  {
    id: 'track-1',
    name: 'Banned Track 1',
    artists: [{ id: MOCK_ARTIST_1, name: 'Banned Artist' }],
    album: { id: 'album-1', name: 'Banned Album' },
  },
  {
    id: 'track-2',
    name: 'Safe Track 1',
    artists: [{ id: MOCK_ARTIST_2, name: 'Safe Artist' }],
    album: { id: 'album-2', name: 'Safe Album' },
  },
  {
    id: 'track-3',
    name: 'Banned Label Track',
    artists: [{ id: MOCK_ARTIST_2, name: 'Safe Artist' }],
    album: { id: 'album-3', name: 'Label Album', label: 'Banned Label' },
  },
];

const MOCK_SAVED_ALBUMS: Album[] = [
  {
    id: 'album-1',
    name: 'Banned Album',
    artists: [{ id: MOCK_ARTIST_1, name: 'Banned Artist' }],
  },
  {
    id: 'album-4',
    name: 'Banned Label Album',
    artists: [{ id: MOCK_ARTIST_2, name: 'Safe Artist' }],
    label: 'Banned Label',
  },
];

describe('buildPlan', () => {
  beforeEach(() => {
    // Mock API responses
    meFollowingArtists.mockResolvedValue([MOCK_ARTIST_1, MOCK_ARTIST_2]);
    meLikedTracks.mockResolvedValue(MOCK_LIKED_TRACKS);
    meSavedAlbums.mockResolvedValue(MOCK_SAVED_ALBUMS);
    albumsFull.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should plan to unfollow banned artists', async () => {
    const options: PlanOptions = {
      artistIds: [MOCK_ARTIST_1],
      labelNames: [],
      strictPrimary: false,
      includeAlbums: false,
    };

    const plan = await buildPlan(options);

    expect(plan.artistsToUnfollow).toEqual([MOCK_ARTIST_1]);
  });

  it('should plan to remove tracks from banned artists', async () => {
    const options: PlanOptions = {
      artistIds: [MOCK_ARTIST_1],
      labelNames: [],
      strictPrimary: false,
      includeAlbums: false,
    };

    const plan = await buildPlan(options);

    expect(plan.trackIdsToRemove).toContain('track-1');
    expect(plan.trackIdsToRemove).not.toContain('track-2');
    expect(plan.tracksToRemove[0]?.reasons).toEqual([
      { type: 'artist', id: MOCK_ARTIST_1, name: 'Banned Artist' },
    ]);
  });

  it('should plan to remove albums from banned artists when enabled', async () => {
    const options: PlanOptions = {
      artistIds: [MOCK_ARTIST_1],
      labelNames: [],
      strictPrimary: false,
      includeAlbums: true,
    };

    const plan = await buildPlan(options);

    expect(plan.albumIdsToRemove).toContain('album-1');
    expect(plan.albumsToRemove[0]?.reasons).toEqual([
      { type: 'artist', id: MOCK_ARTIST_1, name: 'Banned Artist' },
    ]);
  });

  it('should not remove albums from banned artists when disabled', async () => {
    const options: PlanOptions = {
      artistIds: [MOCK_ARTIST_1],
      labelNames: [],
      strictPrimary: false,
      includeAlbums: false,
    };

    const plan = await buildPlan(options);

    expect(plan.albumIdsToRemove).toHaveLength(0);
  });

  it('should plan to remove content based on banned labels', async () => {
    const options: PlanOptions = {
      artistIds: [],
      labelNames: ['Banned Label'],
      strictPrimary: false,
      includeAlbums: true,
    };

    const plan = await buildPlan(options);

    // Track from an album with a banned label
    expect(plan.trackIdsToRemove).toContain('track-3');
    const trackReason = plan.tracksToRemove.find(t => t.id === 'track-3')?.reasons;
    expect(trackReason).toEqual([{ type: 'label', label: 'Banned Label' }]);

    // Album with a banned label
    expect(plan.albumIdsToRemove).toContain('album-4');
    const albumReason = plan.albumsToRemove.find(a => a.id === 'album-4')?.reasons;
    expect(albumReason).toEqual([{ type: 'label', label: 'Banned Label' }]);
  });

  it('should call the onProgress callback at each stage', async () => {
    const onProgress = vi.fn();
    const options: PlanOptions = {
      artistIds: [MOCK_ARTIST_1],
      labelNames: [],
      strictPrimary: false,
      includeAlbums: true,
    };

    await buildPlan(options, { onProgress });

    expect(onProgress).toHaveBeenCalledWith({ stage: 'following' });
    expect(onProgress).toHaveBeenCalledWith({ stage: 'tracks', loaded: 0, total: 0 });
    expect(onProgress).toHaveBeenCalledWith({ stage: 'albums', loaded: 0, total: 0 });
    expect(onProgress).toHaveBeenCalledWith({ stage: 'done' });
  });
});
