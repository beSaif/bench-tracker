"use client"

import { useState, useEffect } from "react"
import { Session, MuscleGroup } from "@/lib/types"
import { loadSessions, loadSessionsLocal, saveSessions } from "@/lib/storage"
import { prescribeNext } from "@/lib/prescription"
import { generateWarmups } from "@/lib/warmup"
import { calcE1RM } from "@/lib/e1rm"
import SessionCard from "@/components/SessionCard"
import StatsGrid from "@/components/StatsGrid"
import ProgressBar from "@/components/ProgressBar"
import LogSessionModal from "@/components/LogSessionModal"

const TARGET = 140

const MUSCLE_ROTATION: MuscleGroup[][] = [
  ["back", "triceps"],
  ["chest", "biceps"],
  ["shoulders", "legs"],
]

function suggestNextMuscles(confirmedSessions: Session[]): MuscleGroup[] {
  const last = [...confirmedSessions]
    .filter((s) => s.date && s.extraWorkouts && s.extraWorkouts.length > 0)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())[0]

  if (!last) return MUSCLE_ROTATION[0]

  const lastMuscles = last.extraWorkouts!.map((w) => w.muscle)

  let bestIdx = 0
  let bestScore = -1
  MUSCLE_ROTATION.forEach((pair, i) => {
    const score = pair.filter((m) => lastMuscles.includes(m)).length
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })

  return MUSCLE_ROTATION[(bestIdx + 1) % MUSCLE_ROTATION.length]
}

function getLatestE1RM(sessions: Session[]): number | null {
  const confirmed = sessions.filter((s) => s.confirmed && s.date != null)
  if (confirmed.length === 0) return null
  const latest = [...confirmed].sort(
    (a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()
  )[0]
  const e1rms = latest.sets
    .filter((s) => !s.isWarmup)
    .map((s) => s.e1rm)
    .filter((v): v is number => v != null)
  return e1rms.length > 0 ? Math.max(...e1rms) : null
}

function getBestWeight(sessions: Session[]): number | null {
  const all = sessions
    .filter((s) => s.confirmed)
    .flatMap((s) => s.sets.filter((set) => !set.isWarmup))
    .map((s) => s.kg)
    .filter((v): v is number => v != null)
  return all.length > 0 ? Math.max(...all) : null
}

function getLatestBW(sessions: Session[]): number | null {
  const withBW = sessions
    .filter((s) => s.confirmed && s.bw != null && s.date != null)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  return withBW[0]?.bw ?? null
}

function createUpcomingSession(sessions: Session[]): Session {
  const prescription = prescribeNext(sessions)
  const warmups = generateWarmups(prescription.weight)
  const workingSets = Array.from({ length: prescription.sets }, (_, i) => ({
    id: `S${i + 1}`,
    kg: prescription.weight,
    reps: prescription.reps,
    rpe: null as null,
    e1rm: calcE1RM(prescription.weight, prescription.reps),
    note: "",
    isWarmup: false,
  }))
  const maxId = sessions.length > 0 ? Math.max(...sessions.map((s) => s.id)) : 0
  return {
    id: maxId + 1,
    date: null,
    type: "Push",
    bw: null,
    confirmed: false,
    coachNote: `Prescribed: ${prescription.weight}kg × ${prescription.reps} × ${prescription.sets}. Stay tight, drive the legs.`,
    sets: [...warmups, ...workingSets],
    selectedMuscleGroups: suggestNextMuscles(sessions),
  }
}

function backfillMuscles(sessions: Session[]): Session[] {
  const upcoming = sessions.find((s) => !s.confirmed)
  if (!upcoming || upcoming.selectedMuscleGroups !== undefined) return sessions
  const confirmed = sessions.filter((s) => s.confirmed)
  const suggested = suggestNextMuscles(confirmed)
  return sessions.map((s) =>
    s.id === upcoming.id ? { ...s, selectedMuscleGroups: suggested } : s
  )
}

export default function Page() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loggingSession, setLoggingSession] = useState<Session | null>(null)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const local = loadSessionsLocal()
    if (local.length > 0) {
      setSessions(backfillMuscles(local))
    }
    setMounted(true)

    loadSessions().then((data) => {
      const patched = backfillMuscles(data)
      setSessions(patched)
      if (patched !== data) saveSessions(patched)
    })
  }, [])

  function handleStartLogging(session: Session) {
    setLoggingSession(JSON.parse(JSON.stringify(session)))
  }

  function handleConfirmSession(updatedSession: Session) {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === updatedSession.id ? updatedSession : s
      )
      const confirmed = updated.filter((s) => s.confirmed)
      const newUpcoming = createUpcomingSession(confirmed)
      const final = [...confirmed, newUpcoming].sort((a, b) => {
        if (!a.confirmed) return -1
        if (!b.confirmed) return 1
        return new Date(b.date!).getTime() - new Date(a.date!).getTime()
      })
      saveSessions(final)
      return final
    })
    setLoggingSession(null)
  }

  function handleCloseModal() {
    setLoggingSession(null)
  }

  function handleEditSession(session: Session) {
    setEditingSession(JSON.parse(JSON.stringify(session)))
  }

  function handleSaveEdit(updatedSession: Session) {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === updatedSession.id ? updatedSession : s
      )
      saveSessions(updated)
      return updated
    })
    setEditingSession(null)
  }

  function handleUpdateMuscleGroups(session: Session, groups: MuscleGroup[]) {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === session.id ? { ...s, selectedMuscleGroups: groups } : s
      )
      saveSessions(updated)
      return updated
    })
  }

  function handleUnlogSession(session: Session) {
    if (!window.confirm(`Unlog Session ${String(session.id).padStart(2, "0")}? This will remove it from your history.`)) return
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.confirmed && s.id !== session.id)
      const newUpcoming = createUpcomingSession(remaining)
      const final = [...remaining, newUpcoming].sort((a, b) => {
        if (!a.confirmed) return -1
        if (!b.confirmed) return 1
        return new Date(b.date!).getTime() - new Date(a.date!).getTime()
      })
      saveSessions(final)
      return final
    })
  }

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        <div className="h-9 w-44 rounded animate-pulse mb-1" style={{ backgroundColor: "#e8ddd5" }} />
        <div className="h-4 w-28 rounded animate-pulse mb-8" style={{ backgroundColor: "#e8ddd5" }} />
        <div className="h-[8px] w-full rounded mb-6" style={{ backgroundColor: "#e8ddd5" }} />
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse"
              style={{
                backgroundColor: "#e8ddd5",
                borderRadius: "16px 10px 14px 12px / 12px 14px 10px 16px",
              }}
            />
          ))}
        </div>
      </main>
    )
  }

  const confirmed = sessions.filter((s) => s.confirmed)
  const upcoming = sessions.find((s) => !s.confirmed)
  const confirmedSorted = [...confirmed].sort(
    (a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()
  )

  const latestE1RM = getLatestE1RM(sessions)
  const bestWeight = getBestWeight(sessions)
  const latestBW = getLatestBW(sessions)

  return (
    <>
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-start gap-2">
            <h1
              className="font-hand text-4xl font-bold leading-tight"
              style={{ color: "#2c2724" }}
            >
              Bench Tracker
            </h1>
            {/* Decorative asterisk cluster */}
            <span
              className="font-hand text-lg select-none mt-1"
              style={{ color: "#2c2724", opacity: 0.35, letterSpacing: "-2px" }}
              aria-hidden
            >
              ✳✳
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "#9a8f87" }}>
            Saif · {confirmed.length} sessions · BW {latestBW ?? 54}kg
          </p>
        </header>

        {/* Progress Bar */}
        <ProgressBar current={latestE1RM} target={TARGET} />

        {/* Stats Grid */}
        <StatsGrid
          e1rm={latestE1RM}
          best={bestWeight}
          sessions={confirmed.length}
          bw={latestBW}
        />

        {/* Session list heading */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="font-hand text-base font-semibold uppercase tracking-wider"
            style={{ color: "#9a8f87" }}
          >
            Sessions
          </span>
          <span
            className="font-hand text-base select-none"
            style={{ color: "#2c2724", opacity: 0.3 }}
            aria-hidden
          >
            ✳✳
          </span>
        </div>

        {/* Session Cards */}
        <div>
          {upcoming && (
            <SessionCard
              session={upcoming}
              onStartLogging={handleStartLogging}
              onUpdateMuscleGroups={handleUpdateMuscleGroups}
            />
          )}
          {confirmedSorted.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onEdit={handleEditSession}
              onUnlog={handleUnlogSession}
            />
          ))}
        </div>
      </main>

      {/* Log Session Modal */}
      {loggingSession && (
        <LogSessionModal
          session={loggingSession}
          onConfirm={handleConfirmSession}
          onClose={handleCloseModal}
          previousSessions={confirmedSorted}
        />
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <LogSessionModal
          session={editingSession}
          mode="edit"
          onConfirm={handleSaveEdit}
          onClose={() => setEditingSession(null)}
          previousSessions={confirmedSorted}
        />
      )}
    </>
  )
}
