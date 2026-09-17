import { ExtraSet, Session } from "./types"

/**
 * Looking up what an exercise was last loaded with — shared by the logger, which
 * pre-fills its inputs from it, and the Balanced home screen, which previews it.
 *
 * Every function here scans `history` in order and takes the first match, so
 * `history` MUST be newest first. Callers pass the sorted confirmed list; an
 * unsorted array silently returns the wrong "last time".
 */

/**
 * Case, spacing and punctuation folded away, so "Lat Pull-Down" and "lat pulldown"
 * are the same lift. Only ever used as a fallback after an exact match fails, and
 * only equality — never fuzzy distance — so it cannot confuse "Dumbbell Curl" with
 * "Dumbbell Curls".
 */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * The most recent session that logged this exercise, with the sets it logged.
 *
 * An exact name match wins outright. Failing that, the scan runs again against
 * normalized names: adopting someone else's split renames the same lift as often as
 * it replaces it, and a lift that came back as "Lat Pull Down" should still prefill
 * from the "Lat Pulldown" you have been logging for months.
 */
export function findLastSessionWithExercise(
  exerciseName: string,
  history: Session[]
): { session: Session; sets: ExtraSet[] } | null {
  return matchExercise(exerciseName, history, (a, b) => a === b)
    ?? matchExercise(exerciseName, history, (a, b) => normalize(a) === normalize(b))
}

function matchExercise(
  exerciseName: string,
  history: Session[],
  matches: (candidate: string, target: string) => boolean
): { session: Session; sets: ExtraSet[] } | null {
  for (const session of history) {
    for (const workout of session.extraWorkouts ?? []) {
      for (const exercise of workout.exercises) {
        if (matches(exercise.name, exerciseName) && exercise.sets.length > 0) {
          return { session, sets: exercise.sets }
        }
      }
    }
  }
  return null
}

/** Every set from the last time this exercise was logged. */
export function getLastSetsForExercise(
  exerciseName: string,
  history: Session[]
): Array<{ kg: number; reps: number }> | null {
  const found = findLastSessionWithExercise(exerciseName, history)
  if (!found) return null
  return found.sets.map((s) => ({ kg: s.kg, reps: s.reps }))
}

/**
 * The heaviest set from the last time this exercise was logged — deliberately the
 * most recent session's best, not the all-time best, so it reads as "what you did".
 */
export function getTopSet(exerciseName: string, history: Session[]): ExtraSet | null {
  const found = findLastSessionWithExercise(exerciseName, history)
  if (!found) return null
  return found.sets.reduce((best, set) =>
    set.kg > best.kg || (set.kg === best.kg && set.reps > best.reps) ? set : best
  )
}
