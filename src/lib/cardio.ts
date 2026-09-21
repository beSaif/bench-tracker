import { ExtraSet } from "./types"

/**
 * The optional numbers a cardio bout can carry beyond its duration.
 *
 * Time is always logged; these are opt-in per exercise, and at most two can be active
 * at once because the log card fits three dials in a row and time holds the first.
 * Which two is the user's choice — the defaults in `DEFAULT_CARDIO_GROUP` only decide
 * what an exercise opens with the very first time, before there is a bout to copy.
 */
export type CardioField = "distance" | "speed" | "incline"

export const CARDIO_FIELDS: CardioField[] = ["distance", "speed", "incline"]

/** How many of them can be dialled in at once, time excluded. */
export const MAX_CARDIO_FIELDS = 2

/** The dial's own caption — the unit, as the machine reads it. */
export const CARDIO_FIELD_UNIT: Record<CardioField, string> = {
  distance: "km",
  speed: "km/h",
  incline: "%",
}

/** The chip's caption, when the field is not being logged yet. */
export const CARDIO_FIELD_LABEL: Record<CardioField, string> = {
  distance: "distance",
  speed: "speed",
  incline: "incline",
}

/**
 * Dial values per field. Ranges are gym-sized on purpose: a half marathon of distance,
 * a sprint of speed and a steep-but-real gradient, each at the step the machine uses.
 */
export const CARDIO_FIELD_VALUES: Record<CardioField, number[]> = {
  distance: Array.from({ length: 210 }, (_, i) => round1((i + 1) * 0.1)),
  speed: Array.from({ length: 191 }, (_, i) => round1(1 + i * 0.1)),
  incline: Array.from({ length: 41 }, (_, i) => round1(i * 0.5)),
}

/** What a field opens at when there is no bout to copy from. */
export const CARDIO_FIELD_DEFAULT: Record<CardioField, number> = {
  distance: 1,
  speed: 6,
  incline: 3,
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Trims a trailing ".0" so a dialled 3.0% reads as "3%". */
export function formatCardioNumber(n: number): string {
  return round1(n).toString()
}

export function formatCardioField(field: CardioField, value: number): string {
  const n = formatCardioNumber(value)
  return field === "incline" ? `${n}%` : `${n} ${CARDIO_FIELD_UNIT[field]}`
}

/**
 * The shape every formatter here needs: a bout's numbers, without the load-bearing
 * fields of a lifting set. Both a logged `ExtraSet` and the logger's in-progress state
 * satisfy it, so the same formatting runs in the card and in history.
 */
export type CardioBout = Pick<ExtraSet, "minutes" | "distance" | "speed" | "incline">

/** The fields a bout actually carries, in display order. */
export function cardioFieldsOf(bout: CardioBout): CardioField[] {
  return CARDIO_FIELDS.filter((f) => bout[f] != null)
}

/**
 * A bout as one line — "10 min · 2 km · 3%".
 *
 * Every surface that reads a session back uses this, so a bout reads the same in the
 * logger, in session history and on the detail page.
 */
export function formatCardioSet(bout: CardioBout): string {
  const parts = [`${formatCardioNumber(bout.minutes ?? 0)} min`]
  for (const field of cardioFieldsOf(bout)) {
    parts.push(formatCardioField(field, bout[field]!))
  }
  return parts.join(" · ")
}

/**
 * The number the bout implies but did not log, if any.
 *
 * Distance and speed are the same fact seen two ways, and a machine only ever tells
 * you one of them: a treadmill is set to a speed, a rower counts out a distance. So
 * whichever is missing is worth showing, because speed is the only figure comparable
 * between two bouts of different lengths — ten minutes says nothing on its own.
 *
 * Nothing is derived when both were logged (the user's numbers win outright) or when
 * the duration is zero, which would divide by nothing.
 */
export function derivedCardioValue(bout: CardioBout): { field: CardioField; value: number } | null {
  const hours = (bout.minutes ?? 0) / 60
  if (hours <= 0) return null
  if (bout.distance != null && bout.speed == null) {
    return { field: "speed", value: round1(bout.distance / hours) }
  }
  if (bout.speed != null && bout.distance == null) {
    return { field: "distance", value: round1(bout.speed * hours) }
  }
  return null
}

/** The derived figure as a line to sit under the dials, e.g. "≈ 12 km/h". */
export function formatDerivedCardio(bout: CardioBout): string | null {
  const derived = derivedCardioValue(bout)
  return derived ? `≈ ${formatCardioField(derived.field, derived.value)}` : null
}
