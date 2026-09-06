"use client"

import { Session, MuscleGroup } from "@/lib/types"
import { MuscleGroupConfig, getMuscleLabel } from "@/lib/exerciseConfig"

interface Props {
  /** Confirmed sessions only — an unlogged upcoming card trains nothing yet. */
  sessions: Session[]
  exerciseConfig: MuscleGroupConfig[]
}

/** Days since a group was last trained; null when it has never been trained. */
interface GroupState {
  id: MuscleGroup
  label: string
  days: number | null
}

const FRESH_DAYS = 4
const STALE_DAYS = 10

function daysSince(dateStr: string): number {
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const d = new Date(dateStr)
  const then = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.max(0, Math.round((todayMidnight - then) / 86_400_000))
}

/** Muscle groups a session trained: what was selected, else what was actually logged. */
function sessionMuscles(session: Session): MuscleGroup[] {
  if (session.selectedMuscleGroups && session.selectedMuscleGroups.length > 0) {
    return session.selectedMuscleGroups
  }
  return session.extraWorkouts?.map((w) => w.muscle) ?? []
}

export function muscleBalance(
  sessions: Session[],
  exerciseConfig: MuscleGroupConfig[]
): GroupState[] {
  const lastTrained = new Map<MuscleGroup, number>()
  for (const session of sessions) {
    if (!session.confirmed || !session.date) continue
    const days = daysSince(session.date)
    for (const muscle of sessionMuscles(session)) {
      const prev = lastTrained.get(muscle)
      if (prev === undefined || days < prev) lastTrained.set(muscle, days)
    }
  }

  return [...exerciseConfig]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      id: g.id,
      label: getMuscleLabel(exerciseConfig, g.id),
      days: lastTrained.get(g.id) ?? null,
    }))
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))
}

function chipClass(days: number | null): string {
  if (days === null || days >= STALE_DAYS) return "bg-[#fdf2f2] text-[#b3261e]"
  if (days <= FRESH_DAYS) return "bg-[#f3faf4] text-[#16a34a]"
  return "bg-[#fff8ed] text-[#b06a1e]"
}

/**
 * Balanced mode has no block or target to chase, so the thing worth surfacing is
 * whether the training is actually balanced: which muscle groups have gone stale.
 */
export default function MuscleBalance({ sessions, exerciseConfig }: Props) {
  const groups = muscleBalance(sessions, exerciseConfig)
  if (groups.length === 0) return null

  const trained = groups.filter((g) => g.days !== null)
  const stalest = groups[0]
  const isStale = stalest.days === null || stalest.days >= STALE_DAYS

  const lead =
    trained.length === 0
      ? "Log a session to start tracking your balance"
      : isStale
      ? stalest.days === null
        ? `${stalest.label} not trained yet`
        : `${stalest.label} not trained in ${stalest.days} days`
      : "Every group trained recently"

  return (
    <div className="mb-4 px-4 py-3.5 rounded-xl bg-white border border-[#e8e8e8]">
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          Muscle balance
        </p>
        <p className="text-[11px] text-[#777777]">{lead}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <span
            key={g.id}
            className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${chipClass(g.days)}`}
          >
            {g.label}
            <span className="font-normal opacity-70">
              {" · "}
              {g.days === null ? "never" : g.days === 0 ? "today" : `${g.days}d`}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
