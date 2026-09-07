import { ExtraSet, Session } from "./types"

/**
 * Looking up what an exercise was last loaded with — shared by the logger, which
 * pre-fills its inputs from it, and the Balanced home screen, which previews it.
 *
 * Every function here scans `history` in order and takes the first match, so
 * `history` MUST be newest first. Callers pass the sorted confirmed list; an
 * unsorted array silently returns the wrong "last time".
 */

/** The most recent session that logged this exercise, with the sets it logged. */
export function findLastSessionWithExercise(
  exerciseName: string,
  history: Session[]
): { session: Session; sets: ExtraSet[] } | null {
  for (const session of history) {
    for (const workout of session.extraWorkouts ?? []) {
      for (const exercise of workout.exercises) {
        if (exercise.name === exerciseName && exercise.sets.length > 0) {
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
