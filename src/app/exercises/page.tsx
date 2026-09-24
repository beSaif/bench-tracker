"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  MuscleGroupConfig,
  DEFAULT_MUSCLE_GROUPS,
  DEFAULT_TRAINING_DAYS,
  generateId,
  sortedCardioGroups,
} from "@/lib/exerciseConfig"
import { TrainingDay } from "@/lib/types"
import TrainingModeSelector from "@/components/TrainingModeSelector"
import {
  loadExerciseConfigLocal,
  loadExerciseConfig,
  saveExerciseConfig,
  loadTrainingDaysLocal,
  loadTrainingDays,
  saveTrainingDays,
  loadCoach,
  stopTrainingUnderCoach,
} from "@/lib/storage"
import { PersonSummary } from "@/lib/routines"

const SECTION_LABEL = "text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3"
const ADD_BUTTON =
  "w-full border border-dashed border-[#e8e8e8] rounded-xl py-3 text-sm font-semibold text-[#aaaaaa] hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <svg
      width="7" height="12" viewBox="0 0 7 12" fill="none"
      stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M1 1l5 5-5 5" />
    </svg>
  )
}

function chipClass(on: boolean) {
  return `px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
    on
      ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
      : "bg-white text-[#777777] border-[#e8e8e8] hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
  }`
}

/**
 * The routine editor: training focus, the days of the split, and the muscle groups
 * those days are built from. Rows stay quiet — a day's rename and delete live inside
 * it once opened, and a group's live on its own page.
 */
export default function ExercisesPage() {
  const [config, setConfig] = useState<MuscleGroupConfig[]>(DEFAULT_MUSCLE_GROUPS)
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>(DEFAULT_TRAINING_DAYS)
  const [mounted, setMounted] = useState(false)
  /** Who this account trains under. While set, the split is theirs and read-only here. */
  const [coach, setCoach] = useState<PersonSummary | null>(null)
  const [stopping, setStopping] = useState(false)
  const locked = coach !== null

  // Adding a muscle group: name and day in one form
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDayId, setNewGroupDayId] = useState<string | null>(null)

  // Training day editing
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [editingDayName, setEditingDayName] = useState("")
  const [addingDay, setAddingDay] = useState(false)
  const [newDayName, setNewDayName] = useState("")

  const addGroupInputRef = useRef<HTMLInputElement>(null)
  const renameDayInputRef = useRef<HTMLInputElement>(null)
  const addDayInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConfig(loadExerciseConfigLocal())
    setTrainingDays(loadTrainingDaysLocal())
    setMounted(true)
    loadExerciseConfig().then(setConfig)
    loadTrainingDays().then(setTrainingDays)
    loadCoach().then(setCoach)
  }, [])

  async function stopFollowing() {
    if (!coach) return
    if (!window.confirm(`Stop training under ${coach.name}? Their routine, as it is now, stays yours to edit.`)) return
    setStopping(true)
    if (await stopTrainingUnderCoach()) setCoach(null)
    setStopping(false)
  }

  useEffect(() => {
    if (addingGroup) addGroupInputRef.current?.focus()
  }, [addingGroup])

  useEffect(() => {
    if (editingDayId) renameDayInputRef.current?.focus()
  }, [editingDayId])

  useEffect(() => {
    if (addingDay) addDayInputRef.current?.focus()
  }, [addingDay])

  // --- Muscle group helpers ---

  function persistConfig(newConfig: MuscleGroupConfig[]) {
    setConfig(newConfig)
    saveExerciseConfig(newConfig)
  }

  function persistDays(newDays: TrainingDay[]) {
    setTrainingDays(newDays)
    saveTrainingDays(newDays)
  }

  function addGroupFinish() {
    const name = newGroupName.trim()
    if (!name) return
    const id = generateId(name)
    const newGroup: MuscleGroupConfig = { id, name, order: config.length, exercises: [] }
    persistConfig([...config, newGroup])

    if (newGroupDayId) {
      persistDays(trainingDays.map((d) =>
        d.id === newGroupDayId
          ? { ...d, muscleGroupIds: [...d.muscleGroupIds, id] }
          : d
      ))
    }
    resetAddGroup()
  }

  function resetAddGroup() {
    setAddingGroup(false)
    setNewGroupName("")
    setNewGroupDayId(null)
  }

  // --- Training day helpers ---

  function addDay() {
    const name = newDayName.trim()
    setAddingDay(false)
    setNewDayName("")
    if (!name) return
    const id = generateId(name)
    const newDay: TrainingDay = { id, name, order: trainingDays.length, muscleGroupIds: [] }
    persistDays([...trainingDays, newDay])
    setExpandedDayId(id)
  }

  function startRenameDay(day: TrainingDay) {
    setEditingDayId(day.id)
    setEditingDayName(day.name)
  }

  function saveRenameDay(id: string) {
    const name = editingDayName.trim()
    setEditingDayId(null)
    if (!name) return
    persistDays(trainingDays.map((d) => (d.id === id ? { ...d, name } : d)))
  }

  function deleteDay(day: TrainingDay) {
    if (!window.confirm(`Delete "${day.name}"? Its muscles stay in the list but won't be part of any training day.`)) return
    persistDays(trainingDays.filter((d) => d.id !== day.id))
    if (expandedDayId === day.id) setExpandedDayId(null)
  }

  function toggleMuscleInDay(dayId: string, muscleId: string) {
    persistDays(trainingDays.map((d) => {
      if (d.id !== dayId) return d
      const has = d.muscleGroupIds.includes(muscleId)
      return {
        ...d,
        muscleGroupIds: has
          ? d.muscleGroupIds.filter((id) => id !== muscleId)
          : [...d.muscleGroupIds, muscleId],
      }
    }))
  }

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
        <div className="h-4 w-16 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        <div className="h-6 w-48 bg-[#e8e8e8] rounded animate-pulse mb-6" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 bg-[#e8e8e8] rounded-xl animate-pulse mb-2" />
        ))}
      </main>
    )
  }

  // Cardio libraries are deliberately absent here: this list is both the split's
  // muscle groups and the chips a training day is built from, and cardio belongs to
  // neither. It gets its own section below.
  const sortedGroups = config
    .filter((g) => !g.retired && !g.cardio)
    .sort((a, b) => a.name.localeCompare(b.name))
  const cardioGroups = sortedCardioGroups(config)
  const sortedDays = [...trainingDays].sort((a, b) => a.order - b.order)
  const groupName = (id: string) => config.find((g) => g.id === id)?.name ?? id

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[#1e3a5f] mb-6 hover:underline"
      >
        ← Back
      </Link>

      <h1 className="text-2xl font-semibold text-[#111111] tracking-tight mb-1">
        Routine
      </h1>
      <p className="text-sm text-[#777777] mb-6">
        Your training days and the exercises in each.
      </p>

      {/* ─── Coach ─── */}
      {coach && (
        <div className="bg-[#f0f4f8] border border-[#dbe4ee] rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-[#111111]">
            Following{" "}
            <Link
              href={`/friends/${encodeURIComponent(coach.email)}`}
              className="font-semibold text-[#1e3a5f] hover:underline"
            >
              {coach.name}
            </Link>
            &apos;s routine. Only cardio is yours to edit.
          </p>
          <button
            onClick={stopFollowing}
            disabled={stopping}
            className="mt-1.5 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {stopping ? "Stopping…" : "Stop training under them"}
          </button>
        </div>
      )}

      {/* ─── Training Focus ─── */}
      <TrainingModeSelector />

      {/* ─── Training Days ─── */}
      <p className={SECTION_LABEL}>Training Days</p>

      <div className="space-y-2 mb-3">
        {sortedDays.map((day) => {
          const isExpanded = expandedDayId === day.id
          const isEditing = editingDayId === day.id
          const dayMuscleNames = day.muscleGroupIds.map(groupName).join(", ")

          return (
            <div
              key={day.id}
              className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                isExpanded ? "border-[#cfd9e5]" : "border-[#e8e8e8]"
              }`}
            >
              {isEditing ? (
                <div className="px-4 py-3.5">
                  <input
                    ref={renameDayInputRef}
                    value={editingDayName}
                    onChange={(e) => setEditingDayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRenameDay(day.id)
                      if (e.key === "Escape") setEditingDayId(null)
                    }}
                    onBlur={() => saveRenameDay(day.id)}
                    aria-label="Day name"
                    className="w-full text-sm font-semibold text-[#111111] border-b border-[#1e3a5f] outline-none bg-transparent py-0.5"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setExpandedDayId(isExpanded ? null : day.id)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#fafafa] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] truncate">{day.name}</p>
                    <p className="text-[11px] text-[#aaaaaa] mt-0.5 truncate">
                      {dayMuscleNames || "No muscles yet — tap to add"}
                    </p>
                  </div>
                  <Chevron open={isExpanded} />
                </button>
              )}

              {/* Expanded: which muscles this day trains, then the day's own actions */}
              {isExpanded && (
                <div className="border-t border-[#f0f0f0] px-4 pt-3 pb-3">
                  <p className="text-[11px] text-[#999999] mb-2">
                    {locked ? "Muscles trained this day" : "Tap to add or remove muscles"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {/* Locked, the unpicked chips would only look tappable: show the day's own */}
                    {sortedGroups
                      .filter((group) => !locked || day.muscleGroupIds.includes(group.id))
                      .map((group) => (
                      <button
                        key={group.id}
                        onClick={() => toggleMuscleInDay(day.id, group.id)}
                        disabled={locked}
                        aria-pressed={day.muscleGroupIds.includes(group.id)}
                        className={chipClass(day.muscleGroupIds.includes(group.id))}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                  {!locked && (
                    <div className="flex gap-4 mt-3 pt-3 border-t border-[#f5f5f5]">
                      <button
                        onClick={() => startRenameDay(day)}
                        className="text-xs font-semibold text-[#555555] hover:text-[#111111] transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => deleteDay(day)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                      >
                        Delete day
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add training day */}
      <div className="mb-8">
        {locked ? null : addingDay ? (
          <div className="border border-[#e8e8e8] rounded-xl px-4 py-4 bg-white">
            <input
              ref={addDayInputRef}
              value={newDayName}
              onChange={(e) => setNewDayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addDay()
                if (e.key === "Escape") { setAddingDay(false); setNewDayName("") }
              }}
              placeholder="Day name, e.g. Push"
              aria-label="New training day name"
              className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-1 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={addDay}
                disabled={!newDayName.trim()}
                className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors disabled:opacity-40"
              >
                Add day
              </button>
              <button
                onClick={() => { setAddingDay(false); setNewDayName("") }}
                className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingDay(true)} className={ADD_BUTTON}>
            + Add training day
          </button>
        )}
      </div>

      {/* ─── Muscle Groups ─── */}
      <p className={SECTION_LABEL}>Muscle Groups</p>

      <div className="bg-white border border-[#e8e8e8] rounded-xl overflow-hidden">
        {sortedGroups.map((group, idx) => {
          const exCount = group.exercises.length
          const days = sortedDays.filter((d) => d.muscleGroupIds.includes(group.id))

          return (
            <Link
              key={group.id}
              href={`/exercises/${group.id}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors ${
                idx < sortedGroups.length - 1 ? "border-b border-[#f5f5f5]" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111111] truncate">{group.name}</p>
                <p className="text-[11px] text-[#aaaaaa] mt-0.5 truncate">
                  {exCount === 0 ? "No exercises" : `${exCount} exercise${exCount !== 1 ? "s" : ""}`}
                  {" · "}
                  {days.length > 0 ? (
                    <span className="text-[#1e3a5f]">{days.map((d) => d.name).join(", ")}</span>
                  ) : (
                    <span className="text-amber-600">Not on a day</span>
                  )}
                </p>
              </div>
              <Chevron />
            </Link>
          )
        })}
      </div>

      {/* Add muscle group: name and day together, one step */}
      <div className="mt-3">
        {locked ? null : addingGroup ? (
          <div className="border border-[#e8e8e8] rounded-xl px-4 py-4 bg-white">
            <input
              ref={addGroupInputRef}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addGroupFinish()
                if (e.key === "Escape") resetAddGroup()
              }}
              placeholder="Muscle group, e.g. Abs"
              aria-label="New muscle group name"
              className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-1 mb-4"
            />
            <p className="text-[11px] text-[#999999] mb-2">Train it on</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setNewGroupDayId(null)}
                aria-pressed={newGroupDayId === null}
                className={chipClass(newGroupDayId === null)}
              >
                No day yet
              </button>
              {sortedDays.map((day) => (
                <button
                  key={day.id}
                  onClick={() => setNewGroupDayId(day.id)}
                  aria-pressed={newGroupDayId === day.id}
                  className={chipClass(newGroupDayId === day.id)}
                >
                  {day.name}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={addGroupFinish}
                disabled={!newGroupName.trim()}
                className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors disabled:opacity-40"
              >
                Add group
              </button>
              <button
                onClick={resetAddGroup}
                className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingGroup(true)} className={ADD_BUTTON}>
            + Add muscle group
          </button>
        )}
      </div>

      {/* ─── Cardio ─── */}
      {cardioGroups.length > 0 && (
        <>
          <p className={`${SECTION_LABEL} mt-8 !mb-1`}>Cardio</p>
          <p className="text-[11px] text-[#999999] mb-3">
            Logged in minutes. Add a bout from any session.
          </p>
          <div className="bg-white border border-[#e8e8e8] rounded-xl overflow-hidden">
            {cardioGroups.map((group, idx) => (
              <Link
                key={group.id}
                href={`/exercises/${group.id}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors ${
                  idx < cardioGroups.length - 1 ? "border-b border-[#f5f5f5]" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111111] truncate">{group.name}</p>
                  <p className="text-[11px] text-[#aaaaaa] mt-0.5">
                    {group.exercises.length === 0
                      ? "No exercises"
                      : `${group.exercises.length} exercise${group.exercises.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <Chevron />
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
