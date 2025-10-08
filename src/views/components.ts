import { state } from '../app/state.js';
import { t } from '../lib/i18n.js';
import { canonicalName } from '../lib/resolver.js';
import { el, spinner } from '../lib/ui.js';
import type { Item, ResolvedArtist } from '../types/index.js';

export type ArtistDisplay = {
  id?: string | null;
  name: string;
  input?: string | null;
  imageUrl?: string | null;
};

export type ArtistInfoOptions = {
  compact?: boolean;
  link?: boolean;
  showSourceDiff?: boolean;
  showFollow?: boolean;
};

export function createMetricCard(label: string, value: string): HTMLElement {
  const card = el('div', { className: 'metric-card' });
  card.appendChild(el('strong', { text: label }));
  card.appendChild(el('span', { text: value }));
  return card;
}

export function createLoadingCard(message: string): HTMLElement {
  const card = el('div', { className: 'glass-card step' });
  const row = el('div', { className: 'source-loading' });
  row.appendChild(spinner());
  row.appendChild(el('span', { text: message }));
  card.appendChild(row);
  return card;
}

export function isArtistFollowed(id?: string | null): boolean {
  if (!id) return false;
  return state.followingArtistIds.includes(id);
}

export function findSourceItemByName(name: string): Item | undefined {
  return state.sourceList?.items.find(item => item.name === name);
}

export function normalizeNameForCompare(name?: string | null): string {
  return name ? canonicalName(name) : '';
}

export function buildArtistAvatar(
  entry: ArtistDisplay,
  options: { compact?: boolean } = {},
): HTMLElement {
  const className = options.compact ? 'roster-avatar roster-avatar--sm' : 'roster-avatar';
  const avatar = el('div', { className });
  if (entry.imageUrl) {
    const img = document.createElement('img');
    img.src = entry.imageUrl;
    img.alt = `${entry.name} portrait`;
    img.loading = 'lazy';
    avatar.appendChild(img);
  } else {
    const fallback = entry.name?.trim()?.[0]?.toUpperCase() ?? t('unknown_initial');
    avatar.appendChild(el('span', { className: 'roster-avatar-fallback', text: fallback }));
  }
  return avatar;
}

export function buildArtistDetails(
  entry: ArtistDisplay,
  options: ArtistInfoOptions = {},
): HTMLElement {
  const {
    compact = false,
    link = Boolean(entry.id),
    showSourceDiff = true,
    showFollow = true,
  } = options;
  const details = el('div', {
    className: compact ? 'artist-details artist-details--compact' : 'artist-details',
  });
  const header = el('div', { className: 'artist-details-header' });
  const nameEl =
    link && entry.id
      ? el('a', {
          className: 'artist-card-name artist-name-link',
          attrs: {
            href: `https://open.spotify.com/artist/${entry.id}`,
            target: '_blank',
            rel: 'noopener',
          },
          text: entry.name,
        })
      : el('span', {
          className: 'artist-card-name roster-primary',
          text: entry.name,
        });
  if (compact) {
    nameEl.classList.add('artist-chip-name');
  }
  header.appendChild(nameEl);
  if (showFollow && isArtistFollowed(entry.id)) {
    header.appendChild(
      el('span', {
        className: 'follow-badge',
        text: t('resolve_following_badge'),
      }),
    );
  }
  details.appendChild(header);

  if (
    showSourceDiff &&
    entry.input &&
    entry.name &&
    canonicalName(entry.input) !== canonicalName(entry.name)
  ) {
    details.appendChild(
      el('span', {
        className: 'artist-card-sub roster-sub',
        text: `Source: ${entry.input}`,
      }),
    );
  }

  return details;
}

export function buildArtistInfo(
  entry: ArtistDisplay,
  options: ArtistInfoOptions = {},
): HTMLElement {
  const { compact = false } = options;
  const info = el('div', {
    className: compact ? 'artist-info artist-info--compact' : 'artist-info',
  });
  info.appendChild(buildArtistAvatar(entry, { compact }));
  info.appendChild(buildArtistDetails(entry, options));
  return info;
}

export function buildArtistChip(entry: ResolvedArtist): HTMLElement {
  const chip = el('div', { className: 'artist-chip' });
  const info = buildArtistInfo(entry, { compact: true, showSourceDiff: true });
  info.classList.add('artist-chip-main');
  chip.appendChild(info);
  chip.setAttribute(
    'title',
    entry.input === entry.name ? entry.name : `${entry.input} → ${entry.name}`,
  );
  return chip;
}
