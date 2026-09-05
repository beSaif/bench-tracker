"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  MuscleGroupConfig,
  DEFAULT_MUSCLE_GROUPS,
  DEFAULT_TRAINING_DAYS,
  generateId,
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
} from "@/lib/storage"

export default function ExercisesPage() {
  const [config, setConfig] = useState<MuscleGroupConfig[]>(DEFAULT_MUSCLE_GROUPS)
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>(DEFAULT_TRAINING_DAYS)
  const [mounted, setMounted] = useState(false)

  // Muscle group editing
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState("")
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDayId, setNewGroupDayId] = useState<string | null>(null)
  const [newGroupStep, setNewGroupStep] = useState<"name" | "day">("name")

  // Training day editing
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [editingDayName, setEditingDayName] = useState("")
  const [addingDay, setAddingDay] = useState(false)
  const [newDayName, setNewDayName] = useState("")

  const renameGroupInputRef = useRef<HTMLInputElement>(null)
  const addGroupInputRef = useRef<HTMLInputElement>(null)
  const renameDayInputRef = useRef<HTMLInputElement>(null)
  const addDayInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConfig(loadExerciseConfigLocal())
    setTrainingDays(loadTrainingDaysLocal())
    setMounted(true)
    loadExerciseConfig().then(setConfig)
    loadTrainingDays().then(setTrainingDays)
  }, [])

  useEffect(() => {
    if (editingGroupId) renameGroupInputRef.current?.focus()
  }, [editingGroupId])

  useEffect(() => {
    if (addingGroup && newGroupStep === "name") addGroupInputRef.current?.focus()
  }, [addingGroup, newGroupStep])

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

  function startRenameGroup(group: MuscleGroupConfig) {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
  }

  function saveRenameGroup(id: string) {
    const name = editingGroupName.trim()
    setEditingGroupId(null)
    if (!name) return
    persistConfig(config.map((g) => (g.id === id ? { ...g, name } : g)))
  }

  function deleteGroup(group: MuscleGroupConfig) {
    const exCount = group.exercises.length
    const msg =
      exCount > 0
        ? `Delete "${group.name}" and its ${exCount} exercise${exCount !== 1 ? "s" : ""}? History is kept.`
        : `Delete "${group.name}"?`
    if (!window.confirm(msg)) return
    persistConfig(config.filter((g) => g.id !== group.id))
    // Remove from any training day
    persistDays(trainingDays.map((d) => ({
      ...d,
      muscleGroupIds: d.muscleGroupIds.filter((id) => id !== group.id),
    })))
  }

  function addGroupNameConfirm() {
    const name = newGroupName.trim()
    if (!name) return
    setNewGroupStep("day")
  }

  function addGroupFinish() {
    const name = newGroupName.trim()
    if (!name) {
      resetAddGroup()
      return
    }
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
    setNewGroupStep("name")
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

  const sortedGroups = [...config].sort((a, b) => a.name.localeCompare(b.name))
  const sortedDays = [...trainingDays].sort((a, b) => a.order - b.order)

  // Which muscles are already assigned to some day
  const assignedMuscles = new Set(trainingDays.flatMap((d) => d.muscleGroupIds))

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[#1e3a5f] mb-6 hover:underline"
      >
        ← Back
      </Link>

      <h1 className="text-2xl font-semibold text-[#111111] tracking-tight mb-1">
        Exercise Selection
      </h1>
      <p className="text-sm text-[#777777] mb-6">
        Organise muscle groups into training days
      </p>

      {/* ─── Training Focus ─── */}
      <TrainingModeSelector />

      {/* ─── Training Days ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
        Training Days
      </p>

      <div className="space-y-2 mb-4">
        {sortedDays.map((day) => {
          const isExpanded = expandedDayId === day.id
          const isEditing = editingDayId === day.id
          const dayMuscleNames = day.muscleGroupIds
            .map((id) => config.find((g) => g.id === id)?.name ?? id)
            .join(", ")

          return (
            <div
              key={day.id}
              className="bg-white border border-[#e8e8e8] rounded-xl overflow-hidden"
            >
              {/* Day header row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedDayId(isExpanded ? null : day.id)}
                  className="flex-1 px-4 py-3.5 text-left hover:bg-[#fafafa] transition-colors min-w-0"
                >
                  {isEditing ? (
                    <input
                      ref={renameDayInputRef}
                      value={editingDayName}
                      onChange={(e) => setEditingDayName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRenameDay(day.id)
                        if (e.key === "Escape") setEditingDayId(null)
                      }}
                      onBlur={() => saveRenameDay(day.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-sm font-semibold text-[#111111] border-b border-[#1e3a5f] outline-none bg-transparent py-0.5"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-[#111111] truncate">{day.name}</p>
                  )}
                  {!isEditing && (
                    <p className="text-[11px] text-[#aaaaaa] mt-0.5 truncate">
                      {dayMuscleNames || "No muscles assigned"}
                    </p>
                  )}
                </button>

                <div className="flex items-center gap-0.5 pr-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRenameDay(day) }}
                    className="p-2 text-[#aaaaaa] hover:text-[#555555] transition-colors"
                    aria-label="Rename day"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDay(day) }}
                    className="p-2 text-[#aaaaaa] hover:text-red-400 transition-colors"
                    aria-label="Delete day"
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,3 11,3" />
                      <path d="M4 3V2h5v1" />
                      <rect x="3" y="4" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                  <svg
                    width="7" height="12" viewBox="0 0 7 12" fill="none"
                    stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`mr-1 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="M1 1l5 5-5 5" />
                  </svg>
                </div>
              </div>

              {/* Expanded: muscle group toggles */}
              {isExpanded && (
                <div className="border-t border-[#f0f0f0] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
                    Muscles in this day
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sortedGroups.map((group) => {
                      const included = day.muscleGroupIds.includes(group.id)
                      return (
                        <button
                          key={group.id}
                          onClick={() => toggleMuscleInDay(day.id, group.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            included
                              ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                              : "bg-white text-[#777777] border-[#e8e8e8] hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
                          }`}
                        >
                          {group.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add training day */}
      <div className="mb-8">
        {addingDay ? (
          <div className="border border-[#e8e8e8] rounded-xl px-4 py-4 bg-white">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
              New Training Day
            </p>
            <input
              ref={addDayInputRef}
              value={newDayName}
              onChange={(e) => setNewDayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addDay()
                if (e.key === "Escape") { setAddingDay(false); setNewDayName("") }
              }}
              placeholder="e.g. Day D"
              className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-1 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={addDay}
                className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors"
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
          <button
            onClick={() => setAddingDay(true)}
            className="w-full border border-dashed border-[#e8e8e8] rounded-xl py-3 text-sm font-semibold text-[#aaaaaa] hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
          >
            + Add training day
          </button>
        )}
      </div>

      {/* ─── Muscle Groups ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
        Muscle Groups
      </p>

      <div className="space-y-2">
        {sortedGroups.map((group) => {
          const isEditing = editingGroupId === group.id
          const exCount = group.exercises.length
          const inDay = trainingDays.find((d) => d.muscleGroupIds.includes(group.id))

          return (
            <div
              key={group.id}
              className="flex items-center gap-2 bg-white border border-[#e8e8e8] rounded-xl overflow-hidden"
            >
              {isEditing ? (
                <div className="flex-1 px-4 py-3.5">
                  <input
                    ref={renameGroupInputRef}
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRenameGroup(group.id)
                      if (e.key === "Escape") setEditingGroupId(null)
                    }}
                    onBlur={() => saveRenameGroup(group.id)}
                    className="w-full text-sm font-semibold text-[#111111] border-b border-[#1e3a5f] outline-none bg-transparent py-0.5"
                  />
                </div>
              ) : (
                <Link
                  href={`/exercises/${group.id}`}
                  className="flex-1 px-4 py-3.5 hover:bg-[#fafafa] transition-colors min-w-0"
                >
                  <p className="text-sm font-semibold text-[#111111] truncate">{group.name}</p>
                  <p className="text-[11px] text-[#aaaaaa] mt-0.5">
                    {exCount === 0 ? "No exercises" : `${exCount} exercise${exCount !== 1 ? "s" : ""}`}
                    {inDay ? <span className="ml-1 text-[#1e3a5f]">· {inDay.name}</span> : null}
                  </p>
                </Link>
              )}

              <div className="flex items-center gap-0.5 pr-2 shrink-0">
                <button
                  onClick={(e) => { e.preventDefault(); startRenameGroup(group) }}
                  className="p-2 text-[#aaaaaa] hover:text-[#555555] transition-colors"
                  aria-label="Rename group"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); deleteGroup(group) }}
                  className="p-2 text-[#aaaaaa] hover:text-red-400 transition-colors"
                  aria-label="Delete group"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,3 11,3" />
                    <path d="M4 3V2h5v1" />
                    <rect x="3" y="4" width="7" height="7" rx="1" />
                  </svg>
                </button>
                {!isEditing && (
                  <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M1 1l5 5-5 5" />
                  </svg>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add muscle group */}
      <div className="mt-4">
        {addingGroup ? (
          <div className="border border-[#e8e8e8] rounded-xl px-4 py-4 bg-white">
            {newGroupStep === "name" ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
                  New Muscle Group
                </p>
                <input
                  ref={addGroupInputRef}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newGroupName.trim()) addGroupNameConfirm()
                    if (e.key === "Escape") resetAddGroup()
                  }}
                  placeholder="e.g. Abs"
                  className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-1 mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={addGroupNameConfirm}
                    disabled={!newGroupName.trim()}
                    className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors disabled:opacity-40"
                  >
                    Next
                  </button>
                  <button
                    onClick={resetAddGroup}
                    className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
                  Assign to training day
                </p>
                <p className="text-xs text-[#999999] mb-3">
                  Which day should <span className="font-semibold text-[#333333]">{newGroupName}</span> belong to?
                </p>
                <div className="space-y-1.5 mb-4">
                  <button
                    onClick={() => setNewGroupDayId(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      newGroupDayId === null
                        ? "bg-[#f0f4f8] border-[#1e3a5f] text-[#1e3a5f] font-semibold"
                        : "border-[#e8e8e8] text-[#777777] hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
                    }`}
                  >
                    None (unassigned)
                  </button>
                  {sortedDays.map((day) => (
                    <button
                      key={day.id}
                      onClick={() => setNewGroupDayId(day.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                        newGroupDayId === day.id
                          ? "bg-[#f0f4f8] border-[#1e3a5f] text-[#1e3a5f] font-semibold"
                          : "border-[#e8e8e8] text-[#777777] hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
                      }`}
                    >
                      {day.name}
                      {day.muscleGroupIds.length > 0 && (
                        <span className="text-[#aaaaaa] font-normal ml-1 text-xs">
                          ({day.muscleGroupIds.map((id) => config.find((g) => g.id === id)?.name ?? id).join(", ")})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={addGroupFinish}
                    className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors"
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
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAddingGroup(true)}
            className="w-full border border-dashed border-[#e8e8e8] rounded-xl py-3 text-sm font-semibold text-[#aaaaaa] hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
          >
            + Add muscle group
          </button>
        )}
      </div>
    </main>
  )
}
