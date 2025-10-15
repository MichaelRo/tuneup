// Spotify API response types
// WHY: Centralized type definitions for Spotify API responses

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

export type PaginatedResponse<T> = {
  items?: T[];
  next?: string | null;
  tracks?: T[];
  artists?: {
    items: T[];
    next: string | null;
  };
};

export type FollowingArtistsResponse = {
  artists: {
    items: Array<{ id: string | null | undefined }>;
    next: string | null;
    total?: number;
  };
};

export type Artist = {
  external_urls: {
    spotify: string;
  };
  followers: {
    href: string | null;
    total: number;
  };
  genres: string[];
  href: string;
  id: string;
  images: {
    url: string;
    height: number;
    width: number;
  }[];
  name: string;
  popularity: number;
  type: string;
  uri: string;
};