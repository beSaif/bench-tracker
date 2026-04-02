import { Session, BenchSet } from "./types"

interface Prescription {
  weight: number
  reps: number
  sets: number
}

function getWorkingSets(session: Session): BenchSet[] {
  return session.sets.filter((s) => !s.isWarmup)
}

function getLastWorkingSet(session: Session): BenchSet | null {
  const working = getWorkingSets(session)
  return working.length > 0 ? working[working.length - 1] : null
}

export function prescribeNext(sessions: Session[]): Prescription {
  const confirmed = sessions
    .filter((s) => s.confirmed)
    .sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })

  if (confirmed.length === 0) {
    return { weight: 60, reps: 5, sets: 3 }
  }

  const last = confirmed[confirmed.length - 1]
  const lastWorking = getWorkingSets(last)
  const lastSet = getLastWorkingSet(last)

  const currentWeight = lastWorking[0]?.kg ?? 60
  const currentReps = lastWorking[0]?.reps ?? 5
  const currentSets = lastWorking.length

  if (confirmed.length === 1) {
    // Only one session — wait for a second before bumping
    return { weight: currentWeight, reps: currentReps, sets: currentSets }
  }

  const secondLast = confirmed[confirmed.length - 2]
  const secondLastWorking = getWorkingSets(secondLast)
  const secondLastWeight = secondLastWorking[0]?.kg ?? 0

  const lastRPE = lastSet?.rpe ?? null

  if (currentWeight === secondLastWeight) {
    // Same weight used twice
    if (lastRPE !== null && lastRPE <= 7) {
      // Both sessions at same weight, RPE ≤ 7 → bump weight
      return { weight: currentWeight + 2.5, reps: currentReps, sets: currentSets }
    }
    // RPE 8+ → repeat
    return { weight: currentWeight, reps: currentReps, sets: currentSets }
  }

  // New weight first time → keep same, wait for second session
  return { weight: currentWeight, reps: currentReps, sets: currentSets }
}
