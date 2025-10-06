import { runPlan } from './lib/apply.js';
import {
  initI18n,
  t,
  onLangChange,
  bindLanguageToggles,
  getLang,
  formatNumber,
} from './lib/i18n.js';
import { buildPlan, getLastPlanContext, getLastFollowingSnapshot } from './lib/planner.js';
import { getCuratedLists, loadCuratedList } from './lib/providers.js';
import { exportJson, exportCsv } from './lib/report.js';
import {
  resolveArtists,
  canonicalName,
  type ArtistCandidate,
  type ResolveArtistsResult,
} from './lib/resolver.js';
import {
  beginAuthFlow,
  handleAuthCallback,
  hasToken,
  SpotifyAuthError,
  clearToken,
  invalidateSpotifyCaches,
} from './lib/spotify.js';
import { loadState, updateState } from './lib/state.js';
import {
  render,
  renderNode,
  el,
  showToast,
  showChoiceModal,
  spinner,
  setLoading,
  showSimpleModal,
} from './lib/ui.js';
import './styles/global.css';
import type { ArtistList, Item, Plan, PlanContext, ResolvedArtist } from './types/index.js';

const ROUTE_DEFAULT = '#/' as const;
const curatedLists = getCuratedLists();
const HAS_SINGLE_LIST = curatedLists.length === 1;

const STEP_ROUTES = HAS_SINGLE_LIST
  ? ([
      { hash: '#/resolve' as const, key: 'step_resolve_title' },
      { hash: '#/dryrun' as const, key: 'step_dryrun_title' },
      { hash: '#/apply' as const, key: 'step_apply_title' },
      { hash: '#/report' as const, key: 'step_report_title' },
    ] as const)
  : ([
      { hash: '#/app' as const, key: 'step_source_title' },
      { hash: '#/resolve' as const, key: 'step_resolve_title' },
      { hash: '#/dryrun' as const, key: 'step_dryrun_title' },
      { hash: '#/apply' as const, key: 'step_apply_title' },
      { hash: '#/report' as const, key: 'step_report_title' },
    ] as const);

type WizardRoute = (typeof STEP_ROUTES)[number]['hash'] | typeof ROUTE_DEFAULT;

const ALL_ROUTES: WizardRoute[] = [ROUTE_DEFAULT, ...STEP_ROUTES.map(route => route.hash)];
const FIRST_STEP_HASH = STEP_ROUTES[0]?.hash ?? '#/resolve';

const APPLY_PHASES = ['unfollow', 'tracks', 'albums'] as const;
type ApplyPhase = (typeof APPLY_PHASES)[number];

type ApplyPhaseState = {
  done: number;
  total: number;
  retries: number;
};

type ApplyStatus = 'idle' | 'running' | 'done' | 'error';

type PhaseStatus = 'pending' | 'active' | 'complete' | 'skipped' | 'stalled';

type ApplyState = {
  status: ApplyStatus;
  progress: Record<ApplyPhase, ApplyPhaseState>;
  message: string | null;
  completedAt: string | null;
};

type PlanMetaSnapshot = {
  before: PlanContext['totals'] | null;
  after: PlanContext['totals'] | null;
};

type AppState = {
  selectedListId: string;
  sourceList: ArtistList | null;
  sourceLoading: boolean;
  resolvedArtists: ResolvedArtist[];
  pendingArtists: string[];
  skippedArtists: string[];
  followingArtistIds: string[];
  resolutionRunning: boolean;
  plan: Plan | null;
  planGeneratedAt: string | null;
  planMeta: PlanMetaSnapshot;
  options: {
    strictPrimary: boolean;
    includeAlbums: boolean;
    includeLabelCleanup: boolean;
  };
  apply: ApplyState;
  autoResolveAttempted: boolean;
  autoResolveCompleted: boolean;
  previewProgress: {
    running: boolean;
    message: string | null;
    percent: number;
    overallPercent: number;
    stageIndex: number;
    stageCount: number;
  };
};

const rootElement = document.getElementById('app-root');
if (!(rootElement instanceof HTMLElement)) {
  throw new Error('Missing #app-root container');
}
const root: HTMLElement = rootElement;

function initialApplyState(): ApplyState {
  return {
    status: 'idle',
    progress: {
      unfollow: { done: 0, total: 0, retries: 0 },
      tracks: { done: 0, total: 0, retries: 0 },
      albums: { done: 0, total: 0, retries: 0 },
    },
    message: null,
    completedAt: null,
  };
}

function initialPreviewProgress(): AppState['previewProgress'] {
  return {
    running: false,
    message: null,
    percent: 0,
    overallPercent: 0,
    stageIndex: 0,
    stageCount: 0,
  };
}

const DEFAULT_LIST_ID = curatedLists[0]?.id ?? 'nmg';

const state: AppState = {
  selectedListId: DEFAULT_LIST_ID,
  sourceList: null,
  sourceLoading: false,
  resolvedArtists: [],
  pendingArtists: [],
  skippedArtists: [],
  followingArtistIds: [],
  resolutionRunning: false,
  plan: null,
  planGeneratedAt: null,
  planMeta: { before: null, after: null },
  options: {
    strictPrimary: false,
    includeAlbums: true,
    includeLabelCleanup: true,
  },
  apply: initialApplyState(),
  autoResolveAttempted: false,
  autoResolveCompleted: false,
  previewProgress: initialPreviewProgress(),
};

let connected = hasToken();
const autoLoadedLists = new Set<string>();
let autoResolveInFlight = false;
let resolvePreviewSort: 'recent' | 'name' = 'recent';
let followingLookup = new Set<string>();

function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach(value => {
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
}

function invalidateGeneratedPlan(): void {
  state.plan = null;
  state.planGeneratedAt = null;
  state.planMeta = { before: null, after: null };
  state.apply = initialApplyState();
}

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
    if (!cache) return;

    const pendingSnapshot = [...state.pendingArtists];
    const resolvedFromCache: ResolvedArtist[] = [];
    const skippedFromCache: string[] = [];
    const remaining: string[] = [];
    const seenInputs = new Set(state.resolvedArtists.map(item => item.input));
    const seenIds = new Set(state.resolvedArtists.map(item => item.id));

    pendingSnapshot.forEach(name => {
      const entry = cache[name] ?? cache[canonicalName(name)];
      if (!entry) {
        remaining.push(name);
        return;
      }
      if (entry.id === '__skip__' || entry.id === '__missing__') {
        skippedFromCache.push(name);
        return;
      }
      if (!entry.id) {
        remaining.push(name);
        return;
      }
      if (seenInputs.has(name) || seenIds.has(entry.id)) {
        return;
      }
      resolvedFromCache.push({ input: name, id: entry.id, name });
      seenInputs.add(name);
      seenIds.add(entry.id);
    });

    if (!resolvedFromCache.length && !skippedFromCache.length) {
      return;
    }

    if (resolvedFromCache.length) {
      state.resolvedArtists = [...state.resolvedArtists, ...resolvedFromCache];
    }
    if (skippedFromCache.length) {
      state.skippedArtists = uniqueNames([...state.skippedArtists, ...skippedFromCache]);
    }
    state.pendingArtists = uniqueNames(remaining);
    invalidateGeneratedPlan();
    renderRoute();
  } catch (err) {
    console.warn('Unable to hydrate cached resolutions', err);
  }
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
  }
  const artistLookup = new Map(state.resolvedArtists.map(artist => [artist.id, artist] as const));
  const grid = el('div', { className: 'plan-artist-grid' });
  plan.artistsToUnfollow.forEach(id => {
    const resolved = artistLookup.get(id);
    const artist: ResolvedArtist = resolved ?? { id, name: id, input: id };
    grid.appendChild(buildArtistChip(artist));
  });
  section.appendChild(grid);
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

function buildReasonedArtistLine(names: string[], highlights: Set<string>): HTMLElement {
  if (!names.length) {
    return el('div', { className: 'plan-item-sub', text: t('unknown_artist') });
  }
  const line = el('div', { className: 'plan-item-sub' });
  names.forEach((name, index) => {
    if (index) {
      line.appendChild(document.createTextNode(', '));
    }
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
  const unique = labels
    .map(label => (label ?? '').trim())
    .filter((label): label is string => Boolean(label));
  const wrapper = el('div', { className: 'plan-item-label' });
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
  unique.forEach(label => {
    chips.appendChild(el('span', { className: 'reason-label', text: label }));
  });
  wrapper.appendChild(chips);
  return wrapper;
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

async function runAutoResolve(options: { force?: boolean } = {}): Promise<void> {
  if (autoResolveInFlight) return;
  if (!state.sourceList) return;
  if (!isConnected()) return;
  if (!state.pendingArtists.length) return;
  if (!options.force && state.autoResolveAttempted) return;

  autoResolveInFlight = true;
  state.autoResolveAttempted = true;
  state.autoResolveCompleted = false;
  state.resolutionRunning = true;
  window.setTimeout(() => renderRoute(), 0);

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
      const tone = outcome.resolvedCount ? 'success' : 'info';
      showToast(parts.join(' · '), tone);
    } else if (state.pendingArtists.length) {
      showToast('No automatic matches found. Use guided review for the remaining artists.', 'info');
    }
  } catch (err) {
    console.error(err);
    state.autoResolveCompleted = false;
    showToast('Automatic artist matching failed. Try again with guided review.', 'error');
  } finally {
    state.resolutionRunning = false;
    autoResolveInFlight = false;
    window.setTimeout(() => renderRoute(), 0);
  }
}

function buildResolveStatusBanner(pendingCount: number, skippedCount: number): HTMLElement | null {
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
      ? `Automatic scan finished. ${formatNumber(skippedCount)} entr${skippedCount === 1 ? 'y was' : 'ies were'} skipped and will stay out of the plan unless you review them.`
      : 'Automatic scan finished. Everything matched—jump to the plan preview when you are ready.';
    return el('div', {
      className: 'resolve-banner resolve-banner-success',
      text,
    });
  }
  return null;
}

const routeHandlers = new Map<WizardRoute, () => string | Node>();
routeHandlers.set(ROUTE_DEFAULT, renderLanding);
STEP_ROUTES.forEach(({ hash }) => {
  routeHandlers.set(hash, () => {
    switch (hash) {
      case '#/app':
        return renderSourceStep();
      case '#/resolve':
        return renderResolveStep();
      case '#/dryrun':
        return renderDryRunStep();
      case '#/apply':
        return renderApplyStep();
      case '#/report':
        return renderReportStep();
      default:
        return renderLanding();
    }
  });
});

function normalizeHash(raw: string): WizardRoute {
  if (!raw || raw === '#') return ROUTE_DEFAULT;
  const candidate = raw as WizardRoute;
  return ALL_ROUTES.includes(candidate) ? candidate : ROUTE_DEFAULT;
}

function navigate(hash: WizardRoute): void {
  if (location.hash === hash) {
    renderRoute();
  } else {
    location.hash = hash;
  }
}

type Renderer = () => string | Node;

function renderRoute(): void {
  const hash = normalizeHash(location.hash);
  const renderer: Renderer | undefined =
    routeHandlers.get(hash) ?? routeHandlers.get(ROUTE_DEFAULT);
  if (!renderer) return;
  const output = renderer();
  if (output instanceof Node) {
    renderNode(output, root);
  } else {
    render(output, root);
  }
  postRender(hash);
}

function postRender(hash: WizardRoute): void {
  bindLanguageToggles(root);
  if (hash === ROUTE_DEFAULT) {
    const connectBtn = root.querySelector<HTMLButtonElement>('[data-action="connect"]');
    if (connectBtn && !isConnected()) {
      connectBtn.addEventListener('click', event => {
        event.preventDefault();
        void beginAuthFlow();
      });
    }
  }
}

// Accessibility: Add ARIA live region for toasts if not present
const ensureToastLiveRegion = () => {
  let toastRegion = document.getElementById('toast-live-region');
  if (!toastRegion) {
    toastRegion = document.createElement('div');
    toastRegion.id = 'toast-live-region';
    toastRegion.setAttribute('aria-live', 'polite');
    toastRegion.setAttribute('role', 'status');
    toastRegion.style.position = 'absolute';
    toastRegion.style.left = '-9999px';
    document.body.appendChild(toastRegion);
  }
};

// Patch showToast to update ARIA live region
const originalShowToast = showToast;
function showToastWithAria(message: string, tone?: string) {
  ensureToastLiveRegion();
  const toastRegion = document.getElementById('toast-live-region');
  if (toastRegion) toastRegion.textContent = message;
  // Map tone to ToastType or default to 'info'
  const validTones = ['info', 'success', 'error', 'warning'] as const;
  const toastType = validTones.includes(tone as (typeof validTones)[number])
    ? (tone as (typeof validTones)[number])
    : 'info';
  return originalShowToast(message, toastType);
}
// Replace showToast globally
window.showToast = showToastWithAria;

function renderLanding(): Node {
  const main = el('div');

  const hero = el('section', { className: 'hero-banner' });
  const heroStack = el('div', { className: 'header-stack' });
  heroStack.appendChild(el('h1', { text: t('hero_title') }));
  heroStack.appendChild(el('p', { text: t('hero_sub') }));
  if (HAS_SINGLE_LIST && curatedLists[0]) {
    heroStack.appendChild(
      el('p', {
        text: `${curatedLists[0].title} · ${curatedLists[0].description ?? 'Live petition roster'}`,
        className: 'muted',
      }),
    );
  }
  const badges = el('div', { className: 'list-badges' });
  [t('pill_transparent'), t('pill_secure'), t('pill_control')].forEach(text => {
    badges.appendChild(el('span', { className: 'badge', text }));
  });
  heroStack.appendChild(badges);
  hero.appendChild(heroStack);

  const heroActions = el('div', { className: 'hero-actions' });
  if (!isConnected()) {
    const connectBtn = el('button', {
      className: 'primary-btn',
      attrs: { 'data-action': 'connect' },
      text: t('cta_connect'),
    });
    heroActions.appendChild(connectBtn);
  } else {
    heroActions.appendChild(buildAuthStatusControls());
    heroActions.appendChild(
      el('a', {
        className: 'primary-btn',
        attrs: { href: FIRST_STEP_HASH },
        text: t('cta_open_wizard'),
      }),
    );
  }

  const githubLink = el('a', {
    className: 'secondary-btn',
    attrs: {
      href: 'https://github.com/your-org/tuneup',
      'data-action': 'github',
      target: '_blank',
      rel: 'noopener',
    },
    text: t('cta_github'),
  });
  heroActions.appendChild(githubLink);
  hero.appendChild(heroActions);

  const heroHighlight = el('div', { className: 'hero-highlight' });
  heroHighlight.appendChild(el('p', { text: t('dryrun_intro') }));
  const metrics = el('div', { className: 'metric-row' });
  metrics.appendChild(createMetricCard('Steps', String(STEP_ROUTES.length)));
  if (state.sourceList) {
    metrics.appendChild(
      createMetricCard('Artists', formatNumber(getArtistCount(state.sourceList))),
    );
    metrics.appendChild(createMetricCard('Labels', formatNumber(getLabelCount(state.sourceList))));
  } else {
    metrics.appendChild(createMetricCard('Lists', formatNumber(curatedLists.length)));
    metrics.appendChild(createMetricCard('Dry-run first', 'Always'));
  }
  heroHighlight.appendChild(metrics);
  hero.appendChild(heroHighlight);

  main.appendChild(hero);

  const capabilityCard = el('section', { className: 'surface-card' });
  capabilityCard.appendChild(el('h2', { text: t('does_title') }));
  capabilityCard.appendChild(el('p', { text: t('does_list') }));
  main.appendChild(capabilityCard);

  const sourcesCard = el('section', { className: 'surface-card' });
  sourcesCard.appendChild(el('h2', { text: t('list_title') }));
  sourcesCard.appendChild(el('p', { text: t('list_body') }));
  main.appendChild(sourcesCard);

  const faqCard = el('section', { className: 'surface-card' });
  faqCard.appendChild(el('h2', { text: t('faq_title') }));
  const faqList = el('ul');
  [t('faq_why'), t('faq_undo'), t('faq_affil')].forEach(text => {
    faqList.appendChild(el('li', { text }));
  });
  faqCard.appendChild(faqList);
  main.appendChild(faqCard);

  const footer = el('section', { className: 'surface-card' });
  footer.appendChild(el('p', { text: t('footer_legal_1') }));
  footer.appendChild(el('p', { text: t('footer_legal_2') }));
  footer.appendChild(el('p', { text: t('footer_legal_3') }));
  main.appendChild(footer);

  return buildShell(main, { title: 'TuneUp', subtitle: t('banner') });
}

function buildWizardLayout(activeHash: WizardRoute, contentNode: HTMLElement): HTMLElement {
  const main = el('div');
  main.appendChild(contentNode);
  return buildShell(main, {
    activeHash,
    title: t('wizard_title'),
    subtitle: t('wizard_intro'),
  });
}

function languageToggleNode(): HTMLElement {
  const current = getLang();
  const container = el('div', {
    className: 'language-toggle',
    attrs: { 'data-component': 'lang-switch' },
  });
  const enBtn = el('button', {
    attrs: { type: 'button', 'data-lang': 'en' },
    text: 'EN',
  });
  if (current === 'en') enBtn.classList.add('is-active');
  const heBtn = el('button', {
    attrs: { type: 'button', 'data-lang': 'he' },
    text: 'HE',
  });
  if (current === 'he') heBtn.classList.add('is-active');
  container.appendChild(enBtn);
  container.appendChild(heBtn);
  return container;
}

function buildAuthStatusControls(options: { compact?: boolean } = {}): HTMLElement {
  const wrapper = el('div', {
    className: `auth-status${options.compact ? ' is-compact' : ''}`,
  });
  wrapper.appendChild(el('span', { className: 'auth-chip', text: 'Connected to Spotify' }));
  const actions = el('div', { className: 'auth-status-actions' });
  const reconnectBtn = el('button', {
    className: 'ghost-btn',
    text: 'Switch account',
  }) as HTMLButtonElement;
  reconnectBtn.addEventListener('click', event => {
    event.preventDefault();
    void beginAuthFlow();
  });
  const logoutBtn = el('button', {
    className: 'ghost-btn',
    text: 'Disconnect',
  }) as HTMLButtonElement;
  logoutBtn.addEventListener('click', event => {
    event.preventDefault();
    handleLogout();
  });
  actions.appendChild(reconnectBtn);
  actions.appendChild(logoutBtn);
  wrapper.appendChild(actions);
  return wrapper;
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

  const modalBody = body;
  rerender();
  showSimpleModal({ title: 'Review artist matches', body: modalBody });
}

function createMetricCard(label: string, value: string): HTMLElement {
  const card = el('div', { className: 'metric-card' });
  card.appendChild(el('strong', { text: label }));
  card.appendChild(el('span', { text: value }));
  return card;
}

function createLoadingCard(message: string): HTMLElement {
  const card = el('div', { className: 'glass-card step' });
  const row = el('div', { className: 'source-loading' });
  row.appendChild(spinner());
  row.appendChild(el('span', { text: message }));
  card.appendChild(row);
  return card;
}

function buildShell(
  mainContent: HTMLElement,
  options: { activeHash?: WizardRoute; title: string; subtitle?: string },
): HTMLElement {
  const shell = el('div', { className: 'app-shell' });
  if (options.activeHash && options.activeHash !== ROUTE_DEFAULT) {
    shell.appendChild(buildSidebar(options.activeHash));
  }
  const contentWrap = el('div', { className: 'shell-content' });
  contentWrap.appendChild(buildShellHeader(options.title, options.subtitle));
  contentWrap.appendChild(mainContent);
  shell.appendChild(contentWrap);
  if (options.activeHash && options.activeHash !== ROUTE_DEFAULT) {
    shell.appendChild(buildBottomNav(options.activeHash));
  }
  return shell;
}

function buildShellHeader(title: string, subtitle?: string): HTMLElement {
  const header = el('div', { className: 'shell-header' });
  const stack = el('div', { className: 'header-stack' });
  stack.appendChild(el('h1', { text: title }));
  if (subtitle) {
    stack.appendChild(el('p', { text: subtitle }));
  }
  header.appendChild(stack);

  const actions = el('div', { className: 'header-actions' });
  if (isConnected()) {
    actions.appendChild(buildAuthStatusControls({ compact: true }));
  }
  actions.appendChild(languageToggleNode());
  header.appendChild(actions);
  return header;
}

function buildSidebar(activeHash: WizardRoute): HTMLElement {
  const sidebar = el('aside', { className: 'shell-sidebar' });
  const logoStack = el('div', { className: 'header-stack' });
  logoStack.appendChild(el('h2', { text: t('wizard_title') }));
  logoStack.appendChild(el('p', { text: t('wizard_intro') }));
  sidebar.appendChild(logoStack);

  const stepper = el('div', { className: 'stepper' });
  STEP_ROUTES.forEach(({ hash, key }, index) => {
    const item = el('a', {
      className: `stepper-item${hash === activeHash ? ' is-active' : ''}`,
      attrs: { href: hash },
    });
    item.appendChild(el('span', { className: 'stepper-index', text: String(index + 1) }));
    const textBlock = el('div', { className: 'header-stack' });
    textBlock.appendChild(el('strong', { text: t(key) }));
    item.appendChild(textBlock);
    stepper.appendChild(item);
  });
  sidebar.appendChild(stepper);
  return sidebar;
}

function buildBottomNav(activeHash: WizardRoute): HTMLElement {
  const nav = el('div', { className: 'bottom-nav' });
  STEP_ROUTES.forEach(({ hash }) => {
    const button = el('button', { attrs: { type: 'button', 'data-nav': hash } });
    if (hash === activeHash) button.classList.add('is-active');
    button.addEventListener('click', () => navigate(hash));
    nav.appendChild(button);
  });
  return nav;
}

function renderSourceStep(): Node {
  if (HAS_SINGLE_LIST) {
    navigate(FIRST_STEP_HASH);
    return renderResolveStep();
  }
  const content = createSourceContent();
  maybeAutoLoadSelectedList();
  return buildWizardLayout('#/app', content);
}

function renderResolveStep(): Node {
  if (!state.sourceList) {
    if (HAS_SINGLE_LIST) {
      maybeAutoLoadSelectedList();
      return buildWizardLayout('#/resolve', createLoadingCard(t('source_loading')));
    }
    showToast('Load a list first.', 'warning');
    navigate('#/app');
    return buildWizardLayout('#/app', createSourceContent());
  }
  const content = createResolveContent();
  return buildWizardLayout('#/resolve', content);
}

function renderDryRunStep(): Node {
  if (!state.sourceList) {
    if (HAS_SINGLE_LIST) {
      maybeAutoLoadSelectedList();
      return buildWizardLayout('#/resolve', createLoadingCard(t('source_loading')));
    }
    navigate('#/app');
    return buildWizardLayout('#/app', createSourceContent());
  }
  if (!getArtistInputs().length) {
    showToast('No artists to resolve in the current list.', 'warning');
    if (HAS_SINGLE_LIST) {
      return buildWizardLayout('#/resolve', createSourceContent());
    }
    navigate('#/app');
    return buildWizardLayout('#/app', createSourceContent());
  }
  if (!state.resolvedArtists.length) {
    showToast('Resolve artist names first.', 'warning');
    navigate('#/resolve');
    return buildWizardLayout('#/resolve', createResolveContent());
  }
  const content = createDryRunContent();
  return buildWizardLayout('#/dryrun', content);
}

function renderApplyStep(): Node {
  if (!state.plan) {
    showToast('Generate a plan preview first.', 'warning');
    navigate('#/dryrun');
    return buildWizardLayout('#/dryrun', createDryRunContent());
  }
  const content = createApplyContent();
  return buildWizardLayout('#/apply', content);
}

function renderReportStep(): Node {
  if (!state.plan) {
    navigate('#/dryrun');
    return buildWizardLayout('#/dryrun', createDryRunContent());
  }
  const content = createReportContent();
  return buildWizardLayout('#/report', content);
}

function createSourceContent(): HTMLElement {
  const container = el('div', { className: 'glass-card step step-source' });
  container.appendChild(el('h2', { text: t('step_source_title') }));
  const activeConfig = curatedLists.find(list => list.id === state.selectedListId);
  if (activeConfig?.subtitle) {
    container.appendChild(el('p', { text: activeConfig.subtitle }));
  } else {
    container.appendChild(el('p', { text: t('source_intro') }));
  }

  const lists = getCuratedLists();
  const providerGrid = el('div', { className: 'provider-grid' });
  lists.forEach(list => {
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
        state.sourceList = null;
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
      showToast('Connect with Spotify to continue.', 'warning');
      return;
    }
    try {
      setLoading(loadBtn, true);
      state.sourceLoading = true;
      renderRoute();
      const list = await loadCuratedList(state.selectedListId);
      if (list) {
        applyNewSource(list);
        showToast(
          t('source_loaded_counts', {
            artists: formatNumber(getArtistCount(list)),
            labels: formatNumber(getLabelCount(list)),
          }),
          'success',
        );
      }
    } catch (err) {
      console.error(err);
      showToast('Unable to load list. Check console for details.', 'error');
    } finally {
      state.sourceLoading = false;
      setLoading(loadBtn, false);
      renderRoute();
    }
  });
  actions.appendChild(loadBtn);

  const nextBtn = el('button', { className: 'secondary-btn', text: t('source_next_btn') });
  nextBtn.addEventListener('click', event => {
    event.preventDefault();
    if (!state.sourceList) {
      showToast('Load a list before continuing.', 'warning');
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
  } else {
    container.appendChild(
      el('div', {
        className: 'empty-state',
        text: 'Select a list to load the latest petition roster.',
      }),
    );
  }

  return container;
}

function renderSourceSummary(list: ArtistList): HTMLElement {
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
  metrics.appendChild(createMetricCard('Artists', formatNumber(artists)));
  metrics.appendChild(createMetricCard('Labels', formatNumber(labels)));
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

function maybeAutoLoadSelectedList(): void {
  if (state.sourceList || state.sourceLoading) return;
  if (autoLoadedLists.has(state.selectedListId)) return;
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
      showToast('Unable to auto-load the selected list.', 'warning');
    } finally {
      state.sourceLoading = false;
      renderRoute();
    }
  })();
}

function applyNewSource(list: ArtistList): void {
  state.sourceList = list;
  state.resolvedArtists = [];
  state.pendingArtists = extractArtistNames(list);
  state.skippedArtists = [];
  state.followingArtistIds = [];
  state.resolutionRunning = false;
  state.autoResolveAttempted = false;
  state.autoResolveCompleted = false;
  invalidateGeneratedPlan();
  followingLookup = new Set();
  state.previewProgress = initialPreviewProgress();
  void hydrateResolvedFromCache();
}

function handleLogout(): void {
  clearToken();
  invalidateSpotifyCaches();
  connected = false;
  state.followingArtistIds = [];
  followingLookup = new Set();
  state.plan = null;
  state.planGeneratedAt = null;
  state.planMeta = { before: null, after: null };
  state.apply = initialApplyState();
  state.previewProgress = initialPreviewProgress();
  showToast('Disconnected from Spotify.', 'info');
  renderRoute();
}

function createResolveContent(): HTMLElement {
  maybeAutoLoadSelectedList();
  void runAutoResolve();
  followingLookup = new Set(state.followingArtistIds);
  const container = el('div', { className: 'glass-card step step-resolve' });
  container.appendChild(el('h2', { text: t('step_resolve_title') }));
  container.appendChild(el('p', { text: t('resolve_intro') }));

  if (!state.sourceList) {
    return createLoadingCard(t('source_loading'));
  }

  const total =
    state.resolvedArtists.length + state.pendingArtists.length + state.skippedArtists.length;
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
  if (pendingCount) {
    previewSection.appendChild(
      el('div', {
        className: 'resolve-status-chip is-pending',
        text: `${formatNumber(pendingCount)} artist${pendingCount === 1 ? '' : 's'} need review`,
      }),
    );
  }
  container.appendChild(previewSection);

  const queueCard = buildPendingQueueCard();
  if (queueCard) {
    container.appendChild(queueCard);
  }

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
        showToast('Connect with Spotify through the landing page.', 'warning');
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
        window.setTimeout(() => renderRoute(), 0);
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
        state.resolutionRunning = false;
        window.setTimeout(() => renderRoute(), 0);
        setLoading(resolveBtn, false);
      }
    });
    if (state.resolutionRunning) {
      resolveBtn.setAttribute('disabled', 'true');
    }
    actions.appendChild(resolveBtn);
  }
  const nextBtn = el('button', { className: 'primary-btn', text: t('resolve_next_btn') });
  nextBtn.addEventListener('click', event => {
    event.preventDefault();
    if (!state.resolvedArtists.length) {
      showToast('Resolve at least one artist before continuing.', 'warning');
      return;
    }
    navigate('#/dryrun');
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

function buildPendingQueueCard(limit = 5): HTMLElement | null {
  if (!isConnected()) return null;
  if (!state.autoResolveAttempted) return null;
  if (!state.pendingArtists.length) {
    return null;
  }
  const card = el('div', { className: 'resolve-queue' });
  card.appendChild(el('h3', { text: 'Quick review queue' }));
  card.appendChild(
    el('p', {
      className: 'muted',
      text: 'Review or skip artists directly. Choices persist between sessions.',
    }),
  );

  const list = el('ul', { className: 'resolve-queue-list' });
  state.pendingArtists.slice(0, limit).forEach((name, index) => {
    const row = el('li', { className: 'resolve-queue-row' });
    const sourceItem = findSourceItemByName(name);
    const main = el('div', { className: 'resolve-queue-main' });
    main.appendChild(el('span', { className: 'resolve-queue-index', text: `${index + 1}.` }));
    const info = buildArtistInfo(
      {
        name,
        input: name,
        id: sourceItem?.spotifyId,
      },
      {
        compact: true,
        link: Boolean(sourceItem?.spotifyId),
        showSourceDiff: false,
      },
    );
    main.appendChild(info);
    row.appendChild(main);
    const actions = el('div', { className: 'resolve-queue-actions' });
    const reviewBtn = el('button', {
      className: 'primary-btn',
      text: 'Review',
    }) as HTMLButtonElement;
    reviewBtn.addEventListener('click', () => {
      if (reviewBtn.disabled) return;
      void reviewSingleArtist(name, reviewBtn, () => undefined);
    });
    actions.appendChild(reviewBtn);

    const skipBtn = el('button', { className: 'secondary-btn', text: 'Skip' }) as HTMLButtonElement;
    skipBtn.addEventListener('click', async () => {
      if (skipBtn.disabled) return;
      setLoading(skipBtn, true);
      try {
        await skipPendingArtist(name);
      } catch (err) {
        console.error(err);
        showToast('Unable to skip artist right now.', 'error');
        setLoading(skipBtn, false);
      }
    });
    actions.appendChild(skipBtn);
    row.appendChild(actions);
    list.appendChild(row);
  });
  card.appendChild(list);

  if (state.pendingArtists.length > limit) {
    card.appendChild(
      el('div', {
        className: 'muted resolve-queue-more',
        text: `+ ${formatNumber(state.pendingArtists.length - limit)} more queued — open the artist list to manage all`,
      }),
    );
  }
  return card;
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
  control.appendChild(buildOption('recent', 'Recent'));
  control.appendChild(buildOption('name', 'A → Z'));
  return control;
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

function buildResolvedPreviewGrid(limit = 8): HTMLElement {
  const wrapper = el('div', { className: 'artist-chip-grid' });
  if (!state.resolvedArtists.length) {
    wrapper.appendChild(el('div', { className: 'muted', text: t('no_artists_resolved') }));
    return wrapper;
  }
  const collection =
    resolvePreviewSort === 'name'
      ? [...state.resolvedArtists].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit)
      : [...state.resolvedArtists].slice(-limit).reverse();
  collection.forEach(entry => {
    wrapper.appendChild(buildArtistChip(entry));
  });
  return wrapper;
}

function isArtistFollowed(id?: string | null): boolean {
  if (!id) return false;
  return followingLookup.has(id);
}

function limitForRosterButton(): number {
  return 8;
}

function findSourceItemByName(name: string): Item | undefined {
  return state.sourceList?.items.find(item => item.name === name);
}

function normalizeNameForCompare(name?: string | null): string {
  return name ? canonicalName(name) : '';
}

type ArtistDisplay = {
  id?: string | null;
  name: string;
  input?: string | null;
  imageUrl?: string | null;
};

type ArtistInfoOptions = {
  compact?: boolean;
  link?: boolean;
  showSourceDiff?: boolean;
  showFollow?: boolean;
};

function buildArtistAvatar(entry: ArtistDisplay, options: { compact?: boolean } = {}): HTMLElement {
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

function buildArtistDetails(entry: ArtistDisplay, options: ArtistInfoOptions = {}): HTMLElement {
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

function buildArtistInfo(entry: ArtistDisplay, options: ArtistInfoOptions = {}): HTMLElement {
  const { compact = false } = options;
  const info = el('div', {
    className: compact ? 'artist-info artist-info--compact' : 'artist-info',
  });
  info.appendChild(buildArtistAvatar(entry, { compact }));
  info.appendChild(buildArtistDetails(entry, options));
  return info;
}

function buildArtistChip(entry: ResolvedArtist): HTMLElement {
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

async function handleAmbiguity(
  input: string,
  candidates: ArtistCandidate[],
): Promise<{ choice: ArtistCandidate | null; skipped?: boolean; cancel?: boolean }> {
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
  if (skipped) {
    return { choice: null, skipped: true };
  }
  if (!selection) {
    return { choice: null, cancel: true };
  }
  return { choice: selection };
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
  runBtn.addEventListener('click', event => {
    event.preventDefault();
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
  if (!state.plan) {
    nextBtn.setAttribute('disabled', 'true');
  }
  actions.appendChild(nextBtn);
  container.appendChild(actions);

  if (state.previewProgress.message || state.previewProgress.running) {
    const progressRow = el('div', { className: 'preview-progress' });
    if (state.previewProgress.running) {
      progressRow.appendChild(spinner('small'));
    }
    if (state.previewProgress.stageCount > 0) {
      const currentStep = state.previewProgress.running
        ? Math.min(state.previewProgress.stageIndex + 1, state.previewProgress.stageCount)
        : state.previewProgress.stageCount;
      progressRow.appendChild(
        el('span', {
          className: 'preview-progress-step',
          text: `Step ${currentStep} of ${state.previewProgress.stageCount}`,
        }),
      );
    }
    if (state.previewProgress.message) {
      progressRow.appendChild(el('span', { text: state.previewProgress.message }));
    }
    if (
      state.previewProgress.stageCount > 0 &&
      (state.previewProgress.running || state.previewProgress.overallPercent)
    ) {
      const overallPercent = Math.round(state.previewProgress.overallPercent * 100);
      progressRow.appendChild(
        el('span', { className: 'preview-progress-overall', text: `Overall ${overallPercent}%` }),
      );
    }
    container.appendChild(progressRow);
  }

  if (state.plan) {
    container.appendChild(renderPlanSummary(state.plan));
  } else {
    container.appendChild(
      el('div', {
        className: 'empty-state',
        text: t('generate_preview_prompt'),
      }),
    );
  }

  return container;
}

function buildToggle(key: keyof AppState['options'], label: string): HTMLElement {
  const wrapper = el('label', { className: 'option-toggle' });
  const input = el('input', { attrs: { type: 'checkbox' } });
  input.checked = Boolean(state.options[key]);
  input.addEventListener('change', () => {
    state.options[key] = input.checked;
    state.plan = null;
    state.planMeta = { before: null, after: null };
    state.previewProgress = initialPreviewProgress();
    renderRoute();
  });
  wrapper.appendChild(input);
  wrapper.appendChild(el('span', { text: label }));
  return wrapper;
}

async function runDryRun(button: HTMLButtonElement): Promise<void> {
  if (!state.resolvedArtists.length && state.options.includeLabelCleanup) {
    showToast('Resolve artists or disable label cleanup.', 'warning');
  }
  try {
    setLoading(button, true);
    const artistIds = state.resolvedArtists.map(item => item.id);
    const labelNames = state.options.includeLabelCleanup
      ? getLabelInputs().map(item => item.name)
      : [];
    const includeAlbumsStage = state.options.includeAlbums || labelNames.length > 0;
    const stages: Array<'following' | 'tracks' | 'albums' | 'enrich'> = ['following', 'tracks'];
    if (includeAlbumsStage) stages.push('albums');
    if (labelNames.length) stages.push('enrich');
    state.previewProgress = {
      running: true,
      message: 'Preparing preview…',
      percent: 0,
      overallPercent: 0,
      stageIndex: 0,
      stageCount: stages.length,
    };
    renderRoute();

    const stageLabels: Record<'following' | 'tracks' | 'albums' | 'enrich' | 'done', string> = {
      following: 'Fetching followed artists…',
      tracks: 'Scanning liked tracks…',
      albums: 'Scanning saved albums…',
      enrich: 'Gathering album details…',
      done: 'Preview ready.',
    };

    const stageIndexMap = new Map(stages.map((stage, index) => [stage, index]));

    const updatePreviewProgress = (
      stage: 'following' | 'tracks' | 'albums' | 'enrich' | 'done',
      ratio: number,
    ) => {
      if (!stages.length) {
        state.previewProgress = {
          running: stage !== 'done',
          message: stageLabels[stage],
          percent: stage === 'done' ? 1 : ratio,
          overallPercent: stage === 'done' ? 1 : ratio,
          stageIndex: stage === 'done' ? 1 : 0,
          stageCount: 1,
        };
        renderRoute();
        return;
      }
      if (stage === 'done') {
        state.previewProgress = {
          running: false,
          message: stageLabels.done,
          percent: 1,
          overallPercent: 1,
          stageIndex: stages.length,
          stageCount: stages.length,
        };
        renderRoute();
        return;
      }
      const index = stageIndexMap.get(stage) ?? 0;
      const overall = Math.min(1, (index + ratio) / stages.length);
      state.previewProgress = {
        running: true,
        message: stageLabels[stage],
        percent: ratio,
        overallPercent: overall,
        stageIndex: index,
        stageCount: stages.length,
      };
      renderRoute();
    };

    const plan = await buildPlan(
      {
        artistIds,
        labelNames,
        strictPrimary: state.options.strictPrimary,
        includeAlbums: state.options.includeAlbums,
      },
      {
        onProgress(update) {
          const total = update.total ?? 0;
          const loaded = update.loaded ?? 0;
          const ratio = total ? Math.min(1, loaded / total) : loaded ? 1 : 0;
          updatePreviewProgress(update.stage, ratio);
        },
      },
    );

    state.plan = plan;
    state.followingArtistIds = getLastFollowingSnapshot();
    followingLookup = new Set(state.followingArtistIds);
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
    state.apply = initialApplyState();
    state.previewProgress = {
      running: false,
      message: 'Preview ready.',
      percent: 1,
      overallPercent: 1,
      stageIndex: stages.length,
      stageCount: stages.length,
    };
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
    state.previewProgress = initialPreviewProgress();
  } finally {
    setLoading(button, false);
    renderRoute();
  }
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
    const done = Math.min(progress.done, total);
    let status: PhaseStatus = 'pending';
    if (!total) {
      status = 'skipped';
    } else if (state.apply.status === 'done') {
      status = 'complete';
    } else if (state.apply.status === 'error') {
      status = done ? 'stalled' : 'pending';
    } else if (done >= total) {
      status = 'complete';
    } else if (state.apply.status === 'running') {
      const previousFinished = APPLY_PHASES.slice(0, index).every(previousPhase => {
        const previousTotal = totals[previousPhase];
        if (!previousTotal) return true;
        return state.apply.progress[previousPhase].done >= previousTotal;
      });
      status = previousFinished ? 'active' : 'pending';
    }
    return { phase, total, done, status, retries: progress.retries };
  });

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

    const bar = el('div', { className: 'progress-bar' });
    const inner = el('div', { className: 'progress-inner' });
    const percentage = total ? Math.min(100, Math.floor((done / total) * 100)) : 100;
    inner.style.width = `${percentage}%`;
    bar.appendChild(inner);
    block.appendChild(bar);

    if (total) {
      block.appendChild(
        el('div', {
          className: 'progress-meta',
          text: t('apply_phase_counts', { done: formatNumber(done), total: formatNumber(total) }),
        }),
      );
    } else {
      block.appendChild(el('div', { className: 'progress-meta', text: t('apply_phase_empty') }));
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

  if (state.apply.message) {
    container.appendChild(
      el('div', { className: 'muted apply-message', text: state.apply.message }),
    );
  } else if (state.apply.status === 'done') {
    container.appendChild(el('div', { className: 'apply-success', text: t('apply_done') }));
  }

  const actions = el('div', { className: 'apply-actions' });
  const startBtn = el('button', { className: 'primary-btn', text: t('apply_start_btn') });
  if (state.apply.status === 'running') {
    setLoading(startBtn, true);
  }
  startBtn.addEventListener('click', async event => {
    event.preventDefault();
    if (state.apply.status === 'running') return;
    await handleApply(startBtn);
  });
  if (!totals.unfollow && !totals.tracks && !totals.albums) {
    startBtn.setAttribute('disabled', 'true');
  }
  actions.appendChild(startBtn);

  if (state.apply.status === 'done') {
    const reportBtn = el('button', { className: 'secondary-btn', text: t('report_json_btn') });
    reportBtn.addEventListener('click', () => navigate('#/report'));
    actions.appendChild(reportBtn);
  }
  container.appendChild(actions);
  return container;
}

function phaseTitle(phase: ApplyPhase): string {
  if (phase === 'unfollow') return t('apply_phase_unfollow');
  if (phase === 'tracks') return t('apply_phase_tracks');
  return t('apply_phase_albums');
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

async function recordOperation(): Promise<void> {
  if (!state.plan) return;
  const timestamp = new Date().toISOString();
  const plan = state.plan;
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

function createReportContent(): HTMLElement {
  if (!state.plan) {
    throw new Error('Plan is required before rendering report content');
  }
  const container = el('div', { className: 'glass-card step step-report' });
  container.appendChild(el('h2', { text: t('step_report_title') }));
  container.appendChild(el('p', { text: t('report_intro') }));

  const metaList = el('ul', { className: 'report-meta' });
  metaList.appendChild(el('li', { text: `Provider: ${state.sourceList?.provider ?? 'custom'}` }));
  if (state.sourceList?.version) {
    metaList.appendChild(el('li', { text: `Version: ${state.sourceList.version}` }));
  }
  if (state.planGeneratedAt) {
    metaList.appendChild(el('li', { text: `Generated: ${state.planGeneratedAt}` }));
  }
  container.appendChild(metaList);

  const actions = el('div', { className: 'report-actions' });
  const jsonBtn = el('button', { className: 'primary-btn', text: t('report_json_btn') });
  jsonBtn.addEventListener('click', () => {
    exportJson(state.plan as Plan, state.planMeta.before, state.planMeta.after, {
      provider: state.sourceList?.provider ?? 'custom',
      version: state.sourceList?.version ?? 'n/a',
      lang: getLang(),
    });
  });
  actions.appendChild(jsonBtn);

  const csvBtn = el('button', { className: 'secondary-btn', text: t('report_csv_btn') });
  csvBtn.addEventListener('click', () => {
    const rows = buildCsvRows();
    exportCsv(rows);
  });
  actions.appendChild(csvBtn);

  const restartBtn = el('button', { className: 'secondary-btn', text: t('report_restart_btn') });
  restartBtn.addEventListener('click', () => navigate('#/'));
  actions.appendChild(restartBtn);

  container.appendChild(actions);
  return container;
}

function buildCsvRows(): Array<Record<string, string>> {
  if (!state.plan) return [];
  const rows: Array<Record<string, string>> = [];
  state.plan.evidence?.forEach(item => {
    rows.push({
      kind: item.kind,
      id: item.id,
      title: item.title,
      label: item.label ?? '',
      year: item.year ? String(item.year) : '',
      generatedAt: state.planGeneratedAt ?? '',
    });
  });
  if (!rows.length) {
    rows.push({
      kind: 'summary',
      id: '-',
      title: 'No evidence recorded',
      label: '',
      year: '',
      generatedAt: state.planGeneratedAt ?? '',
    });
  }
  return rows;
}

function getArtistInputs(): Item[] {
  if (!state.sourceList) return [];
  return state.sourceList.items.filter(item => item.type === 'artist');
}

function getLabelInputs(): Item[] {
  if (!state.sourceList) return [];
  return state.sourceList.items.filter(item => item.type === 'label');
}

function getArtistCount(list: ArtistList): number {
  return list.items.filter(item => item.type === 'artist').length;
}

function getLabelCount(list: ArtistList): number {
  return list.items.filter(item => item.type === 'label').length;
}

function extractArtistNames(list: ArtistList): string[] {
  const names = new Set<string>();
  list.items.forEach(item => {
    if (item.type === 'artist' && item.name) {
      const cleaned = item.name.trim();
      if (cleaned) {
        names.add(cleaned);
      }
    }
  });
  return Array.from(names);
}

function isConnected(): boolean {
  return connected || hasToken();
}

async function init(): Promise<void> {
  initI18n();
  try {
    const result = await handleAuthCallback();
    if (result?.ok) {
      connected = true;
      navigate(FIRST_STEP_HASH);
    }
  } catch (err) {
    console.error(err);
  }
  if (HAS_SINGLE_LIST) {
    maybeAutoLoadSelectedList();
  }
  renderRoute();
  window.addEventListener('hashchange', renderRoute);
  onLangChange(() => renderRoute());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
