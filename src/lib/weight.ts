import { WeightEntry } from "./types"

/**
 * Bodyweight check-ins are a calendar-day series, not a timestamp series: "did I log
 * today?" and "how long is my streak?" are questions about the user's own local days.
 * So every date here is a local "YYYY-MM-DD" key, and all day arithmetic goes through
 * the Date constructor rather than adding 86400000 — an hour of DST would otherwise
 * drop or duplicate a day and silently break a streak.
 */

/** The local calendar date of `d` as "YYYY-MM-DD". Never use toISOString(), that is UTC. */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** `key` shifted by `n` days (negative goes back), still a local date key. */
export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

/** Whole days from `from` to `to`, both local date keys. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parseKey(from)
  const b = parseKey(to)
  // Compare at noon so a DST shift within the span can't round the division down.
  a.setHours(12, 0, 0, 0)
  b.setHours(12, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** Date keys sort correctly as strings, which is the whole point of the format. */
function sortEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export function latestEntry(entries: WeightEntry[]): WeightEntry | null {
  if (entries.length === 0) return null
  return sortEntries(entries)[entries.length - 1]
}

export function entryFor(entries: WeightEntry[], date: string): WeightEntry | null {
  return entries.find((e) => e.date === date) ?? null
}

export function todaysEntry(entries: WeightEntry[]): WeightEntry | null {
  return entryFor(entries, dateKey())
}

/** Replace the entry for `date` if there is one, otherwise insert. Returns a sorted copy. */
export function upsertEntry(entries: WeightEntry[], date: string, kg: number): WeightEntry[] {
  const next = entries.filter((e) => e.date !== date)
  next.push({ date, kg, loggedAt: new Date().toISOString() })
  return sortEntries(next)
}

export function removeEntry(entries: WeightEntry[], date: string): WeightEntry[] {
  return sortEntries(entries.filter((e) => e.date !== date))
}

/**
 * Change between the newest entry and the newest one at least `days` old. The log is
 * gappy by nature — a missed day is normal — so this searches by date rather than
 * trusting `entries[n - days]` to be a week back. Null when there is nothing old
 * enough to compare against.
 */
export function delta(entries: WeightEntry[], days: number): number | null {
  const sorted = sortEntries(entries)
  const newest = sorted[sorted.length - 1]
  if (!newest) return null
  const cutoff = addDays(newest.date, -days)
  const older = [...sorted].reverse().find((e) => e.date <= cutoff)
  if (!older) return null
  return round1(newest.kg - older.kg)
}

/** Delta between the newest and the very first entry. Null until there are two. */
export function totalDelta(entries: WeightEntry[]): number | null {
  const sorted = sortEntries(entries)
  if (sorted.length < 2) return null
  return round1(sorted[sorted.length - 1].kg - sorted[0].kg)
}

export interface Streak {
  /** Consecutive days logged, counting back from today (or yesterday if today is blank). */
  current: number
  loggedToday: boolean
  /** A streak was running and yesterday broke it. */
  missedYesterday: boolean
}

/**
 * Walk back day by day from today. Today being blank does not end a streak — the user
 * may simply not have weighed in yet — so the count then starts at yesterday and the
 * caller nudges rather than scolds.
 */
export function streak(entries: WeightEntry[], today: string = dateKey()): Streak {
  const dates = new Set(entries.map((e) => e.date))
  const loggedToday = dates.has(today)

  let cursor = loggedToday ? today : addDays(today, -1)
  let current = 0
  while (dates.has(cursor)) {
    current += 1
    cursor = addDays(cursor, -1)
  }

  const yesterday = addDays(today, -1)
  const missedYesterday = !dates.has(yesterday) && entries.length > 0

  return { current, loggedToday, missedYesterday }
}

/**
 * Trailing average over `window` calendar days (not over `window` entries), so a week
 * with three weigh-ins averages those three rather than reaching back a fortnight.
 * Daily bodyweight swings several hundred grams on water alone; this is the line that
 * actually shows the trend.
 */
export function rollingAverage(
  entries: WeightEntry[],
  window = 7,
): Array<{ date: string; kg: number }> {
  const sorted = sortEntries(entries)
  return sorted.map((e, i) => {
    const from = addDays(e.date, -(window - 1))
    let sum = 0
    let n = 0
    for (let j = i; j >= 0; j--) {
      if (sorted[j].date < from) break
      sum += sorted[j].kg
      n += 1
    }
    return { date: e.date, kg: round1(sum / n) }
  })
}

/** Entries from the last `days` calendar days, oldest first. */
export function recentEntries(entries: WeightEntry[], days: number): WeightEntry[] {
  const sorted = sortEntries(entries)
  const newest = sorted[sorted.length - 1]
  if (!newest) return []
  const from = addDays(dateKey(), -(days - 1))
  return sorted.filter((e) => e.date >= from)
}

export interface Projection {
  /** Signed rate of change in kg per week over the window used. */
  kgPerWeek: number
  /** Local date key the goal is reached at this rate, or null if it never is. */
  etaDate: string | null
}

/**
 * Rate of change from the smoothed series, and where it lands relative to the goal.
 * Uses the rolling average rather than raw readings so one heavy meal doesn't project
 * a wildly different date. Null until there is enough of a span to mean anything.
 */
export function goalProjection(entries: WeightEntry[], goalBw?: number): Projection | null {
  const avg = rollingAverage(entries)
  if (avg.length < 2) return null

  const last = avg[avg.length - 1]
  const from = addDays(last.date, -28)
  const first = avg.find((p) => p.date >= from) ?? avg[0]
  const span = daysBetween(first.date, last.date)
  if (span < 7) return null

  const kgPerWeek = round1(((last.kg - first.kg) / span) * 7)

  if (goalBw == null || kgPerWeek === 0) return { kgPerWeek, etaDate: null }
  const remaining = goalBw - last.kg
  // Moving away from the goal: no arrival date to give.
  if (Math.sign(remaining) !== Math.sign(kgPerWeek)) return { kgPerWeek, etaDate: null }

  const weeks = Math.abs(remaining / kgPerWeek)
  if (!Number.isFinite(weeks) || weeks > 260) return { kgPerWeek, etaDate: null }
  return { kgPerWeek, etaDate: addDays(last.date, Math.round(weeks * 7)) }
}

/** How stale a weigh-in may be and still count as a session's bodyweight. */
const SESSION_BW_WINDOW = 7

/**
 * The bodyweight to stamp on a session being confirmed. `Session.date` is a full ISO
 * timestamp, so it is converted to a local day key first.
 *
 * Prefers that day's own check-in, then the most recent one within a week. Beyond that
 * it returns null rather than guessing — a three-week-old number is not this session's
 * bodyweight, and null is already the "don't render the BW line" signal everywhere it
 * is read.
 */
export function bwForSession(entries: WeightEntry[], sessionDate: string | null): number | null {
  if (!sessionDate) return null
  const d = new Date(sessionDate)
  if (Number.isNaN(d.getTime())) return null
  const day = dateKey(d)

  const exact = entryFor(entries, day)
  if (exact) return exact.kg

  const floor = addDays(day, -SESSION_BW_WINDOW)
  const candidates = entries.filter((e) => e.date <= day && e.date >= floor)
  const nearest = latestEntry(candidates)
  return nearest?.kg ?? null
}

/** Strength-to-bodyweight ratio, the number the 140kg-at-60kg goal actually describes. */
export function strengthRatio(e1rm: number | null, bw: number | null): number | null {
  if (e1rm == null || bw == null || bw <= 0) return null
  return Math.round((e1rm / bw) * 100) / 100
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** "12 Mar" — the app's compact date style, used on the log list and chart axis. */
export function formatDay(key: string): string {
  return parseKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/** Relative wording for the check-in sheet header. */
export function describeDay(key: string, today: string = dateKey()): string {
  const diff = daysBetween(key, today)
  if (diff === 0) return "today"
  if (diff === 1) return "yesterday"
  return formatDay(key)
}
