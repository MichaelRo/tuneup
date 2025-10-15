// Main auth module combining PKCE and token management
// WHY: Single entry point for all authentication functionality

import { SpotifyAuthError } from '../spotify/client.js';
import type { SpotifyAuthResult } from '../types/index.js';
import { showToast } from '../ui/toast.js';

import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce.js';
import {
  exchangeCodeForToken,
  refreshAccessToken,
  clearToken,
  hasToken,
  readStoredToken,
  isTokenExpiring,
} from './tokens.js';

const SPOTIFY_AUTH = 'https://accounts.spotify.com';
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';
const PKCE_VERIFIER_KEY = 'tuneup_pkce_verifier';
const PKCE_STATE_KEY = 'tuneup_pkce_state';

const SCOPES = [
  'user-follow-modify',
  'user-follow-read',
  'user-library-read',
  'user-library-modify',
];

function redirectUri(): string {
  const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  return `${location.origin}${path}`;
}

export async function beginAuthFlow(): Promise<void> {
  if (!CLIENT_ID) {
    showToast('Spotify Client ID is not configured.', 'error');
    throw new SpotifyAuthError('Missing Spotify Client ID', 'missing_client_id');
  }
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();
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
    await exchangeCodeForToken(CLIENT_ID, code!, verifier, redirectUri());
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

export async function getToken(): Promise<string> {
  const token = readStoredToken();
  if (!token) {
    throw new SpotifyAuthError('Not authenticated', 'unauthenticated');
  }
  if (isTokenExpiring(token)) {
    const refreshed = await refreshAccessToken(CLIENT_ID, token.rt);
    return refreshed.at;
  }
  return token.at;
}

// Re-export functions from tokens module
export { clearToken, hasToken };
