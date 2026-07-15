import { Session, TrainingBlock } from "./types"
import { calcE1RM, roundToPlate } from "./e1rm"
import { getWorkingSets } from "./prescription"

// --- Tunable coaching constants (global defaults; per-profile override is a future extension) ---

/** A gap up to this many days is a normal training break — no penalty. */
export const LAYOFF_GRACE_DAYS = 7
/** A gap of at least this many days raises the layoff trigger. */
export const LAYOFF_TRIGGER_DAYS = 10
/** Anchor reduction per week off, beyond the grace window. */
export const DETRAIN_RATE_PER_WEEK = 0.03
/** Floor on the proposed cut so we never suggest an absurd drop. */
export const DETRAIN_MAX_DROP = 0.20
/**
 * A logged working-set e1RM below `anchorWeight × MISMATCH_RATIO` signals the
 * program has drifted above the lifter's current capability.
 */
export const MISMATCH_RATIO = 0.93

export type RecalibrationReason = "layoff" | "mismatch"

export interface RecalibrationProposal {
  reason: RecalibrationReason
  /** Whole weeks since the last confirmed session (0 for a pure performance mismatch). */
  weeksOff: number
  oldAnchor: number
  newAnchor: number
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

/** Best Brzycki e1RM across a session's working sets (null if none computable). */
export function bestWorkingE1RM(session: Session): number | null {
  let best: number | null = null
  for (const set of getWorkingSets(session)) {
    const e1rm = set.e1rm ?? calcE1RM(set.kg, set.reps)
    if (e1rm != null && (best == null || e1rm > best)) best = e1rm
  }
  return best
}

export function daysSinceLastSession(sessions: Session[], now: Date): number | null {
  const last = lastConfirmedSession(sessions)
  if (!last?.date) return null
  const ms = now.getTime() - new Date(last.date).getTime()
  return ms / (1000 * 60 * 60 * 24)
}

/**
 * Time-decay detraining model. Reduces the anchor by a per-week rate beyond a
 * grace window, capped by DETRAIN_MAX_DROP. When a freshly demonstrated e1RM is
 * available (a just-logged working set), the result is floored to it so we never
 * propose a load the lifter just disproved in either direction.
 */
export function computeDetrainedAnchor(
  oldAnchor: number,
  weeksOff: number,
  demonstratedE1RM?: number | null
): number {
  const effectiveWeeks = Math.max(0, weeksOff - LAYOFF_GRACE_DAYS / 7)
  const dropFrac = Math.min(DETRAIN_RATE_PER_WEEK * effectiveWeeks, DETRAIN_MAX_DROP)
  const decayed = oldAnchor * (1 - dropFrac)
  const candidate =
    demonstratedE1RM != null ? Math.min(decayed, demonstratedE1RM) : decayed
  return roundToPlate(candidate)
}

/**
 * Single entry point. Returns a downward recalibration proposal when the active
 * block's anchor has drifted above reality — detected by a training layoff or by
 * an under-performing logged session — or null when the program is on track.
 * Purely derived from the caller's own sessions/blocks, so it is per-user.
 */
export function evaluateRecalibration(
  sessions: Session[],
  blocks: TrainingBlock[],
  now: Date
): RecalibrationProposal | null {
  const block = activeBlock(blocks)
  if (!block) return null
  // Loads are already low during a deload or an in-progress re-acclimation.
  if (block.phase === "deload" || block.phase === "reacclimation") return null

  const last = lastConfirmedSession(sessions)
  if (!last) return null

  const gapDays = daysSinceLastSession(sessions, now) ?? 0
  const isLayoff = gapDays >= LAYOFF_TRIGGER_DAYS

  // Mismatch is only meaningful for a session belonging to the current block.
  const lastInBlock = block.sessionIds.includes(last.id)
  const demonstratedE1RM = lastInBlock ? bestWorkingE1RM(last) : null
  const isMismatch =
    demonstratedE1RM != null && demonstratedE1RM < block.anchorWeight * MISMATCH_RATIO

  if (!isLayoff && !isMismatch) return null

  const reason: RecalibrationReason = isLayoff ? "layoff" : "mismatch"
  const weeksOff = isLayoff ? gapDays / 7 : 0
  // Floor by demonstrated capability only for a performance mismatch (a layoff is
  // detected before the return session is logged, so the old set is not evidence).
  const floor = isMismatch ? demonstratedE1RM : null

  const newAnchor = computeDetrainedAnchor(block.anchorWeight, weeksOff, floor)
  if (newAnchor >= block.anchorWeight) return null

  const wholeWeeks = Math.round(weeksOff)
  const message =
    reason === "layoff"
      ? `You've been away ~${wholeWeeks} week${wholeWeeks === 1 ? "" : "s"}. Easing the anchor from ${block.anchorWeight}kg to ${newAnchor}kg and dropping in a short re-acclimation before resuming.`
      : `Recent sets came in under the plan (~${demonstratedE1RM}kg e1RM vs a ${block.anchorWeight}kg anchor). Recalibrating the anchor to ${newAnchor}kg with a short re-acclimation to rebuild.`

  return {
    reason,
    weeksOff,
    oldAnchor: block.anchorWeight,
    newAnchor,
    message,
    signature: `${reason}|${block.anchorWeight}|${last.id}`,
  }
}
