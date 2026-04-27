"use client"

import { useState, useEffect, useRef, ButtonHTMLAttributes, ReactNode } from "react"
import Link from "next/link"
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
import {
  MuscleGroupConfig,
  ExerciseConfig,
  DEFAULT_MUSCLE_GROUPS,
  sortedMuscleGroups,
  findSimilarExercises,
  generateId,
} from "@/lib/exerciseConfig"
import { loadExerciseConfigLocal, loadExerciseConfig, saveExerciseConfig } from "@/lib/storage"

// ─── Drag handle icon ────────────────────────────────────────────────────────
function DragHandle(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="p-2 text-[#cccccc] touch-none cursor-grab active:cursor-grabbing shrink-0"
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
  )
}

// ─── Sortable exercise row ───────────────────────────────────────────────────
function SortableExerciseRow({
  exercise,
  groupId,
  isEditing,
  editName,
  onEditNameChange,
  onStartRename,
  onSaveRename,
  onDelete,
}: {
  exercise: ExerciseConfig
  groupId: string
  isEditing: boolean
  editName: string
  onEditNameChange: (v: string) => void
  onStartRename: () => void
  onSaveRename: () => void
  onDelete: () => void
}) {
  const dndId = `ex:${groupId}:${exercise.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dndId })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-2.5 border-b border-[#f5f5f5] last:border-b-0 ${
        isDragging ? "bg-white shadow-sm rounded-lg z-10 relative opacity-80" : ""
      }`}
    >
      <DragHandle {...attributes} {...listeners} />

      {isEditing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveRename()
            if (e.key === "Escape") onSaveRename()
          }}
          onBlur={onSaveRename}
          className="flex-1 text-sm text-[#111111] border-b border-[#7a1f2e] outline-none bg-transparent py-0.5"
        />
      ) : (
        <span className="flex-1 text-sm text-[#333333]">{exercise.name}</span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onStartRename}
          className="p-1.5 text-[#aaaaaa] hover:text-[#555555] transition-colors"
          aria-label="Rename exercise"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
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
}

// ─── Sortable muscle group row ───────────────────────────────────────────────
function SortableMuscleGroupRow({
  group,
  isExpanded,
  isEditing,
  editName,
  onEditNameChange,
  onToggle,
  onStartRename,
  onSaveRename,
  onDelete,
  children,
}: {
  group: MuscleGroupConfig
  isExpanded: boolean
  isEditing: boolean
  editName: string
  onEditNameChange: (v: string) => void
  onToggle: () => void
  onStartRename: () => void
  onSaveRename: () => void
  onDelete: () => void
  children?: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `mg:${group.id}` })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : ""}>
      {/* Group header */}
      <div className="flex items-center gap-2 bg-white border border-[#e8e8e8] rounded-xl px-2 py-1 mb-1">
        <DragHandle {...attributes} {...listeners} />

        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveRename()
              if (e.key === "Escape") onSaveRename()
            }}
            onBlur={onSaveRename}
            className="flex-1 text-sm font-semibold text-[#111111] border-b border-[#7a1f2e] outline-none bg-transparent py-0.5"
          />
        ) : (
          <span className="flex-1 text-sm font-semibold text-[#111111]">{group.name}</span>
        )}

        <button
          onClick={onStartRename}
          className="p-1.5 text-[#aaaaaa] hover:text-[#555555] transition-colors shrink-0"
          aria-label="Rename group"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 1.5l2 2L4 11H2v-2L9.5 1.5z" />
          </svg>
        </button>

        <button
          onClick={onToggle}
          className="p-1.5 text-[#aaaaaa] hover:text-[#555555] transition-colors shrink-0"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <svg
            width="12" height="8" viewBox="0 0 12 8" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          >
            <path d="M1 1l5 5 5-5" />
          </svg>
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="ml-8 border border-[#f0f0f0] rounded-xl mb-2 bg-white overflow-hidden">
          {children}

          {/* Delete group — at the bottom of expanded section */}
          <div className="px-4 py-3 border-t border-[#f5f5f5]">
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
            >
              Delete {group.name}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add exercise inline input ────────────────────────────────────────────────
function AddExerciseInput({
  value,
  onChange,
  onAdd,
  onCancel,
  similarWarning,
}: {
  value: string
  onChange: (v: string) => void
  onAdd: (force?: boolean) => void
  onCancel: () => void
  similarWarning: string[]
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="px-4 py-3 border-t border-[#f5f5f5]">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd()
          if (e.key === "Escape") onCancel()
        }}
        placeholder="Exercise name"
        className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#7a1f2e] outline-none bg-transparent pb-1 mb-2"
      />
      {similarWarning.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] text-amber-600 mb-1">
            Similar already exists: {similarWarning.join(", ")}
          </p>
          <button
            onClick={() => onAdd(true)}
            className="text-[11px] text-[#7a1f2e] font-semibold underline"
          >
            Add anyway
          </button>
        </div>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => onAdd()}
          className="text-xs font-semibold text-white bg-[#7a1f2e] rounded-lg px-4 py-1.5 hover:bg-[#6a1926] transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ExercisesPage() {
  const [config, setConfig] = useState<MuscleGroupConfig[]>(DEFAULT_MUSCLE_GROUPS)
  const [mounted, setMounted] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Rename state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState("")
  const [editingExercise, setEditingExercise] = useState<{ groupId: string; exId: string } | null>(null)
  const [editingExerciseName, setEditingExerciseName] = useState("")

  // Add exercise
  const [addingExerciseTo, setAddingExerciseTo] = useState<string | null>(null)
  const [newExerciseName, setNewExerciseName] = useState("")
  const [similarWarning, setSimilarWarning] = useState<string[]>([])

  // Add muscle group
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    const local = loadExerciseConfigLocal()
    setConfig(local)
    setMounted(true)
    loadExerciseConfig().then(setConfig)
  }, [])

  function persist(newConfig: MuscleGroupConfig[]) {
    setConfig(newConfig)
    saveExerciseConfig(newConfig)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith("mg:") && overId.startsWith("mg:")) {
      const fromId = activeId.slice(3)
      const toId = overId.slice(3)
      const sorted = sortedMuscleGroups(config)
      const oldIdx = sorted.findIndex((g) => g.id === fromId)
      const newIdx = sorted.findIndex((g) => g.id === toId)
      if (oldIdx === -1 || newIdx === -1) return
      persist(arrayMove(sorted, oldIdx, newIdx).map((g, i) => ({ ...g, order: i })))
    } else if (activeId.startsWith("ex:") && overId.startsWith("ex:")) {
      const parts = activeId.split(":")
      const groupId = parts[1]
      const fromExId = parts[2]
      const toParts = overId.split(":")
      const toExId = toParts[2]
      persist(
        config.map((g) => {
          if (g.id !== groupId) return g
          const sorted = [...g.exercises].sort((a, b) => a.order - b.order)
          const oldIdx = sorted.findIndex((e) => e.id === fromExId)
          const newIdx = sorted.findIndex((e) => e.id === toExId)
          if (oldIdx === -1 || newIdx === -1) return g
          return { ...g, exercises: arrayMove(sorted, oldIdx, newIdx).map((e, i) => ({ ...e, order: i })) }
        })
      )
    }
  }

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // Close any open add/edit states for that group
    if (addingExerciseTo === id) {
      setAddingExerciseTo(null)
      setSimilarWarning([])
    }
  }

  // ── Group rename ────────────────────────────────────────────────────────────
  function startRenameGroup(group: MuscleGroupConfig) {
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
    setEditingExercise(null)
  }

  function saveRenameGroup(id: string) {
    const name = editingGroupName.trim()
    setEditingGroupId(null)
    if (!name) return
    persist(config.map((g) => (g.id === id ? { ...g, name } : g)))
  }

  // ── Group delete ────────────────────────────────────────────────────────────
  function deleteGroup(group: MuscleGroupConfig) {
    const exCount = group.exercises.length
    const msg = exCount > 0
      ? `Delete "${group.name}" and its ${exCount} exercise${exCount !== 1 ? "s" : ""}? History is kept.`
      : `Delete "${group.name}"?`
    if (!window.confirm(msg)) return
    const remaining = sortedMuscleGroups(config)
      .filter((g) => g.id !== group.id)
      .map((g, i) => ({ ...g, order: i }))
    persist(remaining)
    setExpandedGroups((prev) => { const next = new Set(prev); next.delete(group.id); return next })
  }

  // ── Group add ───────────────────────────────────────────────────────────────
  function addGroup() {
    const name = newGroupName.trim()
    setAddingGroup(false)
    setNewGroupName("")
    if (!name) return
    const id = generateId(name)
    const newGroup: MuscleGroupConfig = { id, name, order: config.length, exercises: [] }
    persist([...config, newGroup])
    setExpandedGroups((prev) => new Set([...prev, id]))
  }

  // ── Exercise rename ─────────────────────────────────────────────────────────
  function startRenameExercise(groupId: string, ex: ExerciseConfig) {
    setEditingExercise({ groupId, exId: ex.id })
    setEditingExerciseName(ex.name)
    setEditingGroupId(null)
  }

  function saveRenameExercise() {
    if (!editingExercise) return
    const name = editingExerciseName.trim()
    setEditingExercise(null)
    if (!name) return
    persist(
      config.map((g) => {
        if (g.id !== editingExercise.groupId) return g
        return { ...g, exercises: g.exercises.map((e) => e.id === editingExercise.exId ? { ...e, name } : e) }
      })
    )
  }

  // ── Exercise delete ─────────────────────────────────────────────────────────
  function deleteExercise(groupId: string, exId: string) {
    persist(
      config.map((g) => {
        if (g.id !== groupId) return g
        const remaining = g.exercises
          .filter((e) => e.id !== exId)
          .map((e, i) => ({ ...e, order: i }))
        return { ...g, exercises: remaining }
      })
    )
  }

  // ── Exercise add ────────────────────────────────────────────────────────────
  function handleAddExerciseChange(value: string) {
    setNewExerciseName(value)
    if (value.trim().length >= 3) {
      setSimilarWarning(findSimilarExercises(value.trim(), config))
    } else {
      setSimilarWarning([])
    }
  }

  function addExercise(groupId: string, force = false) {
    const name = newExerciseName.trim()
    if (!name) {
      setAddingExerciseTo(null)
      setSimilarWarning([])
      return
    }
    if (!force && similarWarning.length > 0) return

    const group = config.find((g) => g.id === groupId)
    if (!group) return
    const id = generateId(name)
    const newEx: ExerciseConfig = { id, name, order: group.exercises.length }
    persist(config.map((g) => (g.id === groupId ? { ...g, exercises: [...g.exercises, newEx] } : g)))
    setAddingExerciseTo(null)
    setNewExerciseName("")
    setSimilarWarning([])
  }

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        <div className="h-4 w-16 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        <div className="h-6 w-48 bg-[#e8e8e8] rounded animate-pulse mb-6" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-[#e8e8e8] rounded-xl animate-pulse mb-2" />
        ))}
      </main>
    )
  }

  const sorted = sortedMuscleGroups(config)

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 py-6 pb-16">
      {/* Back */}
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
        Drag to reorder · tap ✎ to rename · expand to add or delete
      </p>

      {/* Muscle group list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sorted.map((g) => `mg:${g.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {sorted.map((group) => {
            const isExpanded = expandedGroups.has(group.id)
            const sortedExercises = [...group.exercises].sort((a, b) => a.order - b.order)
            const isEditingGroup = editingGroupId === group.id

            return (
              <SortableMuscleGroupRow
                key={group.id}
                group={group}
                isExpanded={isExpanded}
                isEditing={isEditingGroup}
                editName={editingGroupName}
                onEditNameChange={setEditingGroupName}
                onToggle={() => toggleGroup(group.id)}
                onStartRename={() => startRenameGroup(group)}
                onSaveRename={() => saveRenameGroup(group.id)}
                onDelete={() => deleteGroup(group)}
              >
                {/* Exercise list within expanded group */}
                <SortableContext
                  items={sortedExercises.map((e) => `ex:${group.id}:${e.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedExercises.length === 0 && addingExerciseTo !== group.id && (
                    <p className="text-xs text-[#aaaaaa] px-4 py-3">No exercises yet.</p>
                  )}
                  <div className="px-2">
                    {sortedExercises.map((ex) => (
                      <SortableExerciseRow
                        key={ex.id}
                        exercise={ex}
                        groupId={group.id}
                        isEditing={
                          editingExercise?.groupId === group.id &&
                          editingExercise?.exId === ex.id
                        }
                        editName={editingExerciseName}
                        onEditNameChange={setEditingExerciseName}
                        onStartRename={() => startRenameExercise(group.id, ex)}
                        onSaveRename={saveRenameExercise}
                        onDelete={() => deleteExercise(group.id, ex.id)}
                      />
                    ))}
                  </div>
                </SortableContext>

                {/* Add exercise */}
                {addingExerciseTo === group.id ? (
                  <AddExerciseInput
                    value={newExerciseName}
                    onChange={handleAddExerciseChange}
                    onAdd={(force) => addExercise(group.id, force)}
                    onCancel={() => { setAddingExerciseTo(null); setSimilarWarning([]) }}
                    similarWarning={similarWarning}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setAddingExerciseTo(group.id)
                      setNewExerciseName("")
                      setSimilarWarning([])
                    }}
                    className="w-full text-left px-4 py-3 text-xs font-semibold text-[#7a1f2e] hover:bg-[#fdf5f6] transition-colors border-t border-[#f5f5f5]"
                  >
                    + Add exercise
                  </button>
                )}
              </SortableMuscleGroupRow>
            )
          })}
        </SortableContext>
      </DndContext>

      {/* Add muscle group */}
      <div className="mt-4">
        {addingGroup ? (
          <div className="border border-[#e8e8e8] rounded-xl px-4 py-4 bg-white">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
              New Muscle Group
            </p>
            <input
              autoFocus
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
            onClick={() => { setAddingGroup(true); setNewGroupName("") }}
            className="w-full border border-dashed border-[#e8e8e8] rounded-xl py-3 text-sm font-semibold text-[#aaaaaa] hover:border-[#7a1f2e] hover:text-[#7a1f2e] transition-colors"
          >
            + Add muscle group
          </button>
        )}
      </div>
    </main>
  )
}
