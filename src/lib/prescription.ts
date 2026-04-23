import { Session, TrainingBlock, BlockPhase, SessionType } from "./types"
import { roundToPlate } from "./e1rm"

interface Prescription {
  weight: number
  reps: number
  sets: number
  sessionType: SessionType
}

export const BLOCK_LENGTHS: Record<BlockPhase, number> = {
  accumulation: 4,
  transmutation: 4,
  realization: 3,
  deload: 1,
}

export const PHASE_LABEL: Record<BlockPhase, string> = {
  accumulation: "Accumulation",
  transmutation: "Transmutation",
  realization: "Realization",
  deload: "Deload",
}

const BLOCK_PHASE_ORDER: BlockPhase[] = ["accumulation", "transmutation", "realization", "deload"]

const ACCUMULATION_SCHEME = [
  { pct: 0.675, reps: 8, sets: 4 },
  { pct: 0.700, reps: 7, sets: 4 },
  { pct: 0.725, reps: 6, sets: 4 },
  { pct: 0.750, reps: 6, sets: 5 },
]

const TRANSMUTATION_SCHEME = [
  { pct: 0.800, reps: 5, sets: 4 },
  { pct: 0.825, reps: 4, sets: 4 },
  { pct: 0.850, reps: 3, sets: 4 },
  { pct: 0.875, reps: 3, sets: 4 },
]

const REALIZATION_SCHEME = [
  { pct: 0.900, reps: 3, sets: 3 },
  { pct: 0.950, reps: 2, sets: 2 },
  { pct: 1.000, reps: 1, sets: 1 },
]

const DELOAD_SCHEME = [
  { pct: 0.600, reps: 5, sets: 3 },
]

const PHASE_SCHEMES: Record<BlockPhase, Array<{ pct: number; reps: number; sets: number }>> = {
  accumulation: ACCUMULATION_SCHEME,
  transmutation: TRANSMUTATION_SCHEME,
  realization: REALIZATION_SCHEME,
  deload: DELOAD_SCHEME,
}

const PHASE_SESSION_TYPE: Record<BlockPhase, SessionType> = {
  accumulation: "Volume",
  transmutation: "Intensity",
  realization: "Peak",
  deload: "Deload",
}

function getWorkingSets(session: Session) {
  return session.sets.filter((s) => !s.isWarmup)
}

function getLastWorkingSet(session: Session) {
  const working = getWorkingSets(session)
  return working.length > 0 ? working[working.length - 1] : null
}

export function nextBlockPhase(current: BlockPhase): BlockPhase {
  const idx = BLOCK_PHASE_ORDER.indexOf(current)
  return BLOCK_PHASE_ORDER[(idx + 1) % BLOCK_PHASE_ORDER.length]
}

export function prescribeBlockSession(
  phase: BlockPhase,
  sessionIndexInBlock: number,
  anchorWeight: number
): Prescription {
  const scheme = PHASE_SCHEMES[phase]
  const entry = scheme[Math.min(sessionIndexInBlock, scheme.length - 1)]
  return {
    weight: roundToPlate(anchorWeight * entry.pct),
    reps: entry.reps,
    sets: entry.sets,
    sessionType: PHASE_SESSION_TYPE[phase],
  }
}

/** After a realization block, determine the anchor for the next cycle. */
export function deriveNextAnchor(completedRealizationBlock: TrainingBlock, sessions: Session[]): number {
  const blockSessions = sessions.filter(
    (s) => s.confirmed && completedRealizationBlock.sessionIds.includes(s.id)
  )
  const peakSessions = blockSessions.filter((s) => s.type === "Peak")
  const lastPeak = peakSessions[peakSessions.length - 1]

  if (!lastPeak) return completedRealizationBlock.anchorWeight

  const lastPeakWeight = getWorkingSets(lastPeak)[0]?.kg ?? completedRealizationBlock.anchorWeight
  const lastPeakRPE = getLastWorkingSet(lastPeak)?.rpe ?? null

  return lastPeakRPE !== null && lastPeakRPE <= 7.5
    ? lastPeakWeight + 2.5
    : lastPeakWeight
}

/** Factory for the next block after a completed one. */
export function createNextBlock(
  completedBlock: TrainingBlock,
  sessions: Session[],
  newId: number
): TrainingBlock {
  const phase = nextBlockPhase(completedBlock.phase)
  // Bump anchor only when finishing realization (before the deload between cycles)
  const anchor =
    completedBlock.phase === "realization"
      ? deriveNextAnchor(completedBlock, sessions)
      : completedBlock.anchorWeight

  return {
    id: newId,
    phase,
    status: "active",
    sessionIds: [],
    anchorWeight: anchor,
    startDate: null,
    endDate: null,
  }
}

/** Derive starting anchor weight from existing confirmed sessions (first-run only). */
export function deriveInitialAnchor(confirmedSessions: Session[]): number {
  if (confirmedSessions.length === 0) return 60

  const sorted = [...confirmedSessions].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  // Prefer last Peak session's first working set weight
  const peaks = sorted.filter((s) => s.type === "Peak")
  if (peaks.length > 0) {
    const w = getWorkingSets(peaks[peaks.length - 1])[0]?.kg
    if (w) return w
  }

  // Fallback: last confirmed session
  return getWorkingSets(sorted[sorted.length - 1])[0]?.kg ?? 60
}

/**
 * One-time migration: assigns SessionType to historical "Push" sessions
 * by their chronological position in the old 13-session macro cycle.
 */
export function migrateSessionTypes(sessions: Session[]): Session[] | null {
  const needsMigration = sessions.some((s) => s.confirmed && (s.type as string) === "Push")
  if (!needsMigration) return null

  const LEGACY_BLOCK: SessionType[] = ["Volume", "Intensity", "Peak"]
  const LEGACY_MACRO_TOTAL = 13

  const allConfirmed = sessions
    .filter((s) => s.confirmed)
    .sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })

  const typeMap = new Map<number, SessionType>()
  allConfirmed.forEach((s, i) => {
    const pos = i % LEGACY_MACRO_TOTAL
    typeMap.set(s.id, pos === 12 ? "Deload" : LEGACY_BLOCK[pos % 3])
  })

  return allConfirmed.map((s) => ({ ...s, type: typeMap.get(s.id) ?? s.type }))
}
