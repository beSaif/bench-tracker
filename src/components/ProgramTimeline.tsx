"use client"

import { TrainingBlock, BlockPhase } from "@/lib/types"
import { PHASE_SESSION_TYPE } from "@/lib/prescription"

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
}

interface ProgramTimelineProps {
  blocks: TrainingBlock[]
}

export default function ProgramTimeline({ blocks }: ProgramTimelineProps) {
  const sorted = [...blocks].sort((a, b) => a.id - b.id)
  const activeBlock = sorted.find((b) => b.status === "active")
  if (!activeBlock) return null

  const activePhaseIdx = PHASE_ORDER.indexOf(activeBlock.phase)

  const steps: Step[] = PHASE_ORDER.map((phase, i) => ({
    phase,
    status: i < activePhaseIdx ? "completed" : i === activePhaseIdx ? "active" : "upcoming",
  }))

  return (
    <div className="flex items-start justify-between mb-4 px-1">
      {steps.map((step, i) => (
        <div key={step.phase} className="flex items-center">
          <StepCol step={step} />
          {i < steps.length - 1 && (
            <span className="text-[#cccccc] text-xs mx-1 mt-0.5 leading-none">›</span>
          )}
        </div>
      ))}
    </div>
  )
}

function StepCol({ step }: { step: Step }) {
  const { phase, status } = step
  const color = PHASE_COLOR[phase]
  const isUpcoming = status === "upcoming"
  const isActive = status === "active"
  const isCompleted = status === "completed"

  const dotColor = isUpcoming ? "#dddddd" : color
  const dotOpacity = isCompleted ? 0.6 : 1
  const textColor = isUpcoming ? "#aaaaaa" : isCompleted ? "#999999" : color
  const typeColor = isUpcoming ? "#cccccc" : isCompleted ? "#bbbbbb" : color

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 52 }}>
      <div
        className="w-2 h-2 rounded-full mb-0.5"
        style={{ backgroundColor: dotColor, opacity: dotOpacity }}
      />
      <span
        className="text-[10px] text-center leading-tight"
        style={{
          color: textColor,
          fontWeight: isActive ? 700 : 500,
          opacity: isCompleted ? 0.75 : 1,
        }}
      >
        {isCompleted ? "✓ " : ""}{PHASE_SHORT[phase]}
      </span>
      <span
        className="text-[9px] text-center leading-tight"
        style={{ color: typeColor }}
      >
        {PHASE_SESSION_TYPE[phase]}
      </span>
    </div>
  )
}
