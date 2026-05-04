"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Session, MainLiftSet, UserProfile, MAIN_LIFT_LABEL } from "@/lib/types"
import { loadAll, loadSessionsLocal, loadExerciseConfigLocal, loadExerciseConfig, loadProfile, loadProfileLocal } from "@/lib/storage"
import { MuscleGroupConfig, getMuscleLabel } from "@/lib/exerciseConfig"

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function SetRow({ set }: { set: MainLiftSet }) {
  const isWarmup = set.isWarmup
  const textColor = isWarmup ? "text-[#aaaaaa]" : "text-[#111111]"
  const e1rmColor = isWarmup ? "text-[#aaaaaa]" : "text-[#7a1f2e]"

  return (
    <>
      <div className={`grid grid-cols-[2rem_2.5rem_4.5rem_3.5rem] gap-x-3 py-[3px] text-sm ${textColor}`}>
        <span className="font-medium">{set.id}</span>
        <span>{set.kg}kg</span>
        <span>
          {set.reps} reps
          {set.rpe != null && (
            <span className="text-[#aaaaaa]"> · {set.rpe}</span>
          )}
        </span>
        <span className={`text-right ${e1rmColor} font-medium`}>
          {set.e1rm != null ? `${set.e1rm}` : "—"}
        </span>
      </div>
      {set.note && (
        <div className="text-xs italic text-[#aaaaaa] pb-1 pl-[5.5rem]">
          {set.note}
        </div>
      )}
    </>
  )
}

export default function SessionDetailPage() {
  const params = useParams()
  const id = Number(params.id)

  const [session, setSession] = useState<Session | null>(null)
  const [exerciseConfig, setExerciseConfig] = useState<MuscleGroupConfig[]>(loadExerciseConfigLocal)
  const [profile, setProfile] = useState<UserProfile | null>(loadProfileLocal)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const local = loadSessionsLocal()
    const found = local.find((s) => s.id === id) ?? null
    setSession(found)
    setMounted(true)

    loadExerciseConfig().then(setExerciseConfig)
    loadProfile().then((p) => { if (p) setProfile(p) })

    loadAll().then(({ sessions }) => {
      const updated = sessions.find((s) => s.id === id) ?? null
      setSession(updated)
    })
  }, [id])

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        <div className="h-4 w-16 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        <div className="h-6 w-48 bg-[#e8e8e8] rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-[#e8e8e8] rounded animate-pulse" />
      </main>
    )
  }

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[#7a1f2e] mb-6"
        >
          ← Back
        </Link>
        <p className="text-sm text-[#777777]">Session not found.</p>
      </main>
    )
  }

  const working = session.sets.filter((s) => !s.isWarmup)
  const warmups = session.sets.filter((s) => s.isWarmup)
  const e1rms = working.map((s) => s.e1rm).filter((v): v is number => v != null)
  const bestE1RM = e1rms.length > 0 ? Math.max(...e1rms) : null
  const workingWeight = working[0]?.kg ?? null

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 py-6">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[#7a1f2e] mb-6 hover:underline"
      >
        ← Back
      </Link>

      {/* Session header */}
      <header className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#111111] tracking-tight">
              Session {String(session.id).padStart(2, "0")}
              <span className="text-[#aaaaaa] font-normal"> · {session.type}</span>
            </h1>
            {session.date && (
              <p className="text-sm text-[#777777] mt-0.5">{formatDate(session.date)}</p>
            )}
            {session.bw && (
              <p className="text-xs text-[#aaaaaa] mt-0.5">{session.bw}kg BW</p>
            )}
          </div>
          {bestE1RM && (
            <div className="text-right">
              <p className="text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-0.5">e1RM</p>
              <p className="text-2xl font-semibold text-[#7a1f2e]">{bestE1RM}<span className="text-sm font-normal">kg</span></p>
            </div>
          )}
        </div>
      </header>

      {/* Main lift section */}
      <section className="mb-6">
        <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-3">
          {MAIN_LIFT_LABEL[session.mainLift ?? profile?.mainLift ?? "bench"]}
        </p>

        {/* Quick stats */}
        {workingWeight && (
          <div className="flex gap-4 mb-4">
            <div>
              <p className="text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-0.5">Working</p>
              <p className="text-sm font-semibold text-[#111111]">{workingWeight}kg</p>
            </div>
            <div>
              <p className="text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-0.5">Sets</p>
              <p className="text-sm font-semibold text-[#111111]">{working.length}</p>
            </div>
            {working[0] && (
              <div>
                <p className="text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-0.5">Reps</p>
                <p className="text-sm font-semibold text-[#111111]">{working[0].reps}</p>
              </div>
            )}
          </div>
        )}

        {/* Sets table */}
        <div className="bg-[#fdf5f6] rounded-xl px-4 py-3">
          <div className="grid grid-cols-[2rem_2.5rem_4.5rem_3.5rem] gap-x-3 mb-2">
            <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide">Set</span>
            <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide">kg</span>
            <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide">Reps · RPE</span>
            <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide text-right">e1RM</span>
          </div>
          {warmups.map((set) => (
            <SetRow key={set.id} set={set} />
          ))}
          {warmups.length > 0 && working.length > 0 && (
            <div className="h-px bg-[#e8e8e8] my-2" />
          )}
          {working.map((set) => (
            <SetRow key={set.id} set={set} />
          ))}
        </div>
      </section>

      {/* Extra workouts */}
      {session.extraWorkouts && session.extraWorkouts.length > 0 && (
        <section className="mb-6">
          <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-3">
            Accessories
          </p>
          <div className="space-y-4">
            {session.extraWorkouts.map((workout) => (
              <div key={workout.muscle}>
                <p className="text-xs font-semibold text-[#555555] mb-2">
                  {getMuscleLabel(exerciseConfig, workout.muscle)}
                </p>
                {workout.exercises.map((exercise) => (
                  <div key={exercise.name} className="mb-2">
                    <p className="text-xs text-[#777777] mb-1">{exercise.name}</p>
                    {exercise.sets.map((set, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[2rem_2.5rem_4.5rem] gap-x-3 py-[2px] text-sm text-[#111111]"
                      >
                        <span className="font-medium text-[#aaaaaa]">{i + 1}</span>
                        <span>{set.kg}kg</span>
                        <span>
                          {set.reps} reps
                          {set.rpe != null && (
                            <span className="text-[#aaaaaa]"> · {set.rpe}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Coach note */}
      {session.coachNote && (
        <section>
          <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-2">
            Note
          </p>
          <p className="text-sm italic text-[#555555]">{session.coachNote}</p>
        </section>
      )}
    </main>
  )
}
