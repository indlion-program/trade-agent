// Persistent watchlist via localStorage.
const KEY = 'watchlist-v1'

function load() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function save(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch {}
}

export function isWatched(symbol) {
  return load().has(symbol)
}

export function toggleWatch(symbol) {
  const set = load()
  if (set.has(symbol)) {
    set.delete(symbol)
  } else {
    set.add(symbol)
  }
  save(set)
  window.dispatchEvent(new CustomEvent('watchlistChange', { detail: symbol }))
  return set.has(symbol)
}

export function getWatchlist() {
  return [...load()]
}
