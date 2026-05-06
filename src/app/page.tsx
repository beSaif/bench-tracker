"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Session, TrainingBlock, BlockPhase, MuscleGroup, UserProfile, MAIN_LIFT_LABEL, UserPresence } from "@/lib/types"
import { loadSessionsLocal, loadBlocksLocal, loadExerciseConfigLocal, loadAll, loadExerciseConfig, saveAll, loadDraft, clearDraft, loadProfile, loadProfileLocal, loadPresencesLocal, savePresencesLocal, loadFriendEmailsLocal, saveFriendEmailsLocal, clearMiniPlayer } from "@/lib/storage"
import type { SessionDraft } from "@/lib/types"
import {
  prescribeBlockSession,
  createNextBlock,
  migrateSessionTypes,
  BLOCK_LENGTHS,
  PHASE_LABEL,
  PHASE_SESSION_TYPE,
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
  const [presences, setPresences] = useState<UserPresence[]>(() => loadPresencesLocal())
  const [friendEmails, setFriendEmails] = useState<Set<string>>(() => new Set(loadFriendEmailsLocal()))
  const friendEmailsRef = useRef<Set<string>>(new Set(loadFriendEmailsLocal()))
  const [toasts, setToasts] = useState<Array<{ id: string; name: string }>>([])
  const prevPresencesRef = useRef<UserPresence[]>([])
  const [showNotifBanner, setShowNotifBanner] = useState(false)
  const presenceInitialisedRef = useRef(false)
  const [viewingBlockId, setViewingBlockId] = useState<number | null>(null)
  const [viewingUpcomingPhase, setViewingUpcomingPhase] = useState<BlockPhase | null>(null)
  const installGuide = useInstallGuide()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumeCheckedRef = useRef(false)

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

    // Fast path: render from localStorage immediately to avoid flicker on re-navigation
    const cachedProfile = loadProfileLocal()
    if (cachedProfile) {
      const localSessions = loadSessionsLocal()
      const localBlocks = loadBlocksLocal()
      const localConfig = loadExerciseConfigLocal()
      setProfile(cachedProfile)
      if (localSessions.length > 0) setSessions(backfillMuscles(localSessions, localConfig))
      if (localBlocks.length > 0) setBlocks(localBlocks)
      setExerciseConfig(localConfig)
      setMounted(true)
    }

    loadProfile().then((p) => {
      if (cancelled) return
      if (!p) {
        router.replace("/onboarding")
        return
      }
      setProfile(p)
      installGuide.trigger()

      if (cachedProfile) {
        // Already mounted from cache — just kick off the background KV sync
      } else {
        // First load (no cache): set state and mount now
        const localSessions = loadSessionsLocal()
        const localBlocks = loadBlocksLocal()
        const localConfig = loadExerciseConfigLocal()
        if (localSessions.length > 0) setSessions(backfillMuscles(localSessions, localConfig))
        if (localBlocks.length > 0) setBlocks(localBlocks)
        setExerciseConfig(localConfig)
        setMounted(true)
      }

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

  // Resume a minimized session when navigating back to home
  useEffect(() => {
    if (resumeCheckedRef.current || sessions.length === 0) return
    resumeCheckedRef.current = true
    const resumeId = sessionStorage.getItem('lift-tracker-resume')
    if (!resumeId) return
    sessionStorage.removeItem('lift-tracker-resume')
    const target = sessions.find(s => s.id.toString() === resumeId)
    const draft = loadDraft()
    if (target && draft && draft.sessionId.toString() === resumeId) {
      setLoggingSession(JSON.parse(JSON.stringify(target)))
      setActiveDraft(draft)
    }
  }, [sessions])

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
                  friendEmailsRef.current.has(p.email.trim().toLowerCase()) &&
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
          savePresencesLocal(data)
          setPresences(data)
        })
        .catch(() => {})
    }

    fetchPresences()
    const interval = setInterval(fetchPresences, 15000)
    return () => clearInterval(interval)
  }, [profile])

  useEffect(() => {
    if (!profile) return
    fetch("/api/friends")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { email: string }[]) => {
        if (!Array.isArray(data)) return
        const emails = new Set(data.map((f) => f.email.trim().toLowerCase()))
        friendEmailsRef.current = emails
        saveFriendEmailsLocal([...emails])
        setFriendEmails(emails)
      })
      .catch(() => {})
  }, [profile])

  function subscribeAndStore(vapidKey: string) {
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
  }

  // Register push subscription once profile is loaded.
  // iOS requires Notification.requestPermission() from a user gesture — we
  // can't auto-subscribe there, so we show a banner instead.
  useEffect(() => {
    if (!profile) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    if (Notification.permission === "granted") {
      subscribeAndStore(vapidKey)
    } else if (Notification.permission === "default") {
      setShowNotifBanner(true)
    }
  }, [profile])

  async function handleEnableNotifications() {
    setShowNotifBanner(false)
    const permission = await Notification.requestPermission()
    if (permission === "granted") {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (vapidKey) subscribeAndStore(vapidKey)
    }
  }

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

    clearMiniPlayer()
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
    clearMiniPlayer()
    setLoggingSession(null)
    setActiveDraft(null)

    signalPresence(false)

  }

  function handleCloseModal() {
    signalPresence(false)
    clearMiniPlayer()
    setLoggingSession(null)
    setActiveDraft(null)
  }

  function handleMinimizeModal() {
    setLoggingSession(null)
    setActiveDraft(null)
    // mini-player state already saved by LogSessionModal before this is called
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
        <div className="h-3 w-32 bg-[#e8e8e8] rounded animate-pulse mb-1" />
        <div className="h-8 w-40 bg-[#e8e8e8] rounded animate-pulse mb-6" />
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

  const viewingBlock = viewingBlockId != null
    ? (blocks.find((b) => b.id === viewingBlockId) ?? activeBlock)
    : activeBlock
  const viewingBlockSessionIds = new Set(viewingBlock?.sessionIds ?? [])
  const viewingBlockSessions = confirmedSorted
    .filter((s) => viewingBlockSessionIds.has(s.id))
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())

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
  const firstName = profile.name.split(" ")[0]

  return (
    <>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {installGuide.show && (
        <InstallGuideModal onDismiss={installGuide.dismiss} />
      )}

      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#bbbbbb] lowercase mb-0.5">best workout tracker.</p>
              <h1
                className="text-2xl font-semibold text-[#111111] tracking-tight select-none cursor-default"
                onPointerDown={handleTitlePointerDown}
                onPointerUp={handleTitlePointerUp}
                onPointerLeave={handleTitlePointerUp}
              >
                hello, {firstName}
              </h1>
            </div>
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
        </header>

        {/* Friends presence */}
        <FriendPresenceStrip presences={presences.filter((p) => friendEmails.has(p.email.trim().toLowerCase()))} currentUserEmail={profile.email} />

        {/* Notification opt-in banner (needed on iOS PWA where auto-subscribe is blocked) */}
        {showNotifBanner && (
          <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8]">
            <span className="text-sm text-[#444444]">Enable notifications for friend requests</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleEnableNotifications}
                className="text-sm font-medium text-[#111111] bg-white border border-[#d0d0d0] rounded-lg px-3 py-1 active:opacity-70"
              >
                Enable
              </button>
              <button
                onClick={() => setShowNotifBanner(false)}
                className="text-[#999999] active:opacity-70"
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                  <path d="M1.41 0L0 1.41 5.59 7 0 12.59 1.41 14 7 8.41 12.59 14 14 12.59 8.41 7 14 1.41 12.59 0 7 5.59 1.41 0z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <ProgressBar current={bestWeight} target={profile.target} />

        {/* Stats Grid */}
        <StatsGrid
          e1rm={latestE1RM}
          best={bestWeight}
          sessions={confirmed.length}
          bw={latestBW}
          target={profile.target}
        />

        {/* Program timeline */}
        {blocks.length > 0 && (
          <ProgramTimeline
            blocks={blocks}
            selectedBlockId={viewingBlockId}
            onBlockSelect={(b) => {
              setViewingBlockId(b?.id ?? null)
              setViewingUpcomingPhase(null)
            }}
            selectedUpcomingPhase={viewingUpcomingPhase}
            onUpcomingPhaseSelect={(phase) => {
              setViewingUpcomingPhase(phase)
              setViewingBlockId(null)
            }}
          />
        )}

        {/* Block view */}
        <div className="mb-4">
          {viewingBlock && !viewingUpcomingPhase && (
            <BlockHeader
              block={viewingBlock}
              confirmedCount={viewingBlock === activeBlock ? activeBlockSessions.length : viewingBlockSessions.length}
              onEditAnchor={viewingBlock === activeBlock ? handleEditAnchor : undefined}
            />
          )}

          {/* Banner when browsing a past block */}
          {viewingBlock !== activeBlock && !viewingUpcomingPhase && (
            <button
              onClick={() => setViewingBlockId(null)}
              className="w-full text-left text-xs text-muted-light bg-[#f5f5f5] rounded-xl px-4 py-2.5 mb-2 flex items-center gap-2 active:opacity-70"
            >
              <span>←</span>
              <span>back to current block</span>
            </button>
          )}

          {/* Upcoming phase preview */}
          {viewingUpcomingPhase && activeBlock && (() => {
            const phaseColor: Record<BlockPhase, { bg: string; bar: string; label: string; meta: string }> = {
              accumulation: { bg: "bg-[#f0f7f0]", bar: "bg-[#2d6a2d]", label: "text-[#2d6a2d]", meta: "text-[#4a8a4a]" },
              transmutation: { bg: "bg-[#f5f0ff]", bar: "bg-[#5a2d8a]", label: "text-[#5a2d8a]", meta: "text-[#7a4daa]" },
              realization: { bg: "bg-[#fff0f2]", bar: "bg-[#7a1f2e]", label: "text-[#7a1f2e]", meta: "text-[#9a3f4e]" },
              deload: { bg: "bg-[#f5f5f5]", bar: "bg-[#888888]", label: "text-[#555555]", meta: "text-[#888888]" },
            }
            const style = phaseColor[viewingUpcomingPhase]
            const total = BLOCK_LENGTHS[viewingUpcomingPhase]
            return (
              <>
                <div className={`${style.bg} rounded-xl px-4 py-3 mb-2`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-4 rounded-full ${style.bar}`} />
                      <span className={`text-sm font-semibold ${style.label}`}>
                        {PHASE_SESSION_TYPE[viewingUpcomingPhase]}
                      </span>
                      <span className={`text-xs ${style.meta}`}>· projected</span>
                    </div>
                    <span className={`text-xs font-semibold ${style.label} opacity-60`}>{total} sessions</span>
                  </div>
                  <div className="h-1 rounded-full bg-black/10" />
                </div>
                <button
                  onClick={() => setViewingUpcomingPhase(null)}
                  className="w-full text-left text-xs text-muted-light bg-[#f5f5f5] rounded-xl px-4 py-2.5 mb-2 flex items-center gap-2 active:opacity-70"
                >
                  <span>←</span>
                  <span>back to current block</span>
                </button>
                {Array.from({ length: total }, (_, i) => {
                  const p = prescribeBlockSession(viewingUpcomingPhase, i, activeBlock.anchorWeight)
                  return (
                    <div key={i} className="px-4 py-3 rounded-xl bg-[#f5f5f5] mb-2 flex justify-between items-center opacity-50">
                      <span className="text-xs text-[#888888]">Session {i + 1}</span>
                      <span className="text-xs font-semibold text-[#555555]">
                        {p.weight}kg × {p.reps} × {p.sets}
                      </span>
                    </div>
                  )
                })}
              </>
            )
          })()}

          {/* Active block: upcoming + confirmed sessions + previews */}
          {viewingBlock === activeBlock && !viewingUpcomingPhase && (
            <>
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
              {/* Previews for sessions not yet generated */}
              {activeBlock && (() => {
                const shownSessions = activeBlockSessions.length + (upcoming ? 1 : 0)
                const remaining = BLOCK_LENGTHS[activeBlock.phase] - shownSessions
                if (remaining <= 0) return null
                return Array.from({ length: remaining }, (_, i) => {
                  const idx = shownSessions + i
                  const p = prescribeBlockSession(activeBlock.phase, idx, activeBlock.anchorWeight)
                  return (
                    <div
                      key={idx}
                      className="px-4 py-3 rounded-xl bg-[#f5f5f5] mb-2 flex justify-between items-center opacity-40"
                    >
                      <span className="text-xs text-[#888888]">Session {idx + 1}</span>
                      <span className="text-xs font-semibold text-muted">
                        {p.weight}kg × {p.reps} × {p.sets}
                      </span>
                    </div>
                  )
                })
              })()}
            </>
          )}

          {/* Past block: only confirmed sessions */}
          {viewingBlock !== activeBlock && !viewingUpcomingPhase && viewingBlockSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onEdit={handleEditSession}
              onUnlog={handleUnlogSession}
              exerciseConfig={exerciseConfig}
            />
          ))}
        </div>
      </main>

      {/* Log Session Modal */}
      {loggingSession && (
        <LogSessionModal
          session={loggingSession}
          onConfirm={handleConfirmSession}
          onClose={handleCloseModal}
          onMinimize={handleMinimizeModal}
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
