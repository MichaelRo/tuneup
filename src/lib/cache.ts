import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'tuneup-cache';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase | undefined>;

async function initializeDB(): Promise<IDBPDatabase | undefined> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });

    // In some environments (like iOS private browsing), opening the DB might succeed,
    // but any transaction will fail. We perform a test transaction to be sure.
    const tx = db.transaction(STORE_NAME, 'readonly');
    await tx.done;

    return db;
  } catch (error) {
    console.error('Cache DB is not available, caching will be disabled.', error);
    return undefined;
  }
}

function getDB(): Promise<IDBPDatabase | undefined> {
  if (!dbPromise) {
    dbPromise = initializeDB();
  }
  return dbPromise;
}

export async function getCache<T = unknown>(key: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    // The optional chaining here is important. If getDB() resolves to undefined,
    // this will gracefully return undefined instead of throwing.
    return db?.get(STORE_NAME, key);
  } catch (error) {
    // Even with the check in getDB, an error could occur if the DB connection
    // is closed between initialization and this call.
    console.error('Failed to get cache', { key, error });
    return undefined;
  }
}

export async function setCache(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([tx.store.put(value, key), tx.done]);
  } catch (error) {
    // Fail silently, but log the error for debugging.
    console.error('Failed to set cache', { key, error });
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([tx.store.clear(), tx.done]);
  } catch (error) {
    console.error('Failed to clear cache', { error });
  }
}
