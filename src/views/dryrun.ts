import { HAS_SINGLE_LIST } from '../app/config.js';
import { navigate, renderRoute } from '../app/routing.js';
import {
  state,
  initialPreviewProgress,
  getLabelInputs,
  invalidateGeneratedPlan,
  AppState,
  getArtistInputs,
} from '../app/state.js';
import { t, formatNumber } from '../lib/i18n.js';
import { buildPlan, getLastPlanContext, getLastFollowingSnapshot } from '../lib/planner.js';
import { beginAuthFlow, SpotifyAuthError } from '../lib/spotify.js';
import { el, setLoading, showToast, spinner } from '../lib/ui.js';
import type { Plan, ResolvedArtist } from '../types/index.js';

import { buildArtistChip, createLoadingCard, normalizeNameForCompare } from './components.js';
import { buildShell } from './shell.js';
import { createSourceContent, maybeAutoLoadSelectedList } from './source.js';

function buildReasonedArtistLine(names: string[], highlights: Set<string>): HTMLElement {
  if (!names.length) {
    return el('div', { className: 'plan-item-sub', text: t('unknown_artist') });
  }
  const line = el('div', { className: 'plan-item-sub' });
  names.forEach((name, index) => {
    if (index) line.appendChild(document.createTextNode(', '));
    const normalized = normalizeNameForCompare(name);
    const span = el('span', {
      className: highlights.has(normalized) ? 'reason-artist' : undefined,
      text: name,
    });
    line.appendChild(span);
  });
  return line;
}

function buildLabelReason(labels: string[]): HTMLElement {
  // TODO: Do I need it back?
  const unique = labels
    .map(label => (label ?? '').trim())
    .filter((label): label is string => Boolean(label));
  const wrapper = el('div', { className: 'plan-item-label' });
  // TODO: Do I need it back?
  if (!unique.length) {
    wrapper.appendChild(
      el('span', { className: 'reason-label-badge', text: t('plan_label_badge') }),
    );
    wrapper.appendChild(
      el('span', { className: 'reason-label-prefix', text: t('plan_label_prefix') }),
    );
    return wrapper;
  }
  wrapper.appendChild(el('span', { className: 'reason-label-badge', text: t('plan_label_badge') }));
  wrapper.appendChild(
    el('span', { className: 'reason-label-prefix', text: t('plan_label_prefix') }),
  );
  const chips = el('div', { className: 'reason-label-chips' });
  labels.forEach(label => {
    chips.appendChild(el('span', { className: 'reason-label', text: label }));
  });
  wrapper.appendChild(chips);
  return wrapper;
}

function renderPlanSummary(plan: Plan): HTMLElement {
  const wrapper = el('div', { className: 'plan-summary' });
  wrapper.appendChild(el('h3', { text: t('dryrun_summary_title') }));
  wrapper.appendChild(buildPlanArtistSection(plan));
  wrapper.appendChild(buildPlanTrackSection(plan));
  wrapper.appendChild(buildPlanAlbumSection(plan));

  return wrapper;
}

function buildPlanArtistSection(plan: Plan): HTMLElement {
  const section = el('section', { className: 'plan-section' });
  section.appendChild(
    el('h4', {
      text: `${t('dryrun_summary_artists')} · ${formatNumber(plan.artistsToUnfollow.length)}`,
    }),
  );

  if (!plan.artistsToUnfollow.length) {
    section.appendChild(el('p', { className: 'plan-empty', text: t('plan_artists_empty') }));
    return section;
  } else {
    const artistLookup = new Map(state.resolvedArtists.map(artist => [artist.id, artist] as const));
    const grid = el('div', { className: 'plan-artist-grid' });
    plan.artistsToUnfollow.forEach(id => {
      const resolved = artistLookup.get(id);
      const artist: ResolvedArtist = resolved ?? { id, name: id, input: id };
      grid.appendChild(buildArtistChip(artist));
    });
    section.appendChild(grid);
  }
  return section;
}

function buildPlanTrackSection(plan: Plan): HTMLElement {
  const section = el('section', { className: 'plan-section' });
  section.appendChild(
    el('h4', {
      text: `${t('dryrun_summary_tracks')} · ${formatNumber(plan.tracksToRemove.length)}`,
    }),
  );
  if (!plan.tracksToRemove.length) {
    section.appendChild(el('p', { className: 'plan-empty', text: t('plan_tracks_empty') }));
    return section;
  }
  if (!plan.artistsToUnfollow.length) {
    section.appendChild(el('p', { className: 'plan-note', text: t('plan_tracks_note') }));
  }
  const list = el('ul', { className: 'plan-item-list' });
  plan.tracksToRemove.forEach(track => {
    const item = el('li', { className: 'plan-item' });
    item.appendChild(el('div', { className: 'plan-item-title', text: track.name ?? track.id }));
    const highlightSet = new Set(
      track.reasons
        .filter(reason => reason.type === 'artist')
        .map(reason => normalizeNameForCompare(reason.name ?? reason.id)),
    );
    item.appendChild(buildReasonedArtistLine(track.artistNames, highlightSet));
    if (track.albumName) {
      item.appendChild(el('div', { className: 'plan-item-meta', text: track.albumName }));
    }
    const labelReasons = track.reasons.filter(reason => reason.type === 'label');
    if (labelReasons.length) {
      const labels = Array.from(
        new Set(
          labelReasons
            .map(reason => reason.label ?? '')
            .map(label => label.trim())
            .filter(Boolean),
        ),
      );
      if (labels.length) {
        item.appendChild(buildLabelReason(labels));
      }
    }
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function buildPlanAlbumSection(plan: Plan): HTMLElement {
  const section = el('section', { className: 'plan-section' });
  section.appendChild(
    el('h4', {
      text: `${t('dryrun_summary_albums')} · ${formatNumber(plan.albumsToRemove.length)}`,
    }),
  );
  if (!plan.albumsToRemove.length) {
    section.appendChild(el('p', { className: 'plan-empty', text: t('plan_albums_empty') }));
    return section;
  }
  const list = el('ul', { className: 'plan-item-list' });
  plan.albumsToRemove.forEach(album => {
    const item = el('li', { className: 'plan-item' });
    item.appendChild(el('div', { className: 'plan-item-title', text: album.name ?? album.id }));
    const highlightSet = new Set(
      album.reasons
        .filter(reason => reason.type === 'artist')
        .map(reason => normalizeNameForCompare(reason.name ?? reason.id)),
    );
    item.appendChild(buildReasonedArtistLine(album.artistNames, highlightSet));
    const labelReasons = album.reasons.filter(reason => reason.type === 'label');
    if (labelReasons.length) {
      const labels = Array.from(
        new Set(
          labelReasons
            .map(reason => reason.label ?? '')
            .map(label => label.trim())
            .filter(Boolean),
        ),
      );
      if (labels.length) {
        item.appendChild(buildLabelReason(labels));
      }
    }
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function buildToggle(key: keyof AppState['options'], label: string): HTMLElement {
  const wrapper = el('label', { className: 'option-toggle' });
  const input = el('input', { attrs: { type: 'checkbox' } }) as HTMLInputElement;
  input.checked = state.options[key];
  input.addEventListener('change', () => {
    state.options[key] = input.checked;
    invalidateGeneratedPlan();
    renderRoute();
  });
  wrapper.appendChild(input);
  wrapper.appendChild(el('span', { text: label }));
  return wrapper;
}

async function runDryRun(button: HTMLButtonElement): Promise<void> {
  // TODO: Do I need it back?
  if (!state.resolvedArtists.length && state.options.includeLabelCleanup) {
    showToast('Resolve artists or disable label cleanup.', 'warning');
  }
  const artistIds = state.resolvedArtists.map(a => a.id);
  const labelNames = state.options.includeLabelCleanup ? getLabelInputs().map(l => l.name) : [];
  const stages: Array<'following' | 'tracks' | 'albums' | 'enrich'> = ['following', 'tracks'];
  if (state.options.includeAlbums || labelNames.length > 0) stages.push('albums');
  if (labelNames.length) stages.push('enrich');
  const stageIndexMap = new Map(stages.map((s, i) => [s, i]));

  const updatePreviewProgress = (
    stage: 'following' | 'tracks' | 'albums' | 'enrich' | 'done',
    ratio: number,
  ) => {
    // TODO: Do I need it back?
    // state.apply = initialApplyState();
    const stageIndex = stage === 'done' ? stages.length : (stageIndexMap.get(stage) ?? 0);
    const overallPercent = Math.min(1, (stageIndex + ratio) / stages.length);
    state.previewProgress = {
      ...state.previewProgress,
      running: stage !== 'done',
      percent: ratio,
      overallPercent,
      stageIndex,
      stageCount: stages.length,
    };
    renderRoute();
  };

  try {
    setLoading(button, true);
    state.previewProgress = { ...initialPreviewProgress(), running: true, message: 'Preparing...' };
    renderRoute();

    const plan = await buildPlan(
      {
        artistIds,
        labelNames,
        strictPrimary: state.options.strictPrimary,
        includeAlbums: state.options.includeAlbums,
      },
      {
        onProgress: update => {
          const stageLabels = {
            following: 'Fetching followed artists…',
            tracks: 'Scanning liked tracks…',
            albums: 'Scanning saved albums…',
            enrich: 'Gathering album details…',
            done: 'Preview ready.',
          };
          state.previewProgress.message = stageLabels[update.stage];
          const ratio = update.total
            ? Math.min(1, (update.loaded ?? 0) / update.total)
            : update.loaded
              ? 1
              : 0;
          updatePreviewProgress(update.stage, ratio);
          renderRoute();
        },
      },
    );

    state.plan = plan;
    state.followingArtistIds = getLastFollowingSnapshot();
    state.planGeneratedAt = new Date().toISOString();
    const context = getLastPlanContext();
    if (context?.totals) {
      const before = context.totals;
      const after = {
        following: Math.max(0, before.following - plan.artistsToUnfollow.length),
        likedTracks: Math.max(0, before.likedTracks - plan.trackIdsToRemove.length),
        savedAlbums: Math.max(0, before.savedAlbums - plan.albumIdsToRemove.length),
      };
      state.planMeta = { before, after };
    }
    updatePreviewProgress('done', 1);
    showToast('Preview ready.', 'success');
  } catch (err) {
    if (err instanceof SpotifyAuthError) {
      if (err.code === 'insufficient_scope') {
        showToast('Reconnect to Spotify so TuneUp can read your library.', 'warning');
        void beginAuthFlow();
      } else {
        showToast(err.message, 'error');
      }
    } else {
      console.error(err);
      showToast('Unable to generate preview.', 'error');
    }
  } finally {
    state.previewProgress.running = false;
    setLoading(button, false);
    renderRoute();
  }
}

function createDryRunContent(): HTMLElement {
  const container = el('div', { className: 'glass-card step step-dryrun' });
  container.appendChild(el('h2', { text: t('step_dryrun_title') }));
  container.appendChild(el('p', { text: t('dryrun_intro') }));

  const optionsBox = el('div', { className: 'dryrun-options' });
  optionsBox.appendChild(buildToggle('strictPrimary', t('dryrun_option_strict')));
  optionsBox.appendChild(buildToggle('includeAlbums', t('dryrun_option_albums')));
  optionsBox.appendChild(buildToggle('includeLabelCleanup', t('dryrun_option_labels')));
  container.appendChild(optionsBox);

  const actions = el('div', { className: 'dryrun-actions' });
  const runBtn = el('button', { className: 'primary-btn', text: t('dryrun_run_btn') });
  runBtn.addEventListener('click', e => {
    e.preventDefault();
    void runDryRun(runBtn as HTMLButtonElement);
  });
  actions.appendChild(runBtn);

  const nextBtn = el('button', { className: 'secondary-btn', text: t('dryrun_next_btn') });
  nextBtn.addEventListener('click', event => {
    event.preventDefault();
    if (!state.plan) {
      showToast('Generate a plan preview first.', 'warning');
      return;
    }
    navigate('#/apply');
  });
  if (!state.plan) nextBtn.setAttribute('disabled', 'true');
  actions.appendChild(nextBtn);
  container.appendChild(actions);

  if (state.previewProgress.running || state.previewProgress.overallPercent > 0) {
    const progressRow = el('div', { className: 'preview-progress' });
    if (state.previewProgress.running) {
      progressRow.appendChild(spinner('small'));
    }
    if (state.previewProgress.message) {
      progressRow.appendChild(el('span', { text: state.previewProgress.message }));
    }
    if (state.previewProgress.stageCount > 0) {
      const overallPercent = Math.round(state.previewProgress.overallPercent * 100);
      const bar = el('div', { className: 'progress-bar' });
      const inner = el('div', { className: 'progress-inner' });
      inner.style.width = `${overallPercent}%`;
      bar.appendChild(inner);
      progressRow.appendChild(bar);
      progressRow.appendChild(
        el('span', {
          className: 'preview-progress-overall',
          text: `${overallPercent}%`,
        }),
      );
    }
    container.appendChild(progressRow);
  }

  if (state.plan) {
    container.appendChild(renderPlanSummary(state.plan));
  } else {
    container.appendChild(
      el('div', { className: 'empty-state', text: t('generate_preview_prompt') }),
    );
  }

  return container;
}

export function renderDryRunStep(): Node {
  // TODO: Do I need it back?
  if (!state.sourceList) {
    if (HAS_SINGLE_LIST) {
      maybeAutoLoadSelectedList();
      return buildShell(createLoadingCard(t('source_loading')), {
        activeHash: '#/resolve',
        title: t('wizard_title'),
      });
    }
    navigate('#/app');
    return buildShell(createSourceContent(), { activeHash: '#/app', title: t('wizard_title') });
  }
  if (!getArtistInputs().length) {
    showToast('No artists to resolve in the current list.', 'warning');
    if (HAS_SINGLE_LIST) {
      return buildShell(createSourceContent(), {
        activeHash: '#/resolve',
        title: t('wizard_title'),
      });
    }
    navigate('#/app');
    return buildShell(createSourceContent(), { activeHash: '#/app', title: t('wizard_title') });
  }
  if (!state.resolvedArtists.length) {
    showToast('Resolve at least one artist first.', 'warning');
    navigate('#/resolve');
    return document.createDocumentFragment();
  }
  const content = createDryRunContent();
  return buildShell(content, { activeHash: '#/dryrun', title: t('wizard_title') });
}
