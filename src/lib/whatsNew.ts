import { WHATS_NEW_SEEN_KEY } from "./types"

export interface WhatsNewItem {
  title: string
  body: string
}

export interface WhatsNewRelease {
  /** Monotonically increasing. Bump when adding a release so existing users see it once. */
  version: number
  items: WhatsNewItem[]
}

/**
 * Newest first. Add a new entry at the top with version = previous + 1.
 * Anyone whose last-seen version is lower sees every newer release in one modal.
 */
export const WHATS_NEW: WhatsNewRelease[] = [
  {
    version: 1,
    items: [
      {
        title: "Choose your training focus",
        body: "New in Exercise Selection: Lift-focused keeps one main lift opening every session with block phases. Balanced drops the forced lift and just follows your training days.",
      },
      {
        title: "Balanced mode home",
        body: "In Balanced mode the home screen shows your recent sessions instead of blocks and targets. You can switch back at any time and your block picks up where it left off.",
      },
    ],
  },
]

export const WHATS_NEW_VERSION = WHATS_NEW[0]?.version ?? 0

export function loadWhatsNewSeen(): number {
  try {
    const raw = localStorage.getItem(WHATS_NEW_SEEN_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function markWhatsNewSeen(version: number = WHATS_NEW_VERSION): void {
  try {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, String(version))
  } catch {
    // Private mode / quota — the modal just shows again next load.
  }
}

/** Releases the user has not yet seen, newest first. */
export function pendingWhatsNew(seen: number = loadWhatsNewSeen()): WhatsNewRelease[] {
  return WHATS_NEW.filter((r) => r.version > seen)
}
