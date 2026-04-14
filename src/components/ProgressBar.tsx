"use client"

interface ProgressBarProps {
  current: number | null
  target: number
}

export default function ProgressBar({ current, target }: ProgressBarProps) {
  const pct = current != null ? Math.min((current / target) * 100, 100) : 0
  const pctStr = pct.toFixed(1)

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2.5">
        <span
          className="font-hand text-base font-semibold tracking-wide uppercase"
          style={{ color: "#5a4f47" }}
        >
          Road to {target}kg
        </span>
        <span className="text-xs" style={{ color: "#9a8f87" }}>
          {current != null ? `${current}kg` : "—"} / {target}kg
          <span className="ml-2 font-semibold" style={{ color: "#8b2a1e" }}>
            {pctStr}%
          </span>{" "}
          <span style={{ color: "#2c2724", opacity: 0.5 }}>✳</span>
        </span>
      </div>

      {/* Organic ink-line progress bar */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: "8px",
          borderRadius: "4px 2px 4px 2px / 2px 4px 2px 4px",
          border: "1.5px solid #8b2a1e",
          backgroundColor: "#faf0ea",
        }}
      >
        <div
          className="absolute left-0 top-0 h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: "#d4a843",
            borderRadius: "3px 1px 3px 1px",
          }}
        />
      </div>
    </div>
  )
}
