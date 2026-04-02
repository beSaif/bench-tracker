import { Session, STORAGE_KEY } from "./types"
import { generateSeedData } from "./seed"

/** Read from localStorage (fast, synchronous cache) */
export function loadSessionsLocal(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Session[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Write to localStorage cache */
function saveLocal(sessions: Session[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

/** Load sessions: try KV first, fall back to localStorage, seed if empty */
export async function loadSessions(): Promise<Session[]> {
  try {
    const res = await fetch("/api/sessions")
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        saveLocal(data)
        return data
      }
    }
  } catch {
    // Network/KV unavailable — fall through to localStorage
  }

  // Fall back to localStorage
  const local = loadSessionsLocal()
  if (local.length > 0) return local

  // Nothing anywhere — seed
  const seed = generateSeedData()
  saveLocal(seed)
  // Try to persist seed to KV in background
  saveSessions(seed)
  return seed
}

/** Save sessions to both localStorage (sync) and KV (async, best-effort) */
export function saveSessions(sessions: Session[]): void {
  saveLocal(sessions)
  // Fire-and-forget KV save
  fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessions),
  }).catch(() => {
    // KV unavailable — localStorage is still the source of truth
  })
}
