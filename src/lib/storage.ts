// Storage availability detection
// WHY: Gracefully handle environments where localStorage/IndexedDB are blocked (e.g., private browsing on mobile).

let isStorageAvailable: boolean | undefined;

/**
 * Checks if localStorage is available and writable.
 * We use this as a proxy for general storage availability, including IndexedDB.
 */
export function checkStorageAvailability(): boolean {
  if (isStorageAvailable !== undefined) return isStorageAvailable;

  try {
    const key = '__storage_test__';
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    isStorageAvailable = true;
  } catch {
    isStorageAvailable = false;
  }
  return isStorageAvailable;
}
