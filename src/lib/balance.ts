import { MuscleGroup, Session, TrainingDay } from "./types"
import { MuscleGroupConfig, getDefaultSets, getExercisesForMuscle, getMuscleLabel, isCardioGroup } from "./exerciseConfig"
import { daysSinceDate } from "./layoff"
import { findLastSessionWithExercise } from "./exerciseHistory"
import { sessionWork } from "./stats"

/**
 * Balanced mode has no block, no target and no main lift, so the questions worth
 * answering on its home screen are different: am I training at all (momentum),
 * am I training everything (recovery), and what exactly am I about to do (plan).
 */

/** Trained within this many days — the group is covered. */
export const FRESH_DAYS = 4
/** At or past this many days the group reads as neglected and its bar empties. */
export const STALE_DAYS = 10
/** Rolling buckets, newest ending today, so there is no Monday-morning cliff. */
export const BUCKET_DAYS = 7
export const BUCKET_COUNT = 8
/** Lookback for the per-muscle set and volume totals. */
export const BALANCE_WINDOW_DAYS = 28

export type Freshness = "fresh" | "due" | "stale" | "never"

/** Confirmed, dated sessions, newest first. An unlogged upcoming card trains nothing. */
function loggedSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.confirmed && s.date != null && !isNaN(new Date(s.date).getTime()))
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
}

/**
 * What a session actually trained, with the work behind it.
 *
 * Selection alone does not count: picking Legs on the card and then logging no leg
 * sets used to reset Legs to zero days, which made the balance read better than the
 * training was. Only muscles with at least one logged set are returned.
 *
 * Main-lift sets (`session.sets`) carry no muscle group, so a lift-focused session
 * from before a mode switch contributes volume to `momentum` but nothing here.
 */
export function trainedMuscles(session: Session): Map<MuscleGroup, { sets: number; volume: number }> {
  const out = new Map<MuscleGroup, { sets: number; volume: number }>()
  for (const workout of session.extraWorkouts ?? []) {
    for (const exercise of workout.exercises) {
      if (exercise.sets.length === 0) continue
      const entry = out.get(workout.muscle) ?? { sets: 0, volume: 0 }
      entry.sets += exercise.sets.length
      for (const set of exercise.sets) entry.volume += set.kg * set.reps
      out.set(workout.muscle, entry)
    }
  }
  return out
}

export interface MuscleRecovery {
  id: MuscleGroup
  label: string
  /** Whole days since the group last had a set logged; null when never. */
  days: number | null
  /** 1 = trained today, 0 at or past STALE_DAYS (and for never). Drives the bar fill. */
  freshness: number
  state: Freshness
  /** Sets logged for this group inside the window. */
  sets: number
  /** Tonnage for this group inside the window. */
  volume: number
  /** Newest session that trained it, for deep-linking the row. */
  lastSessionId: number | null
  /** False when no configured training day contains it; undefined when days weren't supplied. */
  inAnyDay?: boolean
}

function freshnessOf(days: number | null): number {
  if (days === null) return 0
  return Math.min(1, Math.max(0, 1 - days / STALE_DAYS))
}

function stateOf(days: number | null): Freshness {
  if (days === null) return "never"
  if (days <= FRESH_DAYS) return "fresh"
  if (days >= STALE_DAYS) return "stale"
  return "due"
}

/**
 * Every muscle group worth showing, stalest first.
 *
 * Rows come from the configured groups plus anything trained inside the window, so a
 * group the user just deleted from their config still shows while it is recent, and
 * long-gone groups fall off on their own.
 */
export function muscleRecovery(
  sessions: Session[],
  exerciseConfig: MuscleGroupConfig[],
  opts: { now?: Date; windowDays?: number; trainingDays?: TrainingDay[] } = {}
): MuscleRecovery[] {
  const { now = new Date(), windowDays = BALANCE_WINDOW_DAYS, trainingDays } = opts
  const logged = loggedSessions(sessions)

  const lastTrained = new Map<MuscleGroup, { days: number; sessionId: number }>()
  const work = new Map<MuscleGroup, { sets: number; volume: number }>()
  const seen = new Set<MuscleGroup>()

  for (const session of logged) {
    const days = daysSinceDate(session.date!, now)
    for (const [muscle, entry] of trainedMuscles(session)) {
      const prev = lastTrained.get(muscle)
      if (prev === undefined || days < prev.days) {
        lastTrained.set(muscle, { days, sessionId: session.id })
      }
      if (days <= windowDays) {
        seen.add(muscle)
        const totals = work.get(muscle) ?? { sets: 0, volume: 0 }
        totals.sets += entry.sets
        totals.volume += entry.volume
        work.set(muscle, totals)
      }
    }
  }

  const scheduled = new Set<MuscleGroup>()
  for (const day of trainingDays ?? []) for (const id of day.muscleGroupIds) scheduled.add(id)

  const order = new Map<MuscleGroup, number>()
  exerciseConfig.forEach((g) => order.set(g.id, g.order))

  // Retired groups are not part of the split any more, so they earn a recovery row
  // only when history actually has work under them — which is what `seen` carries.
  const ids = new Set<MuscleGroup>([
    ...exerciseConfig.filter((g) => !g.retired).map((g) => g.id),
    ...seen,
  ])

  // Cardio is not a muscle to recover, so it never gets a bar — not from the config,
  // and not from history either, however many treadmill bouts are logged under it.
  const cardioIds = new Set(exerciseConfig.filter(isCardioGroup).map((g) => g.id))

  return [...ids]
    .filter((id) => !cardioIds.has(id))
    .map((id): MuscleRecovery => {
      const last = lastTrained.get(id)
      const days = last?.days ?? null
      const totals = work.get(id) ?? { sets: 0, volume: 0 }
      return {
        id,
        label: getMuscleLabel(exerciseConfig, id),
        days,
        freshness: freshnessOf(days),
        state: stateOf(days),
        sets: totals.sets,
        volume: totals.volume,
        lastSessionId: last?.sessionId ?? null,
        ...(trainingDays ? { inAnyDay: scheduled.has(id) } : {}),
      }
    })
    .sort((a, b) => {
      // Never-trained sorts to the front; equal staleness keeps config order so rows
      // don't shuffle between renders.
      const av = a.days ?? Infinity
      const bv = b.days ?? Infinity
      if (av !== bv) return bv - av
      return (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)
    })
}

export interface WeekBucket {
  /** 0 = the last 7 days ending today; BUCKET_COUNT-1 = the oldest bucket. */
  weeksAgo: number
  sessions: number
  sets: number
  volume: number
  /** Distinct muscle groups trained in the bucket. */
  muscles: number
}

export interface Momentum {
  /** Oldest to newest, always BUCKET_COUNT entries, zero-filled. */
  buckets: WeekBucket[]
  current: WeekBucket
  previous: WeekBucket
  /** Signed % change in sets against the previous bucket; null when it had none. */
  setsDeltaPct: number | null
  volumeDeltaPct: number | null
  /** Largest set count in any bucket — the bar-height denominator. */
  peakSets: number
  /** Days since the last confirmed session; null when there is no history. */
  daysSinceLast: number | null
  /**
   * Whether anything was logged before the current bucket, including outside the
   * window. Distinguishes a genuine first week from a return after a long layoff.
   */
  hasEarlierHistory: boolean
  /** True when nothing at all falls inside the window. */
  empty: boolean
}

function emptyBucket(weeksAgo: number): WeekBucket {
  return { weeksAgo, sessions: 0, sets: 0, volume: 0, muscles: 0 }
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/** Training volume and consistency over BUCKET_COUNT rolling weeks ending today. */
export function momentum(sessions: Session[], opts: { now?: Date } = {}): Momentum {
  const { now = new Date() } = opts
  const logged = loggedSessions(sessions)

  const buckets = Array.from({ length: BUCKET_COUNT }, (_, i) => emptyBucket(i))
  const musclesPerBucket = Array.from({ length: BUCKET_COUNT }, () => new Set<MuscleGroup>())

  for (const session of logged) {
    const index = Math.floor(daysSinceDate(session.date!, now) / BUCKET_DAYS)
    if (index >= BUCKET_COUNT) continue
    const work = sessionWork(session)
    buckets[index].sessions += 1
    buckets[index].sets += work.sets
    buckets[index].volume += work.volume
    for (const muscle of trainedMuscles(session).keys()) musclesPerBucket[index].add(muscle)
  }
  buckets.forEach((b, i) => { b.muscles = musclesPerBucket[i].size })

  // Oldest to newest, so the array maps straight onto a left-to-right sparkline.
  const ordered = [...buckets].reverse()
  const current = buckets[0]
  const previous = buckets[1]

  return {
    buckets: ordered,
    current,
    previous,
    setsDeltaPct: deltaPct(current.sets, previous.sets),
    volumeDeltaPct: deltaPct(current.volume, previous.volume),
    peakSets: Math.max(0, ...buckets.map((b) => b.sets)),
    daysSinceLast: logged[0]?.date ? daysSinceDate(logged[0].date, now) : null,
    hasEarlierHistory: logged.some((s) => daysSinceDate(s.date!, now) >= BUCKET_DAYS),
    empty: logged.length === 0,
  }
}

export interface DaySuggestion {
  day: TrainingDay
  /** The stalest muscle in the day — what drove the pick. */
  driver: MuscleRecovery | null
  /** Why this day, for the hero's reason line. */
  reason: string
}

/** Never-trained outranks any real day count, so untouched groups get picked up first. */
function staleness(recovery: MuscleRecovery | undefined): number {
  if (!recovery) return 0
  return recovery.days === null ? STALE_DAYS * 2 : recovery.days
}

/**
 * Which training day to run next.
 *
 * Rotation alone could point at the freshest muscles while a group sat untrained for
 * months, so the pick is driven by staleness — the day carrying the most neglected
 * group wins — with the configured order as the tiebreak. The day just trained is
 * excluded so the same day is never suggested twice running.
 */
export function suggestNextDay(
  sessions: Session[],
  trainingDays: TrainingDay[],
  exerciseConfig: MuscleGroupConfig[],
  opts: { now?: Date } = {}
): DaySuggestion | null {
  const sortedDays = [...trainingDays].sort((a, b) => a.order - b.order)
  const usable = sortedDays.filter((d) => d.muscleGroupIds.length > 0)
  if (sortedDays.length === 0) return null
  if (usable.length === 0) return { day: sortedDays[0], driver: null, reason: "Starting your rotation" }

  const logged = loggedSessions(sessions)
  if (logged.length === 0) {
    return { day: usable[0], driver: null, reason: "Starting your rotation" }
  }

  const recovery = muscleRecovery(sessions, exerciseConfig, { now: opts.now })
  const byId = new Map(recovery.map((r) => [r.id, r]))

  const lastDayId = logged.find((s) => s.selectedTrainingDayId)?.selectedTrainingDayId
  const candidates =
    usable.length > 1 ? usable.filter((d) => d.id !== lastDayId) : usable
  const pool = candidates.length > 0 ? candidates : usable

  const scored = pool.map((day) => {
    const stalenesses = day.muscleGroupIds.map((id) => staleness(byId.get(id)))
    return {
      day,
      max: Math.max(0, ...stalenesses),
      sum: stalenesses.reduce((a, b) => a + b, 0),
    }
  })

  scored.sort((a, b) => b.max - a.max || b.sum - a.sum || a.day.order - b.day.order)
  const winner = scored[0].day

  const driver = winner.muscleGroupIds
    .map((id) => byId.get(id))
    .filter((r): r is MuscleRecovery => r !== undefined)
    .sort((a, b) => staleness(b) - staleness(a))[0] ?? null

  let reason = "Next in your rotation"
  if (driver) {
    if (driver.days === null) reason = `${driver.label} hasn't been trained yet`
    else if (driver.days >= STALE_DAYS) {
      reason = `${driver.label} hasn't been trained in ${driver.days} days`
    }
  }

  return { day: winner, driver, reason }
}

export interface ExercisePreview {
  name: string
  /** Sets the logger will pre-create — mirrors initExtraWorkoutState. */
  plannedSets: number
  /** Heaviest set the last time this exercise was logged; null when never. */
  last: { kg: number; reps: number; daysAgo: number } | null
}

export interface MusclePlan {
  id: MuscleGroup
  label: string
  days: number | null
  state: Freshness
  /** True when the group was added as an extra rather than being part of the day. */
  extra: boolean
  exercises: ExercisePreview[]
}

export interface SessionPlan {
  muscles: MusclePlan[]
  /** Total sets the logger will open with — the hero's headline number. */
  plannedSets: number
  exerciseCount: number
  /** Rough tonnage from last-known loads; 0 when nothing has been logged before. */
  estimatedVolume: number
}

/**
 * The heaviest set the last time an exercise was logged.
 * `history` must be newest first — callers pass the sorted confirmed list.
 */
export function lastTopSetForExercise(
  exerciseName: string,
  history: Session[],
  opts: { now?: Date } = {}
): { kg: number; reps: number; daysAgo: number } | null {
  const { now = new Date() } = opts
  const found = findLastSessionWithExercise(exerciseName, history)
  if (!found) return null
  const top = found.sets.reduce((best, set) =>
    set.kg > best.kg || (set.kg === best.kg && set.reps > best.reps) ? set : best
  )
  return {
    kg: top.kg,
    reps: top.reps,
    daysAgo: found.session.date ? daysSinceDate(found.session.date, now) : 0,
  }
}

/**
 * What the upcoming session will actually contain.
 *
 * This walks the same path as `initExtraWorkoutState` in LogSessionModal — selected
 * groups, then every exercise for each, then `getDefaultSets` with a fallback of 3 —
 * so the set count the hero promises is the set count the logger opens with. Change
 * one and you must change the other.
 */
export function planSession(
  session: Session,
  exerciseConfig: MuscleGroupConfig[],
  history: Session[],
  opts: { now?: Date; dayMuscleIds?: MuscleGroup[]; recovery?: MuscleRecovery[] } = {}
): SessionPlan {
  const { now = new Date(), dayMuscleIds, recovery } = opts
  const byId = new Map((recovery ?? []).map((r) => [r.id, r]))

  const muscles: MusclePlan[] = (session.selectedMuscleGroups ?? []).map((id) => {
    const group = exerciseConfig.find((g) => g.id === id)
    const state = byId.get(id)
    const exercises: ExercisePreview[] = getExercisesForMuscle(exerciseConfig, id).map((name) => {
      const exConfig = group?.exercises.find((e) => e.name === name)
      return {
        name,
        plannedSets: exConfig ? getDefaultSets(exConfig) : 3,
        last: lastTopSetForExercise(name, history, { now }),
      }
    })
    return {
      id,
      label: getMuscleLabel(exerciseConfig, id),
      days: state?.days ?? null,
      state: state?.state ?? "never",
      extra: dayMuscleIds ? !dayMuscleIds.includes(id) : false,
      exercises,
    }
  })

  let plannedSets = 0
  let exerciseCount = 0
  let estimatedVolume = 0
  for (const muscle of muscles) {
    for (const exercise of muscle.exercises) {
      exerciseCount += 1
      plannedSets += exercise.plannedSets
      if (exercise.last) {
        estimatedVolume += exercise.last.kg * exercise.last.reps * exercise.plannedSets
      }
    }
  }

  return { muscles, plannedSets, exerciseCount, estimatedVolume: Math.round(estimatedVolume) }
}

/** The right-hand column of a recovery row. */
export function formatDays(days: number | null): string {
  if (days === null) return "never"
  if (days === 0) return "today"
  return `${days}d`
}
