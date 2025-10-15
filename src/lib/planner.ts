import { albumsFull, meFollowingArtists, meLikedTracks, meSavedAlbums } from '../spotify/api.js';
import type {
  Album,
  Plan,
  PlanContext,
  PlanOptions,
  PlanProgress,
  PlanRemoval,
  PlanRemovalReason,
  Track,
} from '../types/index.js';

import {
  normalizeLabel,
  pickAlbumsByArtists,
  pickAlbumsByLabels,
  pickTracksByArtists,
  pickTracksByLabels,
} from './matcher.js';

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toIdSet(ids: string[]): Set<string> {
  return new Set(ids.filter(Boolean));
}

async function enrichAlbumMetadata(
  likedTracks: Track[],
  savedAlbums: Album[],
  bannedLabelsSet: Set<string>,
): Promise<void> {
  if (!bannedLabelsSet.size) return;
  const albumIdsToEnrich = new Set<string>();
  likedTracks.forEach(track => {
    if (!track.album?.id) return;
    if (!track.album.label) albumIdsToEnrich.add(track.album.id);
  });
  savedAlbums.forEach(album => {
    if (!album.id) return;
    if (!album.label) albumIdsToEnrich.add(album.id);
  });
  if (!albumIdsToEnrich.size) return;

  const details = await albumsFull(Array.from(albumIdsToEnrich));
  const byId = new Map(details.map((album: Album) => [album.id, album] as const));

  likedTracks.forEach(track => {
    if (!track.album?.id) return;
    const full = byId.get(track.album.id);
    if (full) {
      track.album.label = track.album.label ?? full.label;
      track.album.release_date = track.album.release_date ?? full.release_date;
      track.album.imageUrl = track.album.imageUrl ?? full.imageUrl;
      track.album.name = track.album.name ?? full.name;
    }
  });

  savedAlbums.forEach(album => {
    const full = byId.get(album.id);
    if (full) {
      album.label = album.label ?? full.label;
      album.release_date = album.release_date ?? full.release_date;
      album.imageUrl = album.imageUrl ?? full.imageUrl;
      album.name = album.name ?? full.name;
    }
  });
}

let lastContext: PlanContext = {
  totals: {
    following: 0,
    likedTracks: 0,
    savedAlbums: 0,
  },
};

let lastFollowing: string[] = [];

type PlanEvidence = Plan['evidence'][number];

function buildEvidence(
  likedTracks: Track[],
  savedAlbums: Album[],
  trackIdsFromArtists: string[],
  albumIdsFromArtists: string[],
  trackMatchesByLabel: Array<{
    trackId: string;
    albumId?: string;
    label: string;
    title?: string;
    year?: number;
  }>,
  albumMatchesByLabel: Array<{
    albumId: string;
    label: string;
    title?: string;
    year?: number;
  }>,
  bannedArtistIds: Set<string>,
): PlanEvidence[] {
  const evidence: PlanEvidence[] = [];
  const trackArtistSet = new Set(trackIdsFromArtists);
  const albumArtistSet = new Set(albumIdsFromArtists);

  likedTracks.forEach(track => {
    if (!trackArtistSet.has(track.id)) return;
    const offender = track.artists.find(artist => bannedArtistIds.has(artist.id));
    evidence.push({
      kind: 'artist',
      id: offender?.id ?? 'artist',
      title: track.name ?? track.id,
    });
  });

  savedAlbums.forEach(album => {
    if (!albumArtistSet.has(album.id)) return;
    const offender = album.artists.find(artist => bannedArtistIds.has(artist.id));
    evidence.push({
      kind: 'artist',
      id: offender?.id ?? 'artist',
      title: album.name ?? album.id,
      year: album.release_date ? album.release_date.slice(0, 4) : undefined,
    });
  });

  trackMatchesByLabel.forEach(match => {
    evidence.push({
      kind: 'label',
      id: normalizeLabel(match.label),
      title: match.title ?? match.trackId,
      label: match.label,
      year: match.year,
    });
  });

  albumMatchesByLabel.forEach(match => {
    evidence.push({
      kind: 'label',
      id: normalizeLabel(match.label),
      title: match.title ?? match.albumId,
      label: match.label,
      year: match.year,
    });
  });

  return evidence;
}

type PlanBuildCallbacks = {
  onProgress?: (event: PlanProgress) => void;
};

export async function buildPlan(
  options: PlanOptions,
  callbacks: PlanBuildCallbacks = {},
): Promise<Plan> {
  const bannedArtistIds = toIdSet(options.artistIds);
  const bannedLabels = new Set(
    options.labelNames.map(name => normalizeLabel(name)).filter(Boolean),
  );
  const strictPrimary = Boolean(options.strictPrimary);
  const includeAlbums = Boolean(options.includeAlbums);

  callbacks.onProgress?.({ stage: 'following' });
  const following = await meFollowingArtists({
    onProgress: (count: number) =>
      callbacks.onProgress?.({ stage: 'following', loaded: count, total: undefined }),
  });
  callbacks.onProgress?.({ stage: 'following', loaded: following.length, total: following.length });

  if (!bannedArtistIds.size && !bannedLabels.size) {
    callbacks.onProgress?.({ stage: 'done' });
    lastContext = {
      totals: {
        following: following.length,
        likedTracks: 0,
        savedAlbums: 0,
      },
    };
    return {
      artistsToUnfollow: following.filter((id: string) => bannedArtistIds.has(id)),
      trackIdsToRemove: [],
      albumIdsToRemove: [],
      tracksToRemove: [],
      albumsToRemove: [],
      evidence: [],
    };
  }

  let likedTracks: Track[] = [];
  callbacks.onProgress?.({ stage: 'tracks', loaded: 0, total: 0 });
  likedTracks = await meLikedTracks({
    onProgress: ({ loaded, total }: { loaded: number; total?: number }) =>
      callbacks.onProgress?.({ stage: 'tracks', loaded, total }),
  });

  let savedAlbums: Album[] = [];
  if (includeAlbums || bannedLabels.size) {
    callbacks.onProgress?.({ stage: 'albums', loaded: 0, total: 0 });
    savedAlbums = await meSavedAlbums({
      onProgress: ({ loaded, total }: { loaded: number; total?: number }) =>
        callbacks.onProgress?.({ stage: 'albums', loaded, total }),
    });
  }

  lastFollowing = [...following];

  lastContext = {
    totals: {
      following: following.length,
      likedTracks: likedTracks.length,
      savedAlbums: savedAlbums.length,
    },
  };

  if (bannedLabels.size) {
    callbacks.onProgress?.({ stage: 'enrich' });
    await enrichAlbumMetadata(likedTracks, savedAlbums, bannedLabels);
    callbacks.onProgress?.({ stage: 'enrich', loaded: 1, total: 1 });
  }

  const artistsToUnfollow = following.filter((id: string) => bannedArtistIds.has(id));

  const trackIdsFromArtists = pickTracksByArtists(likedTracks, bannedArtistIds, strictPrimary);
  const albumIdsFromArtists = includeAlbums
    ? pickAlbumsByArtists(savedAlbums, bannedArtistIds)
    : [];

  const albumMatchesByLabel = includeAlbums ? pickAlbumsByLabels(savedAlbums, bannedLabels) : [];
  const trackMatchesByLabel = pickTracksByLabels(likedTracks, bannedLabels);

  const trackIdsToRemove = unique([
    ...trackIdsFromArtists,
    ...trackMatchesByLabel.map(match => match.trackId),
  ]);
  const albumIdsToRemove = includeAlbums
    ? unique([...albumIdsFromArtists, ...albumMatchesByLabel.map(match => match.albumId)])
    : [];

  const trackReasons = new Map<string, PlanRemovalReason[]>();
  const albumReasons = new Map<string, PlanRemovalReason[]>();

  const trackArtistReasonSet = new Set(trackIdsFromArtists);
  const albumArtistReasonSet = new Set(albumIdsFromArtists);

  const ensureTrackReason = (id: string): PlanRemovalReason[] => {
    const existing = trackReasons.get(id);
    if (existing) return existing;
    const list: PlanRemovalReason[] = [];
    trackReasons.set(id, list);
    return list;
  };

  const ensureAlbumReason = (id: string): PlanRemovalReason[] => {
    const existing = albumReasons.get(id);
    if (existing) return existing;
    const list: PlanRemovalReason[] = [];
    albumReasons.set(id, list);
    return list;
  };

  const pushReason = (list: PlanRemovalReason[], reason: PlanRemovalReason) => {
    if (reason.type === 'artist') {
      if (!list.some(r => r.type === 'artist' && r.id === reason.id)) {
        list.push(reason);
      }
    } else if (reason.type === 'label') {
      if (!list.some(r => r.type === 'label' && r.label === reason.label)) {
        list.push(reason);
      }
    }
  };

  likedTracks.forEach(track => {
    if (!trackArtistReasonSet.has(track.id)) return;
    track.artists.forEach(artist => {
      if (!artist.id) return;
      if (!bannedArtistIds.has(artist.id)) return;
      const list = ensureTrackReason(track.id);
      pushReason(list, { type: 'artist', id: artist.id, name: artist.name });
    });
  });

  savedAlbums.forEach(album => {
    if (!albumArtistReasonSet.has(album.id)) return;
    album.artists.forEach(artist => {
      if (!artist.id) return;
      if (!bannedArtistIds.has(artist.id)) return;
      const list = ensureAlbumReason(album.id);
      pushReason(list, { type: 'artist', id: artist.id, name: artist.name });
    });
  });

  trackMatchesByLabel.forEach(match => {
    const list = ensureTrackReason(match.trackId);
    pushReason(list, { type: 'label', label: match.label });
  });

  albumMatchesByLabel.forEach(match => {
    const list = ensureAlbumReason(match.albumId);
    pushReason(list, { type: 'label', label: match.label });
  });

  const tracksToRemove = trackIdsToRemove
    .map(id => likedTracks.find(track => track.id === id))
    .filter((track): track is Track => Boolean(track))
    .map(
      (track): PlanRemoval => ({
        id: track.id,
        name: track.name,
        artistNames: track.artists.map(artist => artist.name ?? artist.id),
        albumName: track.album.name,
        album: { imageUrl: track.album.imageUrl },
        reasons: trackReasons.get(track.id) ?? [],
      }),
    );

  const albumsToRemove = albumIdsToRemove
    .map(id => savedAlbums.find(album => album.id === id))
    .filter((album): album is Album => Boolean(album))
    .map(
      (album): PlanRemoval => ({
        id: album.id,
        name: album.name,
        artistNames: album.artists.map(artist => artist.name ?? artist.id),
        imageUrl: album.imageUrl,
        reasons: albumReasons.get(album.id) ?? [],
      }),
    );

  const evidence = buildEvidence(
    likedTracks,
    savedAlbums,
    trackIdsFromArtists,
    albumIdsFromArtists,
    trackMatchesByLabel,
    albumMatchesByLabel,
    bannedArtistIds,
  );

  callbacks.onProgress?.({ stage: 'done' });

  return {
    artistsToUnfollow,
    trackIdsToRemove,
    albumIdsToRemove,
    tracksToRemove,
    albumsToRemove,
    evidence,
  };
}

export function getLastPlanContext(): PlanContext {
  return lastContext;
}

export function getLastFollowingSnapshot(): string[] {
  return [...lastFollowing];
}
