export interface MainLiftSet {
  id: string
  kg: number
  reps: number
  rpe: number | null
  e1rm: number | null
  note: string
  isWarmup: boolean
}

export type SessionType = "Volume" | "Intensity" | "Peak" | "Deload"

export interface Session {
  id: number
  date: string | null
  type: SessionType
  bw: number | null
  sets: MainLiftSet[]
  confirmed: boolean
  coachNote: string
  selectedMuscleGroups?: MuscleGroup[]
  extraWorkouts?: ExtraWorkout[]
  blockId?: number
}

export type BlockPhase = "accumulation" | "transmutation" | "realization" | "deload"
export type BlockStatus = "active" | "completed"

export interface TrainingBlock {
  id: number
  phase: BlockPhase
  status: BlockStatus
  sessionIds: number[]
  anchorWeight: number
  startDate: string | null
  endDate: string | null
}

export type MainLift = "bench" | "deadlift" | "squat"

export const MAIN_LIFT_LABEL: Record<MainLift, string> = {
  bench: "Bench Press",
  deadlift: "Deadlift",
  squat: "Squat",
}

export const MAIN_LIFT_SHORT: Record<MainLift, string> = {
  bench: "Bench",
  deadlift: "Deadlift",
  squat: "Squat",
}

export interface UserProfile {
  email: string
  name: string
  bw: number
  mainLift: MainLift
  anchor: number
  target: number
  createdAt: string
}

export const STORAGE_KEY = "lift-tracker-sessions"
export const DRAFT_KEY = "lift-tracker-draft"
export const BLOCKS_KEY = "lift-tracker-blocks"
export const EXERCISES_KEY = "lift-tracker-exercises"
export const PROFILE_KEY = "lift-tracker-profile"

export interface SessionDraft {
  sessionId: number
  savedAt: string
  sets: Array<{
    id: string
    kg: number
    reps: number
    rpe: number | null
    e1rm: number | null
    note: string
    isWarmup: boolean
    _kgStr: string
    _repsStr: string
    _rpeStr: string
  }>
  completedSets: string[]
  extraState: Record<string, Record<string, Array<{ kgStr: string; repsStr: string }>>>
  coachNote: string
  currentSetIndex: number
  exerciseOrder?: Array<
    | { kind: "main" }
    | { kind: "extra"; muscle: MuscleGroup; exercise: string }
  >
}

export interface PresenceRecord {
  inSession: boolean
  startedAt: string | null
}

export interface UserPresence extends PresenceRecord {
  email: string
  name: string
}

export type ActivityEventType = "session_logged" | "pr_hit"

export interface ActivityEvent {
  id: string
  email: string
  name: string
  type: ActivityEventType
  payload: {
    weight?: number
    sessionType?: string
    sessionId?: number
  }
  timestamp: string
}

export type ReactionEmoji = "🔥" | "💪" | "💀"
export const REACTION_EMOJIS: ReactionEmoji[] = ["🔥", "💪", "💀"]
export type ReactionsMap = Record<ReactionEmoji, string[]>

export interface Comment {
  email: string
  name: string
  text: string
  timestamp: string
}

export interface LeaderEntry {
  rank: number
  name: string
  email: string
  value: number
}

export interface LeaderboardResult {
  bySessionCount: LeaderEntry[]
  byE1RM: LeaderEntry[]
  weekStart: string
}

export type MuscleGroup = string

export interface ExtraSet {
  kg: number
  reps: number
  rpe: number | null
}

export interface ExtraExercise {
  name: string
  sets: ExtraSet[]
}

export interface ExtraWorkout {
  muscle: MuscleGroup
  exercises: ExtraExercise[]
}
