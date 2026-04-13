export interface BenchSet {
  id: string
  kg: number
  reps: number
  rpe: number | null
  e1rm: number | null
  note: string
  isWarmup: boolean
}

export interface Session {
  id: number
  date: string | null
  type: string
  bw: number | null
  sets: BenchSet[]
  confirmed: boolean
  coachNote: string
  selectedMuscleGroups?: MuscleGroup[]
  extraWorkouts?: ExtraWorkout[]
}

export const ATHLETE_NAME = "Saif"
export const TARGET_E1RM = 140
export const TARGET_BW = 60
export const START_DATE = "2026-03-21"
export const STORAGE_KEY = "bench-tracker-sessions"

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
