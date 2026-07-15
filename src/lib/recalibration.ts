import { Session, TrainingBlock } from "./types"
import { calcE1RM, roundToPlate } from "./e1rm"
import { getWorkingSets, prescribeBlockSession } from "./prescription"

// --- Tunable coaching constants (global defaults; per-profile override is a future extension) ---

/** A gap up to this many days is a normal training break — no penalty. */
export const LAYOFF_GRACE_DAYS = 7
/** A gap of at least this many days raises the layoff trigger. */
export const LAYOFF_TRIGGER_DAYS = 10
/** Strength lost per week off, beyond the grace window (used to estimate current capability). */
export const DETRAIN_RATE_PER_WEEK = 0.03
/** Cap on the estimated detraining drop. */
export const DETRAIN_MAX_DROP = 0.20
/** Last working-set e1RM below `anchorWeight × MISMATCH_RATIO` flags a performance mismatch. */
export const MISMATCH_RATIO = 0.93
/** Load step between rebuild sessions when ramping back to the plan. */
export const REBUILD_STEP_KG = 5
/** Cap on how many rebuild sessions to insert. */
export const MAX_REBUILD_SESSIONS = 4

export type RecalibrationReason = "layoff" | "mismatch"

export interface RecalibrationProposal {
  reason: RecalibrationReason
  /** The last completed working set the proposal is based on. */
  lastSetWeight: number
  lastSetReps: number
  lastSetE1RM: number | null
  /** The block's anchor (cycle target) — unchanged; shown for context. */
  anchor: number
  /** Load the interrupted block resumes at once the rebuild is done. */
  resumeLoad: number
  /** Rebuild session loads, ramping from current capability up to the plan. */
  rebuildLoads: number[]
  /** Coach-facing explanation, safe to drop into a coachNote. */
  message: string
  /** Stable identity so a dismissed proposal is not re-shown until the situation changes. */
  signature: string
}

function activeBlock(blocks: TrainingBlock[]): TrainingBlock | undefined {
  return blocks.find((b) => b.status === "active")
}

function lastConfirmedSession(sessions: Session[]): Session | null {
  const confirmed = sessions
    .filter((s) => s.confirmed && s.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  return confirmed[0] ?? null
}

/** The last completed (non-warmup) set of a session — the freshest signal of current level. */
export function lastCompletedSet(session: Session) {
  const working = getWorkingSets(session)
  return working.length > 0 ? working[working.length - 1] : null
}

export function daysSinceLastSession(sessions: Session[], now: Date): number | null {
  const last = lastConfirmedSession(sessions)
  if (!last?.date) return null
  return (now.getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24)
}

/** Estimate current capability after a layoff by decaying a known load. */
export function estimateDetrainedLoad(load: number, weeksOff: number): number {
  const effectiveWeeks = Math.max(0, weeksOff - LAYOFF_GRACE_DAYS / 7)
  const drop = Math.min(DETRAIN_RATE_PER_WEEK * effectiveWeeks, DETRAIN_MAX_DROP)
  return load * (1 - drop)
}

/** Ramp loads from current capability up to (but not reaching) the resume load. */
export function computeRebuildLoads(currentLoad: number, resumeLoad: number): number[] {
  const loads: number[] = []
  let w = roundToPlate(currentLoad + REBUILD_STEP_KG)
  while (w < resumeLoad - 0.01 && loads.length < MAX_REBUILD_SESSIONS) {
    loads.push(w)
    w = roundToPlate(w + REBUILD_STEP_KG)
  }
  return loads
}

/**
 * Single entry point. When a layoff or an under-performing last set means the
 * lifter can't yet hit where the plan resumes, propose a short set of rebuild
 * sessions ramping back up to it — the anchor (cycle target) is NOT changed.
 * Returns null when the program is on track. Purely per-user.
 */
export function evaluateRecalibration(
  sessions: Session[],
  blocks: TrainingBlock[],
  now: Date
): RecalibrationProposal | null {
  const block = activeBlock(blocks)
  if (!block) return null
  // Loads are already low during a deload or an in-progress rebuild.
  if (block.phase === "deload" || block.phase === "reacclimation") return null

  const last = lastConfirmedSession(sessions)
  if (!last) return null

  const gapDays = daysSinceLastSession(sessions, now) ?? 0
  const isLayoff = gapDays >= LAYOFF_TRIGGER_DAYS

  // Base the proposal on the last completed set of the current block's last session.
  const lastInBlock = block.sessionIds.includes(last.id)
  const lastSet = lastInBlock ? lastCompletedSet(last) : null
  const lastSetE1RM = lastSet ? calcE1RM(lastSet.kg, lastSet.reps) : null
  const isMismatch = lastSetE1RM != null && lastSetE1RM < block.anchorWeight * MISMATCH_RATIO

  if (!isLayoff && !isMismatch) return null

  // Where the interrupted block would resume.
  const resumeLoad = prescribeBlockSession(block.phase, block.sessionIds.length, block.anchorWeight).weight

  // Current capability: what they just lifted (mismatch) or a detrained estimate (layoff).
  const base = lastSet?.kg ?? resumeLoad
  const currentLoad = isMismatch ? base : roundToPlate(estimateDetrainedLoad(base, gapDays / 7))

  const rebuildLoads = computeRebuildLoads(currentLoad, resumeLoad)
  if (rebuildLoads.length === 0) return null // already at/above the resume load

  const reason: RecalibrationReason = isLayoff ? "layoff" : "mismatch"
  const n = rebuildLoads.length
  const plural = n === 1 ? "" : "s"
  const loadList = rebuildLoads.map((w) => `${w}kg`).join(", ")
  const message =
    reason === "layoff"
      ? `You've been away ~${Math.round(gapDays / 7)} week${Math.round(gapDays / 7) === 1 ? "" : "s"}. Add ${n} rebuild session${plural} (${loadList}) to ramp back to the ${resumeLoad}kg you left off at — your ${block.anchorWeight}kg target stays.`
      : `Your last working set was ${lastSet!.kg}kg × ${lastSet!.reps} (~${lastSetE1RM}kg e1RM), under the ${resumeLoad}kg the plan called for. Add ${n} rebuild session${plural} (${loadList}) to climb back, then resume at ${resumeLoad}kg — your ${block.anchorWeight}kg target stays.`

  return {
    reason,
    lastSetWeight: lastSet?.kg ?? base,
    lastSetReps: lastSet?.reps ?? 0,
    lastSetE1RM,
    anchor: block.anchorWeight,
    resumeLoad,
    rebuildLoads,
    message,
    signature: `rebuild|${block.id}|${last.id}|${resumeLoad}`,
  }
}
