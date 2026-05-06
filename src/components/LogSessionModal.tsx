"use client"

import { useState, useEffect, useRef } from "react"
import {
  Session,
  MainLiftSet,
  MuscleGroup,
  ExtraWorkout,
  ExtraSet,
} from "@/lib/types"
import { calcE1RM } from "@/lib/e1rm"
import { saveDraft, clearDraft } from "@/lib/storage"
import type { SessionDraft } from "@/lib/types"
import { MuscleGroupConfig, getMuscleLabel, getExercisesForMuscle, sortedMuscleGroups } from "@/lib/exerciseConfig"
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
import { DrumRollPicker } from "@/components/DrumRollPicker"

const REST_DURATION = 180 // seconds

const KG_VALUES = Array.from(
  { length: Math.floor((300 - 20) / 2.5) + 1 },
  (_, i) => 20 + i * 2.5
)
const REPS_VALUES = Array.from({ length: 20 }, (_, i) => i + 1)
const RPE_VALUES: (number | null)[] = [
  null,
  ...Array.from({ length: 19 }, (_, i) => 1 + i * 0.5),
]
const EXTRA_KG_VALUES = Array.from(
  { length: Math.floor(150 / 2.5) + 1 },
  (_, i) => i * 2.5
)
const EXTRA_REPS_VALUES = Array.from({ length: 30 }, (_, i) => i + 1)

interface LogSessionModalProps {
  session: Session
  onConfirm: (session: Session) => void
  onClose: () => void
  mode?: "log" | "edit"
  previousSessions?: Session[]
  initialDraft?: SessionDraft
  exerciseConfig: MuscleGroupConfig[]
  mainLiftLabel: string
}

interface EditableSet extends MainLiftSet {
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
  | { type: "main"; set: EditableSet; globalIndex: number }
  | { type: "extra"; muscle: MuscleGroup; exercise: string; setIndex: number }

type ExerciseGroup =
  | { kind: "main" }
  | { kind: "extra"; muscle: MuscleGroup; exercise: string }

function groupId(g: ExerciseGroup): string {
  return g.kind === "main" ? "main" : `extra-${g.muscle}-${g.exercise}`
}

function buildDefaultOrder(session: Session, exerciseConfig: MuscleGroupConfig[]): ExerciseGroup[] {
  const order: ExerciseGroup[] = [{ kind: "main" }]
  for (const muscle of session.selectedMuscleGroups ?? []) {
    for (const exercise of getExercisesForMuscle(exerciseConfig, muscle)) {
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
    if (group.kind === "main") {
      return sets.map((set, i) => ({ type: "main" as const, set, globalIndex: i }))
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
  completedSets,
  exerciseConfig,
  mainLiftLabel,
  onDelete,
}: {
  id: string
  group: ExerciseGroup
  sets: EditableSet[]
  extraState: ExtraWorkoutState
  completedSets: Set<string>
  exerciseConfig: MuscleGroupConfig[]
  mainLiftLabel: string
  onDelete?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const label =
    group.kind === "main"
      ? mainLiftLabel
      : `${getMuscleLabel(exerciseConfig, group.muscle)} · ${group.exercise}`

  let count: number
  let completedCount: number
  let topKg: number | null = null
  let topReps: number | null = null

  if (group.kind === "main") {
    count = sets.length
    const completedMain = sets.filter(s => completedSets.has(s.id))
    completedCount = completedMain.length
    const topSet = completedMain
      .filter(s => !s.isWarmup)
      .reduce<EditableSet | null>((best, s) =>
        !best || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps) ? s : best
      , null)
    if (topSet) { topKg = topSet.kg; topReps = topSet.reps }
  } else {
    const extraSets = extraState[group.muscle]?.[group.exercise] ?? []
    count = extraSets.length
    const completedExtra = extraSets.filter((_, i) =>
      completedSets.has(`extra-${group.muscle}-${group.exercise}-${i}`)
    )
    completedCount = completedExtra.length
    const topSet = completedExtra.reduce<EditableExtraSet | null>((best, s) => {
      const kg = parseFloat(s.kgStr)
      const bkg = best ? parseFloat(best.kgStr) : -1
      return kg > bkg || (kg === bkg && parseInt(s.repsStr) > parseInt(best!.repsStr)) ? s : best
    }, null)
    if (topSet) { topKg = parseFloat(topSet.kgStr); topReps = parseInt(topSet.repsStr) }
  }

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
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {count <= 10 && Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full shrink-0 ${
                i < completedCount ? "bg-[#7a1f2e]" : "bg-[#e0e0e0]"
              }`}
            />
          ))}
          <span className="text-[11px] text-[#aaaaaa] ml-0.5">{completedCount} / {count}</span>
        </div>
        {topKg !== null && topReps !== null && (
          <p className="text-[10px] text-[#7a1f2e] mt-0.5 font-medium">
            Top: {topKg} × {topReps}
          </p>
        )}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="text-[#cccccc] hover:text-red-400 transition-colors p-1 shrink-0"
          aria-label="Delete exercise"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function toEditable(set: MainLiftSet): EditableSet {
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

function initExtraWorkoutState(
  session: Session,
  exerciseConfig: MuscleGroupConfig[],
  previousSessions: Session[] = []
): ExtraWorkoutState {
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
    for (const exerciseName of getExercisesForMuscle(exerciseConfig, muscle)) {
      const lastSets = getLastSetsForExercise(exerciseName, previousSessions)
      if (lastSets && lastSets.length > 0) {
        state[muscle][exerciseName] = Array.from({ length: 3 }, (_, i) =>
          i < lastSets.length
            ? { kgStr: String(lastSets[i].kg), repsStr: String(lastSets[i].reps) }
            : defaultExtraSet()
        )
      } else {
        state[muscle][exerciseName] = [defaultExtraSet(), defaultExtraSet(), defaultExtraSet()]
      }
    }
  }
  return state
}

function getLastSetsForExercise(
  exerciseName: string,
  previousSessions: Session[]
): Array<{ kg: number; reps: number }> | null {
  for (const session of previousSessions) {
    for (const workout of session.extraWorkouts ?? []) {
      for (const exercise of workout.exercises) {
        if (exercise.name === exerciseName && exercise.sets.length > 0) {
          return exercise.sets.map((s) => ({ kg: s.kg, reps: s.reps }))
        }
      }
    }
  }
  return null
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
  if (item.type === "main") return item.set.id
  return `extra-${item.muscle}-${item.exercise}-${item.setIndex}`
}

export default function LogSessionModal({
  session,
  onConfirm,
  onClose,
  mode = "log",
  previousSessions = [],
  initialDraft,
  exerciseConfig,
  mainLiftLabel,
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
  const [timerMinimized, setTimerMinimized] = useState(false)
  const [extraState, setExtraState] = useState<ExtraWorkoutState>(
    () => initialDraft?.extraState ?? initExtraWorkoutState(session, exerciseConfig, previousSessions)
  )
  const [currentSetIndex, setCurrentSetIndex] = useState(
    initialDraft?.currentSetIndex ?? 0
  )
  const [exerciseOrder, setExerciseOrder] = useState<ExerciseGroup[]>(
    () => initialDraft?.exerciseOrder ?? buildDefaultOrder(session, exerciseConfig)
  )
  const [showReorder, setShowReorder] = useState(false)
  const [showMuscleGroupPicker, setShowMuscleGroupPicker] = useState(false)
  const [pendingDeleteExercise, setPendingDeleteExercise] = useState<
    { kind: "main" } | { kind: "extra"; muscle: string; exercise: string } | null
  >(null)

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

  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    session.selectedMuscleGroups ?? []
  )

  const carouselItems = buildCarouselItems(exerciseOrder, sets, extraState)

  const completedCount = carouselItems.filter((item) =>
    completedSets.has(getItemKey(item))
  ).length
  const allDone = carouselItems.length === 0 || completedCount === carouselItems.length

  const totalVolume = carouselItems.reduce((sum, item) => {
    if (!completedSets.has(getItemKey(item))) return sum
    if (item.type === "main") return sum + item.set.kg * item.set.reps
    const s = extraState[item.muscle]?.[item.exercise]?.[item.setIndex]
    return s ? sum + parseFloat(s.kgStr) * parseInt(s.repsStr) : sum
  }, 0)

  // Keep a ref so the interval callback always sees the current length
  const carouselLengthRef = useRef(carouselItems.length)
  carouselLengthRef.current = carouselItems.length

  const notifIdRef = useRef<string | null>(null)

  function playBeep() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
      osc.onended = () => ctx.close()
    } catch {}
  }

  function cancelNotification() {
    const id = notifIdRef.current
    if (!id) return
    notifIdRef.current = null
    navigator.serviceWorker?.ready.then((reg) => {
      reg.active?.postMessage({ type: "CANCEL", id })
    })
  }

  function scheduleNotification(delay: number, body: string) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return
    if (!navigator.serviceWorker) return
    const id = String(Date.now())
    notifIdRef.current = id
    navigator.serviceWorker.ready.then((reg) => {
      if (notifIdRef.current !== id) return // cancelled before SW was ready
      reg.active?.postMessage({ type: "SCHEDULE", id, delay, title: "Rest done — go!", body, icon: "/apple-icon.png" })
    })
  }

  useEffect(() => {
    if (restEndTime === null) return

    let done = false
    function tick() {
      const remaining = Math.max(0, Math.ceil((restEndTime! - Date.now()) / 1000))
      setRestSeconds(remaining)
      if (remaining <= 0 && !done) {
        done = true
        cancelNotification()
        playBeep()
        navigator.vibrate?.([300, 100, 300])
        setRestEndTime(null)
        setCurrentSetIndex((prev) => Math.min(prev + 1, carouselLengthRef.current - 1))
      }
    }

    tick() // sync immediately on start
    const id = setInterval(tick, 500) // poll at 2 Hz for smooth display

    // Snap display the moment the tab becomes visible again
    function onVisibilityChange() {
      if (!document.hidden) {
        cancelNotification()
        tick()
      }
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
      cancelNotification()
    } else {
      setCompletedSets((prev) => new Set([...prev, key]))
      if (mode !== "edit") {
        setRestEndTime(Date.now() + REST_DURATION * 1000)
        setRestSeconds(REST_DURATION)
        const body = nextItem ? getNextPreview(nextItem) : "Last set — great work"
        const doSchedule = () => scheduleNotification(REST_DURATION * 1000, body)
        if (typeof Notification !== "undefined") {
          if (Notification.permission === "granted") {
            doSchedule()
          } else if (Notification.permission === "default") {
            Notification.requestPermission().then((perm) => {
              if (perm === "granted") doSchedule()
            })
          }
        }
      }
    }
  }

  function dismissRest() {
    cancelNotification()
    setRestEndTime(null)
    setRestSeconds(0)
    setCurrentSetIndex((prev) => {
      for (let i = prev + 1; i < carouselItems.length; i++) {
        if (!completedSets.has(getItemKey(carouselItems[i]))) return i
      }
      return Math.min(prev + 1, carouselItems.length - 1)
    })
  }

  function hideTimer() {
    setTimerMinimized(true)
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

  function deleteSet(globalIndex: number, setId: string) {
    if (sets.length <= 1) return
    setSets((prev) => prev.filter((_, i) => i !== globalIndex))
    setCompletedSets((prev) => { const n = new Set(prev); n.delete(setId); return n })
  }

  function addMuscleGroup(muscleId: string) {
    setSelectedGroups((prev) => [...prev, muscleId])
    setExtraState((prev) => {
      const exercises: Record<string, EditableExtraSet[]> = {}
      for (const name of getExercisesForMuscle(exerciseConfig, muscleId)) {
        exercises[name] = [defaultExtraSet()]
      }
      return { ...prev, [muscleId]: exercises }
    })
    setShowMuscleGroupPicker(false)
  }

  function removeMuscleGroup(muscleId: string) {
    setSelectedGroups((prev) => prev.filter((g) => g !== muscleId))
    setExtraState((prev) => {
      const next = { ...prev }
      delete next[muscleId]
      return next
    })
  }

  function deleteExercise(muscle: string, exercise: string) {
    const willBeEmpty = Object.keys(extraState[muscle] ?? {}).filter(e => e !== exercise).length === 0

    setExtraState((prev) => {
      const next = { ...prev }
      if (willBeEmpty) {
        delete next[muscle]
      } else {
        const muscleExercises = { ...next[muscle] }
        delete muscleExercises[exercise]
        next[muscle] = muscleExercises
      }
      return next
    })

    if (willBeEmpty) {
      setSelectedGroups((prev) => prev.filter(g => g !== muscle))
    }

    setExerciseOrder((prev) =>
      prev.filter(g => !(g.kind === "extra" && g.muscle === muscle && g.exercise === exercise))
    )

    setCompletedSets((prev) => {
      const prefix = `extra-${muscle}-${exercise}-`
      const next = new Set<string>()
      for (const key of prev) {
        if (!key.startsWith(prefix)) next.add(key)
      }
      return next
    })

    setCurrentSetIndex((prev) => Math.max(0, Math.min(prev, carouselItems.length - 2)))
    setPendingDeleteExercise(null)
  }

  function deleteMainExercise() {
    setSets([])
    setCompletedSets((prev) => {
      const next = new Set<string>()
      for (const key of prev) {
        if (key.startsWith("extra-")) next.add(key)
      }
      return next
    })
    setExerciseOrder((prev) => prev.filter(g => g.kind !== "main"))
    setCurrentSetIndex(0)
    setPendingDeleteExercise(null)
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
        exercises: Object.entries(extraState[muscle])
          .filter(([, sets]) => sets.length > 0)
          .map(([name, sets]) => ({
            name,
            sets: sets.map((s) => ({
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
      selectedMuscleGroups: selectedGroups.length > 0 ? selectedGroups : undefined,
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
    if (item.type === "main") {
      return item.set.isWarmup
        ? `${item.set.id} · ${item.set.kg}kg × ${item.set.reps} (warm-up)`
        : `${item.set.id} · ${item.set.kg}kg × ${item.set.reps}`
    }
    return `${item.exercise} · Set ${item.setIndex + 1}`
  }

  // Edit mode — scrollable full-session list
  if (mode === "edit") {
    const availableGroups = sortedMuscleGroups(exerciseConfig).filter(
      (g) => !selectedGroups.includes(g.id)
    )
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-[393px] flex flex-col flex-1 min-h-0 relative">

          {/* Sticky header */}
          <div className="px-4 pt-6 pb-4 shrink-0 border-b border-[#f0f0f0]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#111111]">
                Edit Session {String(session.id).padStart(2, "0")}
              </h2>
              <button
                onClick={onClose}
                className="text-[#777777] hover:text-[#111111] text-xl leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-5 space-y-7 pb-12">

              {/* Main lift */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-medium mb-3">
                  {mainLiftLabel}
                </p>
                <div className="space-y-2">
                  {sets.map((set, idx) => (
                    <div
                      key={set.id}
                      className="rounded-2xl border border-[#e8e8e8] p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-[#333333]">
                          {set.id}{set.isWarmup ? " · Warm-up" : ""}
                        </span>
                        <button
                          onClick={() => deleteSet(idx, set.id)}
                          disabled={sets.length <= 1}
                          className="text-[11px] text-[#bbbbbb] disabled:opacity-30 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <DrumRollPicker
                          values={KG_VALUES}
                          selected={set.kg}
                          onChange={(v) => { if (v !== null) updateSet(idx, "kg", String(v)) }}
                          label="kg"
                        />
                        <DrumRollPicker
                          values={REPS_VALUES}
                          selected={set.reps}
                          onChange={(v) => { if (v !== null) updateSet(idx, "reps", String(v)) }}
                          label="reps"
                        />
                        {!set.isWarmup && (
                          <DrumRollPicker
                            values={RPE_VALUES}
                            selected={set.rpe}
                            onChange={(v) => updateSet(idx, "rpe", v === null ? "" : String(v))}
                            label="rpe"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addSetAfterCurrent(sets.length - 1)}
                  className="mt-2 w-full py-2.5 rounded-xl border border-dashed border-[#e8e8e8] text-xs text-[#aaaaaa] hover:text-[#777777] hover:border-[#aaaaaa] transition-colors"
                >
                  + Add set
                </button>
              </div>

              {/* Muscle group sections */}
              {selectedGroups.map((muscleId) => (
                <div key={muscleId}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-medium">
                      {getMuscleLabel(exerciseConfig, muscleId)}
                    </p>
                    <button
                      onClick={() => removeMuscleGroup(muscleId)}
                      className="text-[10px] uppercase tracking-wide text-[#bbbbbb] hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-4">
                    {Object.entries(extraState[muscleId] ?? {}).map(([exercise, exerciseSets]) => (
                      <div key={exercise}>
                        <p className="text-sm font-medium text-[#333333] mb-2">{exercise}</p>
                        <div className="space-y-2">
                          {exerciseSets.map((s, i) => (
                            <div key={i} className="rounded-xl border border-[#e8e8e8] p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] text-[#aaaaaa]">Set {i + 1}</span>
                                <button
                                  onClick={() => deleteExtraSet(muscleId, exercise, i)}
                                  disabled={exerciseSets.length <= 1}
                                  className="text-[11px] text-[#bbbbbb] disabled:opacity-30 hover:text-red-400 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <DrumRollPicker
                                  values={EXTRA_KG_VALUES}
                                  selected={parseFloat(s.kgStr)}
                                  onChange={(v) => { if (v !== null) updateExtraSet(muscleId, exercise, i, "kg", String(v)) }}
                                  label="kg"
                                />
                                <DrumRollPicker
                                  values={EXTRA_REPS_VALUES}
                                  selected={parseInt(s.repsStr, 10)}
                                  onChange={(v) => { if (v !== null) updateExtraSet(muscleId, exercise, i, "reps", String(v)) }}
                                  label="reps"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => addExtraSetAfter(muscleId, exercise, exerciseSets.length - 1)}
                          className="mt-1.5 w-full py-2 rounded-xl border border-dashed border-[#e8e8e8] text-xs text-[#aaaaaa] hover:text-[#777777] hover:border-[#aaaaaa] transition-colors"
                        >
                          + Add set
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add muscle group */}
              {availableGroups.length > 0 && (
                <button
                  onClick={() => setShowMuscleGroupPicker(true)}
                  className="w-full py-3 rounded-2xl border border-dashed border-[#e8e8e8] text-xs font-medium text-[#aaaaaa] hover:text-[#777777] hover:border-[#aaaaaa] transition-colors"
                >
                  + Add muscle group
                </button>
              )}

              {/* Notes */}
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
                Save Changes
              </button>
            </div>
          </div>

          {/* Muscle group picker bottom sheet */}
          {showMuscleGroupPicker && (
            <>
              <div
                className="absolute inset-0 bg-black/20 z-10"
                onClick={() => setShowMuscleGroupPicker(false)}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.10)] z-20">
                <div className="flex justify-center pt-3">
                  <div className="w-9 h-1 bg-[#e0e0e0] rounded-full" />
                </div>
                <div className="pt-3 pb-3 px-4 border-b border-[#f0f0f0]">
                  <p className="text-[10px] uppercase tracking-widest font-medium text-[#aaaaaa]">
                    Add Muscle Group
                  </p>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {availableGroups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => addMuscleGroup(g.id)}
                      className="w-full text-left px-3 py-3 rounded-xl hover:bg-[#f5f5f5] text-sm font-medium text-[#111111] transition-colors"
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
                <div className="h-6" />
              </div>
            </>
          )}

        </div>
      </div>
    )
  }

  // Full-screen rest timer
  if (restActive && !timerMinimized) {
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
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={dismissRest}
            className="px-8 py-3 rounded-full border border-white/25 text-white/75
                       text-sm font-semibold hover:bg-white/10 active:bg-white/20 transition-colors"
          >
            Skip rest
          </button>
          <button
            onClick={hideTimer}
            className="text-white/40 text-xs font-medium hover:text-white/60 active:text-white/80 transition-colors"
          >
            Hide timer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col overflow-hidden transition-colors duration-300 ${restActive && timerMinimized ? "bg-[#fdf5f6]" : "bg-white"}`}>
      {restActive && timerMinimized && (
        <button
          onClick={() => setTimerMinimized(false)}
          className="w-full bg-[#7a1f2e] flex items-center justify-between px-5 py-3
                     shrink-0 active:opacity-80 transition-opacity"
          aria-label="Restore timer"
        >
          <span className="text-white/50 text-xs uppercase tracking-widest">Resting</span>
          <span className="text-white font-bold tabular-nums text-lg">{timerDisplay}</span>
          <span className="text-white/40 text-xs">tap to expand</span>
        </button>
      )}
      <div className="mx-auto w-full max-w-[393px] px-4 flex flex-col flex-1 min-h-0 relative">

        {/* Header + Progress — pinned at top */}
        <div className="pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-[#111111]">
              Log Session {String(session.id).padStart(2, "0")}
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
              {/* Card */}
              <div>
                {/* Main lift set card (warmup or working) */}
                {currentItem?.type === "main" && (() => {
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
                        {mainLiftLabel}{isWarmup ? " · Warm-up" : ""}
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
                        <div key={item.set.id} className="flex gap-2 mb-5">
                          <DrumRollPicker
                            values={KG_VALUES}
                            selected={item.set.kg}
                            onChange={(v) => { if (v !== null) updateSet(item.globalIndex, "kg", String(v)) }}
                            label="kg"
                            disabled={isDone}
                          />
                          <DrumRollPicker
                            values={REPS_VALUES}
                            selected={item.set.reps}
                            onChange={(v) => { if (v !== null) updateSet(item.globalIndex, "reps", String(v)) }}
                            label="reps"
                            disabled={isDone}
                          />
                          <DrumRollPicker
                            values={RPE_VALUES}
                            selected={item.set.rpe}
                            onChange={(v) => updateSet(item.globalIndex, "rpe", v === null ? "" : String(v))}
                            label="rpe"
                            disabled={isDone}
                          />
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
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => deleteCurrentSet(item.globalIndex, item.set.id)}
                            disabled={sets.length <= 1}
                            className="text-xs text-[#bbbbbb] disabled:opacity-30 hover:text-red-400 transition-colors px-1"
                          >
                            Delete set
                          </button>
                          <button
                            onClick={() => setPendingDeleteExercise({ kind: "main" })}
                            className="text-xs text-[#bbbbbb] hover:text-red-400 transition-colors px-1"
                          >
                            Delete exercise
                          </button>
                        </div>
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
                        {getMuscleLabel(exerciseConfig, item.muscle)}
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
                            best: {topSet.kg}kg &times; {topSet.reps}
                          </span>
                        )}
                      </div>
                      <div key={`${item.muscle}-${item.exercise}-${item.setIndex}`} className="flex gap-2 mb-5">
                        <DrumRollPicker
                          values={EXTRA_KG_VALUES}
                          selected={parseFloat(currentExtraSet?.kgStr ?? "0")}
                          onChange={(v) => { if (v !== null) updateExtraSet(item.muscle, item.exercise, item.setIndex, "kg", String(v)) }}
                          label="kg"
                          disabled={isDone}
                        />
                        <DrumRollPicker
                          values={EXTRA_REPS_VALUES}
                          selected={parseInt(currentExtraSet?.repsStr ?? "10", 10)}
                          onChange={(v) => { if (v !== null) updateExtraSet(item.muscle, item.exercise, item.setIndex, "reps", String(v)) }}
                          label="reps"
                          disabled={isDone}
                        />
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
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => deleteExtraSet(item.muscle, item.exercise, item.setIndex)}
                            disabled={(extraState[item.muscle]?.[item.exercise]?.length ?? 0) <= 1}
                            className="text-xs text-[#bbbbbb] disabled:opacity-30 hover:text-red-400 transition-colors px-1"
                          >
                            Delete set
                          </button>
                          <button
                            onClick={() => setPendingDeleteExercise({ kind: "extra", muscle: item.muscle, exercise: item.exercise })}
                            className="text-xs text-[#bbbbbb] hover:text-red-400 transition-colors px-1"
                          >
                            Delete exercise
                          </button>
                        </div>
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

          {/* Notes + Confirm — shown after all sets are done */}
          {allDone && (
            <div className="w-full space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm font-semibold text-[#7a1f2e]">Session complete</p>
                <p className="text-xs text-[#aaaaaa] mt-0.5">All sets done — add a note and confirm</p>
              </div>
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
                Confirm Session
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
                  Exercises
                </p>
                <button onClick={closeReorder} className="text-sm font-semibold text-[#7a1f2e]">
                  Done
                </button>
              </div>
              <div className="px-4 py-2.5 border-b border-[#f0f0f0] flex items-center gap-2 shrink-0">
                <span className="text-[12px] font-semibold text-[#111111]">
                  {completedCount} / {carouselItems.length} sets
                </span>
                <span className="text-[#dddddd]">·</span>
                <span className="text-[12px] text-[#777777]">
                  {totalVolume.toLocaleString()} kg volume
                </span>
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
                        completedSets={completedSets}
                        exerciseConfig={exerciseConfig}
                        mainLiftLabel={mainLiftLabel}
                        onDelete={group.kind === "extra"
                          ? () => setPendingDeleteExercise({ kind: "extra", muscle: group.muscle, exercise: group.exercise })
                          : () => setPendingDeleteExercise({ kind: "main" })}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </>
        )}

        {/* Delete exercise confirmation */}
        {pendingDeleteExercise && (
          <>
            <div className="absolute inset-0 bg-black/30 z-30" onClick={() => setPendingDeleteExercise(null)} />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)] z-40 p-5">
              <p className="text-sm font-semibold text-[#111111] mb-1">Remove exercise?</p>
              {pendingDeleteExercise.kind === "main" ? (
                <>
                  <p className="text-base font-bold text-[#111111]">{mainLiftLabel}</p>
                  <p className="text-xs text-[#aaaaaa] mt-1 mb-4">
                    All sets will be removed. This session will have no main lift.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-[#111111]">{pendingDeleteExercise.exercise}</p>
                  {(() => {
                    const willBeEmpty = Object.keys(extraState[pendingDeleteExercise.muscle] ?? {}).filter(e => e !== pendingDeleteExercise.exercise).length === 0
                    return willBeEmpty ? (
                      <p className="text-xs text-[#aaaaaa] mt-1 mb-4">
                        This will also remove the {getMuscleLabel(exerciseConfig, pendingDeleteExercise.muscle)} group.
                      </p>
                    ) : (
                      <div className="mb-4" />
                    )
                  })()}
                </>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteExercise(null)}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold bg-[#f5f5f5] text-[#333333] hover:bg-[#ebebeb] active:bg-[#e0e0e0] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => pendingDeleteExercise.kind === "main"
                    ? deleteMainExercise()
                    : deleteExercise(pendingDeleteExercise.muscle, pendingDeleteExercise.exercise)
                  }
                  className="flex-1 rounded-xl py-3 text-sm font-semibold bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
