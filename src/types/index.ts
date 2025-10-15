export type CacheEntry<T> = {
  value: T;
  expires: number;
};

export type ProviderId = 'nmg' | 'curated';

export type Item = {
  type: 'artist' | 'label';
  name: string;
  spotifyId?: string;
};

export type ArtistList = {
  provider: ProviderId;
  title: string;
  version: string;
  updatedAt?: string;
  sourceUrl?: string;
  items: Item[];
};

export type ResolvedArtist = {
  input: string;
  id: string;
  name: string;
  followers?: number;
  imageUrl?: string;
  isFollowing?: boolean;
};

/** A simplified artist object, as returned by some Spotify API endpoints. */
export type TrackArtist = {
  id: string;
  name?: string;
};

/** A simplified album object, as returned by some Spotify API endpoints. */
export type TrackAlbum = {
  id: string;
  name?: string;
  label?: string;
  release_date?: string;
  imageUrl?: string;
};

/** A full track object from the Spotify API. */
export type Track = {
  id: string;
  name?: string;
  artists: TrackArtist[];
  album: TrackAlbum;
};

/** A full album object from the Spotify API. */
export type Album = {
  id: string;
  name?: string;
  artists: TrackArtist[];
  label?: string;
  release_date?: string;
  imageUrl?: string;
};

/** A track object as it appears in a paginated API response. */
export type SpotifyPaginatedTrack = {
  track: {
    id: string;
    name?: string;
    artists?: Array<{ id: string | null | undefined; name?: string }>;
    album?: {
      id: string | null | undefined;
      name?: string;
      label?: string;
      release_date?: string;
      images?: Array<{ url: string }>;
    };
  };
};

/** An album object as it appears in a paginated API response. */
export type SpotifyPaginatedAlbum = {
  album: {
    id: string | null | undefined;
    name?: string;
    artists?: Array<{ id: string | null | undefined; name?: string }>;
    label?: string;
    release_date?: string;
    images?: Array<{ url: string }>;
  };
};

export type PlanEvidence = {
  kind: 'label' | 'artist';
  id: string;
  title: string;
  label?: string;
  year?: number | string;
};

export type PlanRemovalReason =
  | { type: 'artist'; id: string; name?: string }
  | { type: 'label'; label: string };

export type PlanRemoval = {
  id: string;
  name?: string;
  artistNames: string[];
  albumName?: string;
  album?: { imageUrl?: string };
  imageUrl?: string;
  reasons: PlanRemovalReason[];
};

export type PlanTrackRemoval = {
  id: string;
  name?: string;
  artistNames: string[];
  albumName?: string;
  album?: { imageUrl?: string };
  reasons: PlanRemovalReason[];
};

export type PlanAlbumRemoval = {
  id: string;
  name?: string;
  artistNames: string[];
  imageUrl?: string;
  reasons: PlanRemovalReason[];
};

export type Plan = {
  artistsToUnfollow: string[];
  trackIdsToRemove: string[];
  albumIdsToRemove: string[];
  tracksToRemove: PlanTrackRemoval[];
  albumsToRemove: PlanAlbumRemoval[];
  evidence: PlanEvidence[];
};

export type PlanOptions = {
  artistIds: string[];
  labelNames: string[];
  strictPrimary: boolean;
  includeAlbums: boolean;
};

export type ProgressPhase = 'unfollow' | 'tracks' | 'albums';

export type ProgressEvt = {
  phase: ProgressPhase;
  done: number;
  total: number;
  retries?: number;
  retryAfter?: number;
};

export type PlanProgress = {
  stage: 'following' | 'tracks' | 'albums' | 'enrich' | 'done';
  loaded?: number;
  total?: number;
};

export type PurgeState = {
  unfollowed: Record<string, { at: string; source: string }>;
  removedTracksByArtist: Record<string, { trackIds: string[]; at: string }>;
  removedAlbumsByArtist: Record<string, { albumIds: string[]; at: string }>;
  removedTracksByLabel: Record<string, { trackIds: string[]; at: string }>;
  removedAlbumsByLabel: Record<string, { albumIds: string[]; at: string }>;
  nameToId: Record<string, { id: string; verifiedAt: string }>;
  ops: Record<string, { at: string; summary: string }>;
};

export type SpotifyAuthResult = {
  handled: boolean;
  ok?: boolean;
  error?: string;
};

export type PlanTotals = {
  following: number;
  likedTracks: number;
  savedAlbums: number;
};

export type PlanContext = {
  totals: PlanTotals;
};

export type CuratedListConfig = {
  id: string;
  title: string;
  description?: string;
  kind: 'nmg' | 'json';
  url?: string;
  version?: string;
  tags?: string[];
  badge?: string;
  subtitle?: string;
};

export type ApiHooks = {
  onRateLimit?: (retryAfterSeconds: number) => void;
  onRetry?: (attempt: number, status: number) => void;
};
