import { format } from 'date-fns'

// Detect if current date is in US DST (approx Mar 2nd Sun – Nov 1st Sun)
function isUsDst(date = new Date()) {
  const year = date.getFullYear()
  // Second Sunday in March
  const dstStart = new Date(year, 2, 1)
  dstStart.setDate(1 + ((7 - dstStart.getDay() + 0) % 7) + 7)
  // First Sunday in November
  const dstEnd = new Date(year, 10, 1)
  dstEnd.setDate(1 + ((7 - dstEnd.getDay() + 0) % 7))
  return date >= dstStart && date < dstEnd
}

export function getEtTime(date = new Date()) {
  const offsetH = isUsDst(date) ? -4 : -5
  return new Date(date.getTime() + offsetH * 3600 * 1000)
}

export function getMarketStatus(date = new Date()) {
  const et = getEtTime(date)
  const hours = et.getUTCHours()
  const minutes = et.getUTCMinutes()
  const totalMins = hours * 60 + minutes
  const day = et.getUTCDay()

  if (day === 0 || day === 6) return 'CLOSED'
  if (totalMins >= 4 * 60 && totalMins < 9 * 60 + 30) return 'PRE-MARKET'
  if (totalMins >= 9 * 60 + 30 && totalMins < 16 * 60) return 'OPEN'
  if (totalMins >= 16 * 60 && totalMins < 20 * 60) return 'AFTER-HOURS'
  return 'CLOSED'
}

export function formatEtTime(date = new Date()) {
  const et = getEtTime(date)
  const h = et.getUTCHours()
  const m = et.getUTCMinutes().toString().padStart(2, '0')
  const s = et.getUTCSeconds().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m}:${s} ${ampm} ET`
}

export function formatEtDate(date = new Date()) {
  const et = getEtTime(date)
  return format(et, 'EEE, MMM d yyyy')
}
