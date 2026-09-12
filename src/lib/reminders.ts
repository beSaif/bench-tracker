import { Session, UserProfile, WeightEntry } from "./types"
import { daysBetween, streak } from "./weight"
import { LAYOFF_NUDGE_DAYS, LAYOFF_RESTART_DAYS } from "./layoff"

/**
 * Rules for the two scheduled nudges, kept free of KV and web-push so they can be
 * reasoned about (and tested) on their own. `/api/cron/reminders` is the only caller;
 * it supplies the stored data and carries out whatever this decides.
 *
 * The job runs once a day, so every rule here is expressed in whole local days rather
 * than in elapsed hours — "has the streak survived today" is a calendar question, and
 * the weigh-in log is already keyed by local date for exactly that reason.
 */

/** Below this a streak is too young to be worth defending out loud. */
export const STREAK_MENTION_MIN = 3
/** Days without a confirmed session before the first training nudge goes out. */
export const NUDGE_AFTER_DAYS = 2
/** Once nudged, stay quiet this long before saying it again. */
export const NUDGE_REPEAT_DAYS = 7

/**
 * Per-user bookkeeping for the job, stored under `reminderStateKey`. Kept separate from
 * the profile: it is written by the cron rather than the user, and `tz` arrives with the
 * push subscription, not from any settings screen.
 */
export interface ReminderState {
  /** IANA zone reported by the browser, e.g. "Europe/Zurich". Absent means assume UTC. */
  tz?: string
  /** Local date key of the last weigh-in reminder sent. */
  lastWeighInPush?: string
  /** Local date key of the last training nudge sent. */
  lastNudgePush?: string
}

export interface ReminderPush {
  title: string
  body: string
  tag: string
  url: string
}

export type ReminderKind = "weigh-in" | "inactivity"

export interface ReminderDecision {
  kind: ReminderKind
  push: ReminderPush
  /** Merged into the stored state once the push is actually sent. */
  stateUpdate: Partial<ReminderState>
}

/**
 * `now` as a "YYYY-MM-DD" key in `tz`. The server runs in UTC and the data is keyed by
 * the user's own calendar day, so every day comparison in this file starts here. An
 * unknown or malformed zone falls back to UTC rather than throwing — a wrong-by-hours
 * reminder beats a job that dies on one bad profile.
 */
export function dateKeyInTz(now: Date, tz?: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
    return `${get("year")}-${get("month")}-${get("day")}`
  } catch {
    return dateKeyInTz(now, "UTC")
  }
}

/** Local date key of the most recent confirmed session, or null if there has never been one. */
export function lastSessionDay(sessions: Session[], tz?: string): string | null {
  let latest: string | null = null
  for (const s of sessions) {
    if (!s.confirmed || !s.date) continue
    const d = new Date(s.date)
    if (Number.isNaN(d.getTime())) continue
    const key = dateKeyInTz(d, tz)
    if (latest === null || key > latest) latest = key
  }
  return latest
}

/**
 * The daily weigh-in nudge. Silent for anyone who has not opted into check-ins, and
 * silent once today's reading is in — the point is the missing entry, not the clock.
 */
function weighInReminder(
  profile: UserProfile | null,
  weights: WeightEntry[],
  state: ReminderState,
  today: string
): ReminderDecision | null {
  if (profile?.weighInDaily !== true) return null
  // Already sent today: the job re-running must not produce a second buzz.
  if (state.lastWeighInPush === today) return null

  const { current, loggedToday, missedYesterday } = streak(weights, today)
  if (loggedToday) return null

  const push: ReminderPush =
    current >= STREAK_MENTION_MIN
      ? {
          title: `${current}-day weigh-in streak`,
          body: `Step on the scale and make it ${current + 1}.`,
          tag: "weigh-in-reminder",
          url: "/weight",
        }
      : missedYesterday && current === 0
        ? {
            title: "Streak broke yesterday",
            body: "Weigh in this morning and start the next one.",
            tag: "weigh-in-reminder",
            url: "/weight",
          }
        : {
            title: "Morning weigh-in",
            body: "Scale first, breakfast after — same time, same conditions.",
            tag: "weigh-in-reminder",
            url: "/weight",
          }

  return { kind: "weigh-in", push, stateUpdate: { lastWeighInPush: today } }
}

/**
 * The time-off nudge. Fires once the user is `NUDGE_AFTER_DAYS` clear of their last
 * confirmed session, then goes quiet for a week at a time — logging a session moves the
 * last-session day forward, which is what cancels the pending nudge.
 *
 * Reading the deadline out of the data, rather than arming a timer when a session is
 * logged, is deliberate: a service worker timer does not survive two days of eviction,
 * which is why the old three-day reminder in `swNotify` effectively never arrived.
 */
function inactivityReminder(
  sessions: Session[],
  state: ReminderState,
  today: string,
  tz?: string
): ReminderDecision | null {
  const last = lastSessionDay(sessions, tz)
  // Never trained: there is no layoff to point at, and the onboarding flow covers this.
  if (!last) return null

  const days = daysBetween(last, today)
  if (days < NUDGE_AFTER_DAYS) return null

  if (state.lastNudgePush) {
    // Re-nudging the same layoff: weekly, and never twice in a day.
    if (daysBetween(state.lastNudgePush, today) < NUDGE_REPEAT_DAYS) return null
  }

  const push: ReminderPush =
    days >= LAYOFF_RESTART_DAYS
      ? {
          title: `${days} days off`,
          body: "Strength is leaking. Open the app and restart the block.",
          tag: "training-nudge",
          url: "/",
        }
      : days >= LAYOFF_NUDGE_DAYS
        ? {
            title: `${days} days off`,
            body: "The bar's going to feel heavy. Get one session in.",
            tag: "training-nudge",
            url: "/",
          }
        : {
            title: "Two days off",
            body: "Rest is fine, three in a row isn't. Bench is waiting.",
            tag: "training-nudge",
            url: "/",
          }

  return { kind: "inactivity", push, stateUpdate: { lastNudgePush: today } }
}

/**
 * What to send this user today, or null for nothing. At most one push a day: two
 * notifications in the same morning is how people end up muting the app.
 *
 * Time off outranks the weigh-in, and deliberately does not consume the weigh-in's slot
 * — its state is left untouched, so the skipped weigh-in nudge goes out tomorrow, by
 * which time the weekly nudge has gone quiet again.
 */
export function decideReminder(input: {
  profile: UserProfile | null
  weights: WeightEntry[]
  sessions: Session[]
  state: ReminderState
  now?: Date
}): ReminderDecision | null {
  const { profile, weights, sessions, state, now = new Date() } = input
  const today = dateKeyInTz(now, state.tz)

  return (
    inactivityReminder(sessions, state, today, state.tz) ??
    weighInReminder(profile, weights, state, today)
  )
}
