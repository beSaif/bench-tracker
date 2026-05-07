"use client"

interface ProgressBarProps {
  current: number | null
  target: number
  start?: number
}

export default function ProgressBar({ current, target, start }: ProgressBarProps) {
  const pct = current != null ? Math.min((current / target) * 100, 100) : 0
  const pctStr = pct.toFixed(1)
  const startPct = start != null ? Math.min((start / target) * 100, 100) : null

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs font-medium text-[#777777] tracking-wide uppercase">
          Road to {target}kg
        </span>
        <span className="text-xs text-[#777777]">
          best {current != null ? `${current}kg` : "—"} / {target}kg
          <span className="ml-2 text-[#7a1f2e] font-medium">{pctStr}%</span>
        </span>
      </div>
      <div className="relative h-[2px] w-full bg-[#e8e8e8] rounded-full overflow-visible">
        <div
          className="h-full bg-[#7a1f2e] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        {startPct != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[2px] h-[8px] bg-[#c0c0c0] rounded-full"
            style={{ left: `${startPct}%` }}
          />
        )}
      </div>
      {startPct != null && start != null && (
        <div className="relative mt-1 h-3">
          <span
            className="absolute text-[9px] text-[#bbbbbb] -translate-x-1/2"
            style={{ left: `${startPct}%` }}
          >
            started {start}kg
          </span>
        </div>
      )}
    </div>
  )
}
