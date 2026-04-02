"use client"

import { useState, useEffect } from "react"
import { Session } from "@/lib/types"
import { loadSessions, saveSessions } from "@/lib/storage"
import { prescribeNext } from "@/lib/prescription"
import { generateWarmups } from "@/lib/warmup"
import { calcE1RM } from "@/lib/e1rm"
import SessionCard from "@/components/SessionCard"
import StatsGrid from "@/components/StatsGrid"
import ProgressBar from "@/components/ProgressBar"
import LogSessionModal from "@/components/LogSessionModal"

const TARGET = 140

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

function getBestE1RM(sessions: Session[]): number | null {
  const all = sessions
    .filter((s) => s.confirmed)
    .flatMap((s) => s.sets.filter((set) => !set.isWarmup))
    .map((s) => s.e1rm)
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
  }
}

export default function Page() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loggingSession, setLoggingSession] = useState<Session | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const loaded = loadSessions()
    setSessions(loaded)
    setMounted(true)
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
  const bestE1RM = getBestE1RM(sessions)
  const latestBW = getLatestBW(sessions)

  return (
    <>
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">
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
          best={bestE1RM}
          sessions={confirmed.length}
          bw={latestBW}
        />

        {/* Session Cards — upcoming first, then confirmed reverse-chron */}
        <div>
          {upcoming && (
            <SessionCard
              session={upcoming}
              onStartLogging={handleStartLogging}
            />
          )}
          {confirmedSorted.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </main>

      {/* Log Session Modal */}
      {loggingSession && (
        <LogSessionModal
          session={loggingSession}
          onConfirm={handleConfirmSession}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
