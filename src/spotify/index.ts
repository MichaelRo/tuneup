// Main Spotify module combining client and API
// WHY: Single entry point for all Spotify functionality

// Re-export everything from API module
export * from './api.js';

// Re-export auth functions
export {
  beginAuthFlow,
  handleAuthCallback,
  getToken,
  clearToken,
  hasToken,
} from '../auth/index.js';

// Re-export error classes
export { SpotifyRateLimitError, SpotifyAuthError } from './client.js';
