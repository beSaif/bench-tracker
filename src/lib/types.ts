export interface MainLiftSet {
  id: string
  kg: number
  reps: number
  rpe: number | null
  e1rm: number | null
  note: string
  isWarmup: boolean
}

/** "Free" is a Balanced-mode session: accessories only, no main lift, no block. */
export type SessionType = "Volume" | "Intensity" | "Peak" | "Deload" | "Free"

export interface Session {
  id: number
  date: string | null
  type: SessionType
  bw: number | null
  sets: MainLiftSet[]
  confirmed: boolean
  coachNote: string
  selectedMuscleGroups?: MuscleGroup[]
  selectedTrainingDayId?: string
  extraWorkouts?: ExtraWorkout[]
  blockId?: number
}

export type BlockPhase = "accumulation" | "transmutation" | "realization" | "deload" | "reacclimation"
export type BlockStatus = "active" | "completed" | "interrupted"

export interface TrainingBlock {
  id: number
  phase: BlockPhase
  status: BlockStatus
  sessionIds: number[]
  anchorWeight: number
  startDate: string | null
  endDate: string | null
  /** Re-acclimation only: per-session rebuild loads (kg). Block length = rebuildLoads.length. */
  rebuildLoads?: number[]
  /** Re-acclimation only: id of the interrupted block to reactivate once rebuilds are done. */
  resumeBlockId?: number
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

/**
 * How the app is organised for this user.
 * - "lift-focused": one main lift opens every session, block periodization, target tracking.
 * - "balanced": sessions are whatever the training day says; no main lift, no blocks.
 * Profiles saved before this field existed have no value and are treated as lift-focused.
 */
export type TrainingMode = "lift-focused" | "balanced"

export const TRAINING_MODE_LABEL: Record<TrainingMode, string> = {
  "lift-focused": "Lift-focused",
  balanced: "Balanced",
}

export const TRAINING_MODE_DESC: Record<TrainingMode, string> = {
  "lift-focused": "One main lift opens every session. Block periodization, prescribed loads and a target to chase.",
  balanced: "Just your training days. Log whatever the day calls for, no forced lift and no block phases.",
}

export interface UserProfile {
  email: string
  name: string
  bw: number
  trainingMode?: TrainingMode
  /** Required in lift-focused mode; absent for Balanced users who never picked one. */
  mainLift?: MainLift
  anchor?: number
  target?: number
  createdAt: string
}

export const STORAGE_KEY = "lift-tracker-sessions"
export const DRAFT_KEY = "lift-tracker-draft"
export const BLOCKS_KEY = "lift-tracker-blocks"
export const EXERCISES_KEY = "lift-tracker-exercises"
export const PROFILE_KEY = "lift-tracker-profile"
export const PRESENCES_KEY = "lift-tracker-presences"
export const FRIENDS_KEY = "lift-tracker-friends"
export const LAYOFF_DISMISS_KEY = "lift-tracker-layoff-dismissed"
export const WHATS_NEW_SEEN_KEY = "lift-tracker-whats-new-seen"

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
  restEndTime?: number | null
}

export interface PresenceRecord {
  inSession: boolean
  startedAt: string | null
}

export interface UserPresence extends PresenceRecord {
  email: string
  name: string
}

export interface FriendRequest {
  email: string
  name: string
  sentAt: string
}

export type MuscleGroup = string

export interface TrainingDay {
  id: string
  name: string
  order: number
  muscleGroupIds: string[]
}

export const TRAINING_DAYS_KEY = "lift-tracker-training-days"

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

export interface GymbroMessage {
  id: string
  fromEmail: string
  fromName: string
  text: string
  sentAt: string
}
