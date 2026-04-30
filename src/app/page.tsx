"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Session, TrainingBlock, BlockPhase, MuscleGroup, UserProfile, MAIN_LIFT_LABEL, MAIN_LIFT_SHORT, UserPresence } from "@/lib/types"
import { loadSessionsLocal, loadBlocksLocal, loadExerciseConfigLocal, loadAll, loadExerciseConfig, saveAll, loadDraft, clearDraft, loadProfile } from "@/lib/storage"
import type { SessionDraft } from "@/lib/types"
import {
  prescribeBlockSession,
  createNextBlock,
  migrateSessionTypes,
  BLOCK_LENGTHS,
  PHASE_LABEL,
} from "@/lib/prescription"
import { generateWarmups } from "@/lib/warmup"
import { calcE1RM, roundToPlate } from "@/lib/e1rm"
import { MuscleGroupConfig, DEFAULT_MUSCLE_GROUPS, buildMuscleRotation } from "@/lib/exerciseConfig"
import SessionCard from "@/components/SessionCard"
import BlockHeader from "@/components/BlockHeader"
import ProgramTimeline from "@/components/ProgramTimeline"
import StatsGrid from "@/components/StatsGrid"
import ProgressBar from "@/components/ProgressBar"
import LogSessionModal from "@/components/LogSessionModal"
import NavDrawer from "@/components/NavDrawer"
import InstallGuideModal, { useInstallGuide } from "@/components/InstallGuideModal"
import FriendPresenceStrip from "@/components/FriendPresenceStrip"
import { relativeTime } from "@/lib/time"

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

function suggestNextMuscles(confirmedSessions: Session[], muscleRotation: string[][]): MuscleGroup[] {
  if (muscleRotation.length === 0) return []

  const last = [...confirmedSessions]
    .filter((s) => s.date && s.extraWorkouts && s.extraWorkouts.length > 0)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())[0]

  if (!last) return muscleRotation[0]

  const lastMuscles = last.extraWorkouts!.map((w) => w.muscle)
  let bestIdx = 0
  let bestScore = -1
  muscleRotation.forEach((pair, i) => {
    const score = pair.filter((m) => lastMuscles.includes(m)).length
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })
  return muscleRotation[(bestIdx + 1) % muscleRotation.length]
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

function createUpcomingSession(
  sessions: Session[],
  blocks: TrainingBlock[],
  config: MuscleGroupConfig[],
  profile: UserProfile
): Session {
  const activeBlock = getActiveBlock(blocks)

  let prescription: ReturnType<typeof prescribeBlockSession>
  let blockId: number | undefined

  if (activeBlock) {
    const sessionIndexInBlock = activeBlock.sessionIds.length
    prescription = prescribeBlockSession(activeBlock.phase, sessionIndexInBlock, activeBlock.anchorWeight)
    blockId = activeBlock.id
  } else {
    prescription = prescribeBlockSession("accumulation", 0, profile.anchor)
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
  const coachNote = `[${PHASE_LABEL[phase]} ${sessionIndex + 1}/${BLOCK_LENGTHS[phase]}] ${prescription.weight}kg × ${prescription.reps} × ${prescription.sets}. Stay tight, drive the bar.`

  const muscleRotation = buildMuscleRotation(config)

  return {
    id: maxId + 1,
    date: null,
    type: prescription.sessionType,
    bw: null,
    confirmed: false,
    coachNote,
    sets: [...warmups, ...workingSets],
    selectedMuscleGroups: suggestNextMuscles(sessions, muscleRotation),
    blockId,
  }
}

function backfillMuscles(sessions: Session[], config: MuscleGroupConfig[]): Session[] {
  const upcoming = sessions.find((s) => !s.confirmed)
  if (!upcoming || upcoming.selectedMuscleGroups !== undefined) return sessions
  const confirmed = sessions.filter((s) => s.confirmed)
  const suggested = suggestNextMuscles(confirmed, buildMuscleRotation(config))
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
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [exerciseConfig, setExerciseConfig] = useState<MuscleGroupConfig[]>(DEFAULT_MUSCLE_GROUPS)
  const [loggingSession, setLoggingSession] = useState<Session | null>(null)
  const [activeDraft, setActiveDraft] = useState<SessionDraft | null>(null)
  const [draftPrompt, setDraftPrompt] = useState<{ session: Session; draft: SessionDraft } | null>(null)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [anchorPrompt, setAnchorPrompt] = useState(false)
  const [anchorInput, setAnchorInput] = useState("")
  const [mounted, setMounted] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [presences, setPresences] = useState<UserPresence[]>([])
  const [toasts, setToasts] = useState<Array<{ id: string; name: string }>>([])
  const prevPresencesRef = useRef<UserPresence[]>([])
  const presenceInitialisedRef = useRef(false)
  const installGuide = useInstallGuide()
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
    let cancelled = false

    loadProfile().then((p) => {
      if (cancelled) return
      if (!p) {
        router.replace("/onboarding")
        return
      }
      setProfile(p)
      installGuide.trigger()

      // Sync load from localStorage immediately
      const localSessions = loadSessionsLocal()
      const localBlocks = loadBlocksLocal()
      const localConfig = loadExerciseConfigLocal()

      if (localSessions.length > 0) setSessions(backfillMuscles(localSessions, localConfig))
      if (localBlocks.length > 0) setBlocks(localBlocks)
      setExerciseConfig(localConfig)
      setMounted(true)

      // Async load from KV
      Promise.all([loadAll(), loadExerciseConfig()]).then(
        ([{ sessions: data, blocks: loadedBlocks }, config]) => {
          if (cancelled) return
          setExerciseConfig(config)

          let finalSessions = backfillMuscles(data, config)

          // One-time migration for historical "Push" sessions
          const migrated = migrateSessionTypes(finalSessions)
          if (migrated !== null) finalSessions = migrated

          let finalBlocks = loadedBlocks

          // First-time block setup: seed first block from profile anchor
          if (finalBlocks.length === 0) {
            const confirmed = finalSessions.filter((s) => s.confirmed)
            const seededBlocks: TrainingBlock[] = [{
              id: 1,
              phase: "accumulation",
              status: "active",
              sessionIds: [],
              anchorWeight: roundToPlate(p.anchor),
              startDate: null,
              endDate: null,
            }]
            const upcoming = createUpcomingSession(confirmed, seededBlocks, config, p)
            finalSessions = sortSessions([...confirmed, upcoming])
            finalBlocks = seededBlocks
            saveAll(finalSessions, finalBlocks)
            setSessions(finalSessions)
            setBlocks(finalBlocks)
            return
          }

          // Normal load: ensure an upcoming session exists
          const hasUpcoming = finalSessions.some((s) => !s.confirmed)
          if (!hasUpcoming) {
            const confirmed = finalSessions.filter((s) => s.confirmed)
            const upcoming = createUpcomingSession(confirmed, finalBlocks, config, p)
            finalSessions = sortSessions([...confirmed, upcoming])
            saveAll(finalSessions, finalBlocks)
          }

          setSessions(finalSessions)
          setBlocks(finalBlocks)
        }
      )
    })

    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!profile) return

    const fetchPresences = () => {
      fetch("/api/presence")
        .then((r) => r.ok ? r.json() : [])
        .then((data: UserPresence[]) => {
          if (!Array.isArray(data)) return
          const prev = prevPresencesRef.current
          if (presenceInitialisedRef.current) {
            data
              .filter(
                (p) =>
                  p.inSession &&
                  p.email !== profile.email &&
                  !prev.find((q) => q.email === p.email && q.inSession)
              )
              .forEach((p) => {
                const id = `${Date.now()}-${p.email}`
                setToasts((t) => [...t, { id, name: p.name.split(" ")[0] }])
                setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
              })
          }
          presenceInitialisedRef.current = true
          prevPresencesRef.current = data
          setPresences(data)
        })
        .catch(() => {})
    }

    fetchPresences()
    const interval = setInterval(fetchPresences, 15000)
    return () => clearInterval(interval)
  }, [profile])

  // Register push subscription once profile is loaded
  useEffect(() => {
    if (!profile) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    navigator.serviceWorker.ready
      .then((reg) =>
        reg.pushManager.getSubscription().then((existing) => {
          if (existing) return existing
          const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4)
          const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/")
          const raw = atob(base64)
          const key = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        })
      )
      .then((sub) => {
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        }).catch(() => {})
      })
      .catch(() => {})
  }, [profile])

  function signalPresence(inSession: boolean) {
    fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inSession }),
    }).catch(() => {})
  }

  function handleStartLogging(session: Session) {
    const draft = loadDraft()
    const isLive =
      draft !== null &&
      draft.sessionId === session.id &&
      draft.completedSets.length > 0 &&
      Date.now() - new Date(draft.savedAt).getTime() < DRAFT_MAX_AGE_MS

    signalPresence(true)
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
    if (!profile) return
    const parsed = parseFloat(anchorInput)
    if (isNaN(parsed) || parsed <= 0) return
    const anchor = roundToPlate(parsed)
    const confirmed = sessions.filter((s) => s.confirmed)
    const activeBlock = getActiveBlock(blocks)

    let finalBlocks: TrainingBlock[]
    if (activeBlock) {
      finalBlocks = blocks.map((b) =>
        b.id === activeBlock.id ? { ...b, anchorWeight: anchor } : b
      )
    } else {
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

    const upcoming = createUpcomingSession(confirmed, finalBlocks, exerciseConfig, profile)
    const finalSessions = sortSessions([...confirmed, upcoming])
    saveAll(finalSessions, finalBlocks)
    setSessions(finalSessions)
    setBlocks(finalBlocks)
    setAnchorPrompt(false)
  }

  function handleConfirmSession(updatedSession: Session) {
    if (!profile) return
    const prevBestE1RM = getBestE1RM(sessions.filter((s) => s.confirmed))
    const currentSessions = sessions
    const currentBlocks = blocks

    const updatedSessions = currentSessions.map((s) =>
      s.id === updatedSession.id ? { ...updatedSession, blockId: updatedSession.blockId } : s
    )
    const confirmedSessions = updatedSessions.filter((s) => s.confirmed)

    const activeBlock = getActiveBlock(currentBlocks)
    let finalBlocks = currentBlocks

    if (activeBlock) {
      const updatedBlockSessionIds = [...activeBlock.sessionIds, updatedSession.id]
      const isBlockComplete = updatedBlockSessionIds.length >= BLOCK_LENGTHS[activeBlock.phase]

      if (isBlockComplete) {
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
        finalBlocks = currentBlocks.map((b) =>
          b.id === activeBlock.id ? { ...b, sessionIds: updatedBlockSessionIds } : b
        )
      }
    }

    const newUpcoming = createUpcomingSession(confirmedSessions, finalBlocks, exerciseConfig, profile)
    const final = sortSessions([...confirmedSessions, newUpcoming])

    setSessions(final)
    setBlocks(finalBlocks)
    saveAll(final, finalBlocks)
    setLoggingSession(null)
    setActiveDraft(null)

    signalPresence(false)

    const newBestE1RM = getBestE1RM(final.filter((s) => s.confirmed))
    const isNewPR = newBestE1RM !== null && (prevBestE1RM === null || newBestE1RM > prevBestE1RM)
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: isNewPR ? "pr_hit" : "session_logged",
        payload: isNewPR
          ? { weight: newBestE1RM, sessionId: updatedSession.id }
          : { sessionType: updatedSession.type, sessionId: updatedSession.id },
      }),
    }).catch(() => {})
  }

  function handleCloseModal() {
    signalPresence(false)
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
    if (!profile) return
    if (!window.confirm(`Unlog Session ${String(session.id).padStart(2, "0")}? This will remove it from your history.`)) return

    const remaining = sessions.filter((s) => s.confirmed && s.id !== session.id)

    const sessionBlockId = session.blockId
    let newBlocks = blocks
      .filter((b) => {
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

    if (!getActiveBlock(newBlocks) && newBlocks.length > 0) {
      const lastBlock = newBlocks[newBlocks.length - 1]
      newBlocks = newBlocks.map((b) =>
        b.id === lastBlock.id ? { ...b, status: "active" as const } : b
      )
    }

    const newUpcoming = createUpcomingSession(remaining, newBlocks, exerciseConfig, profile)
    const final = sortSessions([...remaining, newUpcoming])

    setSessions(final)
    setBlocks(newBlocks)
    saveAll(final, newBlocks)
  }

  if (!mounted || !profile) {
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

  const activeBlockSessions = confirmedSorted.filter((s) => activeBlockSessionIds.has(s.id))

  const completedCycleBlocks = getCurrentCycleCompletedBlocks(blocks)
  const completedCycleSessionIdSet = new Set(completedCycleBlocks.flatMap((b) => b.sessionIds))
  const completedCycleGroups = completedCycleBlocks.map((block) => ({
    block,
    sessions: confirmedSorted
      .filter((s) => block.sessionIds.includes(s.id))
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()),
  }))

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

  const liftLabel = MAIN_LIFT_LABEL[profile.mainLift]
  const liftShort = MAIN_LIFT_SHORT[profile.mainLift]

  return (
    <>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {installGuide.show && (
        <InstallGuideModal onDismiss={installGuide.dismiss} />
      )}

      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <h1
              className="text-2xl font-semibold text-[#111111] tracking-tight select-none cursor-default"
              onPointerDown={handleTitlePointerDown}
              onPointerUp={handleTitlePointerUp}
              onPointerLeave={handleTitlePointerUp}
            >
              {liftShort} Tracker
            </h1>
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1 -mr-1 text-[#555555] hover:text-[#111111] transition-colors shrink-0"
              aria-label="Open menu"
            >
              <svg width="20" height="14" viewBox="0 0 20 14" fill="currentColor" aria-hidden="true">
                <rect y="0" width="20" height="2" rx="1" />
                <rect y="6" width="20" height="2" rx="1" />
                <rect y="12" width="20" height="2" rx="1" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-[#777777]">
            {profile.name} · {confirmed.length} sessions · BW {latestBW ?? profile.bw}kg
          </p>
        </header>

        {/* Friends presence */}
        <FriendPresenceStrip presences={presences} currentUserEmail={profile.email} />

        {/* Progress Bar */}
        <ProgressBar current={latestE1RM} target={profile.target} />

        {/* Stats Grid */}
        <StatsGrid
          e1rm={latestE1RM}
          best={bestWeight}
          sessions={confirmed.length}
          bw={latestBW}
          target={profile.target}
        />

        {/* Program timeline */}
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
              exerciseConfig={exerciseConfig}
            />
          )}
          {activeBlockSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              blockIndex={blockIndexMap.get(s.id)}
              onEdit={handleEditSession}
              onUnlog={handleUnlogSession}
              exerciseConfig={exerciseConfig}
            />
          ))}
        </div>

        {/* Completed blocks in the current cycle */}
        {completedCycleGroups.map(({ block, sessions }) => (
          <div key={block.id} className="mb-4">
            <BlockHeader block={block} confirmedCount={sessions.length} />
            {sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onEdit={handleEditSession}
                onUnlog={handleUnlogSession}
                exerciseConfig={exerciseConfig}
              />
            ))}
          </div>
        ))}
      </main>

      {/* Log Session Modal */}
      {loggingSession && (
        <LogSessionModal
          session={loggingSession}
          onConfirm={handleConfirmSession}
          onClose={handleCloseModal}
          previousSessions={confirmedSorted}
          initialDraft={activeDraft ?? undefined}
          exerciseConfig={exerciseConfig}
          mainLiftLabel={liftLabel}
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
          exerciseConfig={exerciseConfig}
          mainLiftLabel={liftLabel}
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

      {/* Friend online toasts */}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-0 right-0 z-[60] flex flex-col items-center gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-center gap-2 bg-white border border-[#e8e8e8] rounded-full px-4 py-2 shadow-md text-sm text-[#333333]"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              {toast.name} started lifting
            </div>
          ))}
        </div>
      )}
    </>
  )
}
