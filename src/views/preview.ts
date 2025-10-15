import { HAS_SINGLE_LIST } from '../app/config';
import { navigate, renderRoute } from '../app/routing';
import {
  state,
  initialPreviewProgress,
  getLabelInputs,
  resetPlanExclusions,
  getArtistInputs,
} from '../app/state';
import { beginAuthFlow } from '../auth';
import { t, formatNumber } from '../lib/i18n';
import { buildPlan, getLastPlanContext, getLastFollowingSnapshot } from '../lib/planner';
import { SpotifyAuthError } from '../spotify';
import type {
  Plan,
  PlanAlbumRemoval,
  PlanProgress,
  PlanTrackRemoval,
  ResolvedArtist,
} from '../types';
import { el, setLoading, showToast, spinner } from '../ui';

import { buildArtistChip, createLoadingCard, normalizeNameForCompare } from './components.js';
import { buildShell } from './shell';
import { createSourceContent, maybeAutoLoadSelectedList } from './source.js';

function renderPlanSummary(plan: Plan): HTMLElement {
  const wrapper = el('div', { className: 'plan-summary' });
  wrapper.appendChild(el('h3', { text: t('preview_summary_title') }));
  wrapper.appendChild(buildPlanArtistSection(plan));
  wrapper.appendChild(buildPlanTrackSection(plan));
  wrapper.appendChild(buildPlanAlbumSection(plan));

  return wrapper;
}

function buildPlanArtistSection(plan: Plan): HTMLElement {
  const section = el('section', { className: 'plan-section' });
  section.appendChild(
    el('h4', {
      text: `${t('preview_summary_artists')} · ${formatNumber(plan.artistsToUnfollow.length)}`,
    }),
  );

  if (!plan.artistsToUnfollow.length) {
    section.appendChild(el('p', { className: 'plan-empty', text: t('plan_artists_empty') }));
    return section;
  } else {
    const artistLookup = new Map(
      state.resolvedArtists.map((artist: ResolvedArtist) => [artist.id, artist] as const),
    );
    const artistsToDisplay = plan.artistsToUnfollow.filter(
      id => !state.planExclusions.artists.has(id),
    );
    const grid = el('div', { className: 'plan-artist-grid' });
    artistsToDisplay.forEach((id: string) => {
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
  section.appendChild(el('h4', { text: t('preview_summary_tracks') }));
  const tracksToDisplay = plan.tracksToRemove.filter(
    track => !state.planExclusions.tracks.has(track.id),
  );
  if (!tracksToDisplay.length) {
    section.appendChild(el('p', { className: 'plan-empty', text: t('plan_tracks_empty') }));
    return section;
  }
  if (!plan.artistsToUnfollow.length) {
    section.appendChild(el('p', { className: 'plan-note', text: t('plan_tracks_note') }));
  }
  const list = el('ul', { className: 'plan-item-list' });
  tracksToDisplay.forEach((track: PlanTrackRemoval) => {
    const item = el('label', { className: 'plan-item' });
    const toggle = el('div', { className: 'toggle-switch' });
    const input = el('input', {
      attrs: { type: 'checkbox', 'data-track-id': track.id },
    }) as HTMLInputElement;
    input.checked = true;
    input.addEventListener('change', () => {
      if (input.checked) {
        state.planExclusions.tracks.delete(track.id);
      } else {
        state.planExclusions.tracks.add(track.id);
      }
      renderRoute();
    });
    toggle.appendChild(input);
    toggle.appendChild(el('span', { className: 'toggle-slider' }));
    item.appendChild(toggle);

    if (track.album?.imageUrl) {
      const trackArt = el('img', {
        className: 'roster-avatar roster-avatar--sm',
        attrs: { src: track.album.imageUrl, alt: '' },
      });
      item.appendChild(trackArt);
    }

    const trackInfo = el('div', { className: 'plan-item-info' });
    trackInfo.appendChild(
      el('div', { className: 'plan-item-title', text: track.name ?? track.id }),
    );
    const highlightSet = new Set(
      track.reasons
        .filter(reason => reason.type === 'artist')
        .map(reason => normalizeNameForCompare(reason.name ?? reason.id ?? '')),
    );
    trackInfo.appendChild(buildReasonedArtistLine(track.artistNames, highlightSet));
    if (track.albumName) {
      trackInfo.appendChild(el('div', { className: 'plan-item-meta', text: track.albumName }));
    }
    const labelReasons = track.reasons.filter(
      (reason): reason is { type: 'label'; label: string } => reason.type === 'label',
    );
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
        trackInfo.appendChild(buildLabelReason(labels));
      }
    }
    item.appendChild(trackInfo);
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function buildPlanAlbumSection(plan: Plan): HTMLElement {
  const section = el('section', { className: 'plan-section' });
  section.appendChild(el('h4', { text: t('preview_summary_albums') }));
  const albumsToDisplay = plan.albumsToRemove.filter(
    album => !state.planExclusions.albums.has(album.id),
  );
  if (!albumsToDisplay.length) {
    section.appendChild(el('p', { className: 'plan-empty', text: t('plan_albums_empty') }));
    return section;
  }
  const list = el('ul', { className: 'plan-item-list' });
  albumsToDisplay.forEach((album: PlanAlbumRemoval) => {
    const item = el('label', { className: 'plan-item' });
    const toggle = el('div', { className: 'toggle-switch' });
    const input = el('input', {
      attrs: { type: 'checkbox', 'data-album-id': album.id },
    }) as HTMLInputElement;
    input.checked = true;
    input.addEventListener('change', () => {
      if (input.checked) {
        state.planExclusions.albums.delete(album.id);
      } else {
        state.planExclusions.albums.add(album.id);
      }
      renderRoute();
    });
    toggle.appendChild(input);
    toggle.appendChild(el('span', { className: 'toggle-slider' }));
    item.appendChild(toggle);

    if (album.imageUrl) {
      const albumArt = el('img', {
        className: 'roster-avatar roster-avatar--sm',
        attrs: { src: album.imageUrl, alt: '' },
      });
      item.appendChild(albumArt);
    }
    const albumInfo = el('div', { className: 'plan-item-info' });
    albumInfo.appendChild(
      el('div', { className: 'plan-item-title', text: album.name ?? album.id }),
    );
    const highlightSet = new Set(
      album.reasons
        .filter(reason => reason.type === 'artist')
        .map(reason => normalizeNameForCompare(reason.name ?? reason.id ?? '')),
    );
    albumInfo.appendChild(buildReasonedArtistLine(album.artistNames, highlightSet));
    const labelReasons = album.reasons.filter(
      (reason): reason is { type: 'label'; label: string } => reason.type === 'label',
    );
    if (labelReasons.length) {
      const labels = Array.from(
        new Set(
          labelReasons
            .map((reason: (typeof labelReasons)[number]) => reason.label ?? '')
            .map((label: string) => label.trim())
            .filter(Boolean),
        ),
      );
      if (labels.length) {
        albumInfo.appendChild(buildLabelReason(labels));
      }
    }
    item.appendChild(albumInfo);
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

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
  const unique = labels.map(label => (label ?? '').trim()).filter(Boolean);
  const wrapper = el('div', { className: 'plan-item-label' });
  if (!unique.length) {
    return wrapper;
  }
  wrapper.appendChild(el('span', { className: 'reason-label-badge', text: t('plan_label_badge') }));
  wrapper.appendChild(
    el('span', { className: 'reason-label-prefix', text: t('plan_label_prefix') }),
  );
  unique.forEach(label => {
    wrapper.appendChild(el('span', { className: 'reason-label', text: label }));
  });
  return wrapper;
}

async function runPreview(button: HTMLButtonElement): Promise<void> {
  if (!state.resolvedArtists.length && state.options.includeLabelCleanup) {
    showToast(t('preview_artists_or_disable_labels'), 'warning');
  }
  const artistIds = state.resolvedArtists.map(a => a.id);
  const labelNames = state.options.includeLabelCleanup ? getLabelInputs().map(l => l.name) : [];
  const stages: Array<'following' | 'tracks' | 'albums' | 'enrich'> = ['following', 'tracks'];
  if (state.options.includeAlbums || labelNames.length > 0) stages.push('albums');
  if (labelNames.length > 0) stages.push('enrich');

  const stageIndexMap = new Map(stages.map((s, i) => [s, i]));

  const updatePreviewProgress = (
    stage: 'following' | 'tracks' | 'albums' | 'enrich' | 'done',
    ratio: number,
  ) => {
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
    resetPlanExclusions();
    state.previewProgress = {
      ...initialPreviewProgress(),
      running: true,
      message: t('preview_preparing'),
    };
    renderRoute();

    const plan = await buildPlan(
      {
        artistIds,
        labelNames,
        strictPrimary: state.options.strictPrimary,
        includeAlbums: state.options.includeAlbums,
      },
      {
        onProgress: (update: PlanProgress): void => {
          const stageLabels: Record<PlanProgress['stage'], string> = {
            following: t('preview_fetch_following'),
            tracks: t('preview_scan_tracks'),
            albums: t('preview_scan_albums'),
            enrich: t('preview_enrich_albums'),
            done: t('preview_ready'),
          };
          state.previewProgress.message = stageLabels[update.stage];
          const ratio = update.total
            ? Math.min(1, (update.loaded ?? 0) / update.total)
            : update.loaded
              ? 1
              : 0;
          updatePreviewProgress(update.stage, ratio);
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
    showToast(t('preview_ready'), 'success');
  } catch (err) {
    if (err instanceof SpotifyAuthError) {
      if (err.code === 'insufficient_scope') {
        showToast(t('error_insufficient_scope'), 'warning');
        void beginAuthFlow();
      } else {
        showToast(err.message, 'error');
      }
    } else if (err) {
      console.error(err);
      showToast(t('error_preview_failed'), 'error');
    }
  } finally {
    state.previewProgress.running = false;
    setLoading(button, false);
    renderRoute();
  }
}

function createPreviewContent(): HTMLElement {
  const container = el('div', { className: 'glass-card step step-preview' });
  container.appendChild(el('h2', { text: t('step_preview_title') }));
  container.appendChild(el('p', { text: t('preview_intro') }));

  const actions = el('div', { className: 'preview-actions' });
  const runBtn = el('button', { className: 'primary-btn', text: t('preview_run_btn') });
  runBtn.addEventListener('click', e => {
    e.preventDefault();
    if (state.previewProgress.running || state.plan) return;
    void runPreview(runBtn as HTMLButtonElement);
  });
  actions.appendChild(runBtn);

  const nextBtn = el('button', { className: 'secondary-btn', text: t('preview_next_btn') });
  nextBtn.addEventListener('click', event => {
    event.preventDefault();
    if (!state.plan) {
      showToast(t('generate_preview_prompt'), 'warning');
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

export function renderPreviewStep(): Node {
  if (!state.sourceList) {
    if (HAS_SINGLE_LIST) {
      void maybeAutoLoadSelectedList().then(() => renderRoute());
      return buildShell(createLoadingCard(t('source_loading')), {
        activeHash: '#/resolve',
        title: t('stepper_title'),
      });
    }
    navigate('#/app');
    return buildShell(createSourceContent(), { activeHash: '#/app', title: t('stepper_title') });
  }
  if (!getArtistInputs().length) {
    showToast(t('resolve_no_artists_in_list'), 'warning');
    if (HAS_SINGLE_LIST) {
      return buildShell(createSourceContent(), {
        activeHash: '#/resolve',
        title: t('stepper_title'),
      });
    }
    navigate('#/app');
    return buildShell(createSourceContent(), { activeHash: '#/app', title: t('stepper_title') });
  }
  if (!state.resolvedArtists.length) {
    showToast(t('resolve_artists_first'), 'warning');
    navigate('#/resolve');
    return document.createDocumentFragment();
  }
  const content = createPreviewContent();
  return buildShell(content, { activeHash: '#/preview', title: t('stepper_title') });
}