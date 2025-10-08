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

export type TrackArtist = {
  id: string;
  name?: string;
};

export type TrackAlbum = {
  id: string;
  name?: string;
  label?: string;
  release_date?: string;
};

export type Track = {
  id: string;
  name?: string;
  artists: TrackArtist[];
  album: TrackAlbum;
};

export type Album = {
  id: string;
  name?: string;
  artists: TrackArtist[];
  label?: string;
  release_date?: string;
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

export type PlanTrackRemoval = {
  id: string;
  name?: string;
  artistNames: string[];
  albumName?: string;
  reasons: PlanRemovalReason[];
};

export type PlanAlbumRemoval = {
  id: string;
  name?: string;
  artistNames: string[];
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
