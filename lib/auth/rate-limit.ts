/** In-memory login throttle (single local process). Keyed by email and by client IP. */
const WINDOW_MS = 15 * 60 * 1000
export const MAX_FAILURES = 5

const failures = new Map<string, number[]>()

function recent(key: string, now: number): number[] {
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (list.length) failures.set(key, list)
  else failures.delete(key)
  return list
}

export function isBlocked(keys: string[], now = Date.now()): boolean {
  return keys.some((k) => recent(k, now).length >= MAX_FAILURES)
}

export function recordFailure(keys: string[], now = Date.now()): void {
  for (const k of keys) failures.set(k, [...recent(k, now), now])
}

export function clearFailures(keys: string[]): void {
  for (const k of keys) failures.delete(k)
}

export function resetRateLimit(): void {
  failures.clear()
}
