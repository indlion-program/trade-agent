// Persistent cache backed by IndexedDB.
// Survives page reloads — profile/metrics cached for days mean fast rescans.

const DB_NAME = 'trade-scanner'
const DB_VERSION = 1
const STORE = 'responses'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function getCached(key) {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => {
        const entry = req.result
        if (!entry) return resolve(null)
        if (Date.now() > entry.expires) return resolve(null)
        resolve(entry.data)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function setCached(key, data, ttlMs) {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({
        key,
        data,
        expires: Date.now() + ttlMs,
        ts: Date.now(),
      })
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function clearCachePrefix(prefix) {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.openCursor()
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (cursor) {
          if (!prefix || cursor.value.key.startsWith(prefix)) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve(true)
        }
      }
      req.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

export async function clearAllCache() {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

// In-memory cache for hot data (same session, faster than IDB)
const memCache = new Map()

export function memGet(key) {
  const entry = memCache.get(key)
  if (!entry || Date.now() > entry.expires) {
    if (entry) memCache.delete(key)
    return null
  }
  return entry.data
}

export function memSet(key, data, ttlMs) {
  memCache.set(key, { data, expires: Date.now() + ttlMs })
}

export function memClear() {
  memCache.clear()
}
