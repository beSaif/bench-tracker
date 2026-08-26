"use client"

import { ShortfallResult } from "@/lib/shortfall"

interface Props {
  result: ShortfallResult
  phaseLabel: string
  onAddBuildBlock: () => void
  onRestartCycle: () => void
  onKeep: () => void
}

export default function RecalibratePromptModal({
  result,
  phaseLabel,
  onAddBuildBlock,
  onRestartCycle,
  onKeep,
}: Props) {
  const { targetWeight, targetReps, targetSets, achievedTopWeight, achievedTotalReps, targetTotalReps, rebuildLoads } = result
  const buildCount = rebuildLoads.length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
          {phaseLabel} · fell short
        </p>
        <p className="text-base font-semibold text-[#111111] mb-1">Let&apos;s build up to it</p>
        <p className="text-sm text-[#777777] mb-4">
          You didn&apos;t quite hit the main lift this session. The goal stays the same —
          let&apos;s add work to build the strength for it.
        </p>

        {/* Target vs actual */}
        <div className="rounded-xl bg-[#f5f5f5] px-4 py-3 mb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#777777]">Prescribed</span>
            <span className="font-semibold text-[#111111]">
              {targetWeight}kg × {targetReps} × {targetSets}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1.5">
            <span className="text-[#777777]">You did</span>
            <span className="font-semibold text-[#111111]">
              {achievedTopWeight}kg · {achievedTotalReps}/{targetTotalReps} reps
            </span>
          </div>
        </div>

        <button
          onClick={onAddBuildBlock}
          className="w-full bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-3.5 mb-3 hover:bg-[#16304f] active:bg-[#0f2540] transition-colors"
        >
          Add build block
          <span className="block text-[11px] font-normal text-white/70 mt-0.5">
            {buildCount} session{buildCount !== 1 ? "s" : ""} ramping to {targetWeight}kg, then back to the plan
          </span>
        </button>

        <button
          onClick={onRestartCycle}
          className="w-full border border-[#e8e8e8] text-[#1e3a5f] text-sm font-semibold rounded-xl py-3.5 mb-3 hover:bg-[#f5f5f5] active:bg-[#ececec] transition-colors"
        >
          Restart the cycle
          <span className="block text-[11px] font-normal text-[#999999] mt-0.5">
            Start over from Accumulation — same goal
          </span>
        </button>

        <button
          onClick={onKeep}
          className="w-full text-xs text-[#aaaaaa] hover:text-[#555555] active:text-[#333333] transition-colors pt-1"
        >
          Keep plan as-is
        </button>
      </div>
    </div>
  )
}
