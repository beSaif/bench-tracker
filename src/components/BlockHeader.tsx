"use client"

import { TrainingBlock, BlockPhase } from "@/lib/types"
import { BLOCK_LENGTHS, PHASE_SESSION_TYPE } from "@/lib/prescription"

const PHASE_STYLE: Record<BlockPhase, { bar: string; label: string; meta: string; bg: string }> = {
  accumulation: {
    bar: "bg-[#2d6a2d]",
    label: "text-[#2d6a2d]",
    meta: "text-[#4a8a4a]",
    bg: "bg-[#f0f7f0]",
  },
  transmutation: {
    bar: "bg-[#5a2d8a]",
    label: "text-[#5a2d8a]",
    meta: "text-[#7a4daa]",
    bg: "bg-[#f5f0ff]",
  },
  realization: {
    bar: "bg-[#1e3a5f]",
    label: "text-[#1e3a5f]",
    meta: "text-[#3b5f8a]",
    bg: "bg-[#eff6ff]",
  },
  deload: {
    bar: "bg-[#888888]",
    label: "text-[#555555]",
    meta: "text-[#888888]",
    bg: "bg-[#f5f5f5]",
  },
}

interface BlockHeaderProps {
  block: TrainingBlock
  confirmedCount: number
  onEditAnchor?: () => void
}

export default function BlockHeader({ block, confirmedCount, onEditAnchor }: BlockHeaderProps) {
  const style = PHASE_STYLE[block.phase]
  const total = BLOCK_LENGTHS[block.phase]

  return (
    <div className={`${style.bg} rounded-xl px-4 py-3 mb-3${block.status === "completed" ? " opacity-75" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-4 rounded-full ${style.bar}`} />
          <span className={`text-sm font-semibold ${style.label}`}>
            {block.status === "completed" ? "✓ " : ""}{PHASE_SESSION_TYPE[block.phase]}
          </span>
          {block.status === "completed" ? (
            <span className={`text-xs ${style.meta}`}>· {block.anchorWeight}kg anchor</span>
          ) : (
            <button
              onClick={onEditAnchor}
              className={`text-xs ${style.meta} hover:underline`}
            >
              · {block.anchorWeight}kg anchor
            </button>
          )}
        </div>
        <span className={`text-xs font-semibold ${style.label} opacity-60`}>
          {confirmedCount}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-black/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${style.bar} transition-all duration-500`}
          style={{ width: total > 0 ? `${(confirmedCount / total) * 100}%` : "0%" }}
        />
      </div>
    </div>
  )
}
