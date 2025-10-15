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
import { updateState } from '../lib/state.js';
import {
  artistsFull,
  meFollowingArtists,
  meFollowingContains,
  meLikedTracks,
  meSavedAlbums,
} from '../spotify';
import type { ResolvedArtist } from '../types/index.js';
import { el, setLoading, showToast, showChoiceModal, showSimpleModal } from '../ui';

import {
  createMetricCard,
  buildArtistChip,
  buildArtistInfo,
  findSourceItemByName,
} from './components.js';
import { buildShell } from './shell.js';
import { maybeAutoLoadSelectedList } from './source.js';

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

  // If not connected, we can't enrich. The UI will show placeholders.
  if (!isConnected()) {
    return;
  }

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
}

async function runAutoResolve(
  options: { force?: boolean; onComplete?: () => void } = {},
): Promise<void> {
  if (autoResolveInFlight) return;
  if (!isConnected()) {
    if (options.force) {
      showToast(t('resolve_connect_first'), 'warning');
    }
    return;
  }
  if (!state.sourceList) {
    if (options.force) {
      showToast(t('toast_load_list_first'), 'warning');
    }
    return;
  }
  if (!state.pendingArtists.length) {
    return;
  }
  if (!options.force && state.autoResolveAttempted) return;

  autoResolveInFlight = true;
  state.autoResolveAttempted = true;
  state.resolutionRunning = true;

  try {
    // The `onAmbiguity` handler is intentionally omitted here for a non-interactive scan.
    // Ambiguous items will be moved to the 'skipped' category by `resolveArtists`.
    const pendingSnapshot = [...state.pendingArtists];
    const outcome = await resolveArtists(pendingSnapshot.map(name => ({ type: 'artist', name })));

    // This mutates state and needs to be awaited before enriching.
    applyResolveResult(pendingSnapshot, outcome);
    await enrichAndRenderArtists(outcome.resolved);

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
    // Add a small delay to prevent race conditions with UI updates
    setTimeout(() => {
      autoResolveInFlight = false;
    }, 200);
    options.onComplete?.();
  }
}

async function handleAmbiguity(
  input: string,
  candidates: ArtistCandidate[],
): Promise<{ choice: ArtistCandidate | null; skipped?: boolean; cancel?: boolean }> {
  const choices = candidates.slice(0, 5).map((candidate: ArtistCandidate) => {
    const artistInfo = buildArtistInfo(candidate, { compact: true, showFollow: false });
    const label = el('div');
    label.appendChild(artistInfo);
    label.appendChild(
      el('span', {
        className: 'modal-choice-subtitle',
        text: `${formatNumber(candidate.followers ?? 0)} ${t('resolve_followers')}`,
      }),
    );

    return { label, value: candidate };
  });
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
      void runAutoResolve({ force: true, onComplete: renderRoute });
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
  control.appendChild(buildOption('name', t('resolve_sort_name')));
  control.appendChild(buildOption('recent', t('resolve_sort_recent')));
  return control;
}

function buildResolvedPreviewGridSkeleton(): HTMLElement {
    const wrapper = el('div', { className: 'artist-chip-grid' });
    for (let i = 0; i < RESOLVED_PREVIEW_LIMIT; i++) {
        const chip = el('div', { className: 'artist-chip is-loading' });
        const avatar = el('div', { className: 'roster-avatar roster-avatar--sm' });
        const details = el('div', { className: 'artist-details artist-details--compact' });
        const line1 = el('div', { className: 'skeleton-line' });
        line1.style.width = '100px';
        details.appendChild(line1);
        const line2 = el('div', { className: 'skeleton-line' });
        line2.style.width = '60px';
        details.appendChild(line2);
        chip.appendChild(avatar);
        chip.appendChild(details);
        wrapper.appendChild(chip);
    }
    return wrapper;
}

function buildResolvedPreviewGrid(limit = RESOLVED_PREVIEW_LIMIT): HTMLElement {
  const wrapper = el('div', { className: 'artist-chip-grid' });
  if (!state.resolvedArtists.length) {
      if (state.resolutionRunning || state.sourceLoading) {
          return buildResolvedPreviewGridSkeleton();
      }
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
    control.appendChild(buildOption('name', t('resolve_sort_name')));
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
    [...state.pendingArtists]
      .sort((a, b) => a.localeCompare(b))
      .forEach(name => {
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
          text: t('app_review'),
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
    [...state.skippedArtists]
      .sort((a, b) => a.localeCompare(b))
      .forEach(name => {
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
          text: t('app_requeue'),
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

  const isLoading = !state.sourceList || state.sourceLoading;

  const total = state.sourceList ? getArtistInputs().length : 0;
  const resolvedCount = state.resolvedArtists.length;
  const pendingCount = state.pendingArtists.length;
  const skippedCount = state.skippedArtists.length;

  const metrics = el('div', { className: 'metric-row' });
  metrics.appendChild(
    createMetricCard(
      t('app_all_matched'),
      isLoading ? '-' : `${formatNumber(resolvedCount)} / ${formatNumber(total)}`,
    ),
  );
  const pendingValue = isLoading ? '-' : pendingCount ? formatNumber(pendingCount) : t('app_all_matched');
  const pendingLabel = pendingCount ? t('metric_pending') : t('app_ready');
  metrics.appendChild(createMetricCard(pendingLabel, pendingValue));
  metrics.appendChild(createMetricCard(t('metric_skipped'), isLoading ? '-' : formatNumber(skippedCount)));
  container.appendChild(metrics);

  const banner = buildResolveStatusBanner(pendingCount, skippedCount);
  if (banner) {
    container.appendChild(banner);
  }

  const previewSection = el('div', { className: 'list-summary' });
  if (state.resolvedArtists.length || state.resolutionRunning || isLoading) {
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
  if (pendingCount && !isLoading) {
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
  actions.style.minHeight = '50px';

  if (pendingCount > 0 && isConnected()) {
    const resolveBtn = el('button', {
      className: 'primary-btn',
      text: t('resolve_start_btn'),
    });
    if (
      state.resolutionRunning ||
      state.sourceLoading ||
      !state.sourceList ||
      autoResolveInFlight
    ) {
      setLoading(resolveBtn, true);
    }
    resolveBtn.addEventListener('click', async event => {
      event.preventDefault();
      void runAutoResolve({ force: true, onComplete: renderRoute });
    });
    actions.appendChild(resolveBtn);
  }

  if (state.autoResolveCompleted && pendingCount > 0) {
    const reviewBtn = el('button', {
      className: 'secondary-btn',
      text: t('resolve_review_btn'),
    });
    reviewBtn.addEventListener('click', () => showArtistRosterModal(() => renderRoute()));
    actions.appendChild(reviewBtn);
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
  if (!state.resolvedArtists.length || state.resolutionRunning || isLoading) {
    nextBtn.setAttribute('disabled', 'true');
    nextBtn.setAttribute('title', t('resolve_next_disabled'));
  }
  actions.appendChild(nextBtn);

  if (HAS_SINGLE_LIST) {
    const reloadBtn = el('button', { className: 'secondary-btn', text: t('resolve_reload_btn') });
    reloadBtn.addEventListener('click', () => {
      void maybeAutoLoadSelectedList({ force: true }).then(() => renderRoute());
    });
    actions.appendChild(reloadBtn);
  } else {
    const backBtn = el('button', { className: 'secondary-btn', text: t('resolve_back_btn') });
    backBtn.addEventListener('click', event => {
      event.preventDefault();
      navigate('#/app');
    });
    actions.appendChild(backBtn);
  }

  container.appendChild(actions);

  return container;
}

async function loadAndEnrich(): Promise<void> {
    // 2. Fetch all necessary data in parallel.
    if (isConnected()) {
        if (!state.followingArtistIds.length) {
            state.followingArtistIds = await meFollowingArtists();
        }
        // 3. Enrich all resolved artists (from cache or previous runs) with data from Spotify API.
        if (state.resolvedArtists.length > 0) {
            await enrichAndRenderArtists(state.resolvedArtists);
        }
    }
}

async function loadDataAndResolve(): Promise<void> {
    await loadAndEnrich();
    void runAutoResolve({ onComplete: renderRoute });

    if (isConnected()) {
      void meLikedTracks();
      void meSavedAlbums();
    }
}

export async function renderResolveStep(): Promise<Node> {
  // --- Phase 1: Kick off async work ---
  if (!state.sourceList && HAS_SINGLE_LIST && !state.sourceLoading) {
    void maybeAutoLoadSelectedList({ force: true });
  } else if (!state.sourceList && !HAS_SINGLE_LIST) {
    showToast(t('toast_load_list_first'), 'warning');
    navigate('#/app');
    return document.createDocumentFragment();
  }

  // --- Phase 2: Render with loading state ---
  const content = createResolveContent();
  if (state.sourceList) {
    loadDataAndResolve();
  }

  return buildShell(content, {
    activeHash: '#/resolve',
    title: t('stepper_title'),
  });
}

function isArtistFollowed(id?: string | null): boolean {
  if (!id) return false;
  return state.followingArtistIds.includes(id);
}
