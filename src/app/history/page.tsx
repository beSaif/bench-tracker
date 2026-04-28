"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Session, TrainingBlock, BlockPhase } from "@/lib/types"
import { loadSessionsLocal, loadBlocksLocal, loadExerciseConfig } from "@/lib/storage"
import { MuscleGroupConfig, DEFAULT_MUSCLE_GROUPS } from "@/lib/exerciseConfig"
import SessionCard from "@/components/SessionCard"

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setSessions(loadSessionsLocal())
    setBlocks(loadBlocksLocal())
    loadExerciseConfig().then(setExerciseConfig)
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 py-6">
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

  const archiveSessions = sessions
    .filter((s) => s.confirmed && !activeBlockIds.has(s.id) && !cycleSessionIds.has(s.id))
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 py-6">
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
        <p className="text-sm text-[#777777] ml-8">{archiveSessions.length} session{archiveSessions.length !== 1 ? "s" : ""}</p>
      </header>

      {archiveSessions.length === 0 ? (
        <p className="text-sm text-[#aaaaaa] text-center mt-16">No archived sessions yet</p>
      ) : (
        archiveSessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            exerciseConfig={exerciseConfig}
          />
        ))
      )}
    </main>
  )
}
