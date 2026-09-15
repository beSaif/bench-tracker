import { MainLift } from "./types"
import { RarityTier } from "./friendCard"

/**
 * The card's look-up tables. Colour lives here rather than in the page so the
 * frame, the sprite and the energy pips can't drift apart.
 */

export interface RarityStyle {
  label: string
  /** Stars printed next to the stage line. */
  stars: string
  frame: string
  /** Inner mat the artwork and attacks sit on. */
  mat: string
  ink: string
  /** Only holo cards get the moving foil sheen. */
  holo: boolean
}

export const RARITY: Record<RarityTier, RarityStyle> = {
  common: {
    label: "COMMON",
    stars: "●",
    frame: "linear-gradient(160deg, #d8d8d8 0%, #f2f2f2 45%, #c9c9c9 100%)",
    mat: "#f6f6f4",
    ink: "#3f3f3f",
    holo: false,
  },
  uncommon: {
    label: "UNCOMMON",
    stars: "◆",
    frame: "linear-gradient(160deg, #bfe3c4 0%, #eefaef 45%, #9fd3a9 100%)",
    mat: "#f3faf4",
    ink: "#1e5c1a",
    holo: false,
  },
  rare: {
    label: "RARE",
    stars: "★",
    frame: "linear-gradient(160deg, #ffd88a 0%, #fff6de 42%, #e8b45c 100%)",
    mat: "#fffaf0",
    ink: "#7a4a05",
    holo: false,
  },
  holo: {
    label: "HOLO RARE",
    stars: "★★★",
    frame:
      "linear-gradient(135deg, #ff9ad5 0%, #ffe68a 22%, #8affc9 44%, #8ad2ff 66%, #c79aff 85%, #ff9ad5 100%)",
    mat: "#fdf7ff",
    ink: "#5b2a7a",
    holo: true,
  },
}

/** Energy type, borrowed from the friend's main lift. */
export interface LiftEnergy {
  /** Single glyph used as the energy pip on attacks and in the type line. */
  pip: string
  name: string
  colour: string
  bg: string
}

export const LIFT_ENERGY: Record<MainLift, LiftEnergy> = {
  bench: { pip: "▲", name: "BENCH", colour: "#1e3a5f", bg: "#eff6ff" },
  squat: { pip: "◆", name: "SQUAT", colour: "#1e3a7a", bg: "#f0f5ff" },
  deadlift: { pip: "■", name: "DEADLIFT", colour: "#1e5c1a", bg: "#f2fdf0" },
}

/** Balanced-mode gymbros train no single lift, so they get a neutral energy. */
export const BALANCED_ENERGY: LiftEnergy = {
  pip: "✦",
  name: "BALANCED",
  colour: "#555555",
  bg: "#f5f5f5",
}

/**
 * Evolution stage from how many sessions are on the board. It is pure flavour, but
 * it gives a new gymbro somewhere to climb from.
 */
export function stageFor(level: number): string {
  if (level >= 60) return "STAGE 2"
  if (level >= 20) return "STAGE 1"
  return "BASIC"
}

/**
 * The card's "weakness" — the thing actually eating their progress. Reading it off
 * the layoff is what makes the joke land: a gymbro who trains has no weakness.
 */
export function weaknessFor(daysSinceLast: number | null): { label: string; pip: string } {
  if (daysSinceLast == null) return { label: "UNPROVEN", pip: "?" }
  if (daysSinceLast >= 14) return { label: "THE COUCH", pip: "☾" }
  if (daysSinceLast >= 7) return { label: "REST DAYS", pip: "☾" }
  if (daysSinceLast >= 4) return { label: "SNOOZE", pip: "☾" }
  // No pip when there is nothing to call out — "— none" read like a missing value.
  return { label: "NONE", pip: "" }
}
