// Spotify API endpoint implementations
// WHY: Keep API calls separate from the client and auth logic.

import { clearCache, getCache, setCache } from '../lib/cache.js';
import type { ApiHooks } from '../types/index.js';
import type {
  Album,
  CacheEntry,
  SpotifyPaginatedAlbum,
  SpotifyPaginatedTrack,
  Track,
  TrackArtist,
} from '../types/index.js';

import { apiDEL, apiGET, paginate, SpotifyAuthError } from './client.js';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MUTATION_BATCH_LIMIT = 50;

function cloneTracks(tracks: Track[]): Track[] {
  return tracks.map(track => ({
    ...track,
    artists: track.artists.map(artist => ({ ...artist })),
    album: { ...track.album },
  }));
}

function cloneAlbums(albums: Album[]): Album[] {
  return albums.map(album => ({
    ...album,
    artists: album.artists.map(artist => ({ ...artist })),
  }));
}

type FollowingArtistsResponse = {
  artists: {
    items: Array<{ id: string | null | undefined }>;
    next: string | null;
    total?: number;
  };
};

export async function meFollowingArtists(
  options: { force?: boolean; onProgress?: (count: number) => void } = {},
): Promise<string[]> {
  if (!options.force) {
    const now = Date.now();
    const cached = await getCache<CacheEntry<string[]>>('me:following');
    if (cached && cached.expires > now) {
      options.onProgress?.(cached.value.length);
      return [...cached.value];
    }
  }

  const artistIds: string[] = [];
  for await (const artists of paginate<FollowingArtistsResponse['artists']['items'][0]>(
    '/me/following?type=artist&limit=50',
  )) {
    for (const artist of artists) {
      if (artist?.id) {
        artistIds.push(artist.id);
      }
    }
    options.onProgress?.(artistIds.length);
  }

  await setCache('me:following', {
    value: [...artistIds],
    expires: Date.now() + CACHE_TTL_MS,
  });
  return [...artistIds];
}

export async function meFollowingContains(ids: string[]): Promise<boolean[]> {
  if (!ids.length) return [];
  const results: boolean[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50);
    const params = new URLSearchParams({ type: 'artist', ids: slice.join(',') });
    if (!CLIENT_ID) {
      throw new SpotifyAuthError('Missing Spotify Client ID', 'missing_client_id');
    }
    const payload = await apiGET<boolean[]>(`/me/following/contains?${params.toString()}`);
    results.push(...payload);
  }
  return results;
}

export async function meLikedTracks(
  options: {
    force?: boolean;
    onProgress?: (stats: { loaded: number; total?: number }) => void;
  } = {},
): Promise<Track[]> {
  if (!options.force) {
    const now = Date.now();
    const cached = await getCache<CacheEntry<Track[]>>('me:liked-tracks');
    if (cached && cached.expires > now) {
      options.onProgress?.({ loaded: cached.value.length, total: cached.value.length });
      return cloneTracks(cached.value);
    }
  }

  const tracks: Track[] = [];
  let total: number | undefined;

  for await (const items of paginate<SpotifyPaginatedTrack>('/me/tracks?limit=50')) {
    if (total === undefined) {
      // This is a bit of a hack, but total is on the top-level response, not in the paginator
      if (!CLIENT_ID) {
        throw new SpotifyAuthError('Missing Spotify Client ID', 'missing_client_id');
      }
      const firstPage: { total?: number } = await apiGET('/me/tracks?limit=1');
      total = firstPage.total;
    }

    for (const item of items) {
      const track = item.track;
      if (!track?.id) continue;
      const artistRefs: TrackArtist[] =
        (track.artists ?? [])
          .filter((artist): artist is { id: string; name?: string } => !!artist?.id)
          .map(artist => ({ id: artist.id, name: artist.name })) ?? [];
      const album = track.album;
      tracks.push({
        id: track.id,
        name: track.name,
        artists: artistRefs,
        album: {
          id: album?.id ?? track.id,
          name: album?.name,
          label: album?.label,
          release_date: album?.release_date,
          imageUrl: album?.images?.[album.images.length - 1]?.url,
        },
      });
    }
    options.onProgress?.({ loaded: tracks.length, total });
  }

  await setCache('me:liked-tracks', {
    value: cloneTracks(tracks),
    expires: Date.now() + CACHE_TTL_MS,
  });
  return cloneTracks(tracks);
}

export async function meSavedAlbums(
  options: {
    force?: boolean;
    onProgress?: (stats: { loaded: number; total?: number }) => void;
  } = {},
): Promise<Album[]> {
  if (!options.force) {
    const now = Date.now();
    const cached = await getCache<CacheEntry<Album[]>>('me:saved-albums');
    if (cached && cached.expires > now) {
      options.onProgress?.({ loaded: cached.value.length, total: cached.value.length });
      return cloneAlbums(cached.value);
    }
  }

  const albums: Album[] = [];
  let total: number | undefined;

  for await (const items of paginate<SpotifyPaginatedAlbum>('/me/albums?limit=20')) {
    if (total === undefined) {
      if (!CLIENT_ID) {
        throw new SpotifyAuthError('Missing Spotify Client ID', 'missing_client_id');
      }
      const firstPage: { total?: number } = await apiGET('/me/albums?limit=1');
      total = firstPage.total;
    }

    for (const entry of items) {
      const album = entry.album;
      if (!album?.id) continue;
      const artistRefs: TrackArtist[] =
        (album.artists ?? [])
          .filter((artist): artist is { id: string; name?: string } => !!artist?.id)
          .map(artist => ({ id: artist.id, name: artist.name })) ?? [];
      albums.push({
        id: album.id,
        name: album.name,
        artists: artistRefs,
        label: album.label,
        release_date: album.release_date,
        imageUrl: album.images?.[album.images.length - 1]?.url,
      });
    }
    options.onProgress?.({ loaded: albums.length, total });
  }

  await setCache('me:saved-albums', {
    value: cloneAlbums(albums),
    expires: Date.now() + CACHE_TTL_MS,
  });
  return cloneAlbums(albums);
}

export async function albumsFull(
  ids: string[],
  options: { force?: boolean } = {},
): Promise<Album[]> {
  const result: Album[] = [];
  const idsToFetch: string[] = [];

  if (options.force) {
    idsToFetch.push(...ids);
  } else {
    const now = Date.now();
    for (const id of ids) {
      const cached = await getCache<CacheEntry<Album>>(`album:${id}`);
      if (cached && cached.expires > now) {
        result.push(cached.value);
      } else {
        idsToFetch.push(id);
      }
    }
  }

  if (!idsToFetch.length) return result;

  for (let i = 0; i < idsToFetch.length; i += 20) {
    const slice = idsToFetch.slice(i, i + 20);
    const params = new URLSearchParams({ ids: slice.join(',') });
    const payload = await apiGET<{ albums: Album[] }>(`/albums?${params.toString()}`);
    for (const album of payload.albums) {
      if (album?.id) {
        result.push(album);
        void setCache(`album:${album.id}`, {
          value: album,
          expires: Date.now() + CACHE_TTL_MS,
        });
      }
    }
  }
  return result;
}

export async function artistsFull(
  ids: string[],
  options: { force?: boolean } = {},
): Promise<
  Array<{ id: string; name: string; followers: { total: number }; images: Array<{ url: string }> }>
> {
  if (!ids.length) return [];
  const result: Array<{
    id: string;
    name: string;
    followers: { total: number };
    images: Array<{ url: string }>;
  }> = [];
  const idsToFetch: string[] = [];

  if (options.force) {
    idsToFetch.push(...ids);
  } else {
    const now = Date.now();
    for (const id of ids) {
      const cached = await getCache<CacheEntry<(typeof result)[0]>>(`artist:${id}`);
      if (cached && cached.expires > now) {
        result.push(cached.value);
      } else {
        idsToFetch.push(id);
      }
    }
  }

  if (!idsToFetch.length) return result;

  for (let i = 0; i < idsToFetch.length; i += 50) {
    const slice = idsToFetch.slice(i, i + 50);
    const params = new URLSearchParams({ ids: slice.join(',') });
    const payload = await apiGET<{ artists: typeof result }>(`/artists?${params.toString()}`);
    for (const artist of payload.artists) {
      result.push(artist);
      void setCache(`artist:${artist.id}`, {
        value: artist,
        expires: Date.now() + CACHE_TTL_MS,
      });
    }
  }
  return result;
}

function chunk<T>(list: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

export async function unfollowArtists(ids: string[], hooks?: ApiHooks): Promise<void> {
  for (const batch of chunk(ids, MUTATION_BATCH_LIMIT)) {
    if (!batch.length) continue;
    const params = new URLSearchParams({ type: 'artist', ids: batch.join(',') });
    await apiDEL(`/me/following?${params.toString()}`, undefined, { hooks });
  }
}

export async function removeLikedTracks(ids: string[], hooks?: ApiHooks): Promise<void> {
  for (const batch of chunk(ids, MUTATION_BATCH_LIMIT)) {
    if (!batch.length) continue;
    await apiDEL('/me/tracks', { ids }, { hooks });
  }
}

export async function removeSavedAlbums(ids: string[], hooks?: ApiHooks): Promise<void> {
  for (const batch of chunk(ids, MUTATION_BATCH_LIMIT)) {
    if (!batch.length) continue;
    await apiDEL('/me/albums', { ids }, { hooks });
  }
}

export function invalidateSpotifyCaches(): void {
  void clearCache();
}
