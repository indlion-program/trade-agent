const KEY = 'price-alarms-v1'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

function save(alarms) {
  try {
    localStorage.setItem(KEY, JSON.stringify(alarms))
    window.dispatchEvent(new CustomEvent('alarmsChange'))
  } catch {}
}

export function getAlarms() {
  return load()
}

export function addAlarm(symbol, direction, targetPrice) {
  const alarm = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: symbol.toUpperCase().trim(),
    direction, // 'above' | 'below'
    targetPrice: Number(targetPrice),
    triggered: false,
    createdAt: Date.now(),
  }
  const list = load()
  list.push(alarm)
  save(list)
  return alarm
}

export function removeAlarm(id) {
  save(load().filter(a => a.id !== id))
}

export function markTriggered(id) {
  const list = load()
  const alarm = list.find(a => a.id === id)
  if (alarm) { alarm.triggered = true; save(list) }
}

export function clearTriggered() {
  save(load().filter(a => !a.triggered))
}
