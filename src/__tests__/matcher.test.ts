import { describe, expect, it } from 'vitest';

import {
  normalizeLabel,
  pickAlbumsByArtists,
  pickAlbumsByLabels,
  pickTracksByArtists,
  pickTracksByLabels,
} from '../lib/matcher.js';
import type { Album, Track } from '../types/index.js';

describe('matcher utilities', () => {
  it('normalizes label names consistently', () => {
    expect(normalizeLabel('Interscope Records')).toBe('interscope');
    expect(normalizeLabel('INterscope™   MUSIC')).toBe('interscope');
    expect(normalizeLabel('שלום')).toBe('');
  });

  it('selects tracks by banned artists', () => {
    const tracks: Track[] = [
      {
        id: 'track-1',
        name: 'Song',
        artists: [{ id: 'artist-a' }, { id: 'artist-b' }],
        album: { id: 'album-1' },
      },
      {
        id: 'track-2',
        name: 'Another',
        artists: [{ id: 'artist-c' }],
        album: { id: 'album-2' },
      },
    ];
    const banned = new Set(['artist-b']);
    expect(pickTracksByArtists(tracks, banned, false)).toEqual(['track-1']);
    expect(pickTracksByArtists(tracks, banned, true)).toEqual([]);
  });

  it('selects albums by banned artists', () => {
    const albums: Album[] = [
      {
        id: 'album-1',
        name: 'Album 1',
        artists: [{ id: 'artist-a' }],
      },
      {
        id: 'album-2',
        name: 'Album 2',
        artists: [{ id: 'artist-b' }],
      },
    ];
    const banned = new Set(['artist-b']);
    expect(pickAlbumsByArtists(albums, banned)).toEqual(['album-2']);
  });

  it('selects tracks and albums by label', () => {
    const tracks: Track[] = [
      {
        id: 'track-1',
        name: 'Song',
        artists: [],
        album: { id: 'album-1', label: 'Label Music', release_date: '2020-01-01' },
      },
    ];
    const albums: Album[] = [
      {
        id: 'album-1',
        name: 'Album',
        artists: [],
        label: 'Label Music',
        release_date: '2020-01-01',
      },
    ];
    const bannedLabels = new Set([normalizeLabel('Label Music Inc.')]);
    const trackMatches = pickTracksByLabels(tracks, bannedLabels);
    expect(trackMatches).toHaveLength(1);
    expect(trackMatches[0]).toMatchObject({ trackId: 'track-1', label: 'Label Music' });

    const albumMatches = pickAlbumsByLabels(albums, bannedLabels);
    expect(albumMatches).toHaveLength(1);
    expect(albumMatches[0]).toMatchObject({ albumId: 'album-1', label: 'Label Music' });
  });
});
