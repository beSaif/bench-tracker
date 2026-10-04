import { BlockPhase, Session, TrainingBlock, WeightEntry } from "./types"
import { calcE1RM } from "./e1rm"
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

/** One block of a cycle, as its recap row shows it. */
export interface BlockSummary {
  block: TrainingBlock
  phaseLabel: string
  /** Local date keys of the first and last session filed under the block. */
  startDate: string
  endDate: string
  /** Calendar days from the first session to the last, both included. */
  days: number
  sessions: number
  /** Top set of the block's first and last session. */
  start: BlockEndpoint
  end: BlockEndpoint
  /** end.e1rm − start.e1rm, when both exist. */
  e1rmChange: number | null
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

/**
 * One completed block, for its row in the cycle recap. Null for a block that isn't
 * completed or has no dated sessions to measure.
 */
function summarizeBlock(block: TrainingBlock, sessions: Session[], weights: WeightEntry[]): BlockSummary | null {
  if (block.status !== "completed") return null
  const ids = new Set(block.sessionIds)
  const own = sessions.filter((s) => s.confirmed && s.date && ids.has(s.id)).sort(chrono)
  if (own.length === 0) return null

  const start = endpoint(own[0], weights)
  const end = endpoint(own[own.length - 1], weights)
  return {
    block,
    phaseLabel: PHASE_SHORT[block.phase],
    startDate: start.date,
    endDate: end.date,
    days: daysBetween(start.date, end.date) + 1,
    sessions: own.length,
    start,
    end,
    e1rmChange: start.e1rm != null && end.e1rm != null ? round1(end.e1rm - start.e1rm) : null,
  }
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
  coachNote: string | null
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
    .map((b) => summarizeBlock(b, sessions, weights))
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

function buildCycleNote(s: Omit<CycleSummary, "coachNote">): string | null {
  if (s.anchorEnd > s.anchorStart) return `Cycle ${s.cycle + 1} starts at ${s.anchorEnd}kg.`
  if (s.peak && s.peak.rpe == null) return `No RPE on the peak single, so the anchor stays at ${s.anchorEnd}kg.`
  return `Anchor stays at ${s.anchorEnd}kg.`
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
