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
    version: 4,
    items: [
      {
        title: "Cardio, logged in minutes",
        body: "Treadmill, bike, rower, elliptical, stairs, jump rope and incline walk are now in the exercises sheet under Cardio. Open Exercises mid-session, hit Add, and pick one — it logs minutes instead of kg and reps. Tap + distance, + speed or + incline on the card to record more, and the app works out whichever of distance and speed you did not log. Your choice sticks: the next bout of that exercise opens the same way, at last time's numbers. Cardio sits outside your split, so it never joins a training day, never changes what the coach prescribes and never touches your tonnage or PRs.",
      },
    ],
  },
  {
    version: 3,
    items: [
      {
        title: "Skip your main lift for a day",
        body: "Training legs and shoulders and don't want to bench? Hit Skip Bench on the up-next card. The session logs as accessories only and your prescribed load isn't spent — it opens your next session instead, so the block never loses a step.",
      },
    ],
  },
  {
    version: 2,
    items: [
      {
        title: "Bench Press is in the Chest group",
        body: "Chest now starts with Bench Press, so any day that trains chest suggests it like any other exercise. It is added once if your Chest group was missing it — reorder, rename or remove it from Exercise Selection and that sticks.",
      },
    ],
  },
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
