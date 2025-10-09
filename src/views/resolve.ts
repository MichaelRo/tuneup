import { HAS_SINGLE_LIST } from '../app/config.js';
import { navigate, renderRoute } from '../app/routing.js';
import {
  state,
  isConnected,
  invalidateGeneratedPlan,
  uniqueNames,
  getArtistInputs,
} from '../app/state.js';
import { t, formatNumber } from '../lib/i18n.js';
import {
  resolveArtists,
  canonicalName,
  type ArtistCandidate,
  type ResolveArtistsResult,
} from '../lib/resolver.js';
import { artistsFull, meFollowingContains } from '../lib/spotify.js';
import { updateState, loadState } from '../lib/state.js';
import { el, setLoading, showToast, showChoiceModal, showSimpleModal } from '../lib/ui.js';
import type { ResolvedArtist } from '../types/index.js';

import {
  createMetricCard,
  createLoadingCard,
  buildArtistChip,
  buildArtistInfo,
  findSourceItemByName,
} from './components.js';
import { buildShell } from './shell.js';
import { maybeAutoLoadSelectedList, renderSourceStep } from './source.js';

let autoResolveInFlight = false;
let resolvePreviewSort: 'recent' | 'name' | 'followers' = 'followers';

async function forgetCachedDecision(name: string): Promise<void> {
  const canonical = canonicalName(name);
  await updateState(draft => {
    delete draft.nameToId[name];
    delete draft.nameToId[canonical];
  });
}

async function persistSkipDecision(name: string): Promise<void> {
  const canonical = canonicalName(name);
  const now = new Date().toISOString();
  await updateState(draft => {
    draft.nameToId[name] = { id: '__skip__', verifiedAt: now };
    draft.nameToId[canonical] = { id: '__skip__', verifiedAt: now };
  });
}

async function hydrateResolvedFromCache(): Promise<void> {
  if (!state.pendingArtists.length) return;
  try {
    const saved = await loadState();
    const cache = saved.nameToId ?? {};
    if (!Object.keys(cache).length) return;

    const stillPending: string[] = [];
    const resolvedFromCache: ResolvedArtist[] = [];
    const skippedFromCache: string[] = [];

    for (const name of state.pendingArtists) {
      const entry = cache[name] ?? cache[canonicalName(name)];
      if (!entry) {
        stillPending.push(name);
        continue;
      }
      if (entry.id === '__skip__' || entry.id === '__missing__') {
        skippedFromCache.push(name);
      } else if (entry.id) {
        resolvedFromCache.push({
          input: name,
          id: entry.id,
          name,
          followers: 0,
        });
      } else {
        stillPending.push(name);
      }
    }

    if (resolvedFromCache.length > 0) {
      state.resolvedArtists.push(...resolvedFromCache);
    }
    if (skippedFromCache.length > 0) {
      state.skippedArtists = uniqueNames([...state.skippedArtists, ...skippedFromCache]);
    }
    state.pendingArtists = uniqueNames(stillPending);

    if (resolvedFromCache.length > 0 || skippedFromCache.length > 0) {
      invalidateGeneratedPlan();
      void enrichAndRenderArtists(resolvedFromCache);
      renderRoute();
    }
  } catch (err) {
    console.warn('Unable to hydrate cached resolutions', err);
  }
}

function applyResolveResult(
  pendingSnapshot: string[],
  result: ResolveArtistsResult,
): ResolveArtistsResult & {
  changed: boolean;
  resolvedCount: number;
  skippedCount: number;
  unresolvedCount: number;
  cancelled: boolean;
} {
  let changed = false;
  const resolvedInputs = new Set<string>();

  result.resolved.forEach(entry => {
    const alreadyTracked = state.resolvedArtists.some(
      existing => existing.id === entry.id || existing.input === entry.input,
    );
    if (!alreadyTracked) {
      state.resolvedArtists.push(entry);
      changed = true;
    }
    resolvedInputs.add(entry.input);
  });

  if (result.skipped.length) {
    state.skippedArtists = uniqueNames([...state.skippedArtists, ...result.skipped]);
    changed = true;
  }

  const handled = new Set<string>([...resolvedInputs, ...result.skipped]);
  if (handled.size) {
    const nextPending = pendingSnapshot.filter(name => !handled.has(name));
    if (nextPending.length !== state.pendingArtists.length) {
      state.pendingArtists = uniqueNames(nextPending);
      changed = true;
    }
  }

  if (changed) {
    invalidateGeneratedPlan();
  }

  return {
    ...result,
    changed,
    resolvedCount: result.resolved.length,
    skippedCount: result.skipped.length,
    unresolvedCount: result.unresolved.length,
    cancelled: Boolean(result.cancelled),
  };
}

async function requeueResolvedArtist(input: string): Promise<void> {
  const index = state.resolvedArtists.findIndex(item => item.input === input);
  if (index === -1) return;
  const [entry] = state.resolvedArtists.splice(index, 1);
  if (!entry) return;
  state.pendingArtists = uniqueNames([entry.input, ...state.pendingArtists]);
  await forgetCachedDecision(entry.input);
  invalidateGeneratedPlan();
  renderRoute();
  showToast(t('resolve_unmatch_success', { name: entry.input }), 'info');
}

async function requeueSkippedArtist(name: string): Promise<void> {
  state.skippedArtists = state.skippedArtists.filter(item => item !== name);
  state.pendingArtists = uniqueNames([name, ...state.pendingArtists]);
  await forgetCachedDecision(name);
  invalidateGeneratedPlan();
  renderRoute();
  showToast(t('resolve_requeue_success', { name }), 'success');
}

async function skipPendingArtist(name: string): Promise<void> {
  state.pendingArtists = state.pendingArtists.filter(item => item !== name);
  state.skippedArtists = uniqueNames([...state.skippedArtists, name]);
  await persistSkipDecision(name);
  invalidateGeneratedPlan();
  renderRoute();
  showToast(t('resolve_skip_success', { name }), 'info');
}

const RESOLVED_PREVIEW_LIMIT = 8;

async function enrichAndRenderArtists(artists: ResolvedArtist[]): Promise<void> {
  if (!artists.length) return;

  const artistIds = artists.map(a => a.id);

  // In parallel, fetch full artist details (for images/followers) and follow status
  const [fullDetails, followStatus] = await Promise.all([
    artistsFull(artistIds),
    meFollowingContains(artistIds),
  ]);

  const detailsById = new Map(fullDetails.map(a => [a.id, a]));

  artists.forEach((artist, index) => {
    const details = detailsById.get(artist.id);
    if (details) {
      artist.name = details.name;
      artist.followers = details.followers.total;
      artist.imageUrl = details.images[0]?.url;
    }
    artist.isFollowing = followStatus[index];
  });

  // Update the global state. Find existing entries and update them, or add new ones.
  artists.forEach(artist => {
    const existingIndex = state.resolvedArtists.findIndex(a => a.id === artist.id);
    if (existingIndex > -1) {
      state.resolvedArtists[existingIndex] = artist;
    } else {
      state.resolvedArtists.push(artist);
    }
  });
  renderRoute();
}

async function runAutoResolve(options: { force?: boolean } = {}): Promise<void> {
  if (autoResolveInFlight) return;
  if (!state.sourceList || !isConnected() || !state.pendingArtists.length) return;
  if (!options.force && state.autoResolveAttempted) return;

  autoResolveInFlight = true;
  state.autoResolveAttempted = true;
  state.resolutionRunning = true;
  renderRoute();

  try {
    const pendingSnapshot = [...state.pendingArtists];
    const outcome = await resolveArtists(
      pendingSnapshot.map(name => ({ type: 'artist', name })),
      {},
      async result => {
        const partialOutcome = applyResolveResult(pendingSnapshot, result);
        await enrichAndRenderArtists(result.resolved);
        return partialOutcome;
      },
    );
    state.autoResolveCompleted = !outcome.cancelled;

    const parts: string[] = [];
    if (outcome.resolvedCount > 0) {
      const label = t(
        outcome.resolvedCount === 1 ? 'resolve_artist_label' : 'resolve_artists_label',
      );
      parts.push(t('resolve_auto_resolved_artists', { count: outcome.resolvedCount, label }));
    }
    if (outcome.skippedCount > 0) {
      const label = t(outcome.skippedCount === 1 ? 'resolve_entry_label' : 'resolve_entries_label');
      parts.push(t('resolve_skipped_unmatched', { count: outcome.skippedCount, label }));
    }

    if (parts.length) {
      showToast(parts.join(' · '), outcome.resolvedCount > 0 ? 'success' : 'info');
    } else if (state.pendingArtists.length) {
      showToast(t('resolve_no_matches'), 'info');
    }
  } catch (err) {
    console.error(err);
    showToast(t('resolve_fail'), 'error');
  } finally {
    state.resolutionRunning = false;
    autoResolveInFlight = false;
    renderRoute();
  }
}

async function handleAmbiguity(
  input: string,
  candidates: ArtistCandidate[],
): Promise<{ choice: ArtistCandidate | null; skipped?: boolean; cancel?: boolean }> {
  const choices = candidates.slice(0, 5).map(candidate => ({
    label: candidate.name,
    subtitle: `${formatNumber(candidate.followers ?? 0)} ${t('resolve_followers')}`,
    value: candidate,
  }));

  let skipped = false;
  const selection = await showChoiceModal({
    title: input,
    description: t('resolve_ambiguity_modal_title'),
    choices,
    skipLabel: t('resolve_ambiguity_skip'),
    cancelLabel: t('resolve_ambiguity_stop'),
    onSkip: () => {
      skipped = true;
    },
  });

  if (skipped) return { choice: null, skipped: true };
  if (!selection) return { choice: null, cancel: true };
  return { choice: selection };
}

function buildResolveStatusBanner(pendingCount: number, skippedCount: number): HTMLElement | null {
  if (!isConnected()) {
    return el('div', {
      className: 'resolve-banner resolve-banner-warning',
      text: t('resolve_banner_connect'),
    });
  }
  if (!state.autoResolveAttempted && state.pendingArtists.length) {
    return el('div', {
      className: 'resolve-banner resolve-banner-info',
      text: t('resolve_banner_autoscan'),
    });
  }
  if (state.resolutionRunning) {
    return el('div', {
      className: 'resolve-banner resolve-banner-info',
      text: t('resolve_banner_scanning'),
    });
  }
  if (state.autoResolveAttempted && !state.autoResolveCompleted && pendingCount) {
    const banner = el('div', {
      className: 'resolve-banner resolve-banner-warning',
    });
    banner.appendChild(el('span', { text: t('resolve_banner_paused') }));
    const retryBtn = el('button', {
      className: 'ghost-btn',
      text: t('resolve_retry_btn'),
    });
    retryBtn.addEventListener('click', e => {
      e.preventDefault();
      void runAutoResolve({ force: true });
    });
    banner.appendChild(retryBtn);
    return banner;
  }
  if (!pendingCount) {
    const text =
      skippedCount > 0
        ? t('resolve_banner_finished_skipped', { count: skippedCount })
        : t('resolve_banner_finished_all');
    return el('div', { className: 'resolve-banner resolve-banner-success', text });
  }
  return null;
}

function buildResolvedPreviewSort(): HTMLElement {
  const control = el('div', { className: 'segmented-control resolve-preview-sort' });
  const buildOption = (mode: typeof resolvePreviewSort, label: string): HTMLButtonElement => {
    const button = el('button', {
      className: `segmented-option${resolvePreviewSort === mode ? ' is-active' : ''}`,
      text: label,
    }) as HTMLButtonElement;
    button.addEventListener('click', (): void => {
      if (resolvePreviewSort === mode) return;
      resolvePreviewSort = mode;
      renderRoute();
    });
    return button;
  };
  control.appendChild(buildOption('followers', t('resolve_sort_popularity')));
  control.appendChild(buildOption('name', t('resolve_sort_recent')));
  control.appendChild(buildOption('recent', t('resolve_sort_recent')));
  return control;
}

function buildResolvedPreviewGrid(limit = RESOLVED_PREVIEW_LIMIT): HTMLElement {
  const wrapper = el('div', { className: 'artist-chip-grid' });
  if (!state.resolvedArtists.length) {
    wrapper.appendChild(el('div', { className: 'muted', text: t('no_artists_resolved') }));
    return wrapper;
  }

  const collection =
    resolvePreviewSort === 'name'
      ? [...state.resolvedArtists].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit)
      : resolvePreviewSort === 'followers'
        ? [...state.resolvedArtists]
            .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
            .slice(0, limit)
        : [...state.resolvedArtists].slice(-limit).reverse();

  collection.forEach(entry => {
    wrapper.appendChild(buildArtistChip(entry));
  });

  return wrapper;
}

function buildRosterLinkButton(onUpdate: () => void): HTMLButtonElement {
  const button = el('button', {
    className: 'text-link',
    text: t('resolve_view_list'),
  }) as HTMLButtonElement;
  button.addEventListener('click', event => {
    event.preventDefault();
    showArtistRosterModal(onUpdate);
  });
  return button;
}

async function reviewSingleArtist(
  name: string,
  button: HTMLButtonElement,
  onComplete: () => void,
): Promise<void> {
  try {
    setLoading(button, true);
    const result = await resolveArtists([{ type: 'artist', name }], {
      onAmbiguity: handleAmbiguity,
    });
    const outcome = applyResolveResult([name], result);
    if (outcome.resolvedCount) {
      const top = result.resolved[0];
      if (top) {
        await enrichAndRenderArtists([top]);
        showToast(t('resolve_resolved_success', { input: top.input, name: top.name }), 'success');
      }
    } else if (outcome.skippedCount) {
      showToast(t('resolve_skipped_ambiguous', { name }), 'info');
    } else if (outcome.unresolvedCount && !outcome.cancelled) {
      showToast(t('resolve_still_ambiguous', { name }), 'warning');
    }
    if (outcome.cancelled) {
      showToast(t('resolve_review_cancelled'), 'info');
    }
  } catch (err) {
    console.error(err);
    showToast(t('resolve_fail_review'), 'error');
  } finally {
    setLoading(button, false);
    onComplete();
    renderRoute();
  }
}

function showArtistRosterModal(onUpdate?: () => void): void {
  const body = el('div', { className: 'artist-roster-modal' });
  // Use a local sort state for the modal to avoid affecting the main view's preview grid.
  let modalSort = resolvePreviewSort;

  const rerender = (): void => {
    body.innerHTML = '';
    body.appendChild(buildModalSortControl());
    body.appendChild(renderSummary());
    body.appendChild(renderResolved());
    body.appendChild(renderPending());
    body.appendChild(renderSkipped());
  };

  function buildModalSortControl(): HTMLElement {
    const control = el('div', { className: 'segmented-control resolve-preview-sort' });
    const buildOption = (mode: typeof modalSort, label: string): HTMLButtonElement => {
      const button = el('button', {
        className: `segmented-option${modalSort === mode ? ' is-active' : ''}`,
        text: label,
      }) as HTMLButtonElement;
      button.addEventListener('click', (): void => {
        if (modalSort === mode) return;
        modalSort = mode;
        rerender(); // Re-render only the modal content
      });
      return button;
    };
    control.appendChild(buildOption('followers', t('resolve_sort_popularity')));
    control.appendChild(buildOption('name', t('resolve_sort_recent')));
    control.appendChild(buildOption('recent', t('resolve_sort_recent')));
    return control;
  }
  const renderSummary = (): HTMLElement => {
    const summary = el('div', { className: 'roster-summary' });
    summary.appendChild(
      createMetricCard(t('app_all_matched'), formatNumber(state.resolvedArtists.length)),
    );
    summary.appendChild(
      createMetricCard(t('metric_pending'), formatNumber(state.pendingArtists.length)),
    );
    summary.appendChild(
      createMetricCard(t('metric_skipped'), formatNumber(state.skippedArtists.length)),
    );
    return summary;
  };

  function renderResolved(): HTMLElement {
    const section = el('section', { className: 'roster-group' });
    section.appendChild(
      el('h4', {
        text: `${t('resolve_matched_artists')} (${formatNumber(state.resolvedArtists.length)})`,
      }),
    );
    if (!state.resolvedArtists.length) {
      section.appendChild(el('div', { className: 'muted', text: t('no_artists_resolved') }));
      return section;
    }
    const scroll = el('div', { className: 'roster-scroll' });
    if (scroll.parentElement) {
      scroll.parentElement.style.minHeight = '220px';
    }
    const collection =
      modalSort === 'name'
        ? [...state.resolvedArtists].sort((a, b) => a.name.localeCompare(b.name))
        : modalSort === 'followers'
          ? [...state.resolvedArtists].sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
          : [...state.resolvedArtists].slice().reverse(); // Default to 'recent'
    const list = el('ul', { className: 'roster-list' });
    collection.forEach(entry => {
      const row = el('li', { className: 'roster-row' });
      const info = buildArtistInfo(entry, { showSourceDiff: true });
      row.appendChild(info);
      const actions = el('div', { className: 'roster-row-actions' });
      const undoBtn = el('button', {
        className: 'secondary-btn',
        text: t('resolve_unmatch_button'),
      }) as HTMLButtonElement;
      undoBtn.addEventListener('click', async () => {
        await requeueResolvedArtist(entry.input);
        rerender();
      });
      actions.appendChild(undoBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
    scroll.appendChild(list);
    section.appendChild(scroll);
    return section;
  }

  function renderPending(): HTMLElement {
    const section = el('section', { className: 'roster-group' });
    section.appendChild(
      el('h4', { text: `${t('metric_pending')} (${formatNumber(state.pendingArtists.length)})` }),
    );
    if (!state.pendingArtists.length) {
      section.appendChild(el('div', { className: 'muted', text: t('all_artists_resolved') }));
      return section;
    }
    const scroll = el('div', { className: 'roster-scroll' });
    const list = el('ul', { className: 'roster-list' });
    state.pendingArtists.forEach(name => {
      const row = el('li', { className: 'roster-row' });
      const sourceItem = findSourceItemByName(name);
      const info = buildArtistInfo(
        {
          name,
          isFollowing: isArtistFollowed(sourceItem?.spotifyId),
          input: name,
          id: sourceItem?.spotifyId,
        },
        {
          showSourceDiff: false,
          link: Boolean(sourceItem?.spotifyId),
        },
      );
      row.appendChild(info);
      const actions = el('div', { className: 'roster-row-actions' });
      const reviewBtn = el('button', {
        className: 'primary-btn',
        text: t('wizard_review'),
      }) as HTMLButtonElement;
      reviewBtn.addEventListener('click', (): void => {
        void reviewSingleArtist(name, reviewBtn, () => rerender());
      });
      actions.appendChild(reviewBtn);
      const skipBtn = el('button', {
        className: 'secondary-btn',
        text: t('app_skip'),
      }) as HTMLButtonElement;
      skipBtn.addEventListener('click', async () => {
        skipBtn.disabled = true;
        try {
          await skipPendingArtist(name);
          rerender();
        } catch (err) {
          console.error(err);
          showToast(t('resolve_fail_skip'), 'error');
          skipBtn.disabled = false;
        }
      });
      actions.appendChild(skipBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
    scroll.appendChild(list);
    section.appendChild(scroll);
    return section;
  }

  function renderSkipped(): HTMLElement {
    const section = el('section', { className: 'roster-group' });
    section.appendChild(
      el('h4', { text: `${t('metric_skipped')} (${formatNumber(state.skippedArtists.length)})` }),
    );
    if (!state.skippedArtists.length) {
      section.appendChild(el('div', { className: 'muted', text: t('no_skipped_artists') }));
      return section;
    }
    const scroll = el('div', { className: 'roster-scroll' });
    const list = el('ul', { className: 'roster-list' });
    state.skippedArtists.forEach(name => {
      const row = el('li', { className: 'roster-row' });
      const sourceItem = findSourceItemByName(name);
      const info = buildArtistInfo(
        {
          name,
          isFollowing: isArtistFollowed(sourceItem?.spotifyId),
          input: name,
          id: sourceItem?.spotifyId,
        },
        {
          showSourceDiff: false,
          link: Boolean(sourceItem?.spotifyId),
        },
      );
      row.appendChild(info);
      const actions = el('div', { className: 'roster-row-actions' });
      const retryBtn = el('button', {
        className: 'secondary-btn',
        text: t('wizard_requeue'),
      }) as HTMLButtonElement;
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        try {
          await requeueSkippedArtist(name);
          rerender();
        } catch (err) {
          console.error(err);
          showToast(t('resolve_fail_requeue'), 'error');
          retryBtn.disabled = false;
        }
      });
      actions.appendChild(retryBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
    scroll.appendChild(list);
    section.appendChild(scroll);
    return section;
  }

  rerender();
  showSimpleModal({
    title: t('resolve_review_modal_title'),
    body,
    onClose: onUpdate,
  });
}

function createResolveContent(): HTMLElement {
  const container = el('div', { className: 'glass-card step step-resolve' });
  container.appendChild(el('h2', { text: t('step_resolve_title') }));
  container.appendChild(el('p', { text: t('resolve_intro') }));

  if (!state.sourceList) {
    return createLoadingCard(t('source_loading'));
  }

  const total = getArtistInputs().length;
  const resolvedCount = state.resolvedArtists.length;
  const pendingCount = state.pendingArtists.length;
  const skippedCount = state.skippedArtists.length;

  const metrics = el('div', { className: 'metric-row' });
  metrics.appendChild(
    createMetricCard(
      t('app_all_matched'),
      `${formatNumber(resolvedCount)} / ${formatNumber(total)}`,
    ),
  );
  const pendingValue = pendingCount ? formatNumber(pendingCount) : t('app_all_matched');
  const pendingLabel = pendingCount ? t('metric_pending') : t('app_ready');
  metrics.appendChild(createMetricCard(pendingLabel, pendingValue));
  metrics.appendChild(createMetricCard(t('metric_skipped'), formatNumber(skippedCount)));
  container.appendChild(metrics);

  const banner = buildResolveStatusBanner(pendingCount, skippedCount);
  if (banner) {
    container.appendChild(banner);
  }

  const previewSection = el('div', { className: 'list-summary' });
  if (state.resolvedArtists.length) {
    const header = el('div', { className: 'resolved-preview-header' });
    header.appendChild(el('strong', { text: t('resolve_matched_artists') }));
    const controls = el('div', { className: 'resolved-preview-controls' });
    if (state.resolvedArtists.length > RESOLVED_PREVIEW_LIMIT) {
      controls.appendChild(buildRosterLinkButton(() => renderRoute()));
    }
    if (state.resolvedArtists.length > 1) {
      controls.appendChild(buildResolvedPreviewSort());
    }
    header.appendChild(controls);
    previewSection.appendChild(header);
    previewSection.appendChild(buildResolvedPreviewGrid());
  }
  if (pendingCount) {
    previewSection.appendChild(
      el('div', {
        className: 'resolve-status-chip is-pending',
        text: t('resolve_artists_need_review', { count: formatNumber(pendingCount) }),
      }),
    );
  }
  container.appendChild(previewSection);

  if (!pendingCount && isConnected() && state.resolvedArtists.length) {
    container.appendChild(
      el('div', {
        className: 'muted resolve-followup-note',
        text: t('resolve_banner_finished_note'),
      }),
    );
  }

  const actions = el('div', { className: 'resolve-actions' });
  if (pendingCount) {
    const resolveBtnLabel = state.autoResolveAttempted
      ? t('resolve_review_btn')
      : t('resolve_start_btn');
    const resolveBtnClass = state.autoResolveAttempted ? 'secondary-btn' : 'primary-btn';
    const resolveBtn = el('button', { className: resolveBtnClass, text: resolveBtnLabel });
    if (state.resolutionRunning) {
      setLoading(resolveBtn, true);
    }
    resolveBtn.addEventListener('click', async event => {
      event.preventDefault();
      if (!isConnected()) {
        showToast(t('resolve_connect_first'), 'warning');
        return;
      }
      try {
        if (!state.pendingArtists.length) {
          showToast(t('resolve_all_resolved'), 'info');
          return;
        }
        setLoading(resolveBtn, true);
        state.autoResolveAttempted = true;
        state.resolutionRunning = true;
        const pendingSnapshot = [...state.pendingArtists];
        const outcome = await resolveArtists(
          pendingSnapshot.map(name => ({ type: 'artist', name })),
          { onAmbiguity: handleAmbiguity },
          async (result: ResolveArtistsResult) => {
            const partialOutcome = applyResolveResult(pendingSnapshot, result);
            await enrichAndRenderArtists(result.resolved);
            return partialOutcome;
          },
        );
        state.autoResolveCompleted = !outcome.cancelled;
        if (outcome.resolvedCount) {
          const label = t(
            outcome.resolvedCount === 1 ? 'resolve_artist_label' : 'resolve_artists_label',
          );
          showToast(
            t('resolve_auto_resolved_artists', { count: outcome.resolvedCount, label }),
            'success',
          );
        }
        if (outcome.skippedCount) {
          const label = t(
            outcome.skippedCount === 1 ? 'resolve_artist_label' : 'resolve_artists_label',
          );
          showToast(t('resolve_skipped_unmatched', { count: outcome.skippedCount, label }), 'info');
        }
        if (!outcome.resolvedCount && !outcome.skippedCount && !outcome.unresolvedCount) {
          showToast(t('toast_no_changes_round'), 'info');
        }
        if (outcome.unresolvedCount && !outcome.cancelled) {
          const label = t(
            outcome.unresolvedCount === 1 ? 'resolve_artist_label' : 'resolve_artists_label',
          );
          showToast(
            t('resolve_still_ambiguous', { count: outcome.unresolvedCount, label }),
            'warning',
          );
        }
        if (outcome.cancelled) {
          showToast(t('toast_review_paused'), 'info');
        }
      } catch (err) {
        console.error(err);
        showToast(t('resolve_fail'), 'error');
      } finally {
        setLoading(resolveBtn, false);
        renderRoute();
      }
    });
    actions.appendChild(resolveBtn);
  }

  const nextBtn = el('button', {
    className: state.resolvedArtists.length ? 'primary-btn' : 'secondary-btn',
    text: t('resolve_next_btn'),
  });
  nextBtn.addEventListener('click', event => {
    event.preventDefault();
    if (!state.resolvedArtists.length && !state.plan) {
      showToast(t('resolve_artists_first'), 'warning');
      return;
    }
    navigate('#/preview');
  });
  if (!state.resolvedArtists.length) {
    nextBtn.setAttribute('disabled', 'true');
    nextBtn.setAttribute('title', t('resolve_next_disabled'));
  }
  actions.appendChild(nextBtn);

  const backBtn = el('button', { className: 'secondary-btn', text: t('resolve_back_btn') });
  backBtn.addEventListener('click', event => {
    event.preventDefault();
    navigate('#/app');
  });
  actions.appendChild(backBtn);

  container.appendChild(actions);

  return container;
}

export function renderResolveStep(): Node {
  if (!state.sourceList) {
    if (HAS_SINGLE_LIST) {
      maybeAutoLoadSelectedList();
      return buildShell(createLoadingCard(t('source_loading')), {
        activeHash: '#/resolve',
        title: t('stepper_title'),
      });
    }
    showToast(t('toast_load_list_first'), 'warning');
    navigate('#/app');
    return renderSourceStep();
  }

  void hydrateResolvedFromCache();

  // Use IntersectionObserver to trigger auto-resolve only when the element is visible.
  // This is more reliable on mobile where page visibility can be inconsistent.
  const observer = new IntersectionObserver(
    (entries, obs) => {
      if (entries[0]?.isIntersecting) {
        void runAutoResolve({ force: true });
        obs.disconnect(); // Run only once
      }
    },
    { threshold: 0.1 },
  );
  const content = createResolveContent();
  observer.observe(content);

  return buildShell(content, { activeHash: '#/resolve', title: t('stepper_title') });
}

function isArtistFollowed(id?: string | null): boolean {
  if (!id) return false;
  return state.followingArtistIds.includes(id);
}
