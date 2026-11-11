// Minimal IndexedDB key-value store for caching large data (shared content).
// Every failure resolves to "no cache"; the app then simply downloads again.
const DB = 'luso-char-tracker'
const STORE = 'cache'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => resolve(undefined)
    })
  } catch {
    return undefined
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // cache is optional
  }
}
