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
  reacclimation: 2,
}

export const PHASE_LABEL: Record<BlockPhase, string> = {
  accumulation: "Accumulation",
  transmutation: "Transmutation",
  realization: "Realization",
  deload: "Deload",
  reacclimation: "Re-acclimation",
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

// Fallback scheme if a reacclimation block has no explicit rebuildLoads (rebuild
// loads are normally computed to ramp from current capability back to the plan).
const REACCLIMATION_SCHEME = [
  { pct: 0.675, reps: 5, sets: 3 },
  { pct: 0.750, reps: 5, sets: 4 },
]

// Reps/sets for rebuild (reacclimation) sessions — light, moderate volume.
export const REBUILD_REPS = 5
export const REBUILD_SETS = 3

const PHASE_SCHEMES: Record<BlockPhase, Array<{ pct: number; reps: number; sets: number }>> = {
  accumulation: ACCUMULATION_SCHEME,
  transmutation: TRANSMUTATION_SCHEME,
  realization: REALIZATION_SCHEME,
  deload: DELOAD_SCHEME,
  reacclimation: REACCLIMATION_SCHEME,
}

export const PHASE_SESSION_TYPE: Record<BlockPhase, SessionType> = {
  accumulation: "Volume",
  transmutation: "Intensity",
  realization: "Peak",
  deload: "Deload",
  reacclimation: "Volume",
}

export function getWorkingSets(session: Session) {
  return session.sets.filter((s) => !s.isWarmup)
}

export function getLastWorkingSet(session: Session) {
  const working = getWorkingSets(session)
  return working.length > 0 ? working[working.length - 1] : null
}

export function nextBlockPhase(current: BlockPhase): BlockPhase {
  // Re-acclimation is an out-of-cycle bridge block: after it, restart the cycle.
  if (current === "reacclimation") return "accumulation"
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

/** Number of sessions a block runs for (dynamic for reacclimation rebuild blocks). */
export function getBlockLength(block: TrainingBlock): number {
  if (block.phase === "reacclimation" && block.rebuildLoads) return block.rebuildLoads.length
  return BLOCK_LENGTHS[block.phase]
}

/**
 * Prescribe a session for a specific block. Reacclimation blocks use their
 * explicit rebuildLoads (a ramp back to the interrupted plan); every other
 * block uses the percentage-of-anchor scheme.
 */
export function prescribeSessionForBlock(block: TrainingBlock, sessionIndexInBlock: number): Prescription {
  if (block.phase === "reacclimation" && block.rebuildLoads && block.rebuildLoads.length > 0) {
    const idx = Math.min(sessionIndexInBlock, block.rebuildLoads.length - 1)
    return {
      weight: block.rebuildLoads[idx],
      reps: REBUILD_REPS,
      sets: REBUILD_SETS,
      sessionType: PHASE_SESSION_TYPE.reacclimation,
    }
  }
  return prescribeBlockSession(block.phase, sessionIndexInBlock, block.anchorWeight)
}

/**
 * How much to move the anchor for the next cycle, based on how the realization
 * top single felt. Shared by the silent fallback (deriveNextAnchor) and the
 * user-facing chooser (suggestNextAnchor) so "ignore the prompt" and "pick the
 * recommended option" land on the same weight.
 */
export function nextAnchorDelta(topSingleRPE: number | null): number {
  if (topSingleRPE == null || topSingleRPE <= 6.5) return 5
  if (topSingleRPE <= 7.5) return 2.5
  if (topSingleRPE <= 8.5) return 0
  return -2.5
}

function lastRealizationTopSet(
  block: TrainingBlock,
  sessions: Session[]
): { weight: number; rpe: number | null } | null {
  const blockSessions = sessions.filter((s) => s.confirmed && block.sessionIds.includes(s.id))
  const peakSessions = blockSessions.filter((s) => s.type === "Peak")
  const lastPeak = peakSessions[peakSessions.length - 1]
  if (!lastPeak) return null
  const topSet = getWorkingSets(lastPeak)[0]
  if (!topSet) return null
  return { weight: topSet.kg, rpe: getLastWorkingSet(lastPeak)?.rpe ?? null }
}

/** After a realization block, the anchor for the next cycle (silent fallback). */
export function deriveNextAnchor(completedRealizationBlock: TrainingBlock, sessions: Session[]): number {
  const top = lastRealizationTopSet(completedRealizationBlock, sessions)
  if (!top) return completedRealizationBlock.anchorWeight
  return roundToPlate(top.weight + nextAnchorDelta(top.rpe))
}

export interface NextAnchorSuggestion {
  /** Realization top single the suggestion is built from. */
  basisWeight: number
  basisRPE: number | null
  /** RPE-scaled recommendation (also the silent fallback). */
  recommended: number
  /** Distinct plate-rounded options, recommended first. */
  options: number[]
  /** Stable identity so a handled suggestion is not re-shown. */
  signature: string
}

/**
 * When the active block is a fresh deload directly following a completed
 * realization block, propose next-cycle anchor options off the top single.
 * Returns null at every other point. Purely derived from the caller's data.
 */
export function suggestNextAnchor(
  blocks: TrainingBlock[],
  sessions: Session[]
): NextAnchorSuggestion | null {
  const active = blocks.find((b) => b.status === "active")
  if (!active || active.phase !== "deload" || active.sessionIds.length > 0) return null
  const prev = blocks.find((b) => b.id === active.id - 1)
  if (!prev || prev.phase !== "realization" || prev.status !== "completed") return null

  const top = lastRealizationTopSet(prev, sessions)
  if (!top) return null

  const delta = nextAnchorDelta(top.rpe)
  // Recommended first, then a step up and a step down for user override.
  const rawDeltas = delta === 0 ? [0, 2.5, -2.5] : delta > 0 ? [delta, delta + 2.5, 0] : [delta, 0, delta - 2.5]
  const options: number[] = []
  for (const d of rawDeltas) {
    const w = roundToPlate(top.weight + d)
    if (w > 0 && !options.includes(w)) options.push(w)
  }

  return {
    basisWeight: top.weight,
    basisRPE: top.rpe,
    recommended: options[0],
    options,
    signature: `nextanchor|${active.id}|${top.weight}`,
  }
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

/**
 * Factory for a rebuild (reacclimation) block: keeps the interrupted block's
 * anchor unchanged, carries the explicit ramp loads, and remembers which block
 * to resume once the rebuild is done.
 */
export function createReacclimationBlock(
  newId: number,
  anchorWeight: number,
  rebuildLoads: number[],
  resumeBlockId: number
): TrainingBlock {
  return {
    id: newId,
    phase: "reacclimation",
    status: "active",
    sessionIds: [],
    anchorWeight,
    startDate: null,
    endDate: null,
    rebuildLoads,
    resumeBlockId,
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
