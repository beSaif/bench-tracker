"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Session, TrainingBlock, BlockPhase, UserProfile, TrainingDay, WeightEntry } from "@/lib/types"
import { loadSessionsLocal, loadBlocksLocal, loadExerciseConfig, loadProfileLocal, loadTrainingDaysLocal, loadAll, loadProfile, loadTrainingDays, loadWeights, loadWeightsLocal } from "@/lib/storage"
import { useOnboardingGuard } from "@/lib/useOnboardingGuard"
import { currentStretchSkips, getMainLiftLabel, getMainLiftShortLabel, isLiftFocused } from "@/lib/trainingMode"
import { getBestWeight } from "@/lib/stats"
import { cycleNumbers, completedCycles, PHASE_SHORT, summarizeBlock, summarizeCycle } from "@/lib/blockSummary"
import { getBlockLength } from "@/lib/prescription"
import { formatDay } from "@/lib/weight"
import { MuscleGroupConfig, DEFAULT_MUSCLE_GROUPS, DEFAULT_TRAINING_DAYS } from "@/lib/exerciseConfig"
import SessionCard from "@/components/SessionCard"
import ShareImageModal from "@/components/ShareImageModal"
import { RecapSheetFor, RecapTarget } from "@/components/BlockRecap"
import RecapShareModal from "@/components/RecapShareModal"
import { PHASE_STYLE } from "@/components/BlockHeader"

const BLOCK_PHASE_ORDER: BlockPhase[] = ["accumulation", "transmutation", "realization", "deload"]

function getActiveBlock(blocks: TrainingBlock[]): TrainingBlock | undefined {
  return blocks.find((b) => b.status === "active")
}

function getCurrentCycleCompletedBlockIds(blocks: TrainingBlock[]): Set<number> {
  const active = getActiveBlock(blocks)
  if (!active) return new Set()
  const sorted = [...blocks].sort((a, b) => a.id - b.id)
  const activeIdx = sorted.findIndex((b) => b.id === active.id)
  const phaseIdx = BLOCK_PHASE_ORDER.indexOf(active.phase)
  return new Set(sorted.slice(activeIdx - phaseIdx, activeIdx).map((b) => b.id))
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [exerciseConfig, setExerciseConfig] = useState<MuscleGroupConfig[]>(DEFAULT_MUSCLE_GROUPS)
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>(DEFAULT_TRAINING_DAYS)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [shareSession, setShareSession] = useState<Session | null>(null)
  const [weights, setWeights] = useState<WeightEntry[]>([])
  const [tab, setTab] = useState<"sessions" | "blocks">("sessions")
  const [recap, setRecap] = useState<RecapTarget | null>(null)
  const [shareRecap, setShareRecap] = useState<RecapTarget | null>(null)
  const [mounted, setMounted] = useState(false)
  useOnboardingGuard()

  useEffect(() => {
    let cancelled = false
    // Local first so the list paints at once, then KV — on a fresh device nothing is
    // cached until something loads it, and History should not have to wait for Home.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setSessions(loadSessionsLocal())
    setBlocks(loadBlocksLocal())
    setProfile(loadProfileLocal())
    setTrainingDays(loadTrainingDaysLocal())
    setWeights(loadWeightsLocal())
    setMounted(true)
    loadWeights().then((w) => { if (!cancelled) setWeights(w) })
    loadExerciseConfig().then((c) => { if (!cancelled) setExerciseConfig(c) })
    loadTrainingDays().then((d) => { if (!cancelled) setTrainingDays(d) })
    loadProfile().then((p) => { if (!cancelled && p) setProfile(p) })
    loadAll().then(({ sessions: s, blocks: b }) => {
      if (cancelled) return
      setSessions(s)
      setBlocks(b)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
        <div className="h-8 w-32 bg-[#e8e8e8] rounded animate-pulse mb-6" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-[#e8e8e8] rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    )
  }

  const activeBlock = getActiveBlock(blocks)
  const activeBlockIds = new Set(activeBlock?.sessionIds ?? [])
  const cycleCompletedBlockIds = getCurrentCycleCompletedBlockIds(blocks)
  const cycleSessionIds = new Set(
    blocks
      .filter((b) => cycleCompletedBlockIds.has(b.id))
      .flatMap((b) => b.sessionIds)
  )

  // Off-block sessions hold no blockId, so the block filters above can't recognise the
  // current ones. In lift-focused mode Home still shows those; only older ones archive
  // here. Balanced mode's Home has no block stretch, so everything archives.
  const currentSkipIds = new Set(
    (profile && isLiftFocused(profile) ? currentStretchSkips(sessions, blocks) : []).map((s) => s.id)
  )

  const archiveSessions = sessions
    .filter(
      (s) =>
        s.confirmed &&
        !activeBlockIds.has(s.id) &&
        !cycleSessionIds.has(s.id) &&
        !currentSkipIds.has(s.id)
    )
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())

  // Blocks, grouped by cycle, newest first. Only shown once there's a finished block to recap.
  const cycles = cycleNumbers(blocks)
  const doneCycles = new Set(completedCycles(blocks))
  const cycleGroups = [...new Set(cycles.values())]
    .sort((a, b) => b - a)
    .map((cycle) => ({
      cycle,
      complete: doneCycles.has(cycle),
      blocks: blocks
        .filter((b) => cycles.get(b.id) === cycle)
        .sort((a, b) => b.id - a.id),
    }))
  const hasBlockRecaps = blocks.some((b) => b.status === "completed")
  const showing = hasBlockRecaps ? tab : "sessions"

  const blockFor = (t: RecapTarget | null) => {
    const b = t?.kind === "block" ? blocks.find((x) => x.id === t.blockId) : undefined
    return b ? summarizeBlock(b, blocks, sessions, weights) : null
  }
  const cycleFor = (t: RecapTarget | null) =>
    t?.kind === "cycle" ? summarizeCycle(t.cycle, blocks, sessions, weights) : null
  const shareBlock = blockFor(shareRecap)
  const shareCycle = cycleFor(shareRecap)
  const liftShort = getMainLiftShortLabel(profile)

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/"
            className="p-1 -ml-1 text-[#555555] hover:text-[#111111] transition-colors"
            aria-label="Back to home"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="11,4 6,9 11,14" />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">History</h1>
        </div>
        <p className="text-sm text-[#777777] ml-8">
          {showing === "sessions"
            ? `${archiveSessions.length} session${archiveSessions.length !== 1 ? "s" : ""}`
            : `${blocks.filter((b) => b.status === "completed").length} blocks done`}
        </p>
      </header>

      {hasBlockRecaps && (
        <div className="flex gap-1.5 mb-4">
          {(["sessions", "blocks"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                showing === t ? "bg-[#111111] text-white" : "bg-[#f5f5f5] text-[#777777] hover:bg-[#ebebeb]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {showing === "blocks" ? (
        cycleGroups.map((g) => (
          <section key={g.cycle} className="mb-6">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#111111]">Cycle {g.cycle}</h2>
              {g.complete ? (
                <button
                  onClick={() => setRecap({ kind: "cycle", cycle: g.cycle })}
                  className="text-xs font-semibold text-[#1e3a5f] active:opacity-60"
                >
                  Recap ›
                </button>
              ) : (
                <span className="text-xs text-[#aaaaaa]">in progress</span>
              )}
            </div>
            <div className="border-t border-[#e8e8e8] divide-y divide-[#f0f0f0]">
              {g.blocks.map((b) => {
                const style = PHASE_STYLE[b.phase] ?? PHASE_STYLE.accumulation
                const summary = summarizeBlock(b, blocks, sessions, weights)
                const name = (
                  <span className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${style.bar}`} />
                    <span className="text-sm text-[#111111]">{PHASE_SHORT[b.phase]}</span>
                    <span className="text-xs text-[#aaaaaa]">{b.anchorWeight}kg</span>
                  </span>
                )
                if (!summary) {
                  return (
                    <div key={b.id} className="flex items-center justify-between py-3">
                      {name}
                      <span className="text-xs text-[#aaaaaa]">
                        {b.status === "active" ? `now · ${b.sessionIds.length}/${getBlockLength(b)}` : b.status === "interrupted" ? "paused" : "—"}
                      </span>
                    </div>
                  )
                }
                return (
                  <button
                    key={b.id}
                    onClick={() => setRecap({ kind: "block", blockId: b.id })}
                    className="w-full flex items-center justify-between py-3 text-left active:opacity-60"
                  >
                    {name}
                    <span className="text-xs text-[#777777]">
                      {summary.startDate === summary.endDate
                        ? formatDay(summary.endDate)
                        : `${formatDay(summary.startDate)} – ${formatDay(summary.endDate)}`}
                      {summary.e1rmChange != null && summary.e1rmChange !== 0 && summary.sessions > 1 && (
                        <span className={summary.e1rmChange > 0 ? "text-[#2d6a2d]" : ""}>
                          {" · "}{summary.e1rmChange > 0 ? "+" : "−"}{Math.abs(summary.e1rmChange)}
                        </span>
                      )}
                      <span className="text-[#cccccc]"> ›</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))
      ) : archiveSessions.length === 0 ? (
        <p className="text-sm text-[#aaaaaa] text-center mt-16">No archived sessions yet</p>
      ) : (
        archiveSessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            onShare={profile ? setShareSession : undefined}
            exerciseConfig={exerciseConfig}
            trainingDays={trainingDays}
            mainLiftShortLabel={getMainLiftShortLabel(profile)}
          />
        ))
      )}

      {recap && (
        <RecapSheetFor
          target={recap}
          block={blockFor(recap)}
          cycle={cycleFor(recap)}
          liftLabel={liftShort}
          goal={profile?.target ?? null}
          justFinished={false}
          onClose={() => setRecap(null)}
          onShare={() => {
            setShareRecap(recap)
            setRecap(null)
          }}
          onOpenBlock={(blockId) => setRecap({ kind: "block", blockId })}
        />
      )}

      {shareBlock && (
        <RecapShareModal
          kind="block"
          summary={shareBlock}
          liftLabel={getMainLiftLabel(profile)}
          target={profile?.target ?? null}
          bestWeight={getBestWeight(sessions)}
          onClose={() => setShareRecap(null)}
        />
      )}
      {shareCycle && (
        <RecapShareModal
          kind="cycle"
          summary={shareCycle}
          liftLabel={getMainLiftLabel(profile)}
          target={profile?.target ?? null}
          bestWeight={getBestWeight(sessions)}
          onClose={() => setShareRecap(null)}
        />
      )}

      {shareSession && profile && (
        <ShareImageModal
          session={shareSession}
          sessions={sessions}
          blocks={blocks}
          profile={profile}
          exerciseConfig={exerciseConfig}
          trainingDays={trainingDays}
          onClose={() => setShareSession(null)}
        />
      )}
    </main>
  )
}
