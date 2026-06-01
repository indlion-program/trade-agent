export async function fetchAmericanBullsSignal(ticker) {
  const res = await fetch(`/api/americanbulls?ticker=${encodeURIComponent(ticker)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}
