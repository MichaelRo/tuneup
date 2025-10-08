import { navigate, renderRoute } from '../app/routing.js';
import { APPLY_PHASES, state, type PhaseStatus, type ApplyPhase } from '../app/state.js';
import { runPlan } from '../lib/apply.js';
import { t, formatNumber } from '../lib/i18n.js';
import { invalidateSpotifyCaches } from '../lib/spotify.js';
import { updateState } from '../lib/state.js';
import { el, setLoading, showToast } from '../lib/ui.js';

import { buildShell } from './shell.js';

async function recordOperation(): Promise<void> {
  if (!state.plan) return;
  const timestamp = new Date().toISOString();
  const { plan } = state;
  await updateState(draft => {
    plan.artistsToUnfollow.forEach(id => {
      draft.unfollowed[id] = { at: timestamp, source: state.sourceList?.title ?? 'custom' };
    });
    const key = `op-${Date.now()}`;
    draft.ops[key] = {
      at: timestamp,
      summary: `Artists: ${plan.artistsToUnfollow.length}, tracks: ${plan.trackIdsToRemove.length}, albums: ${plan.albumIdsToRemove.length}`,
    };
  });
}

async function handleApply(button: HTMLButtonElement): Promise<void> {
  if (!state.plan) return;
  try {
    setLoading(button, true);
    state.apply.status = 'running';
    state.apply.message = null;
    state.apply.progress = {
      unfollow: { done: 0, total: state.plan.artistsToUnfollow.length, retries: 0 },
      tracks: { done: 0, total: state.plan.trackIdsToRemove.length, retries: 0 },
      albums: { done: 0, total: state.plan.albumIdsToRemove.length, retries: 0 },
    };
    renderRoute();

    await runPlan(state.plan, evt => {
      const progress = state.apply.progress[evt.phase];
      if (progress) {
        progress.done = evt.done;
        progress.total = evt.total;
        progress.retries = evt.retries ?? progress.retries;
      }
      if (evt.retryAfter) {
        state.apply.message = t('apply_status_wait', { seconds: evt.retryAfter });
      } else {
        state.apply.message = null;
      }
      renderRoute();
    });

    state.apply.status = 'done';
    state.apply.completedAt = new Date().toISOString();
    await recordOperation();
    invalidateSpotifyCaches();
    showToast('Plan applied successfully.', 'success');
  } catch (err) {
    console.error(err);
    state.apply.status = 'error';
    state.apply.message = 'Apply failed. Check console logs.';
    showToast('Apply failed.', 'error');
  } finally {
    setLoading(button, false);
    renderRoute();
  }
}

function phaseTitle(phase: ApplyPhase): string {
  const keyMap = {
    unfollow: 'apply_phase_unfollow',
    tracks: 'apply_phase_tracks',
    albums: 'apply_phase_albums',
  };
  return t(keyMap[phase]);
}

function phaseStatusLabel(status: PhaseStatus): string {
  const keyMap: Record<PhaseStatus, string> = {
    pending: 'apply_phase_status_pending',
    active: 'apply_phase_status_active',
    complete: 'apply_phase_status_complete',
    skipped: 'apply_phase_status_skipped',
    stalled: 'apply_phase_status_stalled',
  };
  return t(keyMap[status]);
}

function buildPhaseBadge(status: PhaseStatus): HTMLElement {
  const symbolMap: Record<PhaseStatus, string> = {
    pending: '○',
    active: '●',
    complete: '✓',
    skipped: '—',
    stalled: '!',
  };
  return el('span', {
    className: `progress-badge progress-badge-${status}`,
    text: symbolMap[status],
    attrs: { 'aria-hidden': 'true' },
  });
}

function createApplyContent(): HTMLElement {
  if (!state.plan) {
    throw new Error('Plan is required before rendering apply content');
  }
  const container = el('div', { className: 'glass-card step step-apply' });
  container.appendChild(el('h2', { text: t('step_apply_title') }));
  container.appendChild(el('p', { text: t('apply_intro') }));

  const totals = {
    unfollow: state.plan.artistsToUnfollow.length,
    tracks: state.plan.trackIdsToRemove.length,
    albums: state.plan.albumIdsToRemove.length,
  };

  const phases = APPLY_PHASES.map((phase, index) => {
    const total = totals[phase];
    const progress = state.apply.progress[phase];
    const done = Math.min(progress?.done ?? 0, total);
    let status: PhaseStatus = 'pending';
    if (!total) {
      status = 'skipped';
    } else if (state.apply.status === 'done' || done >= total) {
      status = 'complete';
    } else if (state.apply.status === 'error') {
      status = done ? 'stalled' : 'pending';
    } else if (state.apply.status === 'running') {
      const previousPhasesFinished = APPLY_PHASES.slice(0, index).every(previousPhase => {
        const previousTotal = totals[previousPhase];
        if (!previousTotal) return true;
        return state.apply.progress?.[previousPhase]?.done ?? 0 >= previousTotal;
      });
      status = previousPhasesFinished ? 'active' : 'pending';
    }
    return { phase, total, done, status, retries: progress?.retries ?? 0 };
  });

  // TODO: Do I need it back?
  const totalWork = phases.reduce((sum, item) => sum + item.total, 0);
  const doneWork = phases.reduce((sum, item) => sum + Math.min(item.done, item.total), 0);
  const overallPercent = Math.min(
    100,
    totalWork ? Math.floor((doneWork / totalWork) * 100) : state.apply.status === 'done' ? 100 : 0,
  );

  if (totalWork) {
    const overview = el('div', { className: 'progress-block progress-overview' });
    const overviewHeader = el('div', { className: 'progress-header' });
    const headerMain = el('div', { className: 'progress-header-main' });
    headerMain.appendChild(
      el('div', { className: 'progress-title', text: t('apply_overall_progress') }),
    );
    overviewHeader.appendChild(headerMain);
    overviewHeader.appendChild(
      el('span', {
        className: `progress-status ${
          state.apply.status === 'done' ? 'progress-status-complete' : 'progress-status-active'
        }`,
        text: `${overallPercent}%`,
      }),
    );
    overview.appendChild(overviewHeader);
    const bar = el('div', { className: 'progress-bar' });
    const inner = el('div', { className: 'progress-inner' });
    inner.style.width = `${overallPercent}%`;
    bar.appendChild(inner);
    overview.appendChild(bar);
    overview.appendChild(
      el('div', {
        className: 'progress-meta',
        text: t('apply_overall_counts', {
          done: formatNumber(doneWork),
          total: formatNumber(totalWork),
        }),
      }),
    );
    container.appendChild(overview);
  }

  if (totalWork) {
    const overview = el('div', { className: 'progress-block progress-overview' });
    const overviewHeader = el('div', { className: 'progress-header' });
    const headerMain = el('div', { className: 'progress-header-main' });
    headerMain.appendChild(
      el('div', { className: 'progress-title', text: t('apply_overall_progress') }),
    );
    overviewHeader.appendChild(headerMain);
    overviewHeader.appendChild(
      el('span', {
        className: `progress-status ${
          state.apply.status === 'done' ? 'progress-status-complete' : 'progress-status-active'
        }`,
        text: `${overallPercent}%`,
      }),
    );
    overview.appendChild(overviewHeader);
    const bar = el('div', { className: 'progress-bar' });
    const inner = el('div', { className: 'progress-inner' });
    inner.style.width = `${overallPercent}%`;
    bar.appendChild(inner);
    overview.appendChild(bar);
    overview.appendChild(
      el('div', {
        className: 'progress-meta',
        text: t('apply_overall_counts', {
          done: formatNumber(doneWork),
          total: formatNumber(totalWork),
        }),
      }),
    );
    container.appendChild(overview);
  }

  const progressContainer = el('div', { className: 'apply-progress' });
  phases.forEach(({ phase, total, done, status, retries }) => {
    const block = el('div', { className: `progress-block progress-${status}` });
    const header = el('div', { className: 'progress-header' });
    const headerMain = el('div', { className: 'progress-header-main' });
    headerMain.appendChild(buildPhaseBadge(status));
    headerMain.appendChild(el('div', { className: 'progress-title', text: phaseTitle(phase) }));
    header.appendChild(headerMain);
    header.appendChild(
      el('span', {
        className: `progress-status progress-status-${status}`,
        text: phaseStatusLabel(status),
      }),
    );
    block.appendChild(header);

    if (total > 0) {
      const bar = el('div', { className: 'progress-bar' });
      const inner = el('div', { className: 'progress-inner' });
      inner.style.width = `${total ? Math.min(100, (done / total) * 100) : 100}%`;
      bar.appendChild(inner);
      block.appendChild(bar);
      block.appendChild(
        el('div', {
          className: 'progress-meta',
          text: t('apply_phase_counts', { done: formatNumber(done), total: formatNumber(total) }),
        }),
      );
    }

    if (retries > 0) {
      block.appendChild(
        el('div', {
          className: 'progress-meta progress-meta-retry',
          text: t('apply_phase_retries', { count: formatNumber(retries) }),
        }),
      );
    }
    progressContainer.appendChild(block);
  });
  container.appendChild(progressContainer);

  // TODO: Do I need it back?
  if (state.apply.message) {
    container.appendChild(
      el('div', { className: 'muted apply-message', text: state.apply.message }),
    );
  } else if (state.apply.status === 'done') {
    container.appendChild(el('div', { className: 'apply-success', text: t('apply_done') }));
  }

  const actions = el('div', { className: 'apply-actions' });
  const startBtn = el('button', { className: 'primary-btn', text: t('apply_start_btn') });
  if (state.apply.status === 'running') setLoading(startBtn, true);
  startBtn.addEventListener('click', e => {
    e.preventDefault();
    if (state.apply.status !== 'running') void handleApply(startBtn);
  });
  // TODO: Do I need it back?
  if (!totals.unfollow && !totals.tracks && !totals.albums) {
    startBtn.setAttribute('disabled', 'true');
  }
  actions.appendChild(startBtn);

  if (state.apply.status === 'done') {
    const nextBtn = el('button', { className: 'secondary-btn', text: t('apply_next_btn') });
    nextBtn.addEventListener('click', () => navigate('#/report'));
    actions.appendChild(nextBtn);
    startBtn.style.display = 'none';
  } else if (state.apply.status === 'running') {
    setLoading(startBtn, true);
  }
  container.appendChild(actions);
  return container;
}

export function renderApplyStep(): Node {
  if (!state.plan) {
    showToast('Generate a plan preview first.', 'warning');
    navigate('#/preview');
    return document.createDocumentFragment();
  }
  const content = createApplyContent();
  return buildShell(content, { activeHash: '#/apply', title: t('wizard_title') });
}
