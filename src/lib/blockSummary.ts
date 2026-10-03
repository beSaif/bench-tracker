import { BlockPhase, Session, TrainingBlock, WeightEntry } from "./types"
import { calcE1RM } from "./e1rm"
import { getBlockLength } from "./prescription"
import { sessionWork } from "./stats"
import { bwForSession, dateKey, daysBetween, round1 } from "./weight"

/** What the athlete calls each phase: the session types on the timeline, not the textbook names. */
export const PHASE_SHORT: Record<BlockPhase, string> = {
  accumulation: "Volume",
  transmutation: "Intensity",
  realization: "Peak",
  deload: "Deload",
  reacclimation: "Rebuild",
}

/**
 * Which cycle (Volume → Intensity → Peak → Deload) each block belongs to, 1-based.
 * Every accumulation block opens a new cycle; a rebuild belongs to the cycle of the
 * block it resumes, since it's a detour inside that cycle rather than a new one.
 */
export function cycleNumbers(blocks: TrainingBlock[]): Map<number, number> {
  const out = new Map<number, number>()
  let cycle = 0
  for (const b of [...blocks].sort((x, y) => x.id - y.id)) {
    if (b.phase === "reacclimation") {
      out.set(b.id, (b.resumeBlockId !== undefined ? out.get(b.resumeBlockId) : undefined) ?? Math.max(cycle, 1))
      continue
    }
    if (b.phase === "accumulation" || cycle === 0) cycle++
    out.set(b.id, cycle)
  }
  return out
}

/** One end of a block: what the main lift looked like in its first or last session. */
export interface BlockEndpoint {
  date: string
  /** Heaviest working set of the session. */
  kg: number
  reps: number
  /** Best e1RM across the session's working sets. */
  e1rm: number | null
  bw: number | null
}

export interface BlockSummary {
  block: TrainingBlock
  /** The cycle the block belongs to, so the recap can say "Cycle 2 · Volume". */
  cycle: number
  phaseLabel: string
  /** Local date keys of the first and last session filed under the block. */
  startDate: string
  endDate: string
  /** Calendar days from the first session to the last, both included. */
  days: number
  sessions: number
  plannedSessions: number
  /** Sessions logged without the main lift while this block was carrying the load. */
  skipped: number
  start: BlockEndpoint
  end: BlockEndpoint
  /** end.e1rm − start.e1rm, when both exist. */
  e1rmChange: number | null
  /** Best e1RM set anywhere in the block. */
  bestE1RM: number | null
  /** True when bestE1RM beat every session logged before the block started. */
  isPR: boolean
  workingSets: number
  /** Main-lift tonnage, working sets only. */
  volume: number
  /** Every exercise in the block's sessions, accessories included. */
  totalSets: number
  avgRPE: number | null
  /** Average RPE of the first and last session, for the fatigue read. */
  rpeStart: number | null
  rpeEnd: number | null
  /** What the block handed on to: the block after it, or the one it resumed. */
  next: { phase: BlockPhase; phaseLabel: string; anchor: number; sessions: number; resumed: boolean } | null
  coachNote: string
}

function chrono(a: Session, b: Session): number {
  const byDate = new Date(a.date!).getTime() - new Date(b.date!).getTime()
  return byDate !== 0 ? byDate : a.id - b.id
}

function working(session: Session) {
  return session.sets.filter((s) => !s.isWarmup)
}

function setE1RM(set: { kg: number; reps: number; e1rm: number | null }): number | null {
  return set.e1rm ?? calcE1RM(set.kg, set.reps)
}

function bestE1RMOf(sessions: Session[]): number | null {
  const all = sessions
    .flatMap(working)
    .map(setE1RM)
    .filter((v): v is number => v != null)
  return all.length > 0 ? Math.max(...all) : null
}

function avgRPEOf(sessions: Session[]): number | null {
  const rpes = sessions
    .flatMap(working)
    .map((s) => s.rpe)
    .filter((v): v is number => v != null)
  return rpes.length > 0 ? round1(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null
}

function endpoint(session: Session, weights: WeightEntry[]): BlockEndpoint {
  const sets = working(session)
  const top = sets.reduce<(typeof sets)[number] | null>((best, s) => (best == null || s.kg > best.kg ? s : best), null)
  return {
    date: dateKey(new Date(session.date!)),
    kg: top?.kg ?? 0,
    reps: top?.reps ?? 0,
    e1rm: bestE1RMOf([session]),
    bw: session.bw ?? bwForSession(weights, session.date),
  }
}

function buildCoachNote(s: Omit<BlockSummary, "coachNote">): string {
  const { block, next, avgRPE, rpeStart, rpeEnd, e1rmChange, skipped } = s
  if (block.phase === "realization" && next) {
    if (next.anchor <= block.anchorWeight && rpeEnd == null) {
      return `No RPE on the single, so the anchor holds at ${next.anchor}kg. Log RPE on peak day to earn the bump.`
    }
    return next.anchor > block.anchorWeight
      ? `Peak single moved at RPE 7.5 or under, so the anchor goes up to ${next.anchor}kg. Deload first, then a new cycle.`
      : `The single wasn't easy enough to raise the anchor. It holds at ${next.anchor}kg: deload, then run the cycle again.`
  }
  if (block.phase === "deload") return "Deload done. Fatigue's down, so the next block starts fresh."
  if (block.phase === "reacclimation") return "Rebuild done. Back to where the block left off."
  if (avgRPE != null && avgRPE >= 9) {
    return `RPE averaged ${avgRPE}. That's fatigue piling up, so prioritise sleep and food before the next block.`
  }
  if (rpeStart != null && rpeEnd != null && rpeEnd - rpeStart >= 1.5) {
    return `RPE climbed from ${rpeStart} to ${rpeEnd} as the loads went up. Expected, but watch bar speed.`
  }
  if (skipped >= 2) {
    return `${skipped} sessions skipped the main lift this block. Consistency moves the e1RM more than load does.`
  }
  if (e1rmChange != null && e1rmChange > 0) return `e1RM up ${e1rmChange}kg across the block. Keep the setup tight and carry it on.`
  return "Block banked. Same setup, same leg drive, next block."
}

/**
 * Everything the end-of-block recap shows. Null for a block that isn't completed or
 * has no dated sessions to measure (a block completed before dates were stored).
 */
export function summarizeBlock(
  block: TrainingBlock,
  blocks: TrainingBlock[],
  sessions: Session[],
  weights: WeightEntry[] = []
): BlockSummary | null {
  if (block.status !== "completed") return null
  const ids = new Set(block.sessionIds)
  const own = sessions.filter((s) => s.confirmed && s.date && ids.has(s.id)).sort(chrono)
  if (own.length === 0) return null

  const first = own[0]
  const last = own[own.length - 1]
  const start = endpoint(first, weights)
  const end = endpoint(last, weights)

  // Skipped-lift sessions carry no blockId. Count the ones logged after the previous
  // block's last session and up to this block's last: the stretch this block held the load.
  const sorted = [...blocks].sort((a, b) => a.id - b.id)
  const idx = sorted.findIndex((b) => b.id === block.id)
  const prevIds = new Set(sorted.slice(0, idx).flatMap((b) => b.sessionIds))
  const prevLast = sessions
    .filter((s) => s.confirmed && s.date && prevIds.has(s.id))
    .reduce((max, s) => Math.max(max, new Date(s.date!).getTime()), -Infinity)
  const lastTime = new Date(last.date!).getTime()
  const skipped = sessions.filter((s) => {
    if (!s.confirmed || !s.date || !s.skippedMainLift) return false
    const t = new Date(s.date).getTime()
    return t > prevLast && t <= lastTime
  }).length
  const cycle = cycleNumbers(blocks).get(block.id) ?? 1

  const bestE1RM = bestE1RMOf(own)
  const firstTime = new Date(first.date!).getTime()
  const priorBest = bestE1RMOf(
    sessions.filter((s) => s.confirmed && s.date && s.type !== "Deload" && new Date(s.date).getTime() < firstTime)
  )
  const sets = own.flatMap(working)

  const nextBlock =
    block.phase === "reacclimation" && block.resumeBlockId !== undefined
      ? sorted.find((b) => b.id === block.resumeBlockId)
      : sorted.find((b) => b.id > block.id && b.phase !== "reacclimation")

  const base: Omit<BlockSummary, "coachNote"> = {
    block,
    cycle,
    phaseLabel: PHASE_SHORT[block.phase],
    startDate: start.date,
    endDate: end.date,
    days: daysBetween(start.date, end.date) + 1,
    sessions: own.length,
    plannedSessions: getBlockLength(block),
    skipped,
    start,
    end,
    e1rmChange: start.e1rm != null && end.e1rm != null ? round1(end.e1rm - start.e1rm) : null,
    bestE1RM,
    isPR: bestE1RM != null && priorBest != null && block.phase !== "deload" && bestE1RM > priorBest,
    workingSets: sets.length,
    volume: Math.round(sets.reduce((sum, s) => sum + s.kg * s.reps, 0)),
    totalSets: own.reduce((sum, s) => sum + sessionWork(s).sets, 0),
    avgRPE: avgRPEOf(own),
    rpeStart: avgRPEOf([first]),
    rpeEnd: avgRPEOf([last]),
    next: nextBlock
      ? {
          phase: nextBlock.phase,
          phaseLabel: PHASE_SHORT[nextBlock.phase],
          anchor: nextBlock.anchorWeight,
          sessions: getBlockLength(nextBlock),
          resumed: nextBlock.id === block.resumeBlockId,
        }
      : null,
  }
  return { ...base, coachNote: buildCoachNote(base) }
}

export interface CycleSummary {
  cycle: number
  /** Recaps of every block in the cycle, in order, rebuilds included. */
  blocks: BlockSummary[]
  startDate: string
  endDate: string
  days: number
  /** Main-lift sessions across the cycle, and the ones that skipped it. */
  sessions: number
  skipped: number
  /** The anchor the cycle was run at, and the one it hands to the next cycle. */
  anchorStart: number
  anchorEnd: number
  /** Best e1RM going in (null for a first cycle, which has nothing before it) and coming out. */
  e1rmStart: number | null
  e1rmEnd: number | null
  /** Heaviest working set before the cycle, and after it. */
  bestStart: number | null
  bestEnd: number | null
  isPR: boolean
  /** Top set of the last Peak session: the number the cycle was built to hit. */
  peak: { kg: number; reps: number; rpe: number | null; date: string } | null
  bwStart: number | null
  bwEnd: number | null
  avgRPE: number | null
  volume: number
  coachNote: string
}

function heaviest(sessions: Session[]): number | null {
  const all = sessions.flatMap(working).map((s) => s.kg)
  return all.length > 0 ? Math.max(...all) : null
}

/**
 * Everything the end-of-cycle recap shows. A cycle is complete once its Deload is;
 * anything earlier returns null.
 */
export function summarizeCycle(
  cycle: number,
  blocks: TrainingBlock[],
  sessions: Session[],
  weights: WeightEntry[] = []
): CycleSummary | null {
  const numbers = cycleNumbers(blocks)
  const inCycle = [...blocks].sort((a, b) => a.id - b.id).filter((b) => numbers.get(b.id) === cycle)
  const deload = inCycle.find((b) => b.phase === "deload")
  if (!deload || deload.status !== "completed") return null

  const summaries = inCycle
    .map((b) => summarizeBlock(b, blocks, sessions, weights))
    .filter((s): s is BlockSummary => s != null)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.block.id - b.block.id))
  const ids = new Set(inCycle.flatMap((b) => b.sessionIds))
  const own = sessions.filter((s) => s.confirmed && s.date && ids.has(s.id)).sort(chrono)
  if (own.length === 0 || summaries.length === 0) return null

  const first = own[0]
  const last = own[own.length - 1]
  const firstTime = new Date(first.date!).getTime()
  const lastTime = new Date(last.date!).getTime()
  const before = sessions.filter((s) => s.confirmed && s.date && new Date(s.date).getTime() < firstTime)
  const through = sessions.filter((s) => s.confirmed && s.date && new Date(s.date).getTime() <= lastTime)
  const lifted = (list: Session[]) => list.filter((s) => s.type !== "Deload")

  // Skips are counted over the cycle's own window, not summed per block: a rebuild
  // overlaps the block it resumes, and summing would count those days twice.
  const prevIds = new Set(
    blocks.filter((b) => (numbers.get(b.id) ?? 0) < cycle).flatMap((b) => b.sessionIds)
  )
  const prevLast = sessions
    .filter((s) => s.confirmed && s.date && prevIds.has(s.id))
    .reduce((max, s) => Math.max(max, new Date(s.date!).getTime()), -Infinity)
  const skipped = sessions.filter((s) => {
    if (!s.confirmed || !s.date || !s.skippedMainLift) return false
    const t = new Date(s.date).getTime()
    return t > prevLast && t <= lastTime
  }).length

  const priorBest = bestE1RMOf(lifted(before))
  const e1rmEnd = bestE1RMOf(lifted(through))
  const peakSession = [...own].reverse().find((s) => s.type === "Peak")
  const peakSet = peakSession
    ? working(peakSession).reduce<ReturnType<typeof working>[number] | null>((b, s) => (b == null || s.kg > b.kg ? s : b), null)
    : null
  const accumulation = inCycle.find((b) => b.phase === "accumulation")
  const anchorStart = accumulation?.anchorWeight ?? inCycle[0].anchorWeight
  const sets = own.flatMap(working)

  const base: Omit<CycleSummary, "coachNote"> = {
    cycle,
    blocks: summaries,
    startDate: dateKey(new Date(first.date!)),
    endDate: dateKey(new Date(last.date!)),
    days: daysBetween(dateKey(new Date(first.date!)), dateKey(new Date(last.date!))) + 1,
    sessions: own.length,
    skipped,
    anchorStart,
    anchorEnd: deload.anchorWeight,
    // No earlier history means no honest "going in" number: a first session's 8-rep
    // estimate against a peak single would read as a jump that never happened.
    e1rmStart: priorBest,
    e1rmEnd,
    bestStart: heaviest(before),
    bestEnd: heaviest(through),
    isPR: priorBest != null && e1rmEnd != null && e1rmEnd > priorBest,
    peak: peakSet && peakSession
      ? { kg: peakSet.kg, reps: peakSet.reps, rpe: peakSet.rpe, date: dateKey(new Date(peakSession.date!)) }
      : null,
    bwStart: first.bw ?? bwForSession(weights, first.date),
    bwEnd: last.bw ?? bwForSession(weights, last.date),
    avgRPE: avgRPEOf(lifted(own)),
    volume: Math.round(sets.reduce((sum, s) => sum + s.kg * s.reps, 0)),
  }
  return { ...base, coachNote: buildCycleNote(base) }
}

function buildCycleNote(s: Omit<CycleSummary, "coachNote">): string {
  const next = s.cycle + 1
  if (s.anchorEnd > s.anchorStart) {
    return `Cycle ${next} runs at ${s.anchorEnd}kg, ${round1(s.anchorEnd - s.anchorStart)}kg heavier. Same plan, heavier bar.`
  }
  if (s.peak && s.peak.rpe == null) {
    return `Anchor holds at ${s.anchorEnd}kg: no RPE on the peak single. Log it next time to earn the bump.`
  }
  if (s.avgRPE != null && s.avgRPE >= 8.5) {
    return `Anchor holds at ${s.anchorEnd}kg and RPE ran high. Run it again and let the same loads move faster.`
  }
  return `Anchor holds at ${s.anchorEnd}kg. Run the cycle again and make the peak single an RPE 7.`
}

/** Every cycle whose Deload is done, newest first. */
export function completedCycles(blocks: TrainingBlock[]): number[] {
  const numbers = cycleNumbers(blocks)
  return [...new Set(
    blocks
      .filter((b) => b.phase === "deload" && b.status === "completed")
      .map((b) => numbers.get(b.id))
      .filter((n): n is number => n != null)
  )].sort((a, b) => b - a)
}
