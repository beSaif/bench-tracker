import { MuscleGroupConfig, ExerciseConfig, getDefaultSets, sortedMuscleGroups } from "./exerciseConfig"
import { TrainingDay } from "./types"

/**
 * Shareable training splits.
 *
 * A routine is the pair of blobs the exercise selection screen edits — the muscle
 * groups with their exercises, and the training days that assign those groups to a
 * session. Nothing else travels: training mode, main lift, anchor, target and
 * bodyweight are personal, and adopting someone's split must never move them.
 *
 * Publishing takes a SNAPSHOT. Editing your own exercises afterwards does not leak
 * out — the screen notices the drift (see `routineFingerprint`) and offers to push
 * an update deliberately.
 *
 * This module is imported by both client pages and route handlers, so it must stay
 * free of `server-only` imports.
 */

export type RoutineVisibility = "public" | "unlisted"

/** Everything adopting a routine writes into the adopter's own config. */
export interface RoutineBundle {
  muscleGroups: MuscleGroupConfig[]
  trainingDays: TrainingDay[]
}

/** Derived at publish time so the directory can list without loading bundles. */
export interface RoutineSummary {
  dayCount: number
  groupCount: number
  exerciseCount: number
  /** One per training day, in order: "Back + Triceps". */
  dayLabels: string[]
}

export interface PublishedRoutine {
  id: string
  name: string
  description: string
  /** Equipment / gym tags, lowercased and deduped: "dumbbells only", "no squat rack". */
  tags: string[]
  authorEmail: string
  authorName: string
  visibility: RoutineVisibility
  bundle: RoutineBundle
  summary: RoutineSummary
  /** Changes whenever the published bundle changes. Drives the "unpublished changes" hint. */
  fingerprint: string
  publishedAt: string
  updatedAt: string
}

/**
 * A routine as the directory serves it: no bundle (too big to list) and no author
 * email — `mine` is resolved server-side so the client never needs it.
 */
export type RoutineListing = Omit<PublishedRoutine, "bundle" | "authorEmail"> & {
  adoptionCount: number
  mine: boolean
}

/** A routine's detail view: the listing fields plus the bundle, for the preview. */
export type RoutineDetail = RoutineListing & { bundle: RoutineBundle }

export interface RoutineMeta {
  name: string
  description: string
  tags: string[]
  visibility: RoutineVisibility
}

// ─── Limits ───
// These bound what a signed-in user can push into KV, so they are enforced by the
// validator below rather than only by the form.

export const ROUTINE_NAME_MAX = 60
export const ROUTINE_DESC_MAX = 280
export const ROUTINE_TAG_MAX = 24
export const ROUTINE_TAGS_MAX = 6
export const ROUTINE_DAYS_MAX = 14
export const ROUTINE_GROUPS_MAX = 30
export const ROUTINE_EXERCISES_MAX = 30
const LABEL_MAX = 60
const ID_MAX = 80

// ─── Ids ───

/**
 * 32 unambiguous characters, so `byte & 31` is an unbiased pick and a routine id
 * survives being read aloud or typed from a screenshot. "l" and "o" are out.
 */
const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"
export const ROUTINE_ID_LENGTH = 8

/** A routine's id doubles as its share code, so it is random rather than derived. */
export function newRoutineId(): string {
  const bytes = new Uint8Array(ROUTINE_ID_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ""
  for (const b of bytes) out += ID_ALPHABET[b & 31]
  return out
}

/** Accepts a pasted share code in any case, with stray spaces or a full URL around it. */
export function parseRoutineCode(raw: string): string | null {
  const tail = raw.trim().split(/[/\s?#]+/).filter(Boolean).pop() ?? ""
  const code = tail.toLowerCase()
  if (code.length !== ROUTINE_ID_LENGTH) return null
  for (const ch of code) if (!ID_ALPHABET.includes(ch)) return null
  return code
}

// ─── Building and summarising ───

/**
 * The publishable snapshot of a user's current setup.
 *
 * Retired groups are dropped: they exist only so the owner's old sessions keep
 * resolving their muscle names, and shipping them to a stranger would add empty
 * groups to their list. Orders are renumbered densely so the bundle is stable —
 * two configs that differ only by gaps in `order` produce the same fingerprint.
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
  const nameOf = (id: string) => bundle.muscleGroups.find((g) => g.id === id)?.name ?? id
  return {
    dayCount: bundle.trainingDays.length,
    groupCount: bundle.muscleGroups.length,
    exerciseCount: bundle.muscleGroups.reduce((n, g) => n + g.exercises.length, 0),
    dayLabels: bundle.trainingDays.map((d) =>
      d.muscleGroupIds.length > 0 ? d.muscleGroupIds.map(nameOf).join(" + ") : "Rest"
    ),
  }
}

/**
 * A stable digest of a bundle's contents, used to tell a published snapshot apart
 * from the author's live config without shipping both to the client and diffing.
 *
 * Not a security primitive — a collision would only mean the "unpublished changes"
 * hint stays quiet, so a short non-cryptographic hash is the right size of tool.
 */
export function routineFingerprint(bundle: RoutineBundle): string {
  const canonical = JSON.stringify([
    bundle.muscleGroups.map((g) => [g.id, g.name, g.exercises.map((e) => [e.id, e.name, e.defaultSets ?? null])]),
    bundle.trainingDays.map((d) => [d.id, d.name, d.muscleGroupIds]),
  ])
  // FNV-1a, 32-bit.
  let hash = 0x811c9dc5
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

// ─── Tags ───

export function normalizeTags(raw: string | string[]): string[] {
  const parts = Array.isArray(raw) ? raw : raw.split(",")
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const tag = String(part).trim().toLowerCase().replace(/\s+/g, " ").slice(0, ROUTINE_TAG_MAX)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length === ROUTINE_TAGS_MAX) break
  }
  return out
}

/** Tags offered as one-tap chips on the publish form — the gym constraints that matter. */
export const SUGGESTED_TAGS = [
  "dumbbells only",
  "no squat rack",
  "cables only",
  "machines only",
  "full commercial gym",
  "home gym",
  "minimal equipment",
  "barbell",
]

// ─── Search ───

/** Free-text match over the fields a browser can reasonably be looking for. */
export function matchesRoutineQuery(listing: RoutineListing, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    listing.name,
    listing.authorName,
    listing.description,
    ...listing.tags,
    ...listing.summary.dayLabels,
  ]
    .join(" ")
    .toLowerCase()
  return q.split(/\s+/).every((term) => haystack.includes(term))
}

// ─── Validation ───
//
// Everything below runs on untrusted request bodies before anything reaches KV.
// Each validator returns null rather than throwing, so a route can answer 400.

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().replace(/\s+/g, " ")
  return trimmed.length === 0 || trimmed.length > max ? null : trimmed
}

function cleanId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed.length > ID_MAX ? null : trimmed
}

function validateExercise(value: unknown, order: number): ExerciseConfig | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const id = cleanId(raw.id)
  const name = cleanString(raw.name, LABEL_MAX)
  if (!id || !name) return null
  const ex: ExerciseConfig = { id, name, order }
  if (typeof raw.defaultSets === "number" && Number.isFinite(raw.defaultSets)) {
    ex.defaultSets = Math.min(10, Math.max(1, Math.round(raw.defaultSets)))
  }
  return ex
}

function validateGroup(value: unknown, order: number): MuscleGroupConfig | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const id = cleanId(raw.id)
  const name = cleanString(raw.name, LABEL_MAX)
  if (!id || !name) return null
  if (!Array.isArray(raw.exercises) || raw.exercises.length > ROUTINE_EXERCISES_MAX) return null

  const exercises: ExerciseConfig[] = []
  for (const candidate of raw.exercises) {
    const ex = validateExercise(candidate, exercises.length)
    if (!ex) return null
    if (exercises.some((e) => e.id === ex.id)) return null
    exercises.push(ex)
  }
  return { id, name, order, exercises }
}

function validateDay(value: unknown, order: number, groupIds: Set<string>): TrainingDay | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const id = cleanId(raw.id)
  const name = cleanString(raw.name, LABEL_MAX)
  if (!id || !name) return null
  if (!Array.isArray(raw.muscleGroupIds)) return null

  const muscleGroupIds: string[] = []
  for (const candidate of raw.muscleGroupIds) {
    const groupId = cleanId(candidate)
    // A day pointing at a group the bundle does not carry would render as a raw id
    // on the adopter's screen, so reject the bundle rather than import the dangle.
    if (!groupId || !groupIds.has(groupId) || muscleGroupIds.includes(groupId)) return null
    muscleGroupIds.push(groupId)
  }
  return { id, name, order, muscleGroupIds }
}

/**
 * A bundle from a request body, rebuilt field by field.
 *
 * Nothing is passed through: the returned object only ever contains keys this
 * function wrote, so no extra properties ride along into KV. A bundle with no
 * training day is rejected — adopting it would leave the adopter with nothing to
 * train, which is worse than the setup they were trying to skip.
 */
export function validateRoutineBundle(value: unknown): RoutineBundle | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.muscleGroups) || !Array.isArray(raw.trainingDays)) return null
  if (raw.muscleGroups.length === 0 || raw.muscleGroups.length > ROUTINE_GROUPS_MAX) return null
  if (raw.trainingDays.length === 0 || raw.trainingDays.length > ROUTINE_DAYS_MAX) return null

  const muscleGroups: MuscleGroupConfig[] = []
  for (const candidate of raw.muscleGroups) {
    const group = validateGroup(candidate, muscleGroups.length)
    if (!group) return null
    if (muscleGroups.some((g) => g.id === group.id)) return null
    muscleGroups.push(group)
  }

  const groupIds = new Set(muscleGroups.map((g) => g.id))
  const trainingDays: TrainingDay[] = []
  for (const candidate of raw.trainingDays) {
    const day = validateDay(candidate, trainingDays.length, groupIds)
    if (!day) return null
    if (trainingDays.some((d) => d.id === day.id)) return null
    trainingDays.push(day)
  }

  if (trainingDays.every((d) => d.muscleGroupIds.length === 0)) return null
  return { muscleGroups, trainingDays }
}

export function validateRoutineMeta(value: unknown): RoutineMeta | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>

  const name = cleanString(raw.name, ROUTINE_NAME_MAX)
  if (!name) return null

  let description = ""
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== "string") return null
    description = raw.description.trim().slice(0, ROUTINE_DESC_MAX)
  }

  let tags: string[] = []
  if (raw.tags !== undefined && raw.tags !== null) {
    if (!Array.isArray(raw.tags) && typeof raw.tags !== "string") return null
    tags = normalizeTags(raw.tags as string | string[])
  }

  const visibility: RoutineVisibility = raw.visibility === "unlisted" ? "unlisted" : "public"
  return { name, description, tags, visibility }
}

/** Strip the fields the client must not see, and stamp on what it needs instead. */
export function toListing(
  routine: PublishedRoutine,
  opts: { adoptionCount: number; viewerEmail: string }
): RoutineListing {
  const { bundle: _bundle, authorEmail, ...rest } = routine
  void _bundle
  return {
    ...rest,
    adoptionCount: opts.adoptionCount,
    mine: authorEmail.toLowerCase() === opts.viewerEmail.toLowerCase(),
  }
}

export function toDetail(
  routine: PublishedRoutine,
  opts: { adoptionCount: number; viewerEmail: string }
): RoutineDetail {
  return { ...toListing(routine, opts), bundle: routine.bundle }
}
