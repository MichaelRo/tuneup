import { resetState as resetPersistentState } from '../lib/state.js';
import { clearToken, invalidateSpotifyCaches } from '../spotify';
import type { ArtistList, Item, Plan, PlanContext, ResolvedArtist } from '../types/index.js';
import { showToast } from '../ui';

import { curatedLists } from './config.js';
import { renderRoute } from './routing.js';

export const APPLY_PHASES = ['unfollow', 'tracks', 'albums'] as const;
export type ApplyPhase = (typeof APPLY_PHASES)[number];

type ApplyPhaseState = {
  done: number;
  total: number;
  retries: number;
};

type ApplyStatus = 'idle' | 'running' | 'done' | 'error';

export type PhaseStatus = 'pending' | 'active' | 'complete' | 'skipped' | 'stalled';

export type ApplyState = {
  status: ApplyStatus;
  progress: Record<ApplyPhase, ApplyPhaseState>;
  message: string | null;
  completedAt: string | null;
};

export type PlanMetaSnapshot = {
  before: PlanContext['totals'] | null;
  after: PlanContext['totals'] | null;
};

export type AppState = {
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
  planExclusions: {
    artists: Set<string>;
    tracks: Set<string>;
    albums: Set<string>;
  };
  options: {
    strictPrimary: boolean;
    includeAlbums: boolean;
    includeLabelCleanup: boolean;
    showRateLimitBanner: boolean;
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

export function initialApplyState(): ApplyState {
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

export function initialPreviewProgress(): AppState['previewProgress'] {
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

export function getInitialState(): AppState {
  return {
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
    planExclusions: {
      artists: new Set(),
      tracks: new Set(),
      albums: new Set(),
    },
    options: {
      strictPrimary: false,
      includeAlbums: true,
      includeLabelCleanup: true,
      showRateLimitBanner: true,
    },
    apply: initialApplyState(),
    autoResolveAttempted: false,
    autoResolveCompleted: false,
    previewProgress: initialPreviewProgress(),
  };
}

export let state: AppState = getInitialState();

export function resetState(): void {
  state = getInitialState();
}

let _connected = false;
export const autoLoadedLists = new Set<string>();

export function isConnected(): boolean {
  return _connected;
}

export function setConnected(value: boolean): void {
  _connected = value;
}

export function uniqueNames(values: string[]): string[] {
  const cleaned = values.map(v => v?.trim()).filter(Boolean) as string[];
  return [...new Set(cleaned)];
}

export function invalidateGeneratedPlan(): void {
  state.plan = null;
  state.planGeneratedAt = null;
  state.planMeta = { before: null, after: null };
  state.previewProgress = initialPreviewProgress();
  state.apply = initialApplyState();
}

export function resetPlanExclusions(): void {
  state.planExclusions.artists.clear();
  state.planExclusions.tracks.clear();
  state.planExclusions.albums.clear();
}

export function getArtistCount(list: ArtistList): number {
  return list.items.filter(item => item.type === 'artist').length;
}

export function getLabelCount(list: ArtistList): number {
  return list.items.filter(item => item.type === 'label').length;
}

export function getArtistInputs(): Item[] {
  if (!state.sourceList) return [];
  return state.sourceList.items.filter(item => item.type === 'artist');
}

export function getLabelInputs(): Item[] {
  if (!state.sourceList) return [];
  return state.sourceList.items.filter(item => item.type === 'label');
}

export function extractArtistNames(list: ArtistList): string[] {
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

export function handleLogout(): void {
  clearToken();
  invalidateSpotifyCaches();
  setConnected(false);
  resetState();
  resetPersistentState();
  showToast('Disconnected from Spotify.', 'info');
  renderRoute();
}
