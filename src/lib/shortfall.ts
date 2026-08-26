import { Session, TrainingBlock } from "./types"
import { prescribeForBlock } from "./prescription"
import { roundToPlate } from "./e1rm"

/** Step between consecutive build-block loads when ramping back toward the missed target. */
const REBUILD_STEP = 5
/** Cap on how many sessions a build block adds. */
const MAX_BUILD_SESSIONS = 3
/** Tolerance (kg) when comparing achieved vs prescribed weight. */
const WEIGHT_EPSILON = 0.1

export interface ShortfallResult {
  targetWeight: number
  targetReps: number
  targetSets: number
  /** Heaviest working-set weight actually lifted this session. */
  achievedTopWeight: number
  /** Total working-set reps performed at or above the target weight. */
  achievedTotalReps: number
  /** targetReps * targetSets. */
  targetTotalReps: number
  /** Heaviest working weight lifted — the floor the build block ramps up from. */
  lastActual: number
  /** Proposed build-block ramp of submaximal loads climbing toward targetWeight. */
  rebuildLoads: number[]
}

/** Working (non-warmup) sets of a session. */
function workingSets(session: Session) {
  return session.sets.filter((s) => !s.isWarmup)
}

/**
 * A short climb of submaximal loads from `lastActual` up toward (but below) `targetWeight`,
 * so a build block can rebuild the strength to re-attempt the missed rung. Always returns at
 * least one session so the build block is never empty.
 */
export function buildRebuildLoads(lastActual: number, targetWeight: number): number[] {
  const loads: number[] = []
  let w = roundToPlate(lastActual + REBUILD_STEP)
  while (w < targetWeight && loads.length < MAX_BUILD_SESSIONS) {
    loads.push(w)
    w = roundToPlate(w + REBUILD_STEP)
  }
  if (loads.length === 0) loads.push(roundToPlate(lastActual))
  return loads
}

/**
 * Detect whether the main lift fell short of the session's prescription — i.e. the working
 * sets missed the prescribed weight or reps. Returns null when the target was met, or for
 * phases without a percentage target (deload, and reacclimation, so a build block never
 * recursively triggers another).
 *
 * `sessionIndexInBlock` must be the block's session index for this session — i.e.
 * `block.sessionIds.length` as it was *before* the confirmed session was appended.
 */
export function detectShortfall(
  session: Session,
  block: TrainingBlock,
  sessionIndexInBlock: number
): ShortfallResult | null {
  if (block.phase === "deload" || block.phase === "reacclimation") return null

  const working = workingSets(session)
  if (working.length === 0) return null

  const { weight: targetWeight, reps: targetReps, sets: targetSets } = prescribeForBlock(
    block,
    sessionIndexInBlock
  )
  const targetTotalReps = targetReps * targetSets

  const achievedTopWeight = Math.max(...working.map((s) => s.kg))
  const achievedTotalReps = working
    .filter((s) => s.kg >= targetWeight - WEIGHT_EPSILON)
    .reduce((sum, s) => sum + s.reps, 0)

  const droppedWeight = achievedTopWeight < targetWeight - WEIGHT_EPSILON
  const missedVolume = achievedTotalReps < targetTotalReps
  if (!droppedWeight && !missedVolume) return null

  const lastActual = achievedTopWeight

  return {
    targetWeight,
    targetReps,
    targetSets,
    achievedTopWeight,
    achievedTotalReps,
    targetTotalReps,
    lastActual,
    rebuildLoads: buildRebuildLoads(lastActual, targetWeight),
  }
}
