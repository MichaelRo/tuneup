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
  // Implementation moved here from main.ts
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
        resolvedFromCache.push({ input: name, id: entry.id, name, followers: 0 }); // Followers unknown from cache
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
      renderRoute();
    }
  } catch (err) {
    console.warn('Unable to hydrate cached resolutions', err);
  }
}

function applyResolveResult(
  pendingSnapshot: string[],
  result: ResolveArtistsResult,
): {
  changed: boolean;
  resolvedCount: number;
  skippedCount: number;
  unresolvedCount: number;
  cancelled: boolean;
} {
  // Implementation moved here from main.ts
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
  showToast(`Queued ${entry.input} for another review.`, 'info');
}

async function requeueSkippedArtist(name: string): Promise<void> {
  state.skippedArtists = state.skippedArtists.filter(item => item !== name);
  state.pendingArtists = uniqueNames([name, ...state.pendingArtists]);
  await forgetCachedDecision(name);
  invalidateGeneratedPlan();
  renderRoute();
  showToast(`Added ${name} back to pending.`, 'success');
}

async function skipPendingArtist(name: string): Promise<void> {
  state.pendingArtists = state.pendingArtists.filter(item => item !== name);
  state.skippedArtists = uniqueNames([...state.skippedArtists, name]);
  await persistSkipDecision(name);
  invalidateGeneratedPlan();
  renderRoute();
  showToast(`${name} marked as skipped.`, 'info');
}

// TODO: This should be a constant
function limitForRosterButton(): number {
  return 8;
}

async function runAutoResolve(options: { force?: boolean } = {}): Promise<void> {
  // Implementation moved here from main.ts
  if (autoResolveInFlight) return;
  if (!state.sourceList || !isConnected() || !state.pendingArtists.length) return;
  if (!options.force && state.autoResolveAttempted) return;

  autoResolveInFlight = true;
  state.autoResolveAttempted = true;
  state.resolutionRunning = true;
  renderRoute();

  try {
    const pendingSnapshot = [...state.pendingArtists];
    const result = await resolveArtists(pendingSnapshot.map(name => ({ type: 'artist', name })));
    const outcome = applyResolveResult(pendingSnapshot, result);
    state.autoResolveCompleted = !outcome.cancelled;

    const parts: string[] = [];
    if (outcome.resolvedCount) {
      const label = outcome.resolvedCount === 1 ? 'artist' : 'artists';
      parts.push(`Auto-resolved ${outcome.resolvedCount} ${label}`);
    }
    if (outcome.skippedCount) {
      const label = outcome.skippedCount === 1 ? 'entry' : 'entries';
      parts.push(`Skipped ${outcome.skippedCount} unmatched ${label}`);
    }

    if (parts.length) {
      showToast(parts.join(' · '), outcome.resolvedCount ? 'success' : 'info');
    } else if (state.pendingArtists.length) {
      showToast('No automatic matches found. Use guided review.', 'info');
    }
  } catch (err) {
    console.error(err);
    showToast('Automatic artist matching failed.', 'error');
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
  // Implementation moved here from main.ts
  const choices = candidates.slice(0, 5).map(candidate => ({
    label: candidate.name,
    subtitle: `${formatNumber(candidate.followers ?? 0)} followers`,
    value: candidate,
  }));

  let skipped = false;
  const selection = await showChoiceModal({
    title: input,
    description: 'Select the correct artist',
    choices,
    skipLabel: 'Skip artist',
    cancelLabel: 'Stop',
    onSkip: () => {
      skipped = true;
    },
  });

  if (skipped) return { choice: null, skipped: true };
  if (!selection) return { choice: null, cancel: true };
  return { choice: selection };
}

function buildResolveStatusBanner(pendingCount: number, skippedCount: number): HTMLElement | null {
  // TODO: all of those texts should be in translations (look for others as well)
  // Implementation moved here from main.ts
  if (!isConnected()) {
    return el('div', {
      className: 'resolve-banner resolve-banner-warning',
      text: 'Connect with Spotify to run the automatic match scan.',
    });
  }
  if (!state.autoResolveAttempted && state.pendingArtists.length) {
    return el('div', {
      className: 'resolve-banner resolve-banner-info',
      text: 'We’ll auto-scan for exact matches. Most petitions resolve without manual work.',
    });
  }
  if (state.resolutionRunning) {
    return el('div', {
      className: 'resolve-banner resolve-banner-info',
      text: 'Scanning your queue for exact matches…',
    });
  }
  if (state.autoResolveAttempted && !state.autoResolveCompleted && pendingCount) {
    return el('div', {
      className: 'resolve-banner resolve-banner-warning',
      text: 'Automatic scan is paused. Use the guided review or quick queue to finish matching.',
    });
  }
  if (!pendingCount) {
    const text = skippedCount
      ? `Scan finished. ${skippedCount} entries were skipped.`
      : 'Scan finished. All artists matched!';
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
    button.addEventListener('click', () => {
      if (resolvePreviewSort === mode) return;
      resolvePreviewSort = mode;
      renderRoute();
    });
    return button;
  };
  control.appendChild(buildOption('followers', 'Popularity'));
  control.appendChild(buildOption('name', 'A → Z'));
  control.appendChild(buildOption('recent', 'Recent'));
  return control;
}

// TODO: 8 here should be taken from that const
function buildResolvedPreviewGrid(limit = 8): HTMLElement {
  // Implementation moved here from main.ts
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

function buildRosterLinkButton(): HTMLButtonElement {
  const button = el('button', {
    className: 'text-link',
    text: 'View artist list',
  }) as HTMLButtonElement;
  button.addEventListener('click', event => {
    event.preventDefault();
    showArtistRosterModal();
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
        showToast(`Resolved ${top.input} → ${top.name}.`, 'success');
      }
    } else if (outcome.skippedCount) {
      showToast(`${name} skipped for now.`, 'info');
    } else if (outcome.unresolvedCount && !outcome.cancelled) {
      showToast(`Still ambiguous: ${name}.`, 'warning');
    }
    if (outcome.cancelled) {
      showToast('Review cancelled. Artist remains in the queue.', 'info');
    }
  } catch (err) {
    console.error(err);
    showToast('Unable to review this artist right now.', 'error');
  } finally {
    setLoading(button, false);
    onComplete();
    renderRoute();
  }
}

function showArtistRosterModal(): void {
  const body = el('div', { className: 'artist-roster-modal' });

  const renderSummary = (): HTMLElement => {
    const summary = el('div', { className: 'roster-summary' });
    summary.appendChild(createMetricCard('Resolved', formatNumber(state.resolvedArtists.length)));
    summary.appendChild(createMetricCard('Pending', formatNumber(state.pendingArtists.length)));
    summary.appendChild(createMetricCard('Skipped', formatNumber(state.skippedArtists.length)));
    return summary;
  };

  const renderResolved = (): HTMLElement => {
    const section = el('section', { className: 'roster-group' });
    section.appendChild(
      el('h4', { text: `Matched (${formatNumber(state.resolvedArtists.length)})` }),
    );
    if (!state.resolvedArtists.length) {
      section.appendChild(el('div', { className: 'muted', text: t('no_artists_resolved') }));
      return section;
    }
    const scroll = el('div', { className: 'roster-scroll' });
    const list = el('ul', { className: 'roster-list' });
    state.resolvedArtists.forEach(entry => {
      const row = el('li', { className: 'roster-row' });
      const info = buildArtistInfo(entry, { showSourceDiff: true });
      row.appendChild(info);
      const actions = el('div', { className: 'roster-row-actions' });
      const undoBtn = el('button', {
        className: 'secondary-btn',
        text: 'Unmatch',
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
  };

  const renderPending = (): HTMLElement => {
    const section = el('section', { className: 'roster-group' });
    section.appendChild(
      el('h4', { text: `Pending (${formatNumber(state.pendingArtists.length)})` }),
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
        text: 'Review',
      }) as HTMLButtonElement;
      reviewBtn.addEventListener('click', () => {
        void reviewSingleArtist(name, reviewBtn, () => rerender());
      });
      actions.appendChild(reviewBtn);
      const skipBtn = el('button', {
        className: 'secondary-btn',
        text: 'Skip',
      }) as HTMLButtonElement;
      skipBtn.addEventListener('click', async () => {
        skipBtn.disabled = true;
        try {
          await skipPendingArtist(name);
          rerender();
        } catch (err) {
          console.error(err);
          showToast('Unable to skip artist right now.', 'error');
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
  };

  const renderSkipped = (): HTMLElement => {
    const section = el('section', { className: 'roster-group' });
    section.appendChild(
      el('h4', { text: `Skipped (${formatNumber(state.skippedArtists.length)})` }),
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
        text: 'Requeue',
      }) as HTMLButtonElement;
      retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        try {
          await requeueSkippedArtist(name);
          rerender();
        } catch (err) {
          console.error(err);
          showToast('Unable to requeue artist.', 'error');
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
  };

  const rerender = (): void => {
    body.innerHTML = '';
    body.appendChild(renderSummary());
    body.appendChild(renderResolved());
    body.appendChild(renderPending());
    body.appendChild(renderSkipped());
  };

  rerender();
  showSimpleModal({ title: 'Review artist matches', body });
}

function createResolveContent(): HTMLElement {
  // Implementation moved here from main.ts
  void runAutoResolve();

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
    createMetricCard('Matched', `${formatNumber(resolvedCount)} / ${formatNumber(total)}`),
  );
  const pendingValue = pendingCount ? formatNumber(pendingCount) : 'All matched';
  const pendingLabel = pendingCount ? 'Pending' : 'Ready';
  metrics.appendChild(createMetricCard(pendingLabel, pendingValue));
  metrics.appendChild(createMetricCard('Skipped', formatNumber(skippedCount)));
  container.appendChild(metrics);

  const banner = buildResolveStatusBanner(pendingCount, skippedCount);
  if (banner) {
    container.appendChild(banner);
  }

  const previewSection = el('div', { className: 'list-summary' });
  if (state.resolvedArtists.length) {
    const header = el('div', { className: 'resolved-preview-header' });
    header.appendChild(el('strong', { text: 'Matched artists' }));
    const controls = el('div', { className: 'resolved-preview-controls' });
    if (state.resolvedArtists.length > limitForRosterButton()) {
      controls.appendChild(buildRosterLinkButton());
    }
    if (state.resolvedArtists.length > 1) {
      controls.appendChild(buildResolvedPreviewSort());
    }
    header.appendChild(controls);
    previewSection.appendChild(header);
    previewSection.appendChild(buildResolvedPreviewGrid());
  }
  // TODO: Do I need it back?
  if (pendingCount) {
    previewSection.appendChild(
      el('div', {
        className: 'resolve-status-chip is-pending',
        text: `${formatNumber(pendingCount)} artist${pendingCount === 1 ? '' : 's'} need review`,
      }),
    );
  }
  container.appendChild(previewSection);

  if (!pendingCount && isConnected() && state.resolvedArtists.length) {
    container.appendChild(
      el('div', {
        className: 'muted resolve-followup-note',
        text: 'Automatic scan finished. You can reload the list anytime to refresh matches.',
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
        showToast('Connect with Spotify to continue.', 'warning');
        return;
      }
      try {
        if (!state.pendingArtists.length) {
          showToast('All artists are already resolved.', 'info');
          return;
        }
        setLoading(resolveBtn, true);
        state.autoResolveAttempted = true;
        state.resolutionRunning = true;
        // TODO: Do I need it?
        // renderRoute();
        const pendingSnapshot = [...state.pendingArtists];
        const result = await resolveArtists(
          pendingSnapshot.map(name => ({ type: 'artist', name })),
          { onAmbiguity: handleAmbiguity },
        );
        const outcome = applyResolveResult(pendingSnapshot, result);
        state.autoResolveCompleted = !outcome.cancelled;
        if (outcome.resolvedCount) {
          showToast(
            `Resolved ${outcome.resolvedCount} artist${outcome.resolvedCount === 1 ? '' : 's'}.`,
            'success',
          );
        }
        if (outcome.skippedCount) {
          showToast(
            `Skipped ${outcome.skippedCount} artist${outcome.skippedCount === 1 ? '' : 's'} based on your choices.`,
            'info',
          );
        }
        if (!outcome.resolvedCount && !outcome.skippedCount && !outcome.unresolvedCount) {
          showToast('No changes this round.', 'info');
        }
        if (outcome.unresolvedCount && !outcome.cancelled) {
          showToast(
            `Still ambiguous: ${outcome.unresolvedCount} artist${outcome.unresolvedCount === 1 ? '' : 's'}.`,
            'warning',
          );
        }
        if (outcome.cancelled) {
          showToast('Guided review paused. Remaining artists stay in the queue.', 'info');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to resolve artists.', 'error');
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
    if (!state.resolvedArtists.length) {
      showToast('Resolve at least one artist before continuing.', 'warning');
      return;
    }
    navigate('#/preview');
  });
  if (!state.resolvedArtists.length) {
    nextBtn.setAttribute('disabled', 'true');
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
        title: t('wizard_title'),
      });
    }
    showToast('Load a list first.', 'warning');
    navigate('#/app');
    return renderSourceStep();
  }

  void hydrateResolvedFromCache();
  const content = createResolveContent();
  return buildShell(content, { activeHash: '#/resolve', title: t('wizard_title') });
}
