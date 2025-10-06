import type { Album, SpotifyAuthResult, Track } from '../types/index.js';

import { showToast } from './ui.js';

const SPOTIFY_AUTH = 'https://accounts.spotify.com';
const API_BASE = 'https://api.spotify.com/v1';
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
const TOKEN_KEY = 'tuneup_token';
const PKCE_VERIFIER_KEY = 'tuneup_pkce_verifier';
const PKCE_STATE_KEY = 'tuneup_pkce_state';
const EXPIRY_SKEW_MS = 60 * 1000;
const MUTATION_MAX_RETRY = 5;
const MUTATION_BACKOFF_BASE_MS = 1000;
const MUTATION_BATCH_LIMIT = 50;

const SCOPES = [
  'user-follow-modify',
  'user-follow-read',
  'user-library-read',
  'user-library-modify',
];

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expires: number;
};

let followingCache: CacheEntry<string[]> | null = null;
let likedTracksCache: CacheEntry<Track[]> | null = null;
let savedAlbumsCache: CacheEntry<Album[]> | null = null;

type StoredToken = {
  at: string;
  rt: string;
  exp: number;
};

type ApiHooks = {
  onRateLimit?: (retryAfterSeconds: number) => void;
  onRetry?: (attempt: number, status: number) => void;
};

type ApiRequestOptions = {
  method?: string;
  body?: BodyInit | Record<string, unknown> | null;
  headers?: HeadersInit;
  attempt?: number;
  hooks?: ApiHooks;
};

type PaginatedResponse<T> = {
  items?: T[];
  next?: string | null;
  tracks?: T[];
  artists?: {
    items: T[];
    next: string | null;
  };
};

export class SpotifyAuthError extends Error {
  constructor(
    message: string,
    public code: string = 'auth_error',
  ) {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}

let cachedToken: StoredToken | null = null;

function redirectUri(): string {
  const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  return `${location.origin}${path}`;
}

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

function randomBytes(len = 32): Uint8Array {
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  return array;
}

function randomString(len = 64): string {
  return Array.from(randomBytes(len))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len);
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(digest);
}

export async function beginAuthFlow(): Promise<void> {
  if (!CLIENT_ID) {
    showToast('Spotify Client ID is not configured.', 'error');
    throw new SpotifyAuthError('Missing Spotify Client ID', 'missing_client_id');
  }
  const verifier = randomString(96);
  const challenge = await sha256(verifier);
  const state = randomString(24);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);

  const authUrl = new URL(`${SPOTIFY_AUTH}/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri());
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', SCOPES.join(' '));

  location.assign(authUrl.toString());
}

function readStoredToken(): StoredToken | null {
  if (cachedToken) return cachedToken;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed?.at) return null;
    cachedToken = parsed;
    return parsed;
  } catch (err) {
    console.warn('Unable to read stored token', err);
    return null;
  }
}

function storeToken(next: StoredToken): void {
  cachedToken = next;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Unable to persist token', err);
  }
}

export function clearToken(): void {
  cachedToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.warn('Unable to clear token', err);
  }
}

function isTokenExpiring(token: StoredToken | null): boolean {
  if (!token) return true;
  return !token.exp || Date.now() > token.exp - EXPIRY_SKEW_MS;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    ...params,
  });
  const response = await fetch(`${SPOTIFY_AUTH}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new SpotifyAuthError(`Token request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as TokenResponse;
}

async function exchangeCodeForToken(code: string, verifier: string): Promise<StoredToken> {
  const payload = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const refreshToken = payload.refresh_token;
  if (!refreshToken) {
    throw new SpotifyAuthError('Missing refresh token from Spotify', 'missing_refresh_token');
  }
  const token: StoredToken = {
    at: payload.access_token,
    rt: refreshToken,
    exp: Date.now() + payload.expires_in * 1000,
  };
  storeToken(token);
  return token;
}

async function refreshAccessToken(refreshToken: string): Promise<StoredToken> {
  if (!refreshToken) {
    throw new SpotifyAuthError('Missing refresh token', 'missing_refresh_token');
  }
  const payload = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const token: StoredToken = {
    at: payload.access_token,
    rt: payload.refresh_token || refreshToken,
    exp: Date.now() + payload.expires_in * 1000,
  };
  storeToken(token);
  return token;
}

async function ensureAccessToken({ forceRefresh = false } = {}): Promise<string> {
  let token = readStoredToken();
  if (!token) {
    throw new SpotifyAuthError('Not authenticated', 'unauthenticated');
  }
  if (forceRefresh || isTokenExpiring(token)) {
    token = await refreshAccessToken(token.rt);
  }
  return token.at;
}

export async function getToken(): Promise<string> {
  const token = readStoredToken();
  if (!token) {
    throw new SpotifyAuthError('Not authenticated', 'unauthenticated');
  }
  if (isTokenExpiring(token)) {
    const refreshed = await refreshAccessToken(token.rt);
    return refreshed.at;
  }
  return token.at;
}

export function hasToken(): boolean {
  return Boolean(readStoredToken());
}

export async function handleAuthCallback(): Promise<SpotifyAuthResult> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) {
    return { handled: false };
  }

  const cleanUrl = () => {
    const url = new URL(location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    history.replaceState({}, '', url.toString());
  };

  if (error) {
    cleanUrl();
    showToast(`Spotify auth failed: ${error}`, 'error');
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    return { handled: true, ok: false, error };
  }

  const state = params.get('state');
  const storedState = sessionStorage.getItem(PKCE_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);

  if (!verifier || !state || state !== storedState) {
    cleanUrl();
    showToast('Invalid PKCE state, please try connecting again.', 'error');
    return { handled: true, ok: false, error: 'invalid_state' };
  }

  try {
    await exchangeCodeForToken(code!, verifier);
    cleanUrl();
    showToast('Spotify account connected. Ready to fetch your library.', 'success');
    return { handled: true, ok: true };
  } catch (err) {
    console.error('Token exchange failed', err);
    cleanUrl();
    showToast('Failed to complete Spotify authentication.', 'error');
    return { handled: true, ok: false, error: err instanceof Error ? err.message : 'error' };
  }
}

function buildApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (!path.startsWith('/')) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}

function parseRetryAfter(headerValue: string | null): number {
  const parsed = Number(headerValue ?? '1');
  return Number.isFinite(parsed) ? parsed : 1;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, attempt = 1, hooks } = options;
  const url = buildApiUrl(path);
  const accessToken = await ensureAccessToken();
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  let payload = body;
  if (
    body &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams)
  ) {
    payload = JSON.stringify(body);
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: payload as BodyInit | null | undefined,
  });

  if (response.status === 401 && attempt <= 1) {
    await ensureAccessToken({ forceRefresh: true });
    return apiRequest<T>(path, { method, body, headers, attempt: attempt + 1, hooks });
  }

  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    hooks?.onRateLimit?.(retryAfter);
    await delay((retryAfter + 0.5) * 1000);
    return apiRequest<T>(path, { method, body, headers, attempt, hooks });
  }

  if (response.status >= 500 && response.status < 600) {
    if (attempt >= MUTATION_MAX_RETRY) {
      const text = await response.text();
      throw new Error(`Spotify API ${response.status}: ${text}`);
    }
    hooks?.onRetry?.(attempt, response.status);
    await delay(MUTATION_BACKOFF_BASE_MS * attempt);
    return apiRequest<T>(path, { method, body, headers, attempt: attempt + 1, hooks });
  }

  if (response.status === 403) {
    const text = await response.text();
    if (text.includes('Insufficient client scope')) {
      throw new SpotifyAuthError('Missing required Spotify scopes.', 'insufficient_scope');
    }
    throw new SpotifyAuthError(`Spotify API 403: ${text}`, 'forbidden');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify API ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export async function apiGET<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

export async function apiDEL<T = unknown>(
  path: string,
  body?: BodyInit | Record<string, unknown>,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'DELETE', body });
}

export async function* paginate<T>(path: string): AsyncGenerator<T[], void, unknown> {
  let next: string | null | undefined = path;
  while (next) {
    const data: PaginatedResponse<T> = await apiGET<PaginatedResponse<T>>(next);
    if (!data) break;
    let items: T[] | undefined;
    if (Array.isArray(data.items)) {
      items = data.items;
      next = data.next;
    } else if (Array.isArray(data.tracks)) {
      items = data.tracks;
      next = data.next;
    } else if (data.artists && Array.isArray(data.artists.items)) {
      items = data.artists.items;
      next = data.artists.next;
    } else {
      console.warn('Unexpected pagination payload', data);
      break;
    }
    if (!items?.length) break;
    yield items;
  }
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
  const now = Date.now();
  if (!options.force && followingCache && followingCache.expires > now) {
    options.onProgress?.(followingCache.value.length);
    return [...followingCache.value];
  }
  const artistIds: string[] = [];
  let url: string | null = '/me/following?type=artist&limit=50';
  while (url) {
    const payload: FollowingArtistsResponse = await apiGET<FollowingArtistsResponse>(url);
    for (const artist of payload.artists.items) {
      if (artist?.id) {
        artistIds.push(artist.id);
      }
    }
    url = payload.artists.next;
    options.onProgress?.(artistIds.length);
  }
  followingCache = { value: [...artistIds], expires: now + CACHE_TTL_MS };
  return [...artistIds];
}

export async function meFollowingContains(ids: string[]): Promise<boolean[]> {
  if (!ids.length) return [];
  const results: boolean[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50);
    const params = new URLSearchParams({ type: 'artist', ids: slice.join(',') });
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
  const now = Date.now();
  if (!options.force && likedTracksCache && likedTracksCache.expires > now) {
    options.onProgress?.({
      loaded: likedTracksCache.value.length,
      total: likedTracksCache.value.length,
    });
    return cloneTracks(likedTracksCache.value);
  }
  const tracks: Track[] = [];
  let url: string | null = '/me/tracks?limit=50';
  while (url) {
    const payload: {
      items: Array<{
        track: {
          id: string;
          name?: string;
          artists?: Array<{ id: string | null | undefined; name?: string }>;
          album?: {
            id: string | null | undefined;
            name?: string;
            label?: string;
            release_date?: string;
          };
        };
      }>;
      next: string | null;
      total?: number;
    } = await apiGET<{
      items: Array<{
        track: {
          id: string;
          name?: string;
          artists?: Array<{ id: string | null | undefined }>;
          album?: {
            id: string | null | undefined;
            name?: string;
            label?: string;
            release_date?: string;
          };
        };
      }>;
      next: string | null;
    }>(url);

    for (const item of payload.items) {
      const track = item.track;
      if (!track?.id) continue;
      const artistRefs = (track.artists ?? [])
        .map((artist): { id: string; name?: string } | null =>
          artist?.id ? { id: artist.id, name: artist.name ?? undefined } : null,
        )
        .filter((artist): artist is { id: string; name?: string } => Boolean(artist));
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
        },
      });
    }
    url = payload.next;
    options.onProgress?.({ loaded: tracks.length, total: payload.total });
  }
  likedTracksCache = { value: cloneTracks(tracks), expires: now + CACHE_TTL_MS };
  return cloneTracks(tracks);
}
export async function meSavedAlbums(
  options: {
    force?: boolean;
    onProgress?: (stats: { loaded: number; total?: number }) => void;
  } = {},
): Promise<Album[]> {
  const now = Date.now();
  if (!options.force && savedAlbumsCache && savedAlbumsCache.expires > now) {
    options.onProgress?.({
      loaded: savedAlbumsCache.value.length,
      total: savedAlbumsCache.value.length,
    });
    return cloneAlbums(savedAlbumsCache.value);
  }
  const albums: Album[] = [];
  let url: string | null = '/me/albums?limit=20';
  while (url) {
    const payload: {
      items: Array<{
        album: {
          id: string | null | undefined;
          name?: string;
          artists?: Array<{ id: string | null | undefined; name?: string }>;
          label?: string;
          release_date?: string;
        };
      }>;
      next: string | null;
      total?: number;
    } = await apiGET<{
      items: Array<{
        album: {
          id: string | null | undefined;
          name?: string;
          artists?: Array<{ id: string | null | undefined; name?: string }>;
          label?: string;
          release_date?: string;
        };
      }>;
      next: string | null;
      total?: number;
    }>(url);

    for (const entry of payload.items) {
      const album = entry.album;
      if (!album?.id) continue;
      const artistRefs = (album.artists ?? [])
        .map((artist): { id: string; name?: string } | null =>
          artist?.id ? { id: artist.id, name: artist.name ?? undefined } : null,
        )
        .filter((artist): artist is { id: string; name?: string } => Boolean(artist));
      albums.push({
        id: album.id,
        name: album.name,
        artists: artistRefs,
        label: album.label,
        release_date: album.release_date,
      });
    }
    url = payload.next;
    options.onProgress?.({ loaded: albums.length, total: payload.total });
  }
  savedAlbumsCache = { value: cloneAlbums(albums), expires: now + CACHE_TTL_MS };
  return cloneAlbums(albums);
}

export async function albumsFull(
  ids: string[],
): Promise<Array<{ id: string; name?: string; label?: string; release_date?: string }>> {
  if (!ids.length) return [];
  const result: Array<{ id: string; name?: string; label?: string; release_date?: string }> = [];
  for (let i = 0; i < ids.length; i += 20) {
    const slice = ids.slice(i, i + 20);
    const params = new URLSearchParams({ ids: slice.join(',') });
    const payload = await apiGET<{
      albums: Array<{ id: string; name?: string; label?: string; release_date?: string }>;
    }>(`/albums?${params.toString()}`);
    payload.albums.forEach(album => {
      if (album?.id) {
        result.push(album);
      }
    });
  }
  return result;
}

export async function unfollowArtists(ids: string[], hooks?: ApiHooks): Promise<void> {
  const batches = chunk(ids, MUTATION_BATCH_LIMIT);
  for (const batch of batches) {
    await unfollowArtistsBatch(batch, hooks);
  }
}

export async function removeLikedTracks(ids: string[], hooks?: ApiHooks): Promise<void> {
  const batches = chunk(ids, MUTATION_BATCH_LIMIT);
  for (const batch of batches) {
    await removeLikedTracksBatch(batch, hooks);
  }
}

export async function removeSavedAlbums(ids: string[], hooks?: ApiHooks): Promise<void> {
  const batches = chunk(ids, MUTATION_BATCH_LIMIT);
  for (const batch of batches) {
    await removeSavedAlbumsBatch(batch, hooks);
  }
}

export async function unfollowArtistsBatch(ids: string[], hooks?: ApiHooks): Promise<void> {
  if (!ids.length) return;
  const params = new URLSearchParams({ type: 'artist', ids: ids.join(',') });
  await apiDEL(`/me/following?${params.toString()}`, undefined, { hooks });
}

export async function removeLikedTracksBatch(ids: string[], hooks?: ApiHooks): Promise<void> {
  if (!ids.length) return;
  await apiDEL('/me/tracks', { ids }, { hooks });
}

export async function removeSavedAlbumsBatch(ids: string[], hooks?: ApiHooks): Promise<void> {
  if (!ids.length) return;
  await apiDEL('/me/albums', { ids }, { hooks });
}

function chunk<T>(list: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

export function invalidateSpotifyCaches(): void {
  followingCache = null;
  likedTracksCache = null;
  savedAlbumsCache = null;
}
