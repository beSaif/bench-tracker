import { TrainingDay } from "./types"

export interface ExerciseConfig {
  id: string
  name: string
  order: number
  defaultSets?: number
}

export interface MuscleGroupConfig {
  id: string
  name: string
  exercises: ExerciseConfig[]
  order: number
  /**
   * A group that is no longer part of the user's split but is kept so sessions that
   * logged it still resolve its name. Retired groups carry no exercises and are
   * hidden everywhere a group can be chosen — `sortedMuscleGroups` filters them,
   * which is what every picker in the app builds from. Only `getMuscleLabel` looks
   * at them, which is the whole point: deleting a group, or replacing your split
   * with someone else's, must not turn last month's history into raw slugs.
   */
  retired?: boolean
}

export const DEFAULT_MUSCLE_GROUPS: MuscleGroupConfig[] = [
  {
    id: "back",
    name: "Back",
    order: 0,
    exercises: [
      { id: "lat-pulldown", name: "Lat Pulldown", order: 0 },
      { id: "single-cable-seated-pulldown", name: "Single Cable Seated Pulldown", order: 1 },
      { id: "cross-rear-delt-fly", name: "Cross Rear Delt Fly", order: 2 },
    ],
  },
  {
    id: "triceps",
    name: "Triceps",
    order: 1,
    exercises: [
      { id: "overhead-extension", name: "Overhead Extension", order: 0 },
      { id: "bar-pulldown", name: "Bar Pulldown", order: 1 },
      { id: "single-arm-cable-pulldown", name: "Single Arm Cable Pulldown", order: 2 },
    ],
  },
  {
    id: "chest",
    name: "Chest",
    order: 2,
    exercises: [
      { id: "bench-press", name: "Bench Press", order: 0, defaultSets: 3 },
      { id: "dumbbell-incline-press", name: "Dumbbell Incline Press", order: 1, defaultSets: 3 },
      { id: "machine-seated-chest-press", name: "Machine Seated Chest Press", order: 2 },
    ],
  },
  {
    id: "biceps",
    name: "Biceps",
    order: 3,
    exercises: [
      { id: "zbar-curls", name: "ZBar Curls", order: 0 },
      { id: "dumbbell-curl", name: "Dumbbell Curl", order: 1 },
      { id: "hammer-curl", name: "Hammer Curl", order: 2 },
    ],
  },
  {
    id: "shoulders",
    name: "Shoulders",
    order: 4,
    exercises: [
      { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", order: 0 },
      { id: "cable-lateral-raise", name: "Cable Lateral Raise", order: 1 },
      { id: "face-pulls", name: "Face Pulls", order: 2 },
    ],
  },
  {
    id: "legs",
    name: "Legs",
    order: 5,
    exercises: [
      { id: "leg-extension", name: "Leg Extension", order: 0 },
      { id: "leg-curl", name: "Leg Curl", order: 1 },
      { id: "leg-press", name: "Leg Press", order: 2 },
    ],
  },
]

export function getDefaultSets(ex: ExerciseConfig): number {
  return ex.defaultSets ?? (ex.order === 0 ? 3 : 2)
}

/** The groups the user actually trains, in order. Retired groups are never included. */
export function sortedMuscleGroups(config: MuscleGroupConfig[]): MuscleGroupConfig[] {
  return config.filter((g) => !g.retired).sort((a, b) => a.order - b.order)
}

/**
 * Retire the groups the incoming config drops, so their names survive in history.
 *
 * Used when a published routine replaces the user's split: any group the new config
 * has no entry for is appended as a name-only tombstone. Tombstones already present
 * in `outgoing` are carried forward, oldest dropped first past `RETIRED_GROUP_LIMIT`
 * so switching splits repeatedly cannot grow the config without bound.
 */
export const RETIRED_GROUP_LIMIT = 60

export function retireReplacedGroups(
  incoming: MuscleGroupConfig[],
  outgoing: MuscleGroupConfig[]
): MuscleGroupConfig[] {
  const liveIds = new Set(incoming.map((g) => g.id))
  const tombstones: MuscleGroupConfig[] = []

  for (const group of outgoing) {
    if (liveIds.has(group.id)) continue
    liveIds.add(group.id)
    tombstones.push({
      id: group.id,
      name: group.name,
      order: incoming.length + tombstones.length,
      exercises: [],
      retired: true,
    })
  }

  return [...incoming, ...tombstones.slice(-RETIRED_GROUP_LIMIT)]
}

/**
 * The display name for a muscle group id, including retired ones.
 *
 * A group deleted before tombstones existed leaves nothing to look up, so the
 * fallback reads the name back out of the id instead: `generateId` builds ids as
 * `<slug>-<base36 timestamp>`, so dropping that suffix and title-casing the slug
 * recovers "Lower Back" from "lower-back-m1k2j3" rather than showing the slug.
 */
export function getMuscleLabel(config: MuscleGroupConfig[], id: string): string {
  const found = config.find((g) => g.id === id)
  if (found) return found.name
  return labelFromId(id)
}

function labelFromId(id: string): string {
  const slug = id.replace(/-[0-9a-z]{6,}$/, "") || id
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function getExercisesForMuscle(config: MuscleGroupConfig[], id: string): string[] {
  const group = config.find((g) => g.id === id)
  if (!group) return []
  return [...group.exercises].sort((a, b) => a.order - b.order).map((e) => e.name)
}

const BENCH_PRESS_ID = "bench-press"
const BENCH_PRESS_NAME = "Bench Press"
const CHEST_GROUP_ID = "chest"

/** Bump when a new one-time repair is added to `migrateExerciseConfig`. */
export const EXERCISE_CONFIG_MIGRATION = 1

/**
 * Any bench press, however the user named it — "Barbell Bench", "Flat Bench Press".
 * "Bench Dip" is not one, so a bench in the name is not enough on its own.
 */
function isBenchPress(name: string): boolean {
  const n = normalize(name)
  if (!n.includes("bench")) return false
  return n.includes("press") || n.endsWith("bench")
}

function findChestGroup(config: MuscleGroupConfig[]): MuscleGroupConfig | undefined {
  const live = config.filter((g) => !g.retired)
  return (
    live.find((g) => g.id === CHEST_GROUP_ID) ??
    live.find((g) => normalize(g.name) === CHEST_GROUP_ID)
  )
}

/**
 * One-time repairs to a config that was saved before the defaults changed.
 *
 * Bench press joined the default Chest group late, and the defaults only ever reach an
 * account that has never saved a config of its own — so an account that edited its
 * exercises even once would never see it. This puts it where the default has it, first
 * in Chest, and runs once: from then on bench press is an ordinary exercise, and
 * reordering, renaming or deleting it sticks. A config that already has one under any
 * name is left exactly as it is.
 *
 * Displaced exercises get their set count pinned, because `getDefaultSets` infers 3
 * sets for whatever sits at order 0 and 2 for the rest — without pinning, inserting
 * bench would quietly cut a set from the exercise it pushed down.
 *
 * Returns the same array when there is nothing to do, so callers can tell whether the
 * config is worth writing back.
 */
export function migrateExerciseConfig(config: MuscleGroupConfig[]): MuscleGroupConfig[] {
  const chest = findChestGroup(config)
  if (!chest || chest.exercises.some((e) => isBenchPress(e.name))) return config

  const exercises = [
    { id: BENCH_PRESS_ID, name: BENCH_PRESS_NAME, order: 0, defaultSets: 3 },
    ...[...chest.exercises].sort((a, b) => a.order - b.order),
  ].map((e, i) => ({ ...e, order: i, defaultSets: e.defaultSets ?? getDefaultSets(e) }))

  return config.map((g) => (g === chest ? { ...g, exercises } : g))
}

/**
 * Exercise names a session opens a muscle group with, in the group's own order.
 *
 * `exclude` drops one exercise by name: lift-focused mode opens every session with the
 * main lift on its own, so the same lift sitting in a muscle group would be a second
 * copy of it on the screen. Matching is on the name alone, so "Dumbbell Bench Press"
 * survives a "Bench Press" main lift — it is a different exercise.
 */
export function getSessionExercisesForMuscle(
  config: MuscleGroupConfig[],
  id: string,
  opts: { exclude?: string } = {}
): string[] {
  const names = getExercisesForMuscle(config, id)
  const skip = opts.exclude ? normalize(opts.exclude) : null
  return skip ? names.filter((n) => normalize(n) !== skip) : names
}

export const DEFAULT_TRAINING_DAYS: TrainingDay[] = [
  { id: "day-a", name: "Day A", order: 0, muscleGroupIds: ["back", "triceps"] },
  { id: "day-b", name: "Day B", order: 1, muscleGroupIds: ["chest", "biceps"] },
  { id: "day-c", name: "Day C", order: 2, muscleGroupIds: ["legs", "shoulders"] },
]

export function buildRotationFromDays(days: TrainingDay[]): string[][] {
  return [...days]
    .sort((a, b) => a.order - b.order)
    .map((d) => d.muscleGroupIds)
    .filter((ids) => ids.length > 0)
}

export function buildMuscleRotation(config: MuscleGroupConfig[]): string[][] {
  const sorted = sortedMuscleGroups(config).map((g) => g.id)
  const pairs: string[][] = []
  for (let i = 0; i < sorted.length; i += 2) {
    if (i + 1 < sorted.length) {
      pairs.push([sorted[i], sorted[i + 1]])
    } else {
      pairs.push([sorted[i]])
    }
  }
  return pairs
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function findSimilarExercises(name: string, config: MuscleGroupConfig[]): string[] {
  const na = normalize(name)
  if (na.length < 3) return []
  const similar: string[] = []
  for (const group of config.filter((g) => !g.retired)) {
    for (const ex of group.exercises) {
      const nb = normalize(ex.name)
      if (nb === na) { similar.push(ex.name); continue }
      const maxLen = Math.max(na.length, nb.length)
      if (maxLen === 0) continue
      const dist = levenshtein(na, nb)
      if (dist / maxLen < 0.3) similar.push(ex.name)
    }
  }
  return similar
}

export function generateId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36)
  )
}
