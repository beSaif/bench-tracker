"use client"

import { useState, useEffect } from "react"
import {
  Session,
  BenchSet,
  MuscleGroup,
  ExtraWorkout,
  ExtraSet,
  MUSCLE_GROUP_LABEL,
  MUSCLE_GROUP_EXERCISES,
} from "@/lib/types"
import { calcE1RM } from "@/lib/e1rm"

const REST_DURATION = 180 // seconds

interface LogSessionModalProps {
  session: Session
  onConfirm: (session: Session) => void
  onClose: () => void
  mode?: "log" | "edit"
  previousSessions?: Session[]
}

interface EditableSet extends BenchSet {
  _kgStr: string
  _repsStr: string
  _rpeStr: string
}

interface EditableExtraSet {
  kgStr: string
  repsStr: string
}

type ExtraWorkoutState = Record<string, Record<string, EditableExtraSet[]>>

function toEditable(set: BenchSet): EditableSet {
  return {
    ...set,
    _kgStr: String(set.kg),
    _repsStr: String(set.reps),
    _rpeStr: set.rpe != null ? String(set.rpe) : "",
  }
}

function defaultExtraSet(): EditableExtraSet {
  return { kgStr: "0", repsStr: "10" }
}

function initExtraWorkoutState(session: Session): ExtraWorkoutState {
  const groups = session.selectedMuscleGroups ?? []
  if (groups.length === 0) return {}

  if (session.extraWorkouts && session.extraWorkouts.length > 0) {
    const state: ExtraWorkoutState = {}
    for (const workout of session.extraWorkouts) {
      state[workout.muscle] = {}
      for (const exercise of workout.exercises) {
        state[workout.muscle][exercise.name] = exercise.sets.map((s) => ({
          kgStr: String(s.kg),
          repsStr: String(s.reps),
        }))
      }
    }
    return state
  }

  const state: ExtraWorkoutState = {}
  for (const muscle of groups) {
    state[muscle] = {}
    for (const exerciseName of MUSCLE_GROUP_EXERCISES[muscle]) {
      state[muscle][exerciseName] = [defaultExtraSet(), defaultExtraSet(), defaultExtraSet()]
    }
  }
  return state
}

// Returns the heaviest set for a given exercise from the most recent session that logged it
function getTopSet(exerciseName: string, sessions: Session[]): ExtraSet | null {
  for (const session of sessions) {
    for (const workout of session.extraWorkouts ?? []) {
      for (const exercise of workout.exercises) {
        if (exercise.name === exerciseName && exercise.sets.length > 0) {
          return exercise.sets.reduce((best, set) =>
            set.kg > best.kg || (set.kg === best.kg && set.reps > best.reps) ? set : best
          )
        }
      }
    }
  }
  return null
}

export default function LogSessionModal({
  session,
  onConfirm,
  onClose,
  mode = "log",
  previousSessions = [],
}: LogSessionModalProps) {
  const [sets, setSets] = useState<EditableSet[]>(session.sets.map(toEditable))
  const [bwStr, setBwStr] = useState(session.bw != null ? String(session.bw) : "")
  const [coachNote, setCoachNote] = useState(session.coachNote)
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set())
  const [restActive, setRestActive] = useState(false)
  const [restSeconds, setRestSeconds] = useState(0)
  const [extraState, setExtraState] = useState<ExtraWorkoutState>(
    () => initExtraWorkoutState(session)
  )
  const [currentSetIndex, setCurrentSetIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  const warmups = sets.filter((s) => s.isWarmup)
  const workingSets = sets.filter((s) => !s.isWarmup)

  useEffect(() => {
    if (!restActive) return
    if (restSeconds <= 0) {
      setRestActive(false)
      setCurrentSetIndex((prev) => Math.min(prev + 1, workingSets.length - 1))
      return
    }
    const id = setTimeout(() => setRestSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [restActive, restSeconds])

  function markSetDone(setId: string) {
    if (completedSets.has(setId)) return
    setCompletedSets((prev) => new Set([...prev, setId]))
    setRestSeconds(REST_DURATION)
    setRestActive(true)
  }

  function dismissRest() {
    setRestActive(false)
    setRestSeconds(0)
    setCurrentSetIndex((prev) => {
      for (let i = prev + 1; i < workingSets.length; i++) {
        if (!completedSets.has(workingSets[i].id)) return i
      }
      return Math.min(prev + 1, workingSets.length - 1)
    })
  }

  function navigatePrev() {
    setCurrentSetIndex((p) => Math.max(p - 1, 0))
  }

  function navigateNext() {
    setCurrentSetIndex((p) => Math.min(p + 1, workingSets.length - 1))
  }

  function updateSet(index: number, field: "kg" | "reps" | "rpe", raw: string) {
    setSets((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s
        const updated = { ...s }
        if (field === "kg") {
          updated._kgStr = raw
          const val = parseFloat(raw)
          if (!isNaN(val) && val > 0) {
            updated.kg = val
            updated.e1rm = calcE1RM(val, updated.reps)
          }
        } else if (field === "reps") {
          updated._repsStr = raw
          const val = parseInt(raw, 10)
          if (!isNaN(val) && val > 0) {
            updated.reps = val
            updated.e1rm = calcE1RM(updated.kg, val)
          }
        } else {
          updated._rpeStr = raw
          const val = parseFloat(raw)
          updated.rpe = isNaN(val) ? null : Math.min(10, Math.max(1, val))
        }
        return updated
      })
    )
  }

  function updateExtraSet(
    muscle: string,
    exercise: string,
    setIndex: number,
    field: "kg" | "reps",
    raw: string
  ) {
    setExtraState((prev) => {
      const next = { ...prev }
      next[muscle] = { ...next[muscle] }
      next[muscle][exercise] = next[muscle][exercise].map((s, i) => {
        if (i !== setIndex) return s
        return field === "kg" ? { ...s, kgStr: raw } : { ...s, repsStr: raw }
      })
      return next
    })
  }

  function handleConfirm() {
    const bw = parseFloat(bwStr)

    const groups = session.selectedMuscleGroups ?? []
    const extraWorkouts: ExtraWorkout[] = groups
      .filter((muscle) => extraState[muscle])
      .map((muscle) => ({
        muscle,
        exercises: (MUSCLE_GROUP_EXERCISES[muscle] as string[])
          .filter((name) => extraState[muscle][name])
          .map((name) => ({
            name,
            sets: extraState[muscle][name].map((s) => ({
              kg: parseFloat(s.kgStr) || 0,
              reps: parseInt(s.repsStr, 10) || 0,
              rpe: null,
            })),
          })),
      }))

    const finalSession: Session = {
      ...session,
      confirmed: true,
      date: mode === "edit" ? session.date : new Date().toISOString(),
      bw: !isNaN(bw) && bw > 0 ? bw : session.bw,
      coachNote,
      sets: sets.map(({ _kgStr: _, _repsStr: __, _rpeStr: ___, ...rest }) => rest),
      extraWorkouts: extraWorkouts.length > 0 ? extraWorkouts : undefined,
    }
    onConfirm(finalSession)
  }

  const selectedGroups = session.selectedMuscleGroups ?? []

  const timerMins = Math.floor(restSeconds / 60)
  const timerSecs = restSeconds % 60
  const timerDisplay = `${timerMins}:${String(timerSecs).padStart(2, "0")}`

  const currentSet = workingSets[currentSetIndex]
  const currentGlobalIndex = sets.findIndex((s) => s.id === currentSet?.id)
  const nextSet = workingSets[currentSetIndex + 1] ?? null

  // Full-screen rest timer
  if (restActive) {
    return (
      <div className="fixed inset-0 z-50 bg-[#7a1f2e] flex flex-col items-center justify-center">
        <p className="text-[11px] uppercase tracking-[0.25em] font-medium text-white/50 mb-4">
          Rest
        </p>
        <p className="text-[96px] font-bold tabular-nums leading-none text-white">
          {timerDisplay}
        </p>
        {nextSet ? (
          <p className="mt-6 text-sm text-white/50">
            Next: {nextSet.id} &middot; {nextSet.kg}kg &times; {nextSet.reps}
          </p>
        ) : (
          <p className="mt-6 text-sm text-white/50">Last set — great work</p>
        )}
        <button
          onClick={dismissRest}
          className="mt-10 px-8 py-3 rounded-full border border-white/25 text-white/75
                     text-sm font-semibold hover:bg-white/10 active:bg-white/20 transition-colors"
        >
          Skip
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="mx-auto max-w-[393px] px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-[#111111]">
            {mode === "edit" ? "Edit" : "Log"} Session {String(session.id).padStart(2, "0")}
          </h2>
          <button
            onClick={onClose}
            className="text-[#777777] hover:text-[#111111] text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body Weight */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-[#777777] mb-1.5 uppercase tracking-wide">
            Body Weight (kg)
          </label>
          <input
            type="number"
            step="0.1"
            min="30"
            max="200"
            value={bwStr}
            onChange={(e) => setBwStr(e.target.value)}
            placeholder="54"
            className="w-24 border border-[#e8e8e8] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
          />
        </div>

        {/* Warm-up Pills */}
        {warmups.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-2">
              Warm-up
            </p>
            <div className="flex flex-wrap gap-2">
              {warmups.map((set) => (
                <span
                  key={set.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e8e8e8] px-3 py-1 text-xs text-[#aaaaaa]"
                >
                  <span className="font-semibold text-[#777777]">{set.id}</span>
                  {set.kg}kg &times; {set.reps}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Progress Dots */}
        {workingSets.length > 0 && (
          <div className="flex justify-center gap-2.5 mb-5">
            {workingSets.map((set, i) => {
              const isDone = completedSets.has(set.id)
              const isCurrent = i === currentSetIndex && !isDone
              return (
                <button
                  key={set.id}
                  onClick={() => setCurrentSetIndex(i)}
                  aria-label={`Go to set ${set.id}`}
                  className={[
                    "w-2.5 h-2.5 rounded-full transition-all",
                    isDone
                      ? "bg-[#7a1f2e]"
                      : isCurrent
                      ? "border-2 border-[#7a1f2e] bg-transparent scale-125"
                      : "bg-[#e8e8e8]",
                  ].join(" ")}
                />
              )
            })}
          </div>
        )}

        {/* Working Set Carousel */}
        {workingSets.length > 0 && (
          <div
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX === null) return
              const delta = e.changedTouches[0].clientX - touchStartX
              if (delta > 50) navigatePrev()
              else if (delta < -50) navigateNext()
              setTouchStartX(null)
            }}
            className="mb-4"
          >
            {currentSet && (
              <div
                className={`rounded-2xl border-2 p-5 transition-colors ${
                  completedSets.has(currentSet.id)
                    ? "border-[#7a1f2e]/30 bg-[#7a1f2e]/[0.03]"
                    : "border-[#e8e8e8]"
                }`}
              >
                {/* Set label + e1RM */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-3xl font-bold text-[#111111] leading-none">
                    {currentSet.id}
                    {completedSets.has(currentSet.id) && (
                      <span className="ml-2 text-[#7a1f2e] text-2xl">✓</span>
                    )}
                  </span>
                  {currentSet.e1rm != null && (
                    <span className="text-sm font-semibold text-[#7a1f2e]">
                      e1RM {currentSet.e1rm}kg
                    </span>
                  )}
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div>
                    <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">
                      kg
                    </label>
                    <input
                      type="number"
                      step="2.5"
                      min="20"
                      max="300"
                      value={currentSet._kgStr}
                      onChange={(e) => updateSet(currentGlobalIndex, "kg", e.target.value)}
                      className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">
                      Reps
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="20"
                      value={currentSet._repsStr}
                      onChange={(e) => updateSet(currentGlobalIndex, "reps", e.target.value)}
                      className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">
                      RPE
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={currentSet._rpeStr}
                      onChange={(e) => updateSet(currentGlobalIndex, "rpe", e.target.value)}
                      placeholder="—"
                      className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                    />
                  </div>
                </div>

                {/* Done Button */}
                <button
                  onClick={() => markSetDone(currentSet.id)}
                  disabled={completedSets.has(currentSet.id)}
                  className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-colors ${
                    completedSets.has(currentSet.id)
                      ? "bg-[#7a1f2e]/10 text-[#7a1f2e] cursor-default"
                      : "bg-[#111111] text-white hover:bg-[#333333] active:bg-[#000000]"
                  }`}
                >
                  {completedSets.has(currentSet.id) ? "✓ Done" : "Done"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Prev / Next Navigation */}
        {workingSets.length > 1 && (
          <div className="flex items-center justify-between mb-6 px-1">
            <button
              onClick={navigatePrev}
              disabled={currentSetIndex === 0}
              className="text-sm font-semibold text-[#777777] disabled:text-[#d4d4d4] px-3 py-2 rounded-lg hover:bg-[#f5f5f5] disabled:hover:bg-transparent transition-colors"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-[#aaaaaa] tabular-nums">
              {currentSetIndex + 1} / {workingSets.length}
            </span>
            <button
              onClick={navigateNext}
              disabled={currentSetIndex === workingSets.length - 1}
              className="text-sm font-semibold text-[#777777] disabled:text-[#d4d4d4] px-3 py-2 rounded-lg hover:bg-[#f5f5f5] disabled:hover:bg-transparent transition-colors"
            >
              Next ›
            </button>
          </div>
        )}

        {/* Additional Muscle Group Sections */}
        {selectedGroups.length > 0 && (
          <div className="mb-5">
            <div className="h-px bg-[#e8e8e8] mb-5" />
            <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-4">
              Additional Work
            </p>
            {selectedGroups.map((muscle) => (
              <div key={muscle} className="mb-6">
                <p className="text-xs font-semibold text-[#7a1f2e] uppercase tracking-wide mb-3">
                  {MUSCLE_GROUP_LABEL[muscle]}
                </p>
                {(MUSCLE_GROUP_EXERCISES[muscle] as string[]).map((exerciseName) => {
                  const topSet = getTopSet(exerciseName, previousSessions)
                  return (
                    <div key={exerciseName} className="mb-4">
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="text-xs font-medium text-[#777777]">{exerciseName}</p>
                        {topSet && (
                          <span className="text-[10px] text-[#aaaaaa]">
                            last: {topSet.kg}kg × {topSet.reps}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(extraState[muscle]?.[exerciseName] ?? []).map((set, i) => {
                          const extraSetId = `extra-${muscle}-${exerciseName}-${i}`
                          const isDone = completedSets.has(extraSetId)
                          return (
                            <div
                              key={i}
                              className={`grid grid-cols-[1.2rem_1fr_1fr_3.5rem] gap-2 items-end transition-opacity ${isDone ? "opacity-50" : ""}`}
                            >
                              <span className="text-[10px] text-[#aaaaaa] pb-2">{i + 1}</span>
                              <div>
                                <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1">
                                  kg
                                </label>
                                <input
                                  type="number"
                                  step="2.5"
                                  min="0"
                                  value={set.kgStr}
                                  onChange={(e) => updateExtraSet(muscle, exerciseName, i, "kg", e.target.value)}
                                  className="w-full border border-[#e8e8e8] rounded-lg px-2 py-1.5 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1">
                                  Reps
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  value={set.repsStr}
                                  onChange={(e) => updateExtraSet(muscle, exerciseName, i, "reps", e.target.value)}
                                  className="w-full border border-[#e8e8e8] rounded-lg px-2 py-1.5 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                                />
                              </div>
                              <button
                                onClick={() => markSetDone(extraSetId)}
                                disabled={isDone}
                                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  isDone
                                    ? "bg-[#7a1f2e]/10 text-[#7a1f2e] cursor-default"
                                    : "bg-[#111111] text-white hover:bg-[#333333]"
                                }`}
                              >
                                {isDone ? "✓" : "Done"}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Coach Note */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-[#777777] mb-1.5 uppercase tracking-wide">
            Session Notes
          </label>
          <textarea
            value={coachNote}
            onChange={(e) => setCoachNote(e.target.value)}
            rows={2}
            placeholder="How did it feel?"
            className="w-full border border-[#e8e8e8] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e] resize-none"
          />
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-[#6a1926] transition-colors"
        >
          {mode === "edit" ? "Save Changes" : "Confirm Session"}
        </button>
      </div>
    </div>
  )
}
