"use client"

import { useState, useEffect, useRef } from "react"
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
import { saveDraft, clearDraft } from "@/lib/storage"
import type { SessionDraft } from "@/lib/types"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const REST_DURATION = 180 // seconds

interface LogSessionModalProps {
  session: Session
  onConfirm: (session: Session) => void
  onClose: () => void
  mode?: "log" | "edit"
  previousSessions?: Session[]
  initialDraft?: SessionDraft
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

type CarouselItem =
  | { type: "bench"; set: EditableSet; globalIndex: number }
  | { type: "extra"; muscle: MuscleGroup; exercise: string; setIndex: number }

type ExerciseGroup =
  | { kind: "bench" }
  | { kind: "extra"; muscle: MuscleGroup; exercise: string }

function groupId(g: ExerciseGroup): string {
  return g.kind === "bench" ? "bench" : `extra-${g.muscle}-${g.exercise}`
}

function buildDefaultOrder(session: Session): ExerciseGroup[] {
  const order: ExerciseGroup[] = [{ kind: "bench" }]
  for (const muscle of session.selectedMuscleGroups ?? []) {
    for (const exercise of MUSCLE_GROUP_EXERCISES[muscle]) {
      order.push({ kind: "extra", muscle, exercise })
    }
  }
  return order
}

function buildCarouselItems(
  order: ExerciseGroup[],
  sets: EditableSet[],
  extraState: ExtraWorkoutState
): CarouselItem[] {
  return order.flatMap((group): CarouselItem[] => {
    if (group.kind === "bench") {
      return sets.map((set, i) => ({ type: "bench" as const, set, globalIndex: i }))
    }
    return (extraState[group.muscle]?.[group.exercise] ?? []).map((_, setIndex) => ({
      type: "extra" as const,
      muscle: group.muscle,
      exercise: group.exercise,
      setIndex,
    }))
  })
}

function SortableGroupRow({
  id,
  group,
  sets,
  extraState,
}: {
  id: string
  group: ExerciseGroup
  sets: EditableSet[]
  extraState: ExtraWorkoutState
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const label =
    group.kind === "bench"
      ? "Bench Press"
      : `${MUSCLE_GROUP_LABEL[group.muscle]} · ${group.exercise}`
  const count =
    group.kind === "bench"
      ? sets.length
      : (extraState[group.muscle]?.[group.exercise]?.length ?? 0)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 py-3.5 px-1 border-b border-[#f0f0f0] select-none ${
        isDragging ? "bg-[#f9f9f9] shadow-sm rounded-lg z-10 relative" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-[#cccccc] touch-none cursor-grab active:cursor-grabbing p-1 shrink-0"
        aria-label="Drag to reorder"
      >
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="9" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="9" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" />
          <circle cx="9" cy="13" r="1.5" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#111111] truncate">{label}</p>
        <p className="text-[11px] text-[#aaaaaa] mt-0.5">
          {count} set{count !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  )
}

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

function getItemKey(item: CarouselItem): string {
  if (item.type === "bench") return item.set.id
  return `extra-${item.muscle}-${item.exercise}-${item.setIndex}`
}

export default function LogSessionModal({
  session,
  onConfirm,
  onClose,
  mode = "log",
  previousSessions = [],
  initialDraft,
}: LogSessionModalProps) {
  const [sets, setSets] = useState<EditableSet[]>(
    () => initialDraft?.sets ?? session.sets.map(toEditable)
  )
  const [coachNote, setCoachNote] = useState(
    initialDraft?.coachNote ?? session.coachNote
  )
  const [completedSets, setCompletedSets] = useState<Set<string>>(
    () => new Set(initialDraft?.completedSets ?? [])
  )
  const [restEndTime, setRestEndTime] = useState<number | null>(null)
  const [restSeconds, setRestSeconds] = useState(0)
  const restActive = restEndTime !== null
  const [extraState, setExtraState] = useState<ExtraWorkoutState>(
    () => initialDraft?.extraState ?? initExtraWorkoutState(session)
  )
  const [currentSetIndex, setCurrentSetIndex] = useState(
    initialDraft?.currentSetIndex ?? 0
  )
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [exerciseOrder, setExerciseOrder] = useState<ExerciseGroup[]>(
    () => initialDraft?.exerciseOrder ?? buildDefaultOrder(session)
  )
  const [showReorder, setShowReorder] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    if (mode === "edit") return
    saveDraft({
      sessionId: session.id,
      savedAt: new Date().toISOString(),
      sets,
      completedSets: Array.from(completedSets),
      extraState,
      coachNote,
      currentSetIndex,
      exerciseOrder,
    })
  }, [sets, completedSets, extraState, coachNote, currentSetIndex])

  const selectedGroups = session.selectedMuscleGroups ?? []

  const carouselItems = buildCarouselItems(exerciseOrder, sets, extraState)

  const completedCount = carouselItems.filter((item) =>
    completedSets.has(getItemKey(item))
  ).length
  const allDone = carouselItems.length > 0 && completedCount === carouselItems.length

  // Keep a ref so the interval callback always sees the current length
  const carouselLengthRef = useRef(carouselItems.length)
  carouselLengthRef.current = carouselItems.length

  useEffect(() => {
    if (restEndTime === null) return

    function tick() {
      const remaining = Math.max(0, Math.ceil((restEndTime! - Date.now()) / 1000))
      setRestSeconds(remaining)
      if (remaining <= 0) {
        setRestEndTime(null)
        setCurrentSetIndex((prev) => Math.min(prev + 1, carouselLengthRef.current - 1))
      }
    }

    tick() // sync immediately on start
    const id = setInterval(tick, 500) // poll at 2 Hz for smooth display

    // Snap display the moment the tab becomes visible again
    function onVisibilityChange() {
      if (!document.hidden) tick()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [restEndTime])

  function markSetDone(key: string) {
    if (completedSets.has(key)) {
      setCompletedSets((prev) => { const n = new Set(prev); n.delete(key); return n })
      setRestEndTime(null)
      setRestSeconds(0)
    } else {
      setCompletedSets((prev) => new Set([...prev, key]))
      if (mode !== "edit") {
        setRestEndTime(Date.now() + REST_DURATION * 1000)
        setRestSeconds(REST_DURATION)
      }
    }
  }

  function dismissRest() {
    setRestEndTime(null)
    setRestSeconds(0)
    setCurrentSetIndex((prev) => {
      for (let i = prev + 1; i < carouselItems.length; i++) {
        if (!completedSets.has(getItemKey(carouselItems[i]))) return i
      }
      return Math.min(prev + 1, carouselItems.length - 1)
    })
  }

  function navigatePrev() {
    setCurrentSetIndex((p) => Math.max(p - 1, 0))
  }

  function navigateNext() {
    setCurrentSetIndex((p) => Math.min(p + 1, carouselItems.length - 1))
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

  function nextSetId(currentSets: EditableSet[], isWarmup: boolean): string {
    const prefix = isWarmup ? "W" : "S"
    const max = currentSets.reduce((m, s) => {
      const match = s.id.match(new RegExp(`^${prefix}(\\d+)$`))
      return match ? Math.max(m, parseInt(match[1])) : m
    }, 0)
    return `${prefix}${max + 1}`
  }

  function addSetAfterCurrent(globalIndex: number) {
    setSets((prev) => {
      const current = prev[globalIndex]
      const newSet: EditableSet = {
        ...current,
        id: nextSetId(prev, current.isWarmup),
        note: "",
      }
      const next = [...prev]
      next.splice(globalIndex + 1, 0, newSet)
      return next
    })
    setCurrentSetIndex((p) => p + 1)
  }

  function deleteCurrentSet(globalIndex: number, setId: string) {
    if (sets.length <= 1) return
    setSets((prev) => prev.filter((_, i) => i !== globalIndex))
    setCompletedSets((prev) => {
      const next = new Set(prev)
      next.delete(setId)
      return next
    })
    setCurrentSetIndex((prev) => Math.max(0, Math.min(prev, carouselItems.length - 2)))
  }

  function addExtraSetAfter(muscle: string, exercise: string, setIndex: number) {
    setExtraState((prev) => {
      const next = { ...prev }
      next[muscle] = { ...next[muscle] }
      const arr = [...next[muscle][exercise]]
      arr.splice(setIndex + 1, 0, defaultExtraSet())
      next[muscle][exercise] = arr
      return next
    })
    setCompletedSets((prev) => {
      const prefix = `extra-${muscle}-${exercise}-`
      const next = new Set<string>()
      for (const key of prev) {
        if (!key.startsWith(prefix)) { next.add(key); continue }
        const idx = parseInt(key.slice(prefix.length))
        next.add(idx > setIndex ? `${prefix}${idx + 1}` : key)
      }
      return next
    })
    setCurrentSetIndex((p) => p + 1)
  }

  function deleteExtraSet(muscle: string, exercise: string, setIndex: number) {
    if ((extraState[muscle]?.[exercise]?.length ?? 0) <= 1) return
    setExtraState((prev) => {
      const next = { ...prev }
      next[muscle] = { ...next[muscle] }
      next[muscle][exercise] = next[muscle][exercise].filter((_, i) => i !== setIndex)
      return next
    })
    setCompletedSets((prev) => {
      const prefix = `extra-${muscle}-${exercise}-`
      const next = new Set<string>()
      for (const key of prev) {
        if (!key.startsWith(prefix)) { next.add(key); continue }
        const idx = parseInt(key.slice(prefix.length))
        if (idx === setIndex) continue
        next.add(idx > setIndex ? `${prefix}${idx - 1}` : key)
      }
      return next
    })
    setCurrentSetIndex((prev) => Math.max(0, Math.min(prev, carouselItems.length - 2)))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setExerciseOrder((prev) => {
      const oldIdx = prev.findIndex((g) => groupId(g) === active.id)
      const newIdx = prev.findIndex((g) => groupId(g) === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function closeReorder() {
    setShowReorder(false)
    const items = buildCarouselItems(exerciseOrder, sets, extraState)
    const first = items.findIndex((item) => !completedSets.has(getItemKey(item)))
    setCurrentSetIndex(first >= 0 ? first : 0)
  }

  function handleConfirm() {
    const extraWorkouts: ExtraWorkout[] = selectedGroups
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
      coachNote,
      sets: sets.map(({ _kgStr: _, _repsStr: __, _rpeStr: ___, ...rest }) => rest),
      extraWorkouts: extraWorkouts.length > 0 ? extraWorkouts : undefined,
    }
    clearDraft()
    onConfirm(finalSession)
  }

  const timerMins = Math.floor(restSeconds / 60)
  const timerSecs = restSeconds % 60
  const timerDisplay = `${timerMins}:${String(timerSecs).padStart(2, "0")}`

  const currentItem = carouselItems[currentSetIndex]
  const nextItem = carouselItems[currentSetIndex + 1] ?? null

  function getNextPreview(item: CarouselItem): string {
    if (item.type === "bench") {
      return item.set.isWarmup
        ? `${item.set.id} · ${item.set.kg}kg × ${item.set.reps} (warm-up)`
        : `${item.set.id} · ${item.set.kg}kg × ${item.set.reps}`
    }
    return `${item.exercise} · Set ${item.setIndex + 1}`
  }

  // Full-screen rest timer
  if (restActive) {
    return (
      <div className="fixed inset-0 z-50 bg-[#7a1f2e] flex flex-col items-center justify-center">
        <p className="text-[11px] uppercase tracking-[0.25em] font-medium text-white/50 mb-4">
          Rest · {completedCount} / {carouselItems.length}
        </p>
        <p className="text-[96px] font-bold tabular-nums leading-none text-white">
          {timerDisplay}
        </p>
        {nextItem ? (
          <p className="mt-6 text-sm text-white/50">
            Next: {getNextPreview(nextItem)}
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
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-[393px] px-4 flex flex-col flex-1 min-h-0 relative">

        {/* Header + Progress — pinned at top */}
        <div className="pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-5">
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

          {mode === "log" && carouselItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[#aaaaaa] uppercase tracking-widest">Progress</span>
                <span className="text-[10px] text-[#aaaaaa] tabular-nums">
                  {completedCount} / {carouselItems.length}
                </span>
              </div>
              <div className="h-1 bg-[#e8e8e8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#7a1f2e] rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / carouselItems.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Centered content area */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 pb-8">

          {!allDone && carouselItems.length > 0 && (
            <div className="w-full space-y-4">
              {/* Swipeable card */}
              <div
                onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                onTouchEnd={(e) => {
                  if (touchStartX === null) return
                  const delta = e.changedTouches[0].clientX - touchStartX
                  if (delta > 50) navigatePrev()
                  else if (delta < -50) navigateNext()
                  setTouchStartX(null)
                }}
              >
                {/* Bench set card (warmup or working) */}
                {currentItem?.type === "bench" && (() => {
                  const item = currentItem
                  const isDone = completedSets.has(item.set.id)
                  const isWarmup = item.set.isWarmup
                  return (
                    <div
                      className={`rounded-2xl border-2 p-5 transition-colors ${
                        isDone ? "border-[#7a1f2e]/30 bg-[#7a1f2e]/[0.03]" : "border-[#e8e8e8]"
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] mb-1">
                        Bench Press{isWarmup ? " · Warm-up" : ""}
                      </p>
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-3xl font-bold text-[#111111] leading-none">
                          {item.set.id}
                          {isDone && <span className="ml-2 text-[#7a1f2e] text-2xl">✓</span>}
                        </span>
                        {!isWarmup && item.set.e1rm != null && (
                          <span className="text-sm font-semibold text-[#7a1f2e]">
                            e1RM {item.set.e1rm}kg
                          </span>
                        )}
                      </div>

                      {isWarmup ? (
                        <div className="flex items-baseline gap-2 mb-5">
                          <span className="text-2xl font-semibold text-[#333333]">
                            {item.set.kg}kg
                          </span>
                          <span className="text-sm text-[#aaaaaa]">&times; {item.set.reps} reps</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 mb-5">
                          <div>
                            <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">kg</label>
                            <input
                              type="number" step="2.5" min="20" max="300"
                              disabled={isDone && mode !== "edit"}
                              value={item.set._kgStr}
                              onChange={(e) => updateSet(item.globalIndex, "kg", e.target.value)}
                              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e] disabled:opacity-40 disabled:bg-[#f5f5f5]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">Reps</label>
                            <input
                              type="number" step="1" min="1" max="20"
                              disabled={isDone && mode !== "edit"}
                              value={item.set._repsStr}
                              onChange={(e) => updateSet(item.globalIndex, "reps", e.target.value)}
                              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e] disabled:opacity-40 disabled:bg-[#f5f5f5]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">RPE</label>
                            <input
                              type="number" step="0.5" min="1" max="10"
                              disabled={isDone && mode !== "edit"}
                              value={item.set._rpeStr}
                              onChange={(e) => updateSet(item.globalIndex, "rpe", e.target.value)}
                              placeholder="—"
                              className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e] disabled:opacity-40 disabled:bg-[#f5f5f5]"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => markSetDone(item.set.id)}
                        className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-colors ${
                          isDone
                            ? "bg-[#7a1f2e]/10 text-[#7a1f2e] hover:bg-[#7a1f2e]/20 active:bg-[#7a1f2e]/30"
                            : "bg-[#111111] text-white hover:bg-[#333333] active:bg-[#000000]"
                        }`}
                      >
                        {isDone ? "✓ Done" : "Done"}
                      </button>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
                        <button
                          onClick={() => deleteCurrentSet(item.globalIndex, item.set.id)}
                          disabled={sets.length <= 1}
                          className="text-xs text-[#bbbbbb] disabled:opacity-30 hover:text-red-400 transition-colors px-1"
                        >
                          Delete set
                        </button>
                        <button
                          onClick={() => addSetAfterCurrent(item.globalIndex)}
                          className="text-xs text-[#bbbbbb] hover:text-[#111111] transition-colors px-1"
                        >
                          + Add set after
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Extra work card */}
                {currentItem?.type === "extra" && (() => {
                  const item = currentItem
                  const key = getItemKey(item)
                  const isDone = completedSets.has(key)
                  const currentExtraSet = extraState[item.muscle]?.[item.exercise]?.[item.setIndex]
                  const topSet = getTopSet(item.exercise, previousSessions)
                  return (
                    <div
                      className={`rounded-2xl border-2 p-5 transition-colors ${
                        isDone ? "border-[#7a1f2e]/30 bg-[#7a1f2e]/[0.03]" : "border-[#e8e8e8]"
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] mb-1">
                        {MUSCLE_GROUP_LABEL[item.muscle]}
                      </p>
                      <div className="flex items-start justify-between mb-5">
                        <div>
                          <p className="text-xl font-bold text-[#111111] leading-tight">
                            {item.exercise}
                            {isDone && <span className="ml-2 text-[#7a1f2e] text-lg">✓</span>}
                          </p>
                          <p className="text-xs text-[#aaaaaa] mt-0.5">Set {item.setIndex + 1}</p>
                        </div>
                        {topSet && (
                          <span className="text-xs text-[#aaaaaa] mt-0.5">
                            last: {topSet.kg}kg &times; {topSet.reps}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div>
                          <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">kg</label>
                          <input
                            type="number" step="2.5" min="0"
                            disabled={isDone && mode !== "edit"}
                            value={currentExtraSet?.kgStr ?? "0"}
                            onChange={(e) => updateExtraSet(item.muscle, item.exercise, item.setIndex, "kg", e.target.value)}
                            className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e] disabled:opacity-40 disabled:bg-[#f5f5f5]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#aaaaaa] uppercase tracking-wide mb-1.5">Reps</label>
                          <input
                            type="number" step="1" min="1"
                            disabled={isDone && mode !== "edit"}
                            value={currentExtraSet?.repsStr ?? "10"}
                            onChange={(e) => updateExtraSet(item.muscle, item.exercise, item.setIndex, "reps", e.target.value)}
                            className="w-full border border-[#e8e8e8] rounded-xl px-3 py-3 text-base text-[#111111] focus:outline-none focus:border-[#7a1f2e] disabled:opacity-40 disabled:bg-[#f5f5f5]"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => markSetDone(key)}
                        className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-colors ${
                          isDone
                            ? "bg-[#7a1f2e]/10 text-[#7a1f2e] hover:bg-[#7a1f2e]/20 active:bg-[#7a1f2e]/30"
                            : "bg-[#111111] text-white hover:bg-[#333333] active:bg-[#000000]"
                        }`}
                      >
                        {isDone ? "✓ Done" : "Done"}
                      </button>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
                        <button
                          onClick={() => deleteExtraSet(item.muscle, item.exercise, item.setIndex)}
                          disabled={(extraState[item.muscle]?.[item.exercise]?.length ?? 0) <= 1}
                          className="text-xs text-[#bbbbbb] disabled:opacity-30 hover:text-red-400 transition-colors px-1"
                        >
                          Delete set
                        </button>
                        <button
                          onClick={() => addExtraSetAfter(item.muscle, item.exercise, item.setIndex)}
                          className="text-xs text-[#bbbbbb] hover:text-[#111111] transition-colors px-1"
                        >
                          + Add set after
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Prev / Next */}
              <div className="flex items-center justify-between px-1">
                <button
                  onClick={navigatePrev}
                  disabled={currentSetIndex === 0}
                  className="text-sm font-semibold text-[#777777] disabled:text-[#d4d4d4] px-3 py-2 rounded-lg hover:bg-[#f5f5f5] disabled:hover:bg-transparent transition-colors"
                >
                  ‹ Prev
                </button>
                <span className="text-xs text-[#aaaaaa] tabular-nums">
                  {currentSetIndex + 1} / {carouselItems.length}
                </span>
                <button
                  onClick={navigateNext}
                  disabled={currentSetIndex === carouselItems.length - 1}
                  className="text-sm font-semibold text-[#777777] disabled:text-[#d4d4d4] px-3 py-2 rounded-lg hover:bg-[#f5f5f5] disabled:hover:bg-transparent transition-colors"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}

          {/* Notes + Confirm — after everything is done (log), or always (edit) */}
          {(allDone || mode === "edit") && (
            <div className="w-full space-y-4">
              {allDone && mode !== "edit" && (
                <div className="text-center mb-2">
                  <p className="text-sm font-semibold text-[#7a1f2e]">Session complete</p>
                  <p className="text-xs text-[#aaaaaa] mt-0.5">All sets done — add a note and confirm</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[#777777] mb-1.5 uppercase tracking-wide">
                  Session Notes
                </label>
                <textarea
                  value={coachNote}
                  onChange={(e) => setCoachNote(e.target.value)}
                  rows={3}
                  placeholder="How did it feel?"
                  className="w-full border border-[#e8e8e8] rounded-lg px-3 py-2 text-sm text-[#111111] focus:outline-none focus:border-[#7a1f2e] resize-none"
                />
              </div>
              <button
                onClick={handleConfirm}
                className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-[#6a1926] transition-colors"
              >
                {mode === "edit" ? "Save Changes" : "Confirm Session"}
              </button>
            </div>
          )}

        </div>

        {/* Chevron trigger — bottom center, only during active logging */}
        {mode === "log" && !allDone && carouselItems.length > 0 && (
          <button
            onClick={() => setShowReorder(true)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[#dddddd] hover:text-[#aaaaaa] p-2 transition-colors"
            aria-label="Reorder exercises"
          >
            <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
              <path d="M1 10L10 1L19 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {/* Bottom sheet */}
        {showReorder && (
          <>
            <div className="absolute inset-0 bg-black/20 z-10" onClick={closeReorder} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.10)] flex flex-col z-20 max-h-[65%]">
              <div className="flex justify-center pt-3 shrink-0">
                <div className="w-9 h-1 bg-[#e0e0e0] rounded-full" />
              </div>
              <div className="pt-3 pb-3 px-4 flex items-center justify-between shrink-0 border-b border-[#f0f0f0]">
                <p className="text-[10px] uppercase tracking-widest font-medium text-[#aaaaaa]">
                  Reorder Exercises
                </p>
                <button onClick={closeReorder} className="text-sm font-semibold text-[#7a1f2e]">
                  Done
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-1 px-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={exerciseOrder.map(groupId)}
                    strategy={verticalListSortingStrategy}
                  >
                    {exerciseOrder.map((group) => (
                      <SortableGroupRow
                        key={groupId(group)}
                        id={groupId(group)}
                        group={group}
                        sets={sets}
                        extraState={extraState}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
