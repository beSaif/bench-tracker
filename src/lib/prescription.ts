import { Session, SessionType } from "./types"
import { roundToPlate } from "./e1rm"

interface Prescription {
  weight: number
  reps: number
  sets: number
  sessionType: SessionType
}

const BLOCK: SessionType[] = ["Volume", "Intensity", "Peak"]
const MACRO_TOTAL = 13 // 4 blocks × 3 + 1 deload

const SCHEMES: Record<SessionType, { pct: number; reps: number; sets: number }> = {
  Volume:    { pct: 0.70, reps: 5, sets: 4 },
  Intensity: { pct: 0.82, reps: 3, sets: 4 },
  Peak:      { pct: 1.00, reps: 3, sets: 3 },
  Deload:    { pct: 0.60, reps: 5, sets: 3 },
}

function getWorkingSets(session: Session) {
  return session.sets.filter((s) => !s.isWarmup)
}

function getLastWorkingSet(session: Session) {
  const working = getWorkingSets(session)
  return working.length > 0 ? working[working.length - 1] : null
}

/**
 * One-time migration: assigns SessionType to historical "Push" sessions
 * by their chronological position in the cycle.
 * Returns the updated confirmed-only array, or null if no migration was needed.
 */
export function migrateSessionTypes(sessions: Session[]): Session[] | null {
  const needsMigration = sessions.some((s) => s.confirmed && (s.type as string) === "Push")
  if (!needsMigration) return null

  const allConfirmed = sessions
    .filter((s) => s.confirmed)
    .sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })

  const typeMap = new Map<number, SessionType>()
  allConfirmed.forEach((s, i) => {
    const pos = i % MACRO_TOTAL
    typeMap.set(s.id, pos === 12 ? "Deload" : BLOCK[pos % 3])
  })

  return allConfirmed.map((s) => ({ ...s, type: typeMap.get(s.id) ?? s.type }))
}

export function prescribeNext(sessions: Session[]): Prescription {
  const confirmed = sessions
    .filter((s) => s.confirmed)
    .sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })

  // Determine next session type from cycle position
  const pos = confirmed.length % MACRO_TOTAL
  const nextType: SessionType = pos === 12 ? "Deload" : BLOCK[pos % 3]

  // Find the Peak anchor weight
  const peakSessions = confirmed.filter((s) => s.type === "Peak")
  const lastPeak = peakSessions[peakSessions.length - 1]

  let anchor: number
  if (lastPeak) {
    const lastPeakWeight = getWorkingSets(lastPeak)[0]?.kg ?? 60
    const lastPeakRPE = getLastWorkingSet(lastPeak)?.rpe ?? null

    if (nextType === "Peak") {
      // Only bump anchor when prescribing the next Peak session
      anchor = lastPeakRPE !== null && lastPeakRPE <= 7.5
        ? lastPeakWeight + 2.5
        : lastPeakWeight
    } else {
      anchor = lastPeakWeight
    }
  } else {
    // Migration / first run: use last confirmed session weight as anchor,
    // or default to 60kg
    const lastWeight = confirmed.length > 0
      ? getWorkingSets(confirmed[confirmed.length - 1])[0]?.kg ?? 60
      : 60
    anchor = lastWeight
  }

  const scheme = SCHEMES[nextType]
  const weight = roundToPlate(anchor * scheme.pct)

  return {
    weight,
    reps: scheme.reps,
    sets: scheme.sets,
    sessionType: nextType,
  }
}
