import { MainLift, MAIN_LIFT_LABEL, MAIN_LIFT_SHORT, Session, TrainingBlock, TrainingDay, TrainingMode, UserProfile } from "./types"

type ModeSource = Pick<UserProfile, "trainingMode"> | null | undefined

/** Profiles saved before the mode existed have no field; they keep the original behaviour. */
export function getTrainingMode(profile: ModeSource): TrainingMode {
  return profile?.trainingMode ?? "lift-focused"
}

export function isLiftFocused(profile: ModeSource): boolean {
  return getTrainingMode(profile) === "lift-focused"
}

/** Display label for the main lift, with a neutral fallback for profiles without one. */
export function getMainLiftLabel(profile: Pick<UserProfile, "mainLift"> | null | undefined): string {
  const lift: MainLift | undefined = profile?.mainLift
  return lift ? MAIN_LIFT_LABEL[lift] : "Main Lift"
}

/** Short label for the main lift ("Bench"), for tags and buttons where space is tight. */
export function getMainLiftShortLabel(profile: Pick<UserProfile, "mainLift"> | null | undefined): string {
  const lift: MainLift | undefined = profile?.mainLift
  return lift ? MAIN_LIFT_SHORT[lift] : "Main lift"
}

/** True when the profile carries everything lift-focused mode needs to prescribe a block. */
export function hasLiftSetup(
  profile: Pick<UserProfile, "mainLift" | "anchor" | "target"> | null | undefined
): profile is { mainLift: MainLift; anchor: number; target: number } {
  return (
    !!profile &&
    profile.mainLift !== undefined &&
    typeof profile.anchor === "number" && profile.anchor > 0 &&
    typeof profile.target === "number" && profile.target > 0
  )
}

/**
 * Display label for a session. Balanced-mode sessions are stored with type "Free",
 * which is a storage value and must never reach the UI — they show their training
 * day instead ("Push", "Pull"), falling back to a neutral word when no day matches.
 */
export function getSessionLabel(
  session: Pick<Session, "type" | "selectedTrainingDayId">,
  trainingDays: TrainingDay[]
): string {
  if (session.type !== "Free") return session.type
  const day = trainingDays.find((d) => d.id === session.selectedTrainingDayId)
  return day?.name ?? "Session"
}

/**
 * How many of the most recent sessions in a row were logged without the main lift.
 * Drives the coach nudge — one skip is a training day, a run of them is a pattern.
 */
export function countConsecutiveSkips(sessions: Session[]): number {
  const chrono = sessions
    .filter((s) => s.confirmed && s.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())

  let count = 0
  for (const s of chrono) {
    if (!s.skippedMainLift) break
    count++
  }
  return count
}

/**
 * Skipped sessions that belong to the stretch the active block is currently in.
 *
 * They carry no blockId by design, so membership cannot be read off the block —
 * instead they qualify by being newer than every session already filed under an
 * earlier block. Home shows these alongside the active block's own sessions;
 * History treats them as current and leaves them out of the archive.
 */
export function currentStretchSkips(sessions: Session[], blocks: TrainingBlock[]): Session[] {
  const activeBlock = blocks.find((b) => b.status === "active")
  const earlierBlockSessionIds = new Set(
    blocks.filter((b) => b.id !== activeBlock?.id).flatMap((b) => b.sessionIds)
  )

  const lastEarlierTime = sessions
    .filter((s) => s.confirmed && s.date && earlierBlockSessionIds.has(s.id))
    .reduce((latest, s) => Math.max(latest, new Date(s.date!).getTime()), 0)

  return sessions.filter(
    (s) =>
      s.confirmed &&
      s.skippedMainLift &&
      s.blockId === undefined &&
      s.date !== null &&
      new Date(s.date).getTime() > lastEarlierTime
  )
}
