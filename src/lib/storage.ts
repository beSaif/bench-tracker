import { Session, TrainingBlock, STORAGE_KEY, BLOCKS_KEY, SessionDraft, DRAFT_KEY, EXERCISES_KEY, PROFILE_KEY, PRESENCES_KEY, FRIENDS_KEY, TRAINING_DAYS_KEY, LAYOFF_DISMISS_KEY, EXERCISES_MIGRATION_KEY, WEIGHTS_KEY, WEIGH_IN_SKIP_KEY, UserProfile, UserPresence, TrainingDay, WeightEntry } from "./types"
import { MuscleGroupConfig, DEFAULT_MUSCLE_GROUPS, DEFAULT_TRAINING_DAYS, EXERCISE_CONFIG_MIGRATION, migrateExerciseConfig } from "./exerciseConfig"
import { PersonSummary } from "./routines"

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

/** Whether the one-time repairs in `migrateExerciseConfig` still need to run here. */
function exerciseMigrationPending(): boolean {
  try {
    const raw = localStorage.getItem(EXERCISES_MIGRATION_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return !(Number.isFinite(n) && n >= EXERCISE_CONFIG_MIGRATION)
  } catch {
    return true
  }
}

function markExerciseMigrationDone(): void {
  try {
    localStorage.setItem(EXERCISES_MIGRATION_KEY, String(EXERCISE_CONFIG_MIGRATION))
  } catch {
    // Private mode / quota — the migration just no-ops next load, since by then the
    // config it repaired already carries the exercise it would add.
  }
}

/**
 * The config on this device. Pending migrations are applied in memory so the first
 * paint matches what `loadExerciseConfig` is about to persist; nothing is written here,
 * because this runs inside render.
 */
export function loadExerciseConfigLocal(): MuscleGroupConfig[] {
  try {
    const raw = localStorage.getItem(EXERCISES_KEY)
    if (!raw) return DEFAULT_MUSCLE_GROUPS
    const parsed = JSON.parse(raw) as MuscleGroupConfig[]
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_MUSCLE_GROUPS
    return exerciseMigrationPending() ? migrateExerciseConfig(parsed) : parsed
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

export function loadTrainingDaysLocal(): TrainingDay[] {
  try {
    const raw = localStorage.getItem(TRAINING_DAYS_KEY)
    if (!raw) return DEFAULT_TRAINING_DAYS
    const parsed = JSON.parse(raw) as TrainingDay[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TRAINING_DAYS
  } catch {
    return DEFAULT_TRAINING_DAYS
  }
}

function saveTrainingDaysLocal(days: TrainingDay[]): void {
  localStorage.setItem(TRAINING_DAYS_KEY, JSON.stringify(days))
}

export async function loadTrainingDays(): Promise<TrainingDay[]> {
  try {
    const res = await fetch("/api/training-days")
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        saveTrainingDaysLocal(data)
        return data
      }
    }
  } catch {
    // fall through
  }
  return loadTrainingDaysLocal()
}

export function saveTrainingDays(days: TrainingDay[]): void {
  saveTrainingDaysLocal(days)
  fetch("/api/training-days", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(days),
  }).catch(() => {})
}

export function loadWeightsLocal(): WeightEntry[] {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WeightEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveWeightsLocal(entries: WeightEntry[]): void {
  localStorage.setItem(WEIGHTS_KEY, JSON.stringify(entries))
}

/**
 * Load the weight log from KV, falling back to localStorage.
 *
 * Unlike `loadTrainingDays` above, an empty array from the server is accepted rather
 * than treated as "nothing there": deleting your last weigh-in on another device is a
 * legitimate state that has to propagate. The route sends `null`, not `[]`, when the
 * key has never been written, which is what the fallback below keys off.
 */
export async function loadWeights(): Promise<WeightEntry[]> {
  try {
    const res = await fetch("/api/weights")
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        saveWeightsLocal(data)
        return data
      }
    }
  } catch {
    // fall through
  }
  return loadWeightsLocal()
}

/**
 * "skip today" on the check-in prompt, so it stops nagging for the rest of the day
 * without switching the feature off. Date-keyed, so it expires by itself at midnight —
 * the same trick `loadLayoffDismissLocal` uses to make a dismissal stick but not stick
 * forever. Device-local on purpose: skipping on your phone shouldn't skip on your laptop.
 */
export function loadWeighInSkipLocal(): string | null {
  try {
    return localStorage.getItem(WEIGH_IN_SKIP_KEY)
  } catch {
    return null
  }
}

export function saveWeighInSkipLocal(day: string): void {
  try {
    localStorage.setItem(WEIGH_IN_SKIP_KEY, day)
  } catch {
    // Private mode / quota — the prompt just reappears on the next load.
  }
}

/**
 * Save the weight log to localStorage (sync) and KV (async, best-effort) — the same
 * guarantee `saveAll` gives sessions, so a check-in in a basement gym still sticks.
 *
 * The server pins `profile.bw` to the newest reading; mirror that into the cached
 * profile here so /profile and the share card show the new number straight away
 * instead of waiting for the next KV round trip.
 */
export function saveWeights(entries: WeightEntry[]): void {
  saveWeightsLocal(entries)

  const newest = entries[entries.length - 1]
  if (newest) {
    const profile = loadProfileLocal()
    if (profile && profile.bw !== newest.kg) {
      try {
        saveProfileLocal({ ...profile, bw: newest.kg })
      } catch {
        // Private mode / quota — KV still has it, and the next load re-syncs.
      }
    }
  }

  fetch("/api/weights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  }).catch(() => {})
}

/** Wipe all per-user local data — call on sign out. */
export function wipeLocalUserData(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(BLOCKS_KEY)
  localStorage.removeItem(EXERCISES_KEY)
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(DRAFT_KEY)
  localStorage.removeItem(TRAINING_DAYS_KEY)
  localStorage.removeItem(LAYOFF_DISMISS_KEY)
  localStorage.removeItem(WEIGHTS_KEY)
  localStorage.removeItem(WEIGH_IN_SKIP_KEY)
}

/**
 * The layoff banner the user last dismissed, as "<last session date>:<tier>", so a
 * dismissal sticks across reloads but a fresh layoff — or one that escalates from a
 * nudge to a restart suggestion — surfaces again.
 */
export function loadLayoffDismissLocal(): string | null {
  try {
    return localStorage.getItem(LAYOFF_DISMISS_KEY)
  } catch {
    return null
  }
}

export function saveLayoffDismissLocal(key: string): void {
  try {
    localStorage.setItem(LAYOFF_DISMISS_KEY, key)
  } catch {
    // Private mode / quota — the banner just reappears next load.
  }
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
  let stored: MuscleGroupConfig[] | null = null
  try {
    const res = await fetch("/api/exercises")
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) stored = data as MuscleGroupConfig[]
    }
  } catch {
    // fall through
  }
  if (!stored) return loadExerciseConfigLocal()

  const config = exerciseMigrationPending() ? migrateExerciseConfig(stored) : stored
  // A changed reference means the migration had something to add; write it through so
  // it is not redone. Either way it is now spent — from here the config is the user's.
  if (config !== stored) saveExerciseConfig(config)
  else saveExerciseConfigLocal(config)
  markExerciseMigrationDone()
  return config
}

/** Who this account trains under, or null. Null too when offline — nothing is cached. */
export async function loadCoach(): Promise<PersonSummary | null> {
  try {
    const res = await fetch("/api/coach")
    if (!res.ok) return null
    const data = await res.json()
    return data && typeof data === "object" && data.email ? (data as PersonSummary) : null
  } catch {
    return null
  }
}

/**
 * Train under someone. Their routine replaces this account's groups and days and
 * stays linked; the server has already synced it, so this only mirrors the result
 * onto the device. Groups the routine drops are kept, retired, so history still
 * names them; training mode, main lift, anchor, target and sessions are untouched.
 */
export async function trainUnder(email: string): Promise<
  { ok: true; coach: PersonSummary } | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/coach", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) return { ok: false, error: data?.error ?? "failed" }
    saveExerciseConfigLocal(data.config)
    saveTrainingDaysLocal(data.trainingDays)
    return { ok: true, coach: data.coach as PersonSummary }
  } catch {
    return { ok: false, error: "offline" }
  }
}

/** Stop training under your coach. Their routine, as it stands, becomes your own. */
export async function stopTrainingUnderCoach(): Promise<boolean> {
  try {
    const res = await fetch("/api/coach", { method: "DELETE" })
    return res.ok
  } catch {
    return false
  }
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
