"use client"

import PixelCharacter from "@/components/PixelCharacter"

interface ProgressBarProps {
  current: number | null
  target: number
}

export default function ProgressBar({ current, target }: ProgressBarProps) {
  const pct = current != null ? Math.min((current / target) * 100, 100) : 0
  const pctStr = pct.toFixed(1)

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs font-medium text-[#777777] tracking-wide uppercase">
          Road to {target}kg
        </span>
        <span className="text-xs text-[#777777]">
          {current != null ? `${current}kg` : "—"} / {target}kg
          <span className="ml-2 text-[#7a1f2e] font-medium">{pctStr}%</span>
        </span>
      </div>
      {/* Character zone + track */}
      <div className="relative pt-9">
        <PixelCharacter
          animation={pct >= 75 ? "run" : "walk"}
          direction="east"
          size={32}
          style={{
            position: "absolute",
            top: 0,
            left: `clamp(0px, calc(${pct}% - 16px), calc(100% - 32px))`,
            transition: "left 0.5s ease",
          }}
        />
        <div className="h-[2px] w-full bg-[#e8e8e8] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7a1f2e] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
