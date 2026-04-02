import { Session, STORAGE_KEY } from "./types"
import { generateSeedData } from "./seed"

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedAndSave()
    const parsed = JSON.parse(raw) as Session[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedAndSave()
    return parsed
  } catch {
    return seedAndSave()
  }
}

export function saveSessions(sessions: Session[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function seedAndSave(): Session[] {
  const seed = generateSeedData()
  saveSessions(seed)
  return seed
}
