import "server-only"
import { Session, TrainingBlock, TrainingDay } from "./types"
import { MuscleGroupConfig } from "./exerciseConfig"

/**
 * Shape checks for the whole-document writes (/api/sessions, /api/exercises,
 * /api/training-days). Each of those replaces the stored document outright, so a
 * malformed body would wipe the user's data and break every page that reads it.
 *
 * Structural only, unlike the weights sanitizer: these documents carry many optional
 * fields that older and newer clients disagree on, so anything well-formed is stored
 * as sent rather than rebuilt field by field.
 */

/** A generous ceiling: years of daily sessions. Larger is a bug, not a user. */
const MAX_ITEMS = 5000

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function isBoundedArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length <= MAX_ITEMS
}

function isSession(v: unknown): v is Session {
  return (
    isObject(v) &&
    typeof v.id === "number" &&
    (v.date === null || typeof v.date === "string") &&
    typeof v.type === "string" &&
    typeof v.confirmed === "boolean" &&
    Array.isArray(v.sets) &&
    v.sets.every((s) => isObject(s) && typeof s.kg === "number" && typeof s.reps === "number")
  )
}

function isBlock(v: unknown): v is TrainingBlock {
  return (
    isObject(v) &&
    typeof v.id === "number" &&
    typeof v.phase === "string" &&
    typeof v.status === "string" &&
    typeof v.anchorWeight === "number" &&
    Array.isArray(v.sessionIds) &&
    v.sessionIds.every((id) => typeof id === "number")
  )
}

/** `{ sessions, blocks }`, or the legacy bare session array (normalised by the caller). */
export function parseSessionsPayload(
  body: unknown
): { sessions: Session[]; blocks: TrainingBlock[] } | null {
  if (isBoundedArray(body)) return body.every(isSession) ? { sessions: body, blocks: [] } : null
  if (!isObject(body)) return null
  const { sessions, blocks = [] } = body
  if (!isBoundedArray(sessions) || !sessions.every(isSession)) return null
  if (!isBoundedArray(blocks) || !blocks.every(isBlock)) return null
  return { sessions, blocks }
}

export function isMuscleGroupConfigArray(body: unknown): body is MuscleGroupConfig[] {
  return (
    isBoundedArray(body) &&
    body.every(
      (g) =>
        isObject(g) &&
        typeof g.id === "string" &&
        typeof g.name === "string" &&
        Array.isArray(g.exercises)
    )
  )
}

export function isTrainingDayArray(body: unknown): body is TrainingDay[] {
  return (
    isBoundedArray(body) &&
    body.every(
      (d) =>
        isObject(d) &&
        typeof d.id === "string" &&
        typeof d.name === "string" &&
        Array.isArray(d.muscleGroupIds) &&
        d.muscleGroupIds.every((m) => typeof m === "string")
    )
  )
}
