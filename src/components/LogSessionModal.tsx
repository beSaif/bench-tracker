"use client"

import { useState, useEffect } from "react"
import {
  Session,
  BenchSet,
  MuscleGroup,
  ExtraWorkout,
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
}

interface EditableSet extends BenchSet {
  _kgStr: string
  _repsStr: string
  _rpeStr: string
}

interface EditableExtraSet {
  kgStr: string
  repsStr: string
  rpeStr: string
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
  return { kgStr: "0", repsStr: "10", rpeStr: "" }
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
          rpeStr: s.rpe != null ? String(s.rpe) : "",
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

export default function LogSessionModal({ session, onConfirm, onClose, mode = "log" }: LogSessionModalProps) {
  const [sets, setSets] = useState<EditableSet[]>(session.sets.map(toEditable))
  const [bwStr, setBwStr] = useState(session.bw != null ? String(session.bw) : "")
  const [coachNote, setCoachNote] = useState(session.coachNote)
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set())
  const [restActive, setRestActive] = useState(false)
  const [restSeconds, setRestSeconds] = useState(0)
  const [extraState, setExtraState] = useState<ExtraWorkoutState>(
    () => initExtraWorkoutState(session)
  )

  useEffect(() => {
    if (!restActive) return
    if (restSeconds <= 0) {
      setRestActive(false)
      return
    }
    const id = setTimeout(() => setRestSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [restActive, restSeconds])

  function markSetDone(setId: string) {
    setCompletedSets((prev) => new Set([...prev, setId]))
    setRestSeconds(REST_DURATION)
    setRestActive(true)
  }

  function dismissRest() {
    setRestActive(false)
    setRestSeconds(0)
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
    field: "kg" | "reps" | "rpe",
    raw: string
  ) {
    setExtraState((prev) => {
      const next = { ...prev }
      next[muscle] = { ...next[muscle] }
      next[muscle][exercise] = next[muscle][exercise].map((s, i) => {
        if (i !== setIndex) return s
        const updated = { ...s }
        if (field === "kg") updated.kgStr = raw
        else if (field === "reps") updated.repsStr = raw
        else updated.rpeStr = raw
        return updated
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
              rpe: s.rpeStr !== "" ? parseFloat(s.rpeStr) : null,
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

  const warmups = sets.filter((s) => s.isWarmup)
  const workingSets = sets.filter((s) => !s.isWarmup)
  const selectedGroups = session.selectedMuscleGroups ?? []

  const timerMins = Math.floor(restSeconds / 60)
  const timerSecs = restSeconds % 60
  const timerDisplay = `${timerMins}:${String(timerSecs).padStart(2, "0")}`

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="mx-auto max-w-[393px] px-4 py-6">
        {/* Rest Timer Banner */}
        {restActive && (
          <div className="sticky top-2 z-10 bg-[#7a1f2e] text-white rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-medium opacity-70 mb-0.5">Rest</p>
              <p className="text-2xl font-bold tabular-nums leading-none">{timerDisplay}</p>
            </div>
            <button
              onClick={dismissRest}
              className="text-white/70 hover:text-white text-sm font-medium px-2 py-1"
            >
              Skip
            </button>
          </div>
        )}

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

        {/* Warm-up Sets */}
        <div className="mb-5">
          <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-2">
            Warm-up Sets
          </p>
          <div className="space-y-1">
            {warmups.map((set) => (
              <div
                key={set.id}
                className="grid grid-cols-[2rem_2.5rem_4.5rem_3.5rem] gap-x-3 py-1 text-sm text-[#aaaaaa]"
              >
                <span className="font-medium">{set.id}</span>
                <span>{set.kg}kg</span>
                <span>{set.reps} reps</span>
                <span className="text-right">—</span>
              </div>
            ))}
          </div>
        </div>

        {/* Working Sets */}
        <div className="mb-5">
          <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-3">
            Working Sets
          </p>
          <div className="space-y-4">
            {workingSets.map((set) => {
              const globalIndex = sets.findIndex((s) => s.id === set.id)
              const isDone = completedSets.has(set.id)
              return (
                <div
                  key={set.id}
                  className={`rounded-xl border p-3 transition-colors ${isDone ? "border-[#7a1f2e]/25 bg-[#7a1f2e]/[0.03]" : "border-[#e8e8e8]"}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-[#111111]">
                      Set {set.id}
                      {isDone && <span className="ml-1.5 text-[#7a1f2e]">✓</span>}
                    </span>
                    {set.e1rm != null && (
                      <span className="text-xs font-semibold text-[#7a1f2e]">
                        e1RM {set.e1rm}kg
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1">
                        kg
                      </label>
                      <input
                        type="number"
                        step="2.5"
                        min="20"
                        max="300"
                        value={set._kgStr}
                        onChange={(e) => updateSet(globalIndex, "kg", e.target.value)}
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
                        max="20"
                        value={set._repsStr}
                        onChange={(e) => updateSet(globalIndex, "reps", e.target.value)}
                        className="w-full border border-[#e8e8e8] rounded-lg px-2 py-1.5 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1">
                        RPE
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="10"
                        value={set._rpeStr}
                        onChange={(e) => updateSet(globalIndex, "rpe", e.target.value)}
                        placeholder="—"
                        className="w-full border border-[#e8e8e8] rounded-lg px-2 py-1.5 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => markSetDone(set.id)}
                    disabled={isDone}
                    className={`mt-3 w-full rounded-lg py-2 text-xs font-semibold transition-colors ${
                      isDone
                        ? "bg-[#7a1f2e]/10 text-[#7a1f2e] cursor-default"
                        : "bg-[#111111] text-white hover:bg-[#333333] active:bg-[#000000]"
                    }`}
                  >
                    Done
                  </button>
                </div>
              )
            })}
          </div>
        </div>

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
                {(MUSCLE_GROUP_EXERCISES[muscle] as string[]).map((exerciseName) => (
                  <div key={exerciseName} className="mb-4">
                    <p className="text-xs font-medium text-[#777777] mb-2">{exerciseName}</p>
                    <div className="space-y-2">
                      {(extraState[muscle]?.[exerciseName] ?? []).map((set, i) => (
                        <div key={i} className="grid grid-cols-3 gap-3">
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
                          <div>
                            <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1">
                              RPE
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="1"
                              max="10"
                              value={set.rpeStr}
                              onChange={(e) => updateExtraSet(muscle, exerciseName, i, "rpe", e.target.value)}
                              placeholder="—"
                              className="w-full border border-[#e8e8e8] rounded-lg px-2 py-1.5 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
