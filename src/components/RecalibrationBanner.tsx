"use client"

import { RecalibrationProposal } from "@/lib/recalibration"

interface RecalibrationBannerProps {
  proposal: RecalibrationProposal
  onAccept: () => void
  onDismiss: () => void
}

export default function RecalibrationBanner({ proposal, onAccept, onDismiss }: RecalibrationBannerProps) {
  const { reason, oldAnchor, newAnchor, message } = proposal
  const heading = reason === "layoff" ? "Welcome back — let's recalibrate" : "Time to recalibrate"

  return (
    <div className="mb-4 rounded-xl bg-[#fff8f0] border border-[#f0d9b8] px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-[#c8791e]" />
          <span className="text-sm font-semibold text-[#8a5311]">{heading}</span>
        </div>
        <span className="text-xs font-semibold text-[#8a5311] opacity-70">
          {oldAnchor}kg → {newAnchor}kg
        </span>
      </div>

      <p className="text-xs text-[#7a5a2e] leading-snug mb-3">{message}</p>

      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          className="text-sm font-medium text-white bg-[#c8791e] rounded-lg px-3 py-1.5 active:opacity-80"
        >
          Recalibrate
        </button>
        <button
          onClick={onDismiss}
          className="text-sm font-medium text-[#8a5311] bg-white border border-[#e6c99a] rounded-lg px-3 py-1.5 active:opacity-70"
        >
          Keep plan
        </button>
      </div>
    </div>
  )
}
