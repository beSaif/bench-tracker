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

export function reactionsKey(ownerEmail: string, sessionId: number): string {
  return `session:${normalize(ownerEmail)}:${sessionId}:reactions`
}

export function commentsKey(ownerEmail: string, sessionId: number): string {
  return `session:${normalize(ownerEmail)}:${sessionId}:comments`
}

export function pushSubKey(email: string): string {
  return `user:${normalize(email)}:push-sub`
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

export const LEGACY_SESSIONS_KEY = "bench-tracker-sessions"
export const LEGACY_EXERCISES_KEY = "bench-tracker-exercises"

export function isLegacyOwner(email: string): boolean {
  const owner = process.env.LEGACY_OWNER_EMAIL
  return !!owner && normalize(owner) === normalize(email)
}
