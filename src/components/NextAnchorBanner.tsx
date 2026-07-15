"use client"

import { useState } from "react"
import { NextAnchorSuggestion } from "@/lib/prescription"
import { roundToPlate } from "@/lib/e1rm"

interface NextAnchorBannerProps {
  suggestion: NextAnchorSuggestion
  onPick: (anchor: number) => void
  onDismiss: () => void
}

export default function NextAnchorBanner({ suggestion, onPick, onDismiss }: NextAnchorBannerProps) {
  const { basisWeight, basisRPE, recommended, options } = suggestion
  const [custom, setCustom] = useState("")

  function submitCustom() {
    const parsed = parseFloat(custom)
    if (!isNaN(parsed) && parsed > 0) onPick(roundToPlate(parsed))
  }

  return (
    <div className="mb-4 rounded-xl bg-[#eff6ff] border border-[#c7dbf2] px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-[#1e3a5f]" />
          <span className="text-sm font-semibold text-[#1e3a5f]">Set your next cycle&apos;s anchor</span>
        </div>
        <button onClick={onDismiss} className="text-[#7a94b5] active:opacity-70" aria-label="Keep suggested">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <path d="M1.41 0L0 1.41 5.59 7 0 12.59 1.41 14 7 8.41 12.59 14 14 12.59 8.41 7 14 1.41 12.59 0 7 5.59 1.41 0z" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-[#3b5f8a] leading-snug mb-3">
        Cycle done — top single was {basisWeight}kg{basisRPE != null ? ` @ RPE ${basisRPE}` : ""}. Pick the anchor for the next cycle.
      </p>

      <div className="flex flex-wrap gap-2 mb-2">
        {options.map((w) => {
          const isRec = w === recommended
          return (
            <button
              key={w}
              onClick={() => onPick(w)}
              className={`text-sm font-semibold rounded-lg px-3 py-1.5 active:opacity-80 ${
                isRec
                  ? "text-white bg-[#1e3a5f]"
                  : "text-[#1e3a5f] bg-white border border-[#c7dbf2]"
              }`}
            >
              {w}kg{isRec ? " · recommended" : ""}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitCustom() }}
          placeholder="custom kg"
          className="w-24 text-sm text-[#1e3a5f] bg-white border border-[#c7dbf2] rounded-lg px-2 py-1.5 outline-none"
        />
        <button
          onClick={submitCustom}
          className="text-sm font-medium text-[#1e3a5f] bg-white border border-[#c7dbf2] rounded-lg px-3 py-1.5 active:opacity-70"
        >
          Set
        </button>
      </div>
    </div>
  )
}
