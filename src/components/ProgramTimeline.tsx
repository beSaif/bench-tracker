"use client"

import { TrainingBlock, BlockPhase } from "@/lib/types"

const PHASE_ORDER: BlockPhase[] = ["accumulation", "transmutation", "realization", "deload"]

const PHASE_SHORT: Record<BlockPhase, string> = {
  accumulation: "Volume",
  transmutation: "Intensity",
  realization: "Peak",
  deload: "Deload",
  reacclimation: "Re-acclim",
}

const PHASE_COLOR: Record<BlockPhase, string> = {
  accumulation: "#2d6a2d",
  transmutation: "#5a2d8a",
  realization: "#1e3a5f",
  deload: "#888888",
  reacclimation: "#c8791e",
}

type StepStatus = "completed" | "active" | "upcoming"

interface Step {
  phase: BlockPhase
  status: StepStatus
  block?: TrainingBlock
  /** The single "you are here" step (the ring + "now" marker). */
  now?: boolean
}

interface ProgramTimelineProps {
  blocks: TrainingBlock[]
  selectedBlockId?: number | null
  onBlockSelect: (block: TrainingBlock | null) => void
  selectedUpcomingPhase?: BlockPhase | null
  onUpcomingPhaseSelect?: (phase: BlockPhase | null) => void
}

/** Reconstruct one cycle (accumulation → deload) around a reference block. */
function cycleSteps(sorted: TrainingBlock[], referenceIdx: number): Step[] {
  const reference = sorted[referenceIdx]
  const refPhaseIdx = PHASE_ORDER.indexOf(reference.phase)
  const cycleStartIdx = referenceIdx - refPhaseIdx
  return PHASE_ORDER.map((phase, i): Step => {
    if (i === refPhaseIdx) return { phase, status: "active", block: reference }
    const block = sorted[cycleStartIdx + i]
    // A completed cycle slot only if a real completed block occupies it.
    if (i < refPhaseIdx && block && block.status !== "active") {
      return { phase, status: "completed", block }
    }
    return { phase, status: "upcoming" }
  })
}

/**
 * Build the phase-dot steps for the timeline. For a normal active block this is
 * the cycle around it. For a rebuild (reacclimation) block the cycle is
 * reconstructed around the interrupted block it will resume, with the Rebuild
 * inserted — as the current "now" step — at that phase's position.
 */
export function buildTimelineSteps(blocks: TrainingBlock[]): Step[] {
  const sorted = [...blocks].sort((a, b) => a.id - b.id)
  const active = sorted.find((b) => b.status === "active")
  if (!active) return []

  if (active.phase !== "reacclimation") {
    return cycleSteps(sorted, sorted.findIndex((b) => b.id === active.id)).map((s) =>
      s.status === "active" ? { ...s, now: true } : s
    )
  }

  // Rebuild: place it at the interrupted block's position in the current cycle.
  const interrupted =
    sorted.find((b) => b.id === active.resumeBlockId) ??
    sorted.find((b) => b.status === "interrupted")

  if (!interrupted) {
    // Fallback: no interrupted block to anchor on — rebuild then a fresh cycle.
    return [
      { phase: "reacclimation", status: "active", block: active, now: true },
      ...PHASE_ORDER.map((phase): Step => ({ phase, status: "upcoming" })),
    ]
  }

  const interruptedIdx = sorted.findIndex((b) => b.id === interrupted.id)
  const steps = cycleSteps(sorted, interruptedIdx) // interrupted phase is "active" (resume target), no "now"
  const insertAt = PHASE_ORDER.indexOf(interrupted.phase)
  const rebuildStep: Step = { phase: "reacclimation", status: "active", block: active, now: true }
  return [...steps.slice(0, insertAt), rebuildStep, ...steps.slice(insertAt)]
}

export default function ProgramTimeline({ blocks, selectedBlockId, onBlockSelect, selectedUpcomingPhase, onUpcomingPhaseSelect }: ProgramTimelineProps) {
  const steps = buildTimelineSteps(blocks)
  if (steps.length === 0) return null

  function handleStepClick(step: Step) {
    if (step.now) {
      onBlockSelect(null)
      onUpcomingPhaseSelect?.(null)
      return
    }
    if (step.block) {
      onUpcomingPhaseSelect?.(null)
      onBlockSelect(step.block)
      return
    }
    onBlockSelect(null)
    onUpcomingPhaseSelect?.(step.phase === selectedUpcomingPhase ? null : step.phase)
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
                  step.block != null
                    ? step.block.id === selectedBlockId
                    : step.phase === selectedUpcomingPhase
                }
                isNow={step.now ?? false}
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
  isNow,
}: {
  step: Step
  isSelected: boolean
  isNow: boolean
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
          boxShadow: isNow ? `0 0 0 2px ${color}40` : isSelected ? `0 0 0 2px ${color}80` : "none",
        }}
      />
      <span
        className="text-[10px] text-center leading-tight transition-colors"
        style={{
          color: textColor,
          fontWeight: isNow || isSelected ? 700 : 500,
          opacity: isCompleted && !isSelected ? 0.75 : 1,
        }}
      >
        {isCompleted ? "✓ " : ""}{PHASE_SHORT[phase]}
        {isNow && <span className="block text-[8px] opacity-60">now</span>}
      </span>
    </>
  )
}
