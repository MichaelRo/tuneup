// Spotify API client with 401 refresh and 429 backoff
// WHY: Centralized API client with proper error handling and retry logic

import { state } from '../app/state.js';
import { clearToken, ensureAccessToken } from '../auth/tokens.js';
import { t } from '../lib/i18n.js';
import type { ApiHooks } from '../types/index.js';
import type { PaginatedResponse } from '../types/spotify.js';
import { showToast } from '../ui/index.js';

const API_BASE = 'https://api.spotify.com/v1';
const MUTATION_MAX_RETRY = 5;
const MUTATION_BACKOFF_BASE_MS = 1000;
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

export class SpotifyRateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(`Spotify API rate limit exceeded. Retry after ${retryAfter} seconds.`);
    this.name = 'SpotifyRateLimitError';
  }
}

export class SpotifyAuthError extends Error {
  isSpotifyAuthError = true;
  constructor(
    message: string,
    public code: string = 'auth_error',
  ) {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}

let rateLimitUntil = 0;
let isRateLimited = false;

export type ApiRequestOptions = {
  method?: string;
  body?: BodyInit | Record<string, unknown> | null;
  headers?: HeadersInit;
  attempt?: number;
  hooks?: ApiHooks;
};

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
  if (headerValue) {
    const parsed = Number(headerValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, 3600); // Cap at 1 hour
    }
  }
  return 2;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers } = options;
  const url = buildApiUrl(path);
  if (!CLIENT_ID) {
    throw new SpotifyAuthError('Missing Spotify Client ID', 'missing_client_id');
  }
  const accessToken = await ensureAccessToken(CLIENT_ID);
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

  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    rateLimitUntil = Date.now() + (retryAfter + 0.5) * 1000;
    throw new SpotifyRateLimitError(retryAfter);
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
    const responseText = await response.text();
    return JSON.parse(responseText) as T;
  }
  return (await response.text()) as T;
}

export async function spotifyFetch<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers, attempt = 1, hooks } = options;

  try {
    const now = Date.now();
    if (now < rateLimitUntil) {
      if (!isRateLimited) {
        const remaining = Math.ceil((rateLimitUntil - now) / 1000);
        if (state.options.showRateLimitBanner) {
          showToast(t('apply_status_wait', { seconds: remaining }), 'warning');
        }
        isRateLimited = true;
      }
      await delay(rateLimitUntil - now);
      isRateLimited = false;
    }
    return await apiRequest<T>(path, { method, body, headers });
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      hooks?.onRateLimit?.(err.retryAfter);
      return spotifyFetch<T>(path, { ...options, attempt: attempt + 1 }); // Retry the request
    }

    if (err instanceof SpotifyAuthError && err.code === 'invalid_grant') {
      showToast(t('error_session_expired'), 'error');
      clearToken();
      // Give the toast a moment to be seen before reloading.
      setTimeout(() => location.reload(), 1500);
    }

    // Handle 401 Unauthorized by refreshing token and retrying ONCE.
    if (err instanceof Error && err.message.includes('401') && attempt <= 1) {
      if (!CLIENT_ID) {
        throw new SpotifyAuthError('Missing Spotify Client ID', 'missing_client_id');
      }
      await ensureAccessToken(CLIENT_ID, { forceRefresh: true });
      return spotifyFetch<T>(path, { ...options, attempt: attempt + 1 });
    }

    // Handle 5xx server errors with exponential backoff.
    if (err instanceof Error && /5\d\d/.test(err.message)) {
      if (attempt >= MUTATION_MAX_RETRY) {
        throw err; // Max retries reached
      }
      hooks?.onRetry?.(attempt, 500); // Assuming 500 for simplicity
      await delay(MUTATION_BACKOFF_BASE_MS * attempt);
      return spotifyFetch<T>(path, { ...options, attempt: attempt + 1 });
    }

    // Re-throw other errors
    throw err;
  }
}

export async function apiGET<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return spotifyFetch<T>(path, { ...options, method: 'GET' });
}

export async function apiDEL<T = unknown>(
  path: string,
  body?: BodyInit | Record<string, unknown>,
  options: ApiRequestOptions = {},
): Promise<T> {
  return spotifyFetch<T>(path, { ...options, method: 'DELETE', body });
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
    } else if ('tracks' in data && data.tracks && Array.isArray(data.tracks.items)) {
      items = data.tracks.items;
      next = data.tracks.next;
    } else if ('artists' in data && data.artists && Array.isArray(data.artists.items)) {
      items = data.artists.items;
      next = data.artists.next;
    } else {
      break;
    }
    if (!items?.length) break;
    yield items;
  }
}