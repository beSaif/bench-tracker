"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  MuscleGroupConfig,
  ExerciseConfig,
  DEFAULT_MUSCLE_GROUPS,
  findSimilarExercises,
  generateId,
} from "@/lib/exerciseConfig"
import { loadExerciseConfigLocal, loadExerciseConfig, saveExerciseConfig } from "@/lib/storage"

export default function GroupPage() {
  const params = useParams()
  const groupId = String(params.groupId)

  const [config, setConfig] = useState<MuscleGroupConfig[]>(DEFAULT_MUSCLE_GROUPS)
  const [mounted, setMounted] = useState(false)

  const [editingExId, setEditingExId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const [addingExercise, setAddingExercise] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState("")
  const [similarWarning, setSimilarWarning] = useState<string[]>([])

  const renameInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConfig(loadExerciseConfigLocal())
    setMounted(true)
    loadExerciseConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (editingExId) renameInputRef.current?.focus()
  }, [editingExId])

  useEffect(() => {
    if (addingExercise) addInputRef.current?.focus()
  }, [addingExercise])

  function persist(newConfig: MuscleGroupConfig[]) {
    setConfig(newConfig)
    saveExerciseConfig(newConfig)
  }

  const group = config.find((g) => g.id === groupId)
  const sortedExercises = [...(group?.exercises ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  function startRename(ex: ExerciseConfig) {
    setEditingExId(ex.id)
    setEditingName(ex.name)
    setAddingExercise(false)
  }

  function saveRename() {
    if (!editingExId) return
    const name = editingName.trim()
    setEditingExId(null)
    if (!name) return
    persist(
      config.map((g) => {
        if (g.id !== groupId) return g
        return { ...g, exercises: g.exercises.map((e) => (e.id === editingExId ? { ...e, name } : e)) }
      })
    )
  }

  function deleteExercise(exId: string) {
    persist(
      config.map((g) => {
        if (g.id !== groupId) return g
        return { ...g, exercises: g.exercises.filter((e) => e.id !== exId) }
      })
    )
  }

  function handleNewNameChange(value: string) {
    setNewExerciseName(value)
    setSimilarWarning(value.trim().length >= 3 ? findSimilarExercises(value.trim(), config) : [])
  }

  function addExercise(force = false) {
    const name = newExerciseName.trim()
    if (!name) {
      setAddingExercise(false)
      setSimilarWarning([])
      return
    }
    if (!force && similarWarning.length > 0) return

    const id = generateId(name)
    const newEx: ExerciseConfig = { id, name, order: group?.exercises.length ?? 0 }
    persist(
      config.map((g) =>
        g.id === groupId ? { ...g, exercises: [...g.exercises, newEx] } : g
      )
    )
    setAddingExercise(false)
    setNewExerciseName("")
    setSimilarWarning([])
  }

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        <div className="h-4 w-16 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        <div className="h-6 w-40 bg-[#e8e8e8] rounded animate-pulse mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-[#e8e8e8] rounded-xl animate-pulse mb-2" />
        ))}
      </main>
    )
  }

  if (!group) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        <Link href="/exercises" className="inline-flex items-center gap-1 text-sm text-[#7a1f2e] mb-6 hover:underline">
          ← Back
        </Link>
        <p className="text-sm text-[#777777]">Group not found.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 py-6 pb-16">
      <Link
        href="/exercises"
        className="inline-flex items-center gap-1 text-sm text-[#7a1f2e] mb-6 hover:underline"
      >
        ← Back
      </Link>

      <h1 className="text-2xl font-semibold text-[#111111] tracking-tight mb-1">
        {group.name}
      </h1>
      <p className="text-sm text-[#777777] mb-6">
        {sortedExercises.length === 0
          ? "No exercises yet — add one below"
          : `${sortedExercises.length} exercise${sortedExercises.length !== 1 ? "s" : ""}, sorted A–Z`}
      </p>

      {/* Exercise list */}
      <div className="bg-white border border-[#e8e8e8] rounded-xl overflow-hidden mb-4">
        {sortedExercises.length === 0 && !addingExercise && (
          <p className="text-sm text-[#aaaaaa] px-4 py-4">No exercises yet.</p>
        )}

        {sortedExercises.map((ex, idx) => {
          const isEditing = editingExId === ex.id
          return (
            <div
              key={ex.id}
              className={`flex items-center gap-2 px-4 py-3 ${
                idx < sortedExercises.length - 1 ? "border-b border-[#f5f5f5]" : ""
              }`}
            >
              {isEditing ? (
                <input
                  ref={renameInputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename()
                    if (e.key === "Escape") setEditingExId(null)
                  }}
                  onBlur={saveRename}
                  className="flex-1 text-sm text-[#111111] border-b border-[#7a1f2e] outline-none bg-transparent py-0.5"
                />
              ) : (
                <span className="flex-1 text-sm text-[#333333]">{ex.name}</span>
              )}

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => startRename(ex)}
                  className="p-1.5 text-[#aaaaaa] hover:text-[#555555] transition-colors"
                  aria-label="Rename exercise"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteExercise(ex.id)}
                  className="p-1.5 text-[#aaaaaa] hover:text-red-400 transition-colors"
                  aria-label="Delete exercise"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2,3 11,3" />
                    <path d="M4 3V2h5v1" />
                    <rect x="3" y="4" width="7" height="7" rx="1" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        {/* Inline add input */}
        {addingExercise && (
          <div className={`px-4 py-3 ${sortedExercises.length > 0 ? "border-t border-[#f5f5f5]" : ""}`}>
            <input
              ref={addInputRef}
              value={newExerciseName}
              onChange={(e) => handleNewNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addExercise()
                if (e.key === "Escape") { setAddingExercise(false); setSimilarWarning([]) }
              }}
              placeholder="Exercise name"
              className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#7a1f2e] outline-none bg-transparent pb-1 mb-2"
            />
            {similarWarning.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] text-amber-600">
                  Similar already exists: {similarWarning.join(", ")}
                </p>
                <button
                  onClick={() => addExercise(true)}
                  className="text-[11px] text-[#7a1f2e] font-semibold underline mt-0.5"
                >
                  Add anyway
                </button>
              </div>
            )}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => addExercise()}
                className="text-xs font-semibold text-white bg-[#7a1f2e] rounded-lg px-4 py-1.5 hover:bg-[#6a1926] transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setAddingExercise(false); setSimilarWarning([]) }}
                className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add exercise button */}
      {!addingExercise && (
        <button
          onClick={() => { setAddingExercise(true); setNewExerciseName(""); setSimilarWarning([]) }}
          className="w-full border border-dashed border-[#e8e8e8] rounded-xl py-3 text-sm font-semibold text-[#aaaaaa] hover:border-[#7a1f2e] hover:text-[#7a1f2e] transition-colors"
        >
          + Add exercise
        </button>
      )}
    </main>
  )
}
