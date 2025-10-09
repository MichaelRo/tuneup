import { curatedLists, HAS_SINGLE_LIST, FIRST_STEP_HASH } from '../app/config';
import { navigate, renderRoute } from '../app/routing';
import {
  state,
  isConnected,
  getArtistCount,
  getLabelCount,
  extractArtistNames,
  invalidateGeneratedPlan,
  initialPreviewProgress,
  autoLoadedLists,
  getArtistInputs,
} from '../app/state';
import { t, formatNumber } from '../lib/i18n';
import { loadCuratedList } from '../lib/providers';
import { el, showToast, spinner } from '../lib/ui';

import { createMetricCard } from './components';
import { renderResolveStep } from './resolve';
import { buildShell } from './shell';

function applyNewSource(list: import('../types/index.js').ArtistList): void {
  state.sourceList = list;
  state.resolvedArtists = [];
  state.pendingArtists = extractArtistNames(list);
  state.skippedArtists = [];
  state.followingArtistIds = [];
  state.resolutionRunning = false;
  state.autoResolveAttempted = false;
  state.autoResolveCompleted = false;
  invalidateGeneratedPlan();
  state.previewProgress = initialPreviewProgress();
}

export function maybeAutoLoadSelectedList(options: { force?: boolean } = {}): void {
  if (!options.force) {
    if (state.sourceList || state.sourceLoading || autoLoadedLists.has(state.selectedListId)) {
      return;
    }
  }

  autoLoadedLists.add(state.selectedListId);

  void (async () => {
    try {
      state.sourceLoading = true;
      renderRoute();
      const list = await loadCuratedList(state.selectedListId);
      applyNewSource(list);
      showToast(
        t('source_loaded_counts', {
          artists: formatNumber(getArtistCount(list)),
          labels: formatNumber(getLabelCount(list)),
        }),
        'success',
      );
    } catch (err) {
      console.warn('Auto-load list failed', err);
      showToast(t('error_load_list'), 'warning');
    } finally {
      state.sourceLoading = false;
      renderRoute();
    }
  })();
}

function renderSourceSummary(list: import('../types/index.js').ArtistList): HTMLElement {
  const artists = getArtistCount(list);
  const labels = getLabelCount(list);
  const currentConfig = curatedLists.find(entry => entry.id === state.selectedListId);
  const summary = el('div', { className: 'list-summary' });

  if (currentConfig) {
    summary.appendChild(el('strong', { text: currentConfig.title }));
    if (currentConfig.subtitle) {
      summary.appendChild(el('div', { className: 'provider-meta', text: currentConfig.subtitle }));
    }
  }

  const metrics = el('div', { className: 'metric-row' });
  metrics.appendChild(createMetricCard(t('metric_artists'), formatNumber(artists)));
  metrics.appendChild(createMetricCard(t('metric_labels'), formatNumber(labels)));
  summary.appendChild(metrics);

  if (list.version) {
    summary.appendChild(
      el('div', {
        className: 'provider-meta',
        text: t('source_version_label', { version: list.version }),
      }),
    );
  }
  if (list.sourceUrl) {
    summary.appendChild(
      el('a', {
        className: 'provider-meta summary-link',
        attrs: { href: list.sourceUrl, target: '_blank', rel: 'noopener' },
        text: list.sourceUrl,
      }),
    );
  }

  return summary;
}

export function createSourceContent(): HTMLElement {
  const container = el('div', { className: 'glass-card step step-source' });
  container.appendChild(el('h2', { text: t('step_source_title') }));
  const activeConfig = curatedLists.find(list => list.id === state.selectedListId);
  if (activeConfig?.subtitle) {
    container.appendChild(el('p', { text: activeConfig.subtitle }));
  } else {
    container.appendChild(el('p', { text: t('source_intro') }));
  }
  const providerGrid = el('div', { className: 'provider-grid' });
  curatedLists.forEach(list => {
    const card = el('button', {
      className: `provider-card${state.selectedListId === list.id ? ' is-active' : ''}`,
      attrs: { type: 'button' },
    });
    card.appendChild(el('h3', { text: list.title }));
    if (list.badge) {
      card.appendChild(el('span', { className: 'provider-badge', text: list.badge }));
    }
    if (list.subtitle) {
      card.appendChild(el('div', { className: 'provider-meta', text: list.subtitle }));
    }
    if (list.description) {
      card.appendChild(el('div', { className: 'provider-meta', text: list.description }));
    }
    card.addEventListener('click', () => {
      if (state.selectedListId !== list.id) {
        state.selectedListId = list.id;
        state.sourceLoading = false;
        state.sourceList = null; // Invalidate source list on selection change
        renderRoute();
      }
    });
    providerGrid.appendChild(card);
  });
  container.appendChild(providerGrid);

  const actions = el('div', { className: 'provider-action' });
  const loadBtn = el('button', { className: 'primary-btn', text: t('source_load_btn') });
  loadBtn.addEventListener('click', async event => {
    event.preventDefault();
    if (!isConnected()) {
      showToast(t('resolve_connect_first'), 'warning');
      return;
    }
    maybeAutoLoadSelectedList();
  });
  actions.appendChild(loadBtn);

  const nextBtn = el('button', { className: 'secondary-btn', text: t('source_next_btn') });
  nextBtn.addEventListener('click', event => {
    event.preventDefault();
    if (!state.sourceList) {
      showToast(t('toast_load_list_first'), 'warning');
      return;
    }
    navigate('#/resolve');
  });
  if (!state.sourceList || !getArtistInputs().length) {
    nextBtn.setAttribute('disabled', 'true');
  }
  actions.appendChild(nextBtn);
  container.appendChild(actions);

  if (state.sourceList) {
    container.appendChild(renderSourceSummary(state.sourceList));
  } else if (state.sourceLoading) {
    const loadingRow = el('div', { className: 'source-loading' });
    loadingRow.appendChild(spinner());
    loadingRow.appendChild(el('span', { text: t('source_loading') }));
    container.appendChild(loadingRow);
  }

  return container;
}

export function renderSourceStep(): Node {
  if (HAS_SINGLE_LIST) {
    navigate(FIRST_STEP_HASH);
    return renderResolveStep();
  }
  const content = createSourceContent();
  maybeAutoLoadSelectedList();
  return buildShell(content, { activeHash: '#/app', title: t('stepper_title') });
}
