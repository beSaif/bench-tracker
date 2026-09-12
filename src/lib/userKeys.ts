import "server-only"

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

export function profileKey(email: string): string {
  return `user:${normalize(email)}:profile`
}

export function sessionsKey(email: string): string {
  return `user:${normalize(email)}:sessions`
}

export function exercisesKey(email: string): string {
  return `user:${normalize(email)}:exercises`
}

export function trainingDaysKey(email: string): string {
  return `user:${normalize(email)}:training-days`
}

export function weightsKey(email: string): string {
  return `user:${normalize(email)}:weights`
}

export function reactionsKey(ownerEmail: string, sessionId: number): string {
  return `session:${normalize(ownerEmail)}:${sessionId}:reactions`
}

export function commentsKey(ownerEmail: string, sessionId: number): string {
  return `session:${normalize(ownerEmail)}:${sessionId}:comments`
}

export function pushSubKey(email: string): string {
  return `user:${normalize(email)}:push-sub`
}

/** Bookkeeping for the daily reminder job: the user's zone and when each nudge last went out. */
export function reminderStateKey(email: string): string {
  return `user:${normalize(email)}:reminder-state`
}

/** The email a `pushSubKey` belongs to. Emails cannot contain ":", so this is unambiguous. */
export function emailFromPushSubKey(key: string): string | null {
  const match = /^user:(.+):push-sub$/.exec(key)
  return match ? match[1] : null
}

export function friendsKey(email: string): string {
  return `user:${normalize(email)}:friends`
}

export function friendRequestsInKey(email: string): string {
  return `user:${normalize(email)}:friend-requests-in`
}

export function friendRequestsOutKey(email: string): string {
  return `user:${normalize(email)}:friend-requests-out`
}

export function messageInboxKey(email: string): string {
  return `user:${normalize(email)}:messages`
}

export const LEGACY_SESSIONS_KEY = "bench-tracker-sessions"
export const LEGACY_EXERCISES_KEY = "bench-tracker-exercises"

export function isLegacyOwner(email: string): boolean {
  const owner = process.env.LEGACY_OWNER_EMAIL
  return !!owner && normalize(owner) === normalize(email)
}
