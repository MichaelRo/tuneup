import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'tuneup-cache';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | undefined;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        return tx.done;
      },
    });
  }
  return dbPromise;
}

export async function getCache<T = unknown>(key: string): Promise<T | undefined> {
  return (await getDB()).get(STORE_NAME, key);
}

export async function setCache(key: string, value: unknown): Promise<void> {
  const tx = (await getDB()).transaction(STORE_NAME, 'readwrite');
  await Promise.all([tx.store.put(value, key), tx.done]);
}

export async function clearCache(): Promise<void> {
  const tx = (await getDB()).transaction(STORE_NAME, 'readwrite');
  await Promise.all([tx.store.clear(), tx.done]);
}
