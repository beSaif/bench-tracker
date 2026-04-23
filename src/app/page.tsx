"use client"

import { useState, useEffect, useRef } from "react"
import { Session, MuscleGroup } from "@/lib/types"
import { loadSessions, loadSessionsLocal, saveSessions, loadDraft, clearDraft } from "@/lib/storage"
import type { SessionDraft } from "@/lib/types"
import { prescribeNext, migrateSessionTypes } from "@/lib/prescription"
import { generateWarmups } from "@/lib/warmup"
import { calcE1RM } from "@/lib/e1rm"
import SessionCard from "@/components/SessionCard"
import StatsGrid from "@/components/StatsGrid"
import ProgressBar from "@/components/ProgressBar"
import LogSessionModal from "@/components/LogSessionModal"

const TARGET = 140
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

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

  // Find rotation slot with highest overlap to last session's muscles
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
    type: prescription.sessionType,
    bw: null,
    confirmed: false,
    coachNote: `Prescribed [${prescription.sessionType}]: ${prescription.weight}kg × ${prescription.reps} × ${prescription.sets}. Stay tight, drive the legs.`,
    sets: [...warmups, ...workingSets],
    selectedMuscleGroups: suggestNextMuscles(sessions),
  }
}

// If the upcoming session was saved before auto-suggest existed, fill it in on load.
// Only fills when selectedMuscleGroups is undefined — respects intentional empty [] selections.
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
  const [activeDraft, setActiveDraft] = useState<SessionDraft | null>(null)
  const [draftPrompt, setDraftPrompt] = useState<{ session: Session; draft: SessionDraft } | null>(null)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [mounted, setMounted] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTitlePointerDown() {
    longPressTimer.current = setTimeout(() => {
      window.location.href = "/dev"
    }, 800)
  }

  function handleTitlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => {
    // Show localStorage data immediately, then sync from KV
    const local = loadSessionsLocal()
    if (local.length > 0) {
      setSessions(backfillMuscles(local))
    }
    setMounted(true)

    loadSessions().then((data) => {
      const patched = backfillMuscles(data)

      // One-time migration: re-assign types to historical "Push" sessions
      const migrated = migrateSessionTypes(patched)
      if (migrated !== null) {
        const newUpcoming = createUpcomingSession(migrated)
        const final = [...migrated, newUpcoming].sort((a, b) => {
          if (!a.confirmed) return -1
          if (!b.confirmed) return 1
          return new Date(b.date!).getTime() - new Date(a.date!).getTime()
        })
        saveSessions(final)
        setSessions(final)
        return
      }

      setSessions(patched)
      // Persist if we added a suggestion
      if (patched !== data) saveSessions(patched)
    })
  }, [])

  function handleStartLogging(session: Session) {
    const draft = loadDraft()
    const isLive =
      draft !== null &&
      draft.sessionId === session.id &&
      draft.completedSets.length > 0 &&
      Date.now() - new Date(draft.savedAt).getTime() < DRAFT_MAX_AGE_MS

    if (isLive) {
      setDraftPrompt({ session: JSON.parse(JSON.stringify(session)), draft })
    } else {
      setLoggingSession(JSON.parse(JSON.stringify(session)))
    }
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
    setActiveDraft(null)
  }

  function handleCloseModal() {
    setLoggingSession(null)
    setActiveDraft(null)
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
        <div className="h-8 w-40 bg-[#e8e8e8] rounded animate-pulse mb-1" />
        <div className="h-4 w-24 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        <div className="h-[2px] w-full bg-[#e8e8e8] rounded mb-6" />
        <div className="grid grid-cols-2 border border-[#e8e8e8] rounded-[10px] overflow-hidden mb-6 h-24" />
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
          <h1
            className="text-2xl font-semibold text-[#111111] tracking-tight select-none cursor-default"
            onPointerDown={handleTitlePointerDown}
            onPointerUp={handleTitlePointerUp}
            onPointerLeave={handleTitlePointerUp}
          >
            Bench Tracker
          </h1>
          <p className="text-sm text-[#777777] mt-0.5">
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

        {/* Session Cards — upcoming first, then confirmed reverse-chron */}
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
          initialDraft={activeDraft ?? undefined}
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

      {/* Draft resume prompt */}
      {draftPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10">
            <p className="text-base font-semibold text-[#111111] mb-1">Resume session?</p>
            <p className="text-sm text-[#777777] mb-6">
              Draft saved {relativeTime(draftPrompt.draft.savedAt)} · {draftPrompt.draft.completedSets.length} set{draftPrompt.draft.completedSets.length !== 1 ? "s" : ""} done
            </p>
            <button
              onClick={() => {
                setActiveDraft(draftPrompt.draft)
                setLoggingSession(draftPrompt.session)
                setDraftPrompt(null)
              }}
              className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 mb-3 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors"
            >
              Continue
            </button>
            <button
              onClick={() => {
                clearDraft()
                setLoggingSession(draftPrompt.session)
                setDraftPrompt(null)
              }}
              className="w-full border border-[#e8e8e8] text-[#555555] text-sm font-semibold rounded-xl py-3.5 hover:bg-[#f5f5f5] active:bg-[#eeeeee] transition-colors"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}
    </>
  )
}
