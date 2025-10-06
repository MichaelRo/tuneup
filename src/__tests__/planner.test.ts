import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPlan, getLastFollowingSnapshot, getLastPlanContext } from '../lib/planner.js';
import type { Album, Track } from '../types/index.js';

vi.mock('../lib/spotify.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/spotify.js')>('../lib/spotify.js');
  return {
    ...actual,
    albumsFull: vi.fn(),
    meFollowingArtists: vi.fn(),
    meLikedTracks: vi.fn(),
    meSavedAlbums: vi.fn(),
  };
});

const spotify = await import('../lib/spotify.js');
const albumsFull = vi.mocked(spotify.albumsFull);
const meFollowingArtists = vi.mocked(spotify.meFollowingArtists);
const meLikedTracks = vi.mocked(spotify.meLikedTracks);
const meSavedAlbums = vi.mocked(spotify.meSavedAlbums);

describe('buildPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-08-10T12:00:00.000Z'));

    meFollowingArtists.mockImplementation(async ({ onProgress } = {}) => {
      onProgress?.(2);
      return ['artist-bad', 'artist-ok'];
    });

    const likedTracks: Track[] = [
      {
        id: 'track-artist',
        name: 'Song By Banned Artist',
        artists: [
          { id: 'artist-bad', name: 'Banned Artist' },
          { id: 'artist-ok', name: 'Friendly Artist' },
        ],
        album: { id: 'album-artist', name: 'Missing Label Album' },
      },
      {
        id: 'track-label',
        name: 'Song By Label',
        artists: [{ id: 'artist-ok', name: 'Friendly Artist' }],
        album: {
          id: 'album-label',
          name: 'Label Album',
          label: 'Force Records',
          release_date: '2018-04-01',
        },
      },
    ];

    meLikedTracks.mockImplementation(async ({ onProgress } = {}) => {
      onProgress?.({ loaded: likedTracks.length, total: likedTracks.length });
      return likedTracks;
    });

    const savedAlbums: Album[] = [
      {
        id: 'album-artist',
        name: 'Missing Label Album',
        artists: [{ id: 'artist-bad', name: 'Banned Artist' }],
      },
      {
        id: 'album-label',
        name: 'Label Album',
        artists: [{ id: 'artist-ok', name: 'Friendly Artist' }],
        label: 'Force Records',
        release_date: '2018-04-01',
      },
    ];

    meSavedAlbums.mockImplementation(async ({ onProgress } = {}) => {
      onProgress?.({ loaded: savedAlbums.length, total: savedAlbums.length });
      return savedAlbums;
    });

    albumsFull.mockImplementation(async ids =>
      ids.map(id => ({
        id,
        name: `Enriched ${id}`,
        label: 'Enriched Label',
        release_date: '2017-01-01',
        artists: [],
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('hydrates plan with artist and label reasons while emitting staged progress', async () => {
    const events: string[] = [];
    const plan = await buildPlan(
      {
        artistIds: ['artist-bad'],
        labelNames: ['Force Records'],
        strictPrimary: false,
        includeAlbums: true,
      },
      {
        onProgress: evt => {
          events.push(evt.stage);
        },
      },
    );

    expect(plan.artistsToUnfollow).toEqual(['artist-bad']);
    expect(plan.trackIdsToRemove).toEqual(['track-artist', 'track-label']);
    expect(plan.albumIdsToRemove).toEqual(['album-artist', 'album-label']);

    const trackReasons =
      plan.tracksToRemove.find(track => track.id === 'track-artist')?.reasons ?? [];
    expect(trackReasons).toEqual([{ type: 'artist', id: 'artist-bad', name: 'Banned Artist' }]);

    const labelReasons =
      plan.tracksToRemove.find(track => track.id === 'track-label')?.reasons ?? [];
    expect(labelReasons).toContainEqual({ type: 'label', label: 'Force Records' });

    const evidenceKinds = new Set(plan.evidence.map(item => item.kind));
    expect(evidenceKinds).toEqual(new Set(['artist', 'label']));

    expect(albumsFull).toHaveBeenCalledWith(['album-artist']);

    expect(events).toEqual([
      'following',
      'following',
      'following',
      'tracks',
      'tracks',
      'albums',
      'albums',
      'enrich',
      'enrich',
      'done',
    ]);

    expect(getLastPlanContext().totals).toEqual({ following: 2, likedTracks: 2, savedAlbums: 2 });
    expect(getLastFollowingSnapshot()).toEqual(['artist-bad', 'artist-ok']);
    const snapshot = getLastFollowingSnapshot();
    snapshot.push('new-artist');
    expect(getLastFollowingSnapshot()).toEqual(['artist-bad', 'artist-ok']);
  });

  it('skips album loading when includeAlbums is false', async () => {
    await buildPlan(
      {
        artistIds: ['artist-bad'],
        labelNames: [],
        strictPrimary: false,
        includeAlbums: false,
      },
      {
        onProgress: () => {
          /* no-op */
        },
      },
    );

    expect(meSavedAlbums).not.toHaveBeenCalled();
    expect(albumsFull).not.toHaveBeenCalled();
  });
});
