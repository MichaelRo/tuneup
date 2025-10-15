// PKCE utilities for Spotify OAuth flow
// WHY: Centralized PKCE logic for better testability and reusability

function randomBytes(len = 32): Uint8Array {
  const array = new Uint8Array(len);
  crypto.getRandomValues(array);
  return array;
}

export function randomString(len = 64): string {
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

export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(digest);
}

export function generateCodeVerifier(): string {
  return randomString(96);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  return sha256(verifier);
}

export function generateState(): string {
  return randomString(24);
}
