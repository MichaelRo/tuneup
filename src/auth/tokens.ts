// Token storage and refresh logic for Spotify OAuth
// WHY: Centralized token management with proper expiry handling

import { checkStorageAvailability } from '../lib/storage';
import { SpotifyAuthError } from '../spotify/client';
const TOKEN_KEY = 'tuneup_token';
const EXPIRY_SKEW_MS = 60 * 1000; // Refresh 60s before expiry

export type StoredToken = {
  at: string; // access token
  rt: string; // refresh token
  exp: number; // expiry timestamp
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

let cachedToken: StoredToken | null = null;

export function readStoredToken(): StoredToken | null {
  if (cachedToken) return cachedToken;
  if (!checkStorageAvailability()) return null;
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

export function storeToken(token: StoredToken): void {
  cachedToken = token;
  if (!checkStorageAvailability()) return;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  } catch (err) {
    console.warn('Unable to persist token', err);
  }
}

export function clearToken(): void {
  cachedToken = null;
  if (!checkStorageAvailability()) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.warn('Unable to clear token', err);
  }
}

export function isTokenExpiring(token: StoredToken | null): boolean {
  if (!token) return true;
  return !token.exp || Date.now() > token.exp - EXPIRY_SKEW_MS;
}

export function hasToken(): boolean {
  return Boolean(readStoredToken());
}

export async function requestToken(
  clientId: string,
  params: Record<string, string>,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    ...params,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 400 && text.includes('invalid_grant')) {
      throw new SpotifyAuthError('Refresh token is invalid or revoked.', 'invalid_grant');
    }
    throw new SpotifyAuthError(
      `Token request failed (${response.status}): ${text}`,
      `token_request_failed_${response.status}`,
    );
  }

  return (await response.json()) as TokenResponse;
}

export async function exchangeCodeForToken(
  clientId: string,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<StoredToken> {
  const payload = await requestToken(clientId, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
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

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
): Promise<StoredToken> {
  if (!refreshToken) {
    throw new SpotifyAuthError('Missing refresh token', 'missing_refresh_token');
  }

  const payload = await requestToken(clientId, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const token: StoredToken = {
    at: payload.access_token,
    rt: payload.refresh_token || refreshToken, // Keep existing if not provided
    exp: Date.now() + payload.expires_in * 1000,
  };

  storeToken(token);
  return token;
}

export async function ensureAccessToken(
  clientId: string,
  { forceRefresh = false } = {},
): Promise<string> {
  let token = readStoredToken();
  if (!token) {
    throw new SpotifyAuthError('Not authenticated', 'unauthenticated');
  }

  if (forceRefresh || isTokenExpiring(token)) {
    token = await refreshAccessToken(clientId, token.rt);
  }

  return token.at;
}
