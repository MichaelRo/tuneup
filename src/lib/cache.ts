import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'tuneup-cache';
const STORE_NAME = 'spotify-api-cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME);
      },
    });
  }
  return dbPromise;
}

type CacheEntry<T> = {
  value: T;
  expires: number;
};

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const entry = (await db.get(STORE_NAME, key)) as CacheEntry<T> | undefined;
    if (entry && entry.expires > Date.now()) {
      return entry.value;
    }
  } catch (err) {
    console.warn(`Failed to get from cache [${key}]`, err);
  }
  return null;
}

export async function setCache<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    const entry: CacheEntry<T> = { value, expires: Date.now() + CACHE_TTL_MS };
    await db.put(STORE_NAME, entry, key);
  } catch (err) {
    console.warn(`Failed to set to cache [${key}]`, err);
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (err) {
    console.warn('Failed to clear cache', err);
  }
}
