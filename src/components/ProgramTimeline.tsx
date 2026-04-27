"use client"

import { useState } from "react"
import { TrainingBlock, BlockPhase, Session } from "@/lib/types"
import { PHASE_SESSION_TYPE, prescribeBlockSession, BLOCK_LENGTHS } from "@/lib/prescription"

const PHASE_ORDER: BlockPhase[] = ["accumulation", "transmutation", "realization", "deload"]

const PHASE_SHORT: Record<BlockPhase, string> = {
  accumulation: "Accum",
  transmutation: "Trans",
  realization: "Real",
  deload: "Deload",
}

const PHASE_COLOR: Record<BlockPhase, string> = {
  accumulation: "#2d6a2d",
  transmutation: "#5a2d8a",
  realization: "#7a1f2e",
  deload: "#888888",
}

type StepStatus = "completed" | "active" | "upcoming"

interface Step {
  phase: BlockPhase
  status: StepStatus
  block?: TrainingBlock
}

interface ProgramTimelineProps {
  blocks: TrainingBlock[]
  sessions: Session[]
}

export default function ProgramTimeline({ blocks, sessions }: ProgramTimelineProps) {
  const [expandedPhase, setExpandedPhase] = useState<BlockPhase | null>(null)

  const sorted = [...blocks].sort((a, b) => a.id - b.id)
  const activeBlock = sorted.find((b) => b.status === "active")
  if (!activeBlock) return null

  const activePhaseIdx = PHASE_ORDER.indexOf(activeBlock.phase)
  const activeIdx = sorted.findIndex((b) => b.id === activeBlock.id)
  const cycleStartIdx = activeIdx - activePhaseIdx

  const steps: Step[] = PHASE_ORDER.map((phase, i) => {
    if (i < activePhaseIdx) {
      return { phase, status: "completed", block: sorted[cycleStartIdx + i] }
    }
    if (i === activePhaseIdx) {
      return { phase, status: "active", block: activeBlock }
    }
    return { phase, status: "upcoming" }
  })

  function handleStepClick(step: Step) {
    if (step.status === "active") {
      setExpandedPhase(null)
      return
    }
    setExpandedPhase(expandedPhase === step.phase ? null : step.phase)
  }

  const expandedStep = steps.find((s) => s.phase === expandedPhase)

  return (
    <div className="mb-4">
      {/* Timeline strip */}
      <div className="flex items-start justify-between px-1">
        {steps.map((step, i) => (
          <div key={step.phase} className="flex items-center">
            <button
              onClick={() => handleStepClick(step)}
              className="flex flex-col items-center gap-0.5"
              style={{ minWidth: 52 }}
            >
              <StepDot step={step} isExpanded={expandedPhase === step.phase} />
            </button>
            {i < steps.length - 1 && (
              <span className="text-[#cccccc] text-xs mx-1 mt-0.5 leading-none">›</span>
            )}
          </div>
        ))}
      </div>

      {/* Inline expansion */}
      {expandedStep && (
        <div className="mt-3 rounded-xl px-4 py-3 bg-[#f7f7f7]">
          {expandedStep.status === "upcoming" ? (
            <UpcomingPreview phase={expandedStep.phase} anchorWeight={activeBlock.anchorWeight} />
          ) : (
            <CompletedPreview block={expandedStep.block!} sessions={sessions} />
          )}
        </div>
      )}
    </div>
  )
}

function StepDot({ step, isExpanded }: { step: Step; isExpanded: boolean }) {
  const { phase, status } = step
  const color = PHASE_COLOR[phase]
  const isUpcoming = status === "upcoming"
  const isActive = status === "active"
  const isCompleted = status === "completed"

  const dotBg = isExpanded ? color : isUpcoming ? "#dddddd" : color
  const dotOpacity = !isExpanded && isCompleted ? 0.6 : 1
  const textColor = isExpanded ? color : isUpcoming ? "#aaaaaa" : isCompleted ? "#999999" : color
  const typeColor = isExpanded ? color : isUpcoming ? "#cccccc" : isCompleted ? "#bbbbbb" : color

  return (
    <>
      <div
        className="w-2 h-2 rounded-full mb-0.5 transition-all"
        style={{ backgroundColor: dotBg, opacity: dotOpacity }}
      />
      <span
        className="text-[10px] text-center leading-tight transition-colors"
        style={{
          color: textColor,
          fontWeight: isActive || isExpanded ? 700 : 500,
          opacity: isCompleted && !isExpanded ? 0.75 : 1,
        }}
      >
        {isCompleted ? "✓ " : ""}{PHASE_SHORT[phase]}
      </span>
      <span
        className="text-[9px] text-center leading-tight transition-colors"
        style={{ color: typeColor }}
      >
        {PHASE_SESSION_TYPE[phase]}
      </span>
    </>
  )
}

function UpcomingPreview({ phase, anchorWeight }: { phase: BlockPhase; anchorWeight: number }) {
  const color = PHASE_COLOR[phase]
  const count = BLOCK_LENGTHS[phase]

  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
        style={{ color }}
      >
        {PHASE_SHORT[phase]} · {anchorWeight}kg anchor
      </p>
      <div className="space-y-1.5">
        {Array.from({ length: count }, (_, i) => {
          const p = prescribeBlockSession(phase, i, anchorWeight)
          return (
            <div key={i} className="flex justify-between items-center">
              <span className="text-xs text-[#888888]">Session {i + 1}</span>
              <span className="text-xs font-semibold text-[#111111]">
                {p.weight}kg × {p.reps} × {p.sets}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompletedPreview({ block, sessions }: { block: TrainingBlock; sessions: Session[] }) {
  const color = PHASE_COLOR[block.phase]
  const blockSessions = block.sessionIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter((s): s is Session => s !== undefined)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())

  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-2.5"
        style={{ color }}
      >
        {PHASE_SHORT[block.phase]} · {block.anchorWeight}kg anchor
      </p>
      <div className="space-y-1.5">
        {blockSessions.map((session, i) => {
          const workingSets = session.sets.filter((s) => !s.isWarmup)
          const top = workingSets[0]
          return (
            <div key={session.id} className="flex justify-between items-center">
              <span className="text-xs text-[#888888]">Session {i + 1}</span>
              <span className="text-xs font-semibold text-[#111111]">
                {top ? `${top.kg}kg × ${top.reps} × ${workingSets.length}` : "—"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
