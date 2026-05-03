"use client"

import { TrainingBlock, BlockPhase } from "@/lib/types"

const PHASE_ORDER: BlockPhase[] = ["accumulation", "transmutation", "realization", "deload"]

const PHASE_SHORT: Record<BlockPhase, string> = {
  accumulation: "Volume",
  transmutation: "Intensity",
  realization: "Peak",
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
  selectedBlockId?: number | null
  onBlockSelect: (block: TrainingBlock | null) => void
  selectedUpcomingPhase?: BlockPhase | null
  onUpcomingPhaseSelect?: (phase: BlockPhase | null) => void
}

export default function ProgramTimeline({ blocks, selectedBlockId, onBlockSelect, selectedUpcomingPhase, onUpcomingPhaseSelect }: ProgramTimelineProps) {
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
      onBlockSelect(null)
      onUpcomingPhaseSelect?.(null)
      return
    }
    if (step.status === "completed" && step.block) {
      onUpcomingPhaseSelect?.(null)
      onBlockSelect(step.block)
      return
    }
    if (step.status === "upcoming") {
      onBlockSelect(null)
      onUpcomingPhaseSelect?.(step.phase === selectedUpcomingPhase ? null : step.phase)
    }
  }

  return (
    <div className="mb-4">
      <div className="flex items-start justify-between px-1">
        {steps.map((step, i) => (
          <div key={step.phase} className="flex items-center">
            <button
              onClick={() => handleStepClick(step)}
              className="flex flex-col items-center gap-0.5"
              style={{ minWidth: 52 }}
            >
              <StepDot
                step={step}
                isSelected={
                  step.status === "upcoming"
                    ? step.phase === selectedUpcomingPhase
                    : step.block != null && step.block.id === selectedBlockId
                }
                isActiveBlock={step.status === "active"}
              />
            </button>
            {i < steps.length - 1 && (
              <span className="text-[#cccccc] text-xs mx-1 mt-0.5 leading-none">›</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepDot({
  step,
  isSelected,
  isActiveBlock,
}: {
  step: Step
  isSelected: boolean
  isActiveBlock: boolean
}) {
  const { phase, status } = step
  const color = PHASE_COLOR[phase]
  const isUpcoming = status === "upcoming"
  const isCompleted = status === "completed"

  const dotBg = isUpcoming && !isSelected ? "#dddddd" : color
  const dotOpacity = isCompleted && !isSelected ? 0.55 : isUpcoming && !isSelected ? 0.4 : 1
  const textColor = isUpcoming && !isSelected ? "#aaaaaa" : isCompleted ? (isSelected ? color : "#999999") : color

  return (
    <>
      <div
        className="w-2 h-2 rounded-full mb-0.5 transition-all"
        style={{
          backgroundColor: dotBg,
          opacity: dotOpacity,
          boxShadow: isActiveBlock ? `0 0 0 2px ${color}40` : isSelected ? `0 0 0 2px ${color}80` : "none",
        }}
      />
      <span
        className="text-[10px] text-center leading-tight transition-colors"
        style={{
          color: textColor,
          fontWeight: isActiveBlock || isSelected ? 700 : 500,
          opacity: isCompleted && !isSelected ? 0.75 : 1,
        }}
      >
        {isCompleted ? "✓ " : ""}{PHASE_SHORT[phase]}
        {isActiveBlock && <span className="block text-[8px] opacity-60">now</span>}
      </span>
    </>
  )
}
