"use client"

import { WeightEntry } from "@/lib/types"
import { daysBetween, formatDay, rollingAverage } from "@/lib/weight"

const VB_W = 100
const VB_H = 42
/** A break longer than this reads as "stopped weighing in", so the line breaks too. */
const GAP_DAYS = 4

interface Props {
  /** Entries in the selected range, oldest first. */
  entries: WeightEntry[]
  goalBw?: number
}

interface Pt {
  x: number
  y: number
  gapBefore: boolean
}

/**
 * Weight over time: raw readings faint, the 7-day average emphasised, the goal as a
 * dashed rule. Hand-built SVG because the app carries no charting library and the
 * whole visual language here is inline SVG.
 */
export default function WeightChart({ entries, goalBw }: Props) {
  if (entries.length < 2) {
    return (
      <div className="h-[140px] flex items-center justify-center rounded-xl bg-[#fafafa] border border-[#f0f0f0]">
        <p className="text-sm text-[#aaaaaa]">
          {entries.length === 0 ? "nothing logged yet" : "one reading — log another to see a trend"}
        </p>
      </div>
    )
  }

  const avg = rollingAverage(entries)
  const first = entries[0].date
  const span = daysBetween(first, entries[entries.length - 1].date) || 1

  const kgs = entries.map((e) => e.kg)
  let min = Math.min(...kgs)
  let max = Math.max(...kgs)
  // Keep the goal line inside the frame, otherwise it silently clips off the top.
  if (goalBw != null) {
    min = Math.min(min, goalBw)
    max = Math.max(max, goalBw)
  }
  const pad = (max - min) * 0.12 || 0.5
  min -= pad
  max += pad
  const range = max - min || 1

  const x = (date: string) => (daysBetween(first, date) / span) * VB_W
  const y = (kg: number) => VB_H - ((kg - min) / range) * VB_H

  // Split at long gaps so a fortnight off doesn't render as a confident straight line
  // between two distant readings.
  function toSegments(series: Array<{ date: string; kg: number }>): string[] {
    const segments: string[] = []
    let current: string[] = []
    let prev: string | null = null
    for (const p of series) {
      const pt: Pt = { x: x(p.date), y: y(p.kg), gapBefore: prev != null && daysBetween(prev, p.date) > GAP_DAYS }
      if (pt.gapBefore && current.length > 0) {
        segments.push(current.join(" "))
        current = []
      }
      current.push(`${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
      prev = p.date
    }
    if (current.length > 0) segments.push(current.join(" "))
    return segments.filter((s) => s.includes(" "))
  }

  const rawSegments = toSegments(entries)
  const avgSegments = toSegments(avg)
  const goalY = goalBw != null ? y(goalBw) : null

  return (
    <div>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="w-full h-[140px]"
        aria-hidden="true"
      >
        {goalY != null && (
          <line
            x1="0"
            y1={goalY}
            x2={VB_W}
            y2={goalY}
            stroke="#aaaaaa"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {rawSegments.map((points, i) => (
          <polyline
            key={`raw-${i}`}
            points={points}
            fill="none"
            stroke="#dbeafe"
            strokeWidth="1.5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {avgSegments.map((points, i) => (
          <polyline
            key={`avg-${i}`}
            points={points}
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-[#cccccc]">{formatDay(first)}</span>
        <span className="text-[9px] text-[#cccccc]">
          {formatDay(entries[entries.length - 1].date)}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-[10px] text-[#777777]">
          <span className="w-3 h-0.5 rounded bg-[#1e3a5f]" />7-day average
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#777777]">
          <span className="w-3 h-0.5 rounded bg-[#dbeafe]" />daily
        </span>
        {goalBw != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-[#777777]">
            <span className="w-3 border-t border-dashed border-[#aaaaaa]" />goal
          </span>
        )}
      </div>
    </div>
  )
}
