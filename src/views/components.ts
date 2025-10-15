import { renderRoute } from '../app/routing';
import { AppState, invalidateGeneratedPlan, state } from '../app/state.js';
import { t } from '../lib/i18n.js';
import { canonicalName } from '../lib/resolver.js';
import type { Item, ResolvedArtist } from '../types/index.js';
import { el } from '../ui';

export type ArtistDisplay = {
  id?: string | null;
  name: string;
  input?: string | null;
  imageUrl?: string | null;
  isFollowing?: boolean;
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

export function createLoadingCard(text: string, promise?: Promise<HTMLElement>): HTMLElement {
  const container = el('div', { className: 'glass-card is-loading' });
  const spinner = el('div', { className: 'spinner spinner-medium' });
  const label = el('div', { text });
  container.appendChild(spinner);
  container.appendChild(label);

  if (promise) {
    promise
      .then(content => {
        container.replaceWith(content);
      })
      .catch(err => {
        console.error('Failed to load card content', err);
        label.textContent = t('error_generic');
        spinner.remove();
      });
  }

  return container;
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
  if (showFollow && entry.isFollowing) {
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

export function buildToggle(key: keyof AppState['options'], label: string): HTMLElement {
  const wrapper = el('label', { className: 'option-toggle' });
  const toggle = el('div', { className: 'toggle-switch' });
  const input = el('input', { attrs: { type: 'checkbox' } }) as HTMLInputElement;
  input.id = `option-${key}`;
  wrapper.htmlFor = input.id;
  input.checked = state.options[key];
  input.addEventListener('change', () => {
    state.options[key] = input.checked;
    invalidateGeneratedPlan();
    renderRoute();
  });
  toggle.appendChild(input);
  toggle.appendChild(el('span', { className: 'toggle-slider' }));
  wrapper.appendChild(toggle);
  wrapper.appendChild(el('span', { text: label }));
  return wrapper;
}
