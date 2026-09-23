import { MuscleGroupConfig, ExerciseConfig, getDefaultSets, sortedMuscleGroups } from "./exerciseConfig"
import { TrainingDay, MainLift, TrainingMode } from "./types"

/**
 * Routines, and the people who train them.
 *
 * A routine is the pair of blobs the exercise selection screen edits — the muscle
 * groups with their exercises, and the training days that assign those groups to a
 * session. Everyone's routine is public: it is the Routine tab on their profile.
 * Nothing else travels: training mode, main lift, anchor, target and bodyweight are
 * personal, and training under someone must never move them.
 *
 * Training under someone makes them your COACH and you one of their ATHLETES. It is
 * a live link, not a copy: while it holds, your groups and days are whatever your
 * coach trains (resolved server-side in `coach.ts`), so their edits reach you on
 * your next load. Stopping keeps the last version as your own, editable again.
 *
 * This module is imported by both client pages and route handlers, so it must stay
 * free of `server-only` imports.
 */

/** Everything a routine is: what training under someone writes into your own config. */
export interface RoutineBundle {
  muscleGroups: MuscleGroupConfig[]
  trainingDays: TrainingDay[]
}

export interface RoutineSummary {
  dayCount: number
  groupCount: number
  exerciseCount: number
}

/** A person as lists and headers show them: never the full profile. */
export interface PersonSummary {
  email: string
  name: string
  trainingMode?: TrainingMode
  mainLift?: MainLift
}

/** What a profile shows about someone's place among other people. */
export interface ProfileSocial {
  gymbroCount: number
  athleteCount: number
  /** Who they train under, if anyone. */
  coach: PersonSummary | null
  /** The viewer's own relationship to them. */
  isSelf: boolean
  isFriend: boolean
  /** The viewer has asked to be their gymbro and is waiting. */
  requestPending: boolean
  /** The viewer trains under this person. */
  isMyCoach: boolean
}

/**
 * The routine a user actually trains.
 *
 * Retired groups are dropped: they exist only so the owner's old sessions keep
 * resolving their muscle names, and showing them to someone else would add empty
 * groups to their list. Cardio libraries are dropped too — they are outside the
 * split, and each athlete keeps their own. Orders are renumbered densely.
 */
export function buildRoutineBundle(
  config: MuscleGroupConfig[],
  days: TrainingDay[]
): RoutineBundle {
  const muscleGroups = sortedMuscleGroups(config).map((g, i) => ({
    id: g.id,
    name: g.name,
    order: i,
    exercises: [...g.exercises]
      .sort((a, b) => a.order - b.order)
      .map((e, j) => {
        const ex: ExerciseConfig = { id: e.id, name: e.name, order: j }
        ex.defaultSets = e.defaultSets ?? getDefaultSets(e)
        return ex
      }),
  }))

  const liveGroupIds = new Set(muscleGroups.map((g) => g.id))
  const trainingDays = [...days]
    .sort((a, b) => a.order - b.order)
    .map((d, i) => ({
      id: d.id,
      name: d.name,
      order: i,
      muscleGroupIds: d.muscleGroupIds.filter((id) => liveGroupIds.has(id)),
    }))

  return { muscleGroups, trainingDays }
}

export function summarizeRoutine(bundle: RoutineBundle): RoutineSummary {
  return {
    dayCount: bundle.trainingDays.length,
    groupCount: bundle.muscleGroups.length,
    exerciseCount: bundle.muscleGroups.reduce((n, g) => n + g.exercises.length, 0),
  }
}
