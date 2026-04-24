export interface BenchSet {
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
  sets: BenchSet[]
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

export const ATHLETE_NAME = "Saif"
export const TARGET_E1RM = 140
export const TARGET_BW = 60
export const START_DATE = "2026-03-21"
export const STORAGE_KEY = "bench-tracker-sessions"
export const DRAFT_KEY = "bench-tracker-draft"
export const BLOCKS_KEY = "bench-tracker-blocks"

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
    | { kind: "bench" }
    | { kind: "extra"; muscle: MuscleGroup; exercise: string }
  >
}

export type MuscleGroup = "back" | "triceps" | "chest" | "biceps" | "shoulders" | "legs"

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  back: "Back",
  triceps: "Triceps",
  chest: "Chest",
  biceps: "Biceps",
  shoulders: "Shoulders",
  legs: "Legs",
}

export const MUSCLE_GROUP_EXERCISES: Record<MuscleGroup, readonly string[]> = {
  back: ["Lat Pulldown", "Single Cable Seated Pulldown", "Cross Rear Delt Fly"],
  triceps: ["Overhead Extension", "Bar Pulldown", "Single Arm Cable Pulldown"],
  chest: ["Dumbbell Incline Press", "Machine Seated Chest Press"],
  biceps: ["ZBar Curls", "Dumbbell Curl", "Hammer Curl"],
  shoulders: ["Dumbbell Shoulder Press", "Cable Lateral Raise", "Face Pulls"],
  legs: ["Leg Extension", "Leg Curl", "Leg Press"],
}

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
