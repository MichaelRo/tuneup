/// <reference types="vite/client" />

// Declare all Vite environment variables here for type safety.

declare interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
