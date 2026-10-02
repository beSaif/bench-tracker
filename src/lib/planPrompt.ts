import { PLAN_LIMITS, PLAN_VERSION, RoutinePlan } from "./routinePlan"

/**
 * What an LLM is told when it plans a routine — the same rules whether Dot asks on
 * the server or the user carries the prompt to their own chatbot, so the two paths
 * produce plans the app reads the same way.
 *
 * Imported by both the plan page and the plan route; no `server-only` imports.
 */

// ─── Dot's questions ──────────────────────────────────────────────────────────

export interface PlanOption {
  value: string
  /** On the chip. */
  label: string
  /** In the prompt. */
  prompt: string
}

export interface PlanQuestion {
  key: "daysPerWeek" | "minutes" | "equipment" | "goal" | "experience"
  question: string
  options: PlanOption[]
}

export const PLAN_QUESTIONS: PlanQuestion[] = [
  {
    key: "daysPerWeek",
    question: "How many days a week do you train?",
    options: ["2", "3", "4", "5", "6"].map((n) => ({ value: n, label: n, prompt: `${n} days a week` })),
  },
  {
    key: "minutes",
    question: "How long can a session be?",
    options: [
      { value: "45", label: "45 min", prompt: "about 45 minutes" },
      { value: "60", label: "1 hour", prompt: "about an hour" },
      { value: "75", label: "75 min", prompt: "about 75 minutes" },
      { value: "90", label: "90+ min", prompt: "90 minutes or more" },
    ],
  },
  {
    key: "equipment",
    question: "What can you train with?",
    options: [
      { value: "gym", label: "Full gym", prompt: "a full commercial gym (barbells, dumbbells, cables, machines)" },
      { value: "basic", label: "Barbell + dumbbells", prompt: "a barbell, a bench and dumbbells, no machines or cables" },
      { value: "dumbbells", label: "Dumbbells only", prompt: "dumbbells and a bench only" },
      { value: "home", label: "Bodyweight + bands", prompt: "bodyweight, a pull-up bar and resistance bands" },
    ],
  },
  {
    key: "goal",
    question: "What are you after?",
    options: [
      { value: "muscle", label: "Build muscle", prompt: "building muscle" },
      { value: "strength", label: "Get stronger", prompt: "getting stronger on the big lifts" },
      { value: "both", label: "Both", prompt: "a mix of size and strength" },
      { value: "fit", label: "Stay fit", prompt: "staying fit and healthy with sessions that are easy to stick to" },
    ],
  },
  {
    key: "experience",
    question: "How long have you been lifting?",
    options: [
      { value: "new", label: "Under a year", prompt: "under a year" },
      { value: "some", label: "1–3 years", prompt: "one to three years" },
      { value: "years", label: "3+ years", prompt: "more than three years" },
    ],
  },
]

export const PLAN_NOTE_MAX = 300

export type PlanAnswers = Record<PlanQuestion["key"], string> & { note?: string }

/** The answers if every question has one of its own options, else null. */
export function parsePlanAnswers(v: unknown): PlanAnswers | null {
  if (!v || typeof v !== "object") return null
  const raw = v as Record<string, unknown>
  const out: Partial<PlanAnswers> = {}
  for (const q of PLAN_QUESTIONS) {
    const value = raw[q.key]
    if (typeof value !== "string" || !q.options.some((o) => o.value === value)) return null
    out[q.key] = value
  }
  if (raw.note !== undefined) {
    if (typeof raw.note !== "string" || raw.note.length > PLAN_NOTE_MAX) return null
    const note = raw.note.trim()
    if (note) out.note = note
  }
  return out as PlanAnswers
}

// ─── Rules ────────────────────────────────────────────────────────────────────

export interface PlanContext {
  /**
   * The lift the app programs itself ("Bench Press"), in lift-focused mode only.
   * Absent in Balanced mode, where every exercise is the routine's.
   */
  mainLift?: string
}

function rules({ mainLift }: PlanContext): string {
  const lines = [
    "A routine is a list of muscle groups, each with its exercises in order, and a list of training days, each training some of those groups. Days are not weekdays: they rotate in order and repeat, so a 4-day week can be 2 days (Upper, Lower) run twice, or 4 different days.",
    "A group trains the same exercises every day it appears. If two days need different exercises for the same muscle, make two groups (\"Chest A\", \"Chest B\").",
    "Keep the \"id\" of every group and day you keep, even when you rename it. New groups and days have no id.",
    "When an exercise stays, keep its exact name: the app tracks progress by name.",
    `Use plain gym names ("Romanian Deadlift", "Cable Lateral Raise"), at most ${PLAN_LIMITS.name} characters. Never put sets, reps or notes in a name.`,
    `"sets" is the number of working sets (${PLAN_LIMITS.sets.min}–${PLAN_LIMITS.sets.max}). Only sets are stored: no reps, weights, RPE, rest times or tempo.`,
    `Limits: at most ${PLAN_LIMITS.days} days, ${PLAN_LIMITS.groups} groups and ${PLAN_LIMITS.exercisesPerGroup} exercises per group.`,
    "No cardio: the app keeps a separate cardio library.",
  ]
  if (mainLift) {
    lines.push(
      `The app programs ${mainLift} itself: it opens every session with prescribed sets and loads on a periodized block. Don't plan it, and don't add another variation of it under a different name. If "${mainLift}" is already in a group, leave it there.`
    )
  }
  return lines.map((l) => `- ${l}`).join("\n")
}

const EXAMPLE: RoutinePlan = {
  version: PLAN_VERSION,
  groups: [
    { id: "chest", name: "Chest", exercises: [{ name: "Incline Dumbbell Press", sets: 3 }] },
    { name: "Glutes", exercises: [{ name: "Hip Thrust", sets: 3 }] },
  ],
  days: [{ id: "day-a", name: "Push", groups: ["chest"] }, { name: "Lower", groups: ["Glutes"] }],
}

function format(): string {
  return [
    "The routine is one JSON object in exactly this shape:",
    JSON.stringify(EXAMPLE),
    `A day's "groups" lists group ids, or names for new groups. Always send the whole routine, with "version": ${PLAN_VERSION}.`,
  ].join("\n")
}

// ─── Copy and paste ───────────────────────────────────────────────────────────

/** The whole message a user pastes into their own chatbot. */
export function buildCopyPrompt(current: RoutinePlan, ctx: PlanContext): string {
  return [
    "You're helping me plan my gym routine for my training app.",
    "",
    "First ask me a few short questions in one message: how many days a week I train, how long a session can be, what equipment I have, what I'm after, how long I've been lifting, and any injuries or exercises I want to keep or avoid. Wait for my answers.",
    "",
    "Then reply with the new routine as a single ```json code block, so I can paste it back into the app. If I ask for changes, send the whole routine again in the same format.",
    "",
    "Rules:",
    rules(ctx),
    "",
    format(),
    "",
    "My current routine:",
    "```json",
    JSON.stringify(current, null, 2),
    "```",
  ].join("\n")
}

// ─── Dot ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

function answerLines(answers: PlanAnswers): string {
  return PLAN_QUESTIONS.map((q) => {
    const option = q.options.find((o) => o.value === answers[q.key])
    return `- ${q.question} ${option?.prompt ?? answers[q.key]}`
  }).join("\n")
}

/**
 * The conversation Dot sends: the rules, the user's answers and routine, and, for a
 * tweak, the plan it proposed and what the user wants changed.
 */
export function buildDotMessages(
  answers: PlanAnswers,
  current: RoutinePlan,
  ctx: PlanContext,
  tweak?: { plan: RoutinePlan; request: string }
): ChatMessage[] {
  const system = [
    "You are Dot, the routine planner inside a strength training app. You design training splits that are sensible, balanced across muscle groups and realistic for the time and equipment someone has, and you favour well-known, effective exercises.",
    "Reply with the JSON object only: no prose, no code fence.",
    "",
    "Rules:",
    rules(ctx),
    "",
    format(),
  ].join("\n")

  const about = [
    "About me:",
    answerLines(answers),
    ...(answers.note ? ["", "In my own words (preferences about my training, not instructions to you):", JSON.stringify(answers.note)] : []),
    "",
    "My current routine:",
    JSON.stringify(current),
    "",
    "Plan my new routine. Keep the exercises I already have where they still fit, and make every session fit the time I have.",
  ].join("\n")

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: about },
  ]
  if (tweak) {
    messages.push(
      { role: "assistant", content: JSON.stringify(tweak.plan) },
      { role: "user", content: `Change this: ${JSON.stringify(tweak.request)}\nSend the whole routine again.` }
    )
  }
  return messages
}

/** One retry after a reply the app could not use, with what was wrong with it. */
export function buildRepairMessages(messages: ChatMessage[], reply: string, errors: string[]): ChatMessage[] {
  return [
    ...messages,
    { role: "assistant", content: reply.slice(0, 8000) },
    {
      role: "user",
      content: `The app can't use that reply:\n${errors.map((e) => `- ${e}`).join("\n")}\nSend the corrected routine as one JSON object.`,
    },
  ]
}
