"use client"

import { Session } from "@/lib/types"

interface E1RMChartProps {
  sessions: Session[]
}

export default function E1RMChart({ sessions }: E1RMChartProps) {
  const points = sessions
    .filter((s) => s.confirmed && s.date != null && s.type !== "Deload")
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .map((s) => {
      const e1rms = s.sets
        .filter((set) => !set.isWarmup && set.e1rm != null)
        .map((set) => set.e1rm!)
      return e1rms.length > 0 ? Math.max(...e1rms) : null
    })
    .filter((v): v is number => v != null)

  if (points.length < 2) return null

  const W = 320
  const H = 52
  const PAD_X = 4
  const PAD_Y = 8
  const minE = Math.min(...points)
  const maxE = Math.max(...points)
  const range = maxE - minE || 1

  const x = (i: number) =>
    PAD_X + (i * (W - 2 * PAD_X)) / (points.length - 1)
  const y = (e: number) =>
    H - PAD_Y - ((e - minE) / range) * (H - 2 * PAD_Y)

  const pathD = points
    .map((e, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(e).toFixed(1)}`)
    .join(" ")

  const last = points[points.length - 1]
  const first = points[0]
  const delta = parseFloat((last - first).toFixed(1))

  return (
    <div className="mb-6 px-4 py-3 bg-[#fdf5f6] rounded-xl">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          e1RM this block
        </span>
        <span className="text-[10px] font-medium text-[#7a1f2e]">
          {last}kg
          {delta !== 0 && (
            <span className={`ml-1.5 ${delta > 0 ? "text-green-600" : "text-red-500"}`}>
              {delta > 0 ? "+" : ""}{delta}kg
            </span>
          )}
        </span>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block overflow-visible"
      >
        <path
          d={pathD}
          fill="none"
          stroke="#7a1f2e"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
        {points.map((e, i) => (
          <circle
            key={i}
            cx={x(i).toFixed(1)}
            cy={y(e).toFixed(1)}
            r={i === points.length - 1 ? 3.5 : 2.5}
            fill={i === points.length - 1 ? "#7a1f2e" : "#e8a0aa"}
          />
        ))}
      </svg>
    </div>
  )
}
