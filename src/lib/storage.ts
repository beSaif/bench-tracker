import { Session, TrainingBlock, STORAGE_KEY, BLOCKS_KEY, SessionDraft, DRAFT_KEY, EXERCISES_KEY, PROFILE_KEY, PRESENCES_KEY, FRIENDS_KEY, UserProfile, UserPresence } from "./types"
import { MuscleGroupConfig, DEFAULT_MUSCLE_GROUPS } from "./exerciseConfig"

type StoredData = { sessions: Session[]; blocks: TrainingBlock[] }

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

export function loadBlocksLocal(): TrainingBlock[] {
  try {
    const raw = localStorage.getItem(BLOCKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TrainingBlock[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadExerciseConfigLocal(): MuscleGroupConfig[] {
  try {
    const raw = localStorage.getItem(EXERCISES_KEY)
    if (!raw) return DEFAULT_MUSCLE_GROUPS
    const parsed = JSON.parse(raw) as MuscleGroupConfig[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MUSCLE_GROUPS
  } catch {
    return DEFAULT_MUSCLE_GROUPS
  }
}

export function loadProfileLocal(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as UserProfile
  } catch {
    return null
  }
}

function saveLocal(sessions: Session[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function saveBlocksLocal(blocks: TrainingBlock[]): void {
  localStorage.setItem(BLOCKS_KEY, JSON.stringify(blocks))
}

function saveExerciseConfigLocal(config: MuscleGroupConfig[]): void {
  localStorage.setItem(EXERCISES_KEY, JSON.stringify(config))
}

function saveProfileLocal(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const res = await fetch("/api/profile")
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === "object" && data.email) {
        saveProfileLocal(data)
        return data as UserProfile
      }
      return null
    }
  } catch {
    // fall through
  }
  return loadProfileLocal()
}

export async function saveProfile(profile: Omit<UserProfile, "email" | "createdAt">): Promise<UserProfile | null> {
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
    if (!res.ok) return null
    const data = (await res.json()) as UserProfile
    saveProfileLocal(data)
    return data
  } catch {
    return null
  }
}

/** Wipe all per-user local data — call on sign out. */
export function wipeLocalUserData(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(BLOCKS_KEY)
  localStorage.removeItem(EXERCISES_KEY)
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(DRAFT_KEY)
}

/** Load sessions + blocks from KV, falling back to localStorage. */
export async function loadAll(): Promise<StoredData> {
  try {
    const res = await fetch("/api/sessions")
    if (res.ok) {
      const data = await res.json()
      if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray(data.sessions)) {
        saveLocal(data.sessions)
        saveBlocksLocal(data.blocks ?? [])
        return { sessions: data.sessions, blocks: data.blocks ?? [] }
      }
      // Legacy format: plain array of sessions
      if (Array.isArray(data) && data.length > 0) {
        saveLocal(data)
        return { sessions: data, blocks: [] }
      }
    }
  } catch {
    // Network/KV unavailable — fall through to localStorage
  }

  return {
    sessions: loadSessionsLocal(),
    blocks: loadBlocksLocal(),
  }
}

/** Load exercise config from KV, falling back to localStorage. */
export async function loadExerciseConfig(): Promise<MuscleGroupConfig[]> {
  try {
    const res = await fetch("/api/exercises")
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        saveExerciseConfigLocal(data)
        return data
      }
    }
  } catch {
    // fall through
  }
  return loadExerciseConfigLocal()
}

/** Save exercise config to localStorage (sync) and KV (async, best-effort). */
export function saveExerciseConfig(config: MuscleGroupConfig[]): void {
  saveExerciseConfigLocal(config)
  fetch("/api/exercises", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  }).catch(() => {})
}

/** Save sessions + blocks to localStorage (sync) and KV (async, best-effort). */
export function saveAll(sessions: Session[], blocks: TrainingBlock[]): void {
  saveLocal(sessions)
  saveBlocksLocal(blocks)
  fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessions, blocks }),
  }).catch(() => {})
}

export function saveDraft(draft: SessionDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function loadDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionDraft
  } catch {
    return null
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

export function loadPresencesLocal(): UserPresence[] {
  try {
    const raw = localStorage.getItem(PRESENCES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as UserPresence[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePresencesLocal(presences: UserPresence[]): void {
  localStorage.setItem(PRESENCES_KEY, JSON.stringify(presences))
}

export function loadFriendEmailsLocal(): string[] {
  try {
    const raw = localStorage.getItem(FRIENDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFriendEmailsLocal(emails: string[]): void {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(emails))
}

const FRIEND_LAST_ACTIVE_KEY = "bench_friend_last_active"

export function loadFriendLastActiveLocal(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FRIEND_LAST_ACTIVE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function saveFriendLastActiveLocal(dates: Record<string, string>): void {
  localStorage.setItem(FRIEND_LAST_ACTIVE_KEY, JSON.stringify(dates))
}

const MINI_PLAYER_KEY = 'lift-tracker-mini-player'

export interface MiniPlayerState {
  sessionId: string | number
  label: string
  setsCompleted: number
  totalSets: number
  restEndTime: number | null
}

export function saveMiniPlayer(state: MiniPlayerState): void {
  localStorage.setItem(MINI_PLAYER_KEY, JSON.stringify(state))
}

export function loadMiniPlayer(): MiniPlayerState | null {
  try {
    const raw = localStorage.getItem(MINI_PLAYER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MiniPlayerState
  } catch {
    return null
  }
}

export function clearMiniPlayer(): void {
  localStorage.removeItem(MINI_PLAYER_KEY)
}
