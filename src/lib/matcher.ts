import type { Album, Track } from '../types/index.js';

const LABEL_STRIP_RE = /(records|recordings|music|inc\.|ltd\.|—|–|™|®)/gi;

function safeNormalize(value: string): string {
  try {
    return value.normalize('NFKD');
  } catch {
    return value;
  }
}

export function normalizeLabel(label: string | undefined | null): string {
  if (!label) return '';
  const normalized = safeNormalize(label.toLowerCase());
  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .replace(LABEL_STRIP_RE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function pickTracksByArtists(
  likedTracks: Track[],
  bannedArtistIds: Set<string>,
  strictPrimary = false,
): string[] {
  if (!likedTracks.length || !bannedArtistIds.size) return [];
  const selected = new Set<string>();
  likedTracks.forEach(track => {
    if (!track?.id || !Array.isArray(track.artists)) return;
    if (strictPrimary) {
      const primary = track.artists[0]?.id;
      if (primary && bannedArtistIds.has(primary)) {
        selected.add(track.id);
      }
      return;
    }
    if (track.artists.some(artist => artist?.id && bannedArtistIds.has(artist.id))) {
      selected.add(track.id);
    }
  });
  return Array.from(selected);
}

export function pickAlbumsByArtists(savedAlbums: Album[], bannedArtistIds: Set<string>): string[] {
  if (!savedAlbums.length || !bannedArtistIds.size) return [];
  const selected = new Set<string>();
  savedAlbums.forEach(album => {
    if (!album?.id || !Array.isArray(album.artists)) return;
    if (album.artists.some(artist => artist?.id && bannedArtistIds.has(artist.id))) {
      selected.add(album.id);
    }
  });
  return Array.from(selected);
}

export function pickAlbumsByLabels(
  savedAlbums: (Album & { label?: string })[],
  bannedLabels: Set<string>,
): Array<{ albumId: string; label: string; title?: string; year?: number }> {
  if (!savedAlbums.length || !bannedLabels.size) return [];
  const results: Array<{ albumId: string; label: string; title?: string; year?: number }> = [];
  const seen = new Set<string>();
  savedAlbums.forEach(album => {
    if (!album?.id || !album.label) return;
    const normalized = normalizeLabel(album.label);
    if (!normalized || !bannedLabels.has(normalized) || seen.has(album.id)) return;
    seen.add(album.id);
    const year = album.release_date ? Number(album.release_date.slice(0, 4)) : undefined;
    results.push({ albumId: album.id, label: album.label, title: album.name, year });
  });
  return results;
}

export function pickTracksByLabels(
  likedTracks: (Track & { album: Track['album'] & { label?: string; release_date?: string } })[],
  bannedLabels: Set<string>,
): Array<{ trackId: string; albumId?: string; label: string; title?: string; year?: number }> {
  if (!likedTracks.length || !bannedLabels.size) return [];
  const results: Array<{
    trackId: string;
    albumId?: string;
    label: string;
    title?: string;
    year?: number;
  }> = [];
  const seen = new Set<string>();
  likedTracks.forEach(track => {
    if (!track?.id) return;
    const label = track.album?.label;
    if (!label) return;
    const normalized = normalizeLabel(label);
    if (!normalized || !bannedLabels.has(normalized) || seen.has(track.id)) return;
    seen.add(track.id);
    const year = track.album?.release_date
      ? Number(track.album.release_date.slice(0, 4))
      : undefined;
    results.push({ trackId: track.id, albumId: track.album?.id, label, title: track.name, year });
  });
  return results;
}
