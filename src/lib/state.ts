import type { PurgeState } from '../types/index.js';

import { checkStorageAvailability } from './storage.js';

const STORAGE_KEY = 'tuneup_state';

const DEFAULT_STATE: PurgeState = {
  unfollowed: {},
  removedTracksByArtist: {},
  removedAlbumsByArtist: {},
  removedTracksByLabel: {},
  removedAlbumsByLabel: {},
  nameToId: {},
  ops: {},
};

let memoryState: PurgeState | null = null;

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeState(state: PurgeState | null | undefined): PurgeState {
  const source = state ?? DEFAULT_STATE;
  const {
    unfollowed = DEFAULT_STATE.unfollowed,
    removedTracksByArtist = DEFAULT_STATE.removedTracksByArtist,
    removedAlbumsByArtist = DEFAULT_STATE.removedAlbumsByArtist,
    removedTracksByLabel = DEFAULT_STATE.removedTracksByLabel,
    removedAlbumsByLabel = DEFAULT_STATE.removedAlbumsByLabel,
    nameToId = DEFAULT_STATE.nameToId,
    ops = DEFAULT_STATE.ops,
  } = source;

  return {
    unfollowed: deepClone(unfollowed),
    removedTracksByArtist: deepClone(removedTracksByArtist),
    removedAlbumsByArtist: deepClone(removedAlbumsByArtist),
    removedTracksByLabel: deepClone(removedTracksByLabel),
    removedAlbumsByLabel: deepClone(removedAlbumsByLabel),
    nameToId: deepClone(nameToId),
    ops: deepClone(ops),
  };
}

export async function loadState(): Promise<PurgeState> {
  if (memoryState) {
    return deepClone(memoryState);
  }
  if (!checkStorageAvailability()) {
    console.warn('LocalStorage not available, using in-memory state.');
    return deepClone(DEFAULT_STATE);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryState = deepClone(DEFAULT_STATE);
      return deepClone(memoryState);
    }
    const parsed = JSON.parse(raw) as PurgeState;
    memoryState = normalizeState(parsed);
  } catch (err) {
    console.warn('Unable to read TuneUp state, resetting.', err);
    memoryState = deepClone(DEFAULT_STATE);
  }
  return deepClone(memoryState);
}

export async function saveState(next: PurgeState): Promise<void> {
  const normalized = normalizeState(next);
  memoryState = deepClone(normalized);
  if (!checkStorageAvailability()) return;
  try {
    const serialized = JSON.stringify(memoryState);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.warn('Unable to persist TuneUp state', err);
  }
}

export async function updateState(
  mutator: (draft: PurgeState) => PurgeState | void | Promise<PurgeState | void>,
): Promise<PurgeState> {
  const current = await loadState();
  const draft = deepClone(current);
  const maybeNext = await mutator(draft);
  const next = maybeNext ? (maybeNext as PurgeState) : draft;
  await saveState(next);
  return next;
}

export function resetState(): void {
  memoryState = deepClone(DEFAULT_STATE);
  if (!checkStorageAvailability()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Unable to clear TuneUp state', err);
  }
}

export function getDefaultState(): PurgeState {
  return deepClone(DEFAULT_STATE);
}
