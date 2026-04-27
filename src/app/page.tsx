"use client"

import { useState, useEffect, useRef } from "react"
import { Session, TrainingBlock, BlockPhase, MuscleGroup } from "@/lib/types"
import { loadSessionsLocal, loadBlocksLocal, loadAll, saveAll, loadDraft, clearDraft } from "@/lib/storage"
import type { SessionDraft } from "@/lib/types"
import {
  prescribeBlockSession,
  createNextBlock,
  deriveInitialAnchor,
  migrateSessionTypes,
  BLOCK_LENGTHS,
  PHASE_LABEL,
} from "@/lib/prescription"
import { generateWarmups } from "@/lib/warmup"
import { calcE1RM, roundToPlate } from "@/lib/e1rm"
import SessionCard from "@/components/SessionCard"
import BlockHeader from "@/components/BlockHeader"
import ProgramTimeline from "@/components/ProgramTimeline"
import StatsGrid from "@/components/StatsGrid"
import ProgressBar from "@/components/ProgressBar"
import LogSessionModal from "@/components/LogSessionModal"

const TARGET = 140
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const MUSCLE_ROTATION: MuscleGroup[][] = [
  ["back", "triceps"],
  ["chest", "biceps"],
  ["shoulders", "legs"],
]

function suggestNextMuscles(confirmedSessions: Session[]): MuscleGroup[] {
  const last = [...confirmedSessions]
    .filter((s) => s.date && s.extraWorkouts && s.extraWorkouts.length > 0)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())[0]

  if (!last) return MUSCLE_ROTATION[0]

  const lastMuscles = last.extraWorkouts!.map((w) => w.muscle)
  let bestIdx = 0
  let bestScore = -1
  MUSCLE_ROTATION.forEach((pair, i) => {
    const score = pair.filter((m) => lastMuscles.includes(m)).length
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })
  return MUSCLE_ROTATION[(bestIdx + 1) % MUSCLE_ROTATION.length]
}

function getBestE1RM(sessions: Session[]): number | null {
  const validSets = sessions
    .filter((s) => s.confirmed && s.date != null && s.type !== "Deload")
    .flatMap((s) => s.sets.filter((set) => !set.isWarmup))
    .map((set) => set.e1rm)
    .filter((v): v is number => v != null)
  return validSets.length > 0 ? Math.max(...validSets) : null
}

function getBestWeight(sessions: Session[]): number | null {
  const all = sessions
    .filter((s) => s.confirmed)
    .flatMap((s) => s.sets.filter((set) => !set.isWarmup))
    .map((s) => s.kg)
    .filter((v): v is number => v != null)
  return all.length > 0 ? Math.max(...all) : null
}

function getLatestBW(sessions: Session[]): number | null {
  const withBW = sessions
    .filter((s) => s.confirmed && s.bw != null && s.date != null)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  return withBW[0]?.bw ?? null
}

function getActiveBlock(blocks: TrainingBlock[]): TrainingBlock | undefined {
  return blocks.find((b) => b.status === "active")
}

const BLOCK_PHASE_ORDER: BlockPhase[] = ["accumulation", "transmutation", "realization", "deload"]

function getCurrentCycleCompletedBlocks(blocks: TrainingBlock[]): TrainingBlock[] {
  const active = getActiveBlock(blocks)
  if (!active) return []
  const sorted = [...blocks].sort((a, b) => a.id - b.id)
  const activeIdx = sorted.findIndex((b) => b.id === active.id)
  const phaseIdx = BLOCK_PHASE_ORDER.indexOf(active.phase)
  return sorted.slice(activeIdx - phaseIdx, activeIdx)
}

function createUpcomingSession(sessions: Session[], blocks: TrainingBlock[]): Session {
  const activeBlock = getActiveBlock(blocks)

  let prescription: ReturnType<typeof prescribeBlockSession>
  let blockId: number | undefined

  if (activeBlock) {
    const sessionIndexInBlock = activeBlock.sessionIds.length
    prescription = prescribeBlockSession(activeBlock.phase, sessionIndexInBlock, activeBlock.anchorWeight)
    blockId = activeBlock.id
  } else {
    // Fallback if no active block (shouldn't happen in normal flow)
    prescription = prescribeBlockSession("accumulation", 0, 100)
  }

  const warmups = generateWarmups(prescription.weight)
  const workingSets = Array.from({ length: prescription.sets }, (_, i) => ({
    id: `S${i + 1}`,
    kg: prescription.weight,
    reps: prescription.reps,
    rpe: null as null,
    e1rm: calcE1RM(prescription.weight, prescription.reps),
    note: "",
    isWarmup: false,
  }))
  const maxId = sessions.length > 0 ? Math.max(...sessions.map((s) => s.id)) : 0

  const sessionIndex = activeBlock ? activeBlock.sessionIds.length : 0
  const phase = activeBlock?.phase ?? "accumulation"
  const coachNote = `[${PHASE_LABEL[phase]} ${sessionIndex + 1}/${BLOCK_LENGTHS[phase]}] ${prescription.weight}kg × ${prescription.reps} × ${prescription.sets}. Stay tight, drive the legs.`

  return {
    id: maxId + 1,
    date: null,
    type: prescription.sessionType,
    bw: null,
    confirmed: false,
    coachNote,
    sets: [...warmups, ...workingSets],
    selectedMuscleGroups: suggestNextMuscles(sessions),
    blockId,
  }
}

function initializeFirstBlock(confirmedSessions: Session[]): TrainingBlock {
  return {
    id: 1,
    phase: "accumulation",
    status: "active",
    sessionIds: [],
    anchorWeight: deriveInitialAnchor(confirmedSessions),
    startDate: null,
    endDate: null,
  }
}

function backfillMuscles(sessions: Session[]): Session[] {
  const upcoming = sessions.find((s) => !s.confirmed)
  if (!upcoming || upcoming.selectedMuscleGroups !== undefined) return sessions
  const confirmed = sessions.filter((s) => s.confirmed)
  const suggested = suggestNextMuscles(confirmed)
  return sessions.map((s) =>
    s.id === upcoming.id ? { ...s, selectedMuscleGroups: suggested } : s
  )
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (!a.confirmed) return -1
    if (!b.confirmed) return 1
    return new Date(b.date!).getTime() - new Date(a.date!).getTime()
  })
}

export default function Page() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [loggingSession, setLoggingSession] = useState<Session | null>(null)
  const [activeDraft, setActiveDraft] = useState<SessionDraft | null>(null)
  const [draftPrompt, setDraftPrompt] = useState<{ session: Session; draft: SessionDraft } | null>(null)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [anchorPrompt, setAnchorPrompt] = useState(false)
  const [anchorInput, setAnchorInput] = useState("")
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTitlePointerDown() {
    longPressTimer.current = setTimeout(() => {
      window.location.href = "/dev"
    }, 800)
  }

  function handleTitlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => {
    // Show localStorage data immediately
    const localSessions = loadSessionsLocal()
    const localBlocks = loadBlocksLocal()
    if (localSessions.length > 0) setSessions(backfillMuscles(localSessions))
    if (localBlocks.length > 0) setBlocks(localBlocks)
    setMounted(true)

    loadAll().then(({ sessions: data, blocks: loadedBlocks }) => {
      let finalSessions = backfillMuscles(data)

      // One-time migration for historical "Push" sessions
      const migrated = migrateSessionTypes(finalSessions)
      if (migrated !== null) finalSessions = migrated

      let finalBlocks = loadedBlocks

      // First-time block setup: no blocks exist yet — prompt user for anchor
      if (finalBlocks.length === 0) {
        const confirmed = finalSessions.filter((s) => s.confirmed)
        setSessions(confirmed)
        setAnchorInput(String(deriveInitialAnchor(confirmed)))
        setAnchorPrompt(true)
        return
      }

      // Normal load: ensure an upcoming session exists
      const hasUpcoming = finalSessions.some((s) => !s.confirmed)
      if (!hasUpcoming) {
        const confirmed = finalSessions.filter((s) => s.confirmed)
        const upcoming = createUpcomingSession(confirmed, finalBlocks)
        finalSessions = sortSessions([...confirmed, upcoming])
        saveAll(finalSessions, finalBlocks)
      }

      setSessions(finalSessions)
      setBlocks(finalBlocks)
    })
  }, [])

  function handleStartLogging(session: Session) {
    const draft = loadDraft()
    const isLive =
      draft !== null &&
      draft.sessionId === session.id &&
      draft.completedSets.length > 0 &&
      Date.now() - new Date(draft.savedAt).getTime() < DRAFT_MAX_AGE_MS

    if (isLive) {
      setDraftPrompt({ session: JSON.parse(JSON.stringify(session)), draft })
    } else {
      setLoggingSession(JSON.parse(JSON.stringify(session)))
    }
  }

  function handleEditAnchor() {
    const active = getActiveBlock(blocks)
    setAnchorInput(active ? String(active.anchorWeight) : "")
    setAnchorPrompt(true)
  }

  function handleConfirmAnchor() {
    const parsed = parseFloat(anchorInput)
    if (isNaN(parsed) || parsed <= 0) return
    const anchor = roundToPlate(parsed)
    const confirmed = sessions.filter((s) => s.confirmed)
    const activeBlock = getActiveBlock(blocks)

    let finalBlocks: TrainingBlock[]
    if (activeBlock) {
      // Edit existing block's anchor
      finalBlocks = blocks.map((b) =>
        b.id === activeBlock.id ? { ...b, anchorWeight: anchor } : b
      )
    } else {
      // First-time init
      finalBlocks = [{
        id: 1,
        phase: "accumulation",
        status: "active",
        sessionIds: [],
        anchorWeight: anchor,
        startDate: null,
        endDate: null,
      }]
    }

    const upcoming = createUpcomingSession(confirmed, finalBlocks)
    const finalSessions = sortSessions([...confirmed, upcoming])
    saveAll(finalSessions, finalBlocks)
    setSessions(finalSessions)
    setBlocks(finalBlocks)
    setAnchorPrompt(false)
  }

  function handleConfirmSession(updatedSession: Session) {
    const currentSessions = sessions
    const currentBlocks = blocks

    // Update sessions array with the confirmed session
    const updatedSessions = currentSessions.map((s) =>
      s.id === updatedSession.id ? { ...updatedSession, blockId: updatedSession.blockId } : s
    )
    const confirmedSessions = updatedSessions.filter((s) => s.confirmed)

    // Find active block and add this session to it
    const activeBlock = getActiveBlock(currentBlocks)
    let finalBlocks = currentBlocks

    if (activeBlock) {
      const updatedBlockSessionIds = [...activeBlock.sessionIds, updatedSession.id]
      const isBlockComplete = updatedBlockSessionIds.length >= BLOCK_LENGTHS[activeBlock.phase]

      if (isBlockComplete) {
        // Complete this block and create the next one
        const completedBlock: TrainingBlock = {
          ...activeBlock,
          sessionIds: updatedBlockSessionIds,
          status: "completed",
          endDate: updatedSession.date ?? null,
        }
        const maxBlockId = Math.max(...currentBlocks.map((b) => b.id))
        const newBlock = createNextBlock(completedBlock, confirmedSessions, maxBlockId + 1)
        finalBlocks = currentBlocks
          .map((b) => (b.id === activeBlock.id ? completedBlock : b))
          .concat(newBlock)
      } else {
        // Update the block's session list
        finalBlocks = currentBlocks.map((b) =>
          b.id === activeBlock.id ? { ...b, sessionIds: updatedBlockSessionIds } : b
        )
      }
    }

    // Create the next upcoming session
    const newUpcoming = createUpcomingSession(confirmedSessions, finalBlocks)
    const final = sortSessions([...confirmedSessions, newUpcoming])

    setSessions(final)
    setBlocks(finalBlocks)
    saveAll(final, finalBlocks)
    setLoggingSession(null)
    setActiveDraft(null)
  }

  function handleCloseModal() {
    setLoggingSession(null)
    setActiveDraft(null)
  }

  function handleEditSession(session: Session) {
    setEditingSession(JSON.parse(JSON.stringify(session)))
  }

  function handleSaveEdit(updatedSession: Session) {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === updatedSession.id ? updatedSession : s
      )
      saveAll(updated, blocks)
      return updated
    })
    setEditingSession(null)
  }

  function handleUpdateMuscleGroups(session: Session, groups: MuscleGroup[]) {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === session.id ? { ...s, selectedMuscleGroups: groups } : s
      )
      saveAll(updated, blocks)
      return updated
    })
  }

  function handleUnlogSession(session: Session) {
    if (!window.confirm(`Unlog Session ${String(session.id).padStart(2, "0")}? This will remove it from your history.`)) return

    const remaining = sessions.filter((s) => s.confirmed && s.id !== session.id)

    // Update blocks: remove session from its block, revert block if it was completed
    const sessionBlockId = session.blockId
    let newBlocks = blocks
      .filter((b) => {
        // Remove any blocks created after the affected block
        if (sessionBlockId !== undefined && b.id > sessionBlockId) return false
        return true
      })
      .map((b) => {
        if (b.id !== sessionBlockId) return b
        return {
          ...b,
          sessionIds: b.sessionIds.filter((id) => id !== session.id),
          status: "active" as const,
          endDate: null,
        }
      })

    // If no active block remains, the last block becomes active
    if (!getActiveBlock(newBlocks) && newBlocks.length > 0) {
      const lastBlock = newBlocks[newBlocks.length - 1]
      newBlocks = newBlocks.map((b) =>
        b.id === lastBlock.id ? { ...b, status: "active" as const } : b
      )
    }

    const newUpcoming = createUpcomingSession(remaining, newBlocks)
    const final = sortSessions([...remaining, newUpcoming])

    setSessions(final)
    setBlocks(newBlocks)
    saveAll(final, newBlocks)
  }

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        <div className="h-8 w-40 bg-[#e8e8e8] rounded animate-pulse mb-1" />
        <div className="h-4 w-24 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        <div className="h-[2px] w-full bg-[#e8e8e8] rounded mb-6" />
        <div className="grid grid-cols-2 border border-[#e8e8e8] rounded-[10px] overflow-hidden mb-6 h-24" />
      </main>
    )
  }

  const confirmed = sessions.filter((s) => s.confirmed)
  const upcoming = sessions.find((s) => !s.confirmed)
  const confirmedSorted = [...confirmed].sort(
    (a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()
  )

  const activeBlock = getActiveBlock(blocks)
  const activeBlockSessionIds = new Set(activeBlock?.sessionIds ?? [])

  // Sessions confirmed as part of the active block
  const activeBlockSessions = confirmedSorted.filter((s) => activeBlockSessionIds.has(s.id))

  // Completed blocks in the current cycle + their sessions grouped
  const completedCycleBlocks = getCurrentCycleCompletedBlocks(blocks)
  const completedCycleSessionIdSet = new Set(completedCycleBlocks.flatMap((b) => b.sessionIds))
  const completedCycleGroups = completedCycleBlocks.map((block) => ({
    block,
    sessions: confirmedSorted
      .filter((s) => block.sessionIds.includes(s.id))
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()),
  }))

  // Old archive: sessions from previous cycles only
  const archiveSessions = confirmedSorted.filter(
    (s) => !activeBlockSessionIds.has(s.id) && !completedCycleSessionIdSet.has(s.id)
  )

  // Map each session in the active block to its 1-based position within the block
  const blockIndexMap = new Map<number, number>()
  if (activeBlock) {
    const chronoConfirmed = [...activeBlockSessions].sort(
      (a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()
    )
    chronoConfirmed.forEach((s, i) => blockIndexMap.set(s.id, i + 1))
    if (upcoming?.blockId === activeBlock.id) {
      blockIndexMap.set(upcoming.id, activeBlockSessions.length + 1)
    }
  }

  const latestE1RM = getBestE1RM(sessions)
  const bestWeight = getBestWeight(sessions)
  const latestBW = getLatestBW(sessions)

  return (
    <>
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <h1
            className="text-2xl font-semibold text-[#111111] tracking-tight select-none cursor-default"
            onPointerDown={handleTitlePointerDown}
            onPointerUp={handleTitlePointerUp}
            onPointerLeave={handleTitlePointerUp}
          >
            Bench Tracker
          </h1>
          <p className="text-sm text-[#777777] mt-0.5">
            Saif · {confirmed.length} sessions · BW {latestBW ?? 54}kg
          </p>
        </header>

        {/* Progress Bar */}
        <ProgressBar current={latestE1RM} target={TARGET} />

        {/* Stats Grid */}
        <StatsGrid
          e1rm={latestE1RM}
          best={bestWeight}
          sessions={confirmed.length}
          bw={latestBW}
        />

        {/* Program timeline: all 4 blocks of the current cycle */}
        {blocks.length > 0 && <ProgramTimeline blocks={blocks} sessions={confirmed} />}

        {/* Active block + sessions */}
        <div className="mb-4">
          {activeBlock && (
            <BlockHeader
              block={activeBlock}
              confirmedCount={activeBlockSessions.length}
              onEditAnchor={handleEditAnchor}
            />
          )}
          {upcoming && (
            <SessionCard
              session={upcoming}
              blockIndex={blockIndexMap.get(upcoming.id)}
              onStartLogging={handleStartLogging}
              onUpdateMuscleGroups={handleUpdateMuscleGroups}
            />
          )}
          {activeBlockSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              blockIndex={blockIndexMap.get(s.id)}
              onEdit={handleEditSession}
              onUnlog={handleUnlogSession}
            />
          ))}
        </div>

        {/* Completed blocks in the current cycle — shown inline */}
        {completedCycleGroups.map(({ block, sessions }) => (
          <div key={block.id} className="mb-4">
            <BlockHeader block={block} confirmedCount={sessions.length} />
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onEdit={handleEditSession}
                onUnlog={handleUnlogSession}
              />
            ))}
          </div>
        ))}

        {/* Old history: sessions from previous cycles */}
        {archiveSessions.length > 0 && (
          <div>
            <button
              onClick={() => setArchiveOpen((v) => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-[#777777] mb-3 hover:text-[#444444] transition-colors"
            >
              <span
                className="inline-block transition-transform duration-200"
                style={{ transform: archiveOpen ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                ›
              </span>
              {archiveOpen ? "Hide" : "Show"} history ({archiveSessions.length})
            </button>
            {archiveOpen &&
              archiveSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onEdit={handleEditSession}
                  onUnlog={handleUnlogSession}
                />
              ))}
          </div>
        )}
      </main>

      {/* Log Session Modal */}
      {loggingSession && (
        <LogSessionModal
          session={loggingSession}
          onConfirm={handleConfirmSession}
          onClose={handleCloseModal}
          previousSessions={confirmedSorted}
          initialDraft={activeDraft ?? undefined}
        />
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <LogSessionModal
          session={editingSession}
          mode="edit"
          onConfirm={handleSaveEdit}
          onClose={() => setEditingSession(null)}
          previousSessions={confirmedSorted}
        />
      )}

      {/* Draft resume prompt */}
      {draftPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10">
            <p className="text-base font-semibold text-[#111111] mb-1">Resume session?</p>
            <p className="text-sm text-[#777777] mb-6">
              Draft saved {relativeTime(draftPrompt.draft.savedAt)} · {draftPrompt.draft.completedSets.length} set{draftPrompt.draft.completedSets.length !== 1 ? "s" : ""} done
            </p>
            <button
              onClick={() => {
                setActiveDraft(draftPrompt.draft)
                setLoggingSession(draftPrompt.session)
                setDraftPrompt(null)
              }}
              className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 mb-3 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors"
            >
              Continue
            </button>
            <button
              onClick={() => {
                clearDraft()
                setLoggingSession(draftPrompt.session)
                setDraftPrompt(null)
              }}
              className="w-full border border-[#e8e8e8] text-[#555555] text-sm font-semibold rounded-xl py-3.5 hover:bg-[#f5f5f5] active:bg-[#eeeeee] transition-colors"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      {/* Anchor weight setup / edit */}
      {anchorPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10">
            <p className="text-base font-semibold text-[#111111] mb-1">Set your anchor weight</p>
            <p className="text-sm text-[#777777] mb-6">
              Your anchor is the 1RM this cycle is built around. All block prescriptions are calculated as a percentage of this.
            </p>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
              Current 1RM (kg)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={anchorInput}
              onChange={(e) => setAnchorInput(e.target.value)}
              className="w-full border border-[#e8e8e8] rounded-xl px-4 py-3 text-xl font-semibold text-[#111111] mb-6 focus:outline-none focus:border-[#7a1f2e]"
              placeholder="100"
            />
            <button
              onClick={handleConfirmAnchor}
              disabled={isNaN(parseFloat(anchorInput)) || parseFloat(anchorInput) <= 0}
              className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors disabled:opacity-40"
            >
              Start Block 1: Accumulation
            </button>
          </div>
        </div>
      )}
    </>
  )
}
