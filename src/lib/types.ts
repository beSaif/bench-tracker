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
}

export const ATHLETE_NAME = "Saif"
export const TARGET_E1RM = 140
export const TARGET_BW = 60
export const START_DATE = "2026-03-21"
export const STORAGE_KEY = "bench-tracker-sessions"
