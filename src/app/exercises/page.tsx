"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  MuscleGroupConfig,
  DEFAULT_MUSCLE_GROUPS,
  generateId,
} from "@/lib/exerciseConfig"
import { loadExerciseConfigLocal, loadExerciseConfig, saveExerciseConfig } from "@/lib/storage"

export default function ExercisesPage() {
  const [config, setConfig] = useState<MuscleGroupConfig[]>(DEFAULT_MUSCLE_GROUPS)
  const [mounted, setMounted] = useState(false)

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState("")

  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  const renameInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConfig(loadExerciseConfigLocal())
    setMounted(true)
    loadExerciseConfig().then(setConfig)
  }, [])

  useEffect(() => {
    if (editingGroupId) renameInputRef.current?.focus()
  }, [editingGroupId])

  useEffect(() => {
    if (addingGroup) addInputRef.current?.focus()
  }, [addingGroup])

  function persist(newConfig: MuscleGroupConfig[]) {
    setConfig(newConfig)
    saveExerciseConfig(newConfig)
  }

  function startRename(group: MuscleGroupConfig) {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
  }

  function saveRename(id: string) {
    const name = editingGroupName.trim()
    setEditingGroupId(null)
    if (!name) return
    persist(config.map((g) => (g.id === id ? { ...g, name } : g)))
  }

  function deleteGroup(group: MuscleGroupConfig) {
    const exCount = group.exercises.length
    const msg =
      exCount > 0
        ? `Delete "${group.name}" and its ${exCount} exercise${exCount !== 1 ? "s" : ""}? History is kept.`
        : `Delete "${group.name}"?`
    if (!window.confirm(msg)) return
    persist(config.filter((g) => g.id !== group.id))
  }

  function addGroup() {
    const name = newGroupName.trim()
    setAddingGroup(false)
    setNewGroupName("")
    if (!name) return
    const id = generateId(name)
    const newGroup: MuscleGroupConfig = { id, name, order: config.length, exercises: [] }
    persist([...config, newGroup])
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

  const sorted = [...config].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[#7a1f2e] mb-6 hover:underline"
      >
        ← Back
      </Link>

      <h1 className="text-2xl font-semibold text-[#111111] tracking-tight mb-1">
        Exercise Selection
      </h1>
      <p className="text-sm text-[#777777] mb-6">
        Tap a group to manage its exercises
      </p>

      {/* Muscle group list */}
      <div className="space-y-2">
        {sorted.map((group) => {
          const isEditing = editingGroupId === group.id
          const exCount = group.exercises.length

          return (
            <div
              key={group.id}
              className="flex items-center gap-2 bg-white border border-[#e8e8e8] rounded-xl overflow-hidden"
            >
              {/* Tappable name area → navigates to group page */}
              {isEditing ? (
                <div className="flex-1 px-4 py-3.5">
                  <input
                    ref={renameInputRef}
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(group.id)
                      if (e.key === "Escape") setEditingGroupId(null)
                    }}
                    onBlur={() => saveRename(group.id)}
                    className="w-full text-sm font-semibold text-[#111111] border-b border-[#7a1f2e] outline-none bg-transparent py-0.5"
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
                  </p>
                </Link>
              )}

              {/* Actions */}
              <div className="flex items-center gap-0.5 pr-2 shrink-0">
                <button
                  onClick={(e) => { e.preventDefault(); startRename(group) }}
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
              New Muscle Group
            </p>
            <input
              ref={addInputRef}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addGroup()
                if (e.key === "Escape") { setAddingGroup(false); setNewGroupName("") }
              }}
              placeholder="e.g. Abs"
              className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#7a1f2e] outline-none bg-transparent pb-1 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={addGroup}
                className="text-xs font-semibold text-white bg-[#7a1f2e] rounded-lg px-4 py-1.5 hover:bg-[#6a1926] transition-colors"
              >
                Add group
              </button>
              <button
                onClick={() => { setAddingGroup(false); setNewGroupName("") }}
                className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingGroup(true)}
            className="w-full border border-dashed border-[#e8e8e8] rounded-xl py-3 text-sm font-semibold text-[#aaaaaa] hover:border-[#7a1f2e] hover:text-[#7a1f2e] transition-colors"
          >
            + Add muscle group
          </button>
        )}
      </div>
    </main>
  )
}
