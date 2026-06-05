import { Session } from "@/lib/types"

export function getBestE1RM(sessions: Session[]): number | null {
  const validSets = sessions
    .filter((s) => s.confirmed && s.date != null && s.type !== "Deload")
    .flatMap((s) => s.sets.filter((set) => !set.isWarmup))
    .map((set) => set.e1rm)
    .filter((v): v is number => v != null)
  return validSets.length > 0 ? Math.max(...validSets) : null
}

export function getBestWeight(sessions: Session[]): number | null {
  const all = sessions
    .filter((s) => s.confirmed)
    .flatMap((s) => s.sets.filter((set) => !set.isWarmup))
    .map((s) => s.kg)
    .filter((v): v is number => v != null)
  return all.length > 0 ? Math.max(...all) : null
}

export function getLatestBW(sessions: Session[]): number | null {
  const withBW = sessions
    .filter((s) => s.confirmed && s.bw != null && s.date != null)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  return withBW[0]?.bw ?? null
}

export interface SessionSummary {
  weight: number | null
  reps: number | null
  setCount: number
  bestE1RM: number | null
}

/** Top working-set weight/reps, working-set count, and best e1RM for a single session. */
export function sessionSummary(session: Session): SessionSummary {
  const working = session.sets.filter((s) => !s.isWarmup)
  const e1rms = working.map((s) => s.e1rm).filter((v): v is number => v != null)
  return {
    weight: working[0]?.kg ?? null,
    reps: working[0]?.reps ?? null,
    setCount: working.length,
    bestE1RM: e1rms.length > 0 ? Math.max(...e1rms) : null,
  }
}
