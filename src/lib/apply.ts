import { removeLikedTracks, removeSavedAlbums, unfollowArtists } from '../spotify/api.js';
import type { Plan, ProgressEvt, ProgressPhase } from '../types/index.js';

const BATCH_SIZE = 50;

type BatchWorker = (
  ids: string[],
  hooks?: {
    onRateLimit?: (retryAfterSeconds: number) => void;
    onRetry?: (attempt: number, status: number) => void;
  },
) => Promise<void>;

function chunk<T>(list: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < list.length; index += size) {
    output.push(list.slice(index, index + size));
  }
  return output;
}

async function processPhase(
  phase: ProgressPhase,
  items: string[],
  worker: BatchWorker,
  onProgress?: (event: ProgressEvt) => void,
): Promise<void> {
  const total = items.length;
  let done = 0;
  let retries = 0;
  if (!total) {
    onProgress?.({ phase, done, total, retries });
    return;
  }
  const batches = chunk(items, BATCH_SIZE);
  for (const batch of batches) {
    const hooks = {
      onRateLimit: (retryAfterSeconds: number) => {
        retries += 1;
        onProgress?.({ phase, done, total, retries, retryAfter: retryAfterSeconds });
      },
      onRetry: (attempt: number) => {
        retries = Math.max(retries, attempt);
        onProgress?.({ phase, done, total, retries });
      },
    };
    await worker(batch, hooks);
    done += batch.length;
    onProgress?.({ phase, done, total, retries });
  }
}

export async function runPlan(
  plan: Plan | null,
  onProgress?: (event: ProgressEvt) => void,
): Promise<void> {
  if (!plan) return;
  await processPhase('unfollow', plan.artistsToUnfollow ?? [], unfollowArtists, onProgress);
  await processPhase('tracks', plan.trackIdsToRemove ?? [], removeLikedTracks, onProgress);
  await processPhase('albums', plan.albumIdsToRemove ?? [], removeSavedAlbums, onProgress);
}
