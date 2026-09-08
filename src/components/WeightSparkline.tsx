"use client"

import { WeightEntry } from "@/lib/types"
import { daysBetween } from "@/lib/weight"

const VB_W = 100
const VB_H = 28

interface Props {
  /** Entries to draw, oldest first. Two or more, otherwise there is no line to draw. */
  entries: WeightEntry[]
  className?: string
}

/**
 * A bare trend line for the home card. Points are placed by date, not by index, so a
 * three-day gap reads as a gap in the slope rather than as a steady stretch.
 *
 * The viewBox is stretched to fit its container, which would distort the stroke — hence
 * non-scaling-stroke rather than a fixed stroke-width.
 */
export default function WeightSparkline({ entries, className }: Props) {
  if (entries.length < 2) return null

  const first = entries[0].date
  const span = daysBetween(first, entries[entries.length - 1].date) || 1
  const kgs = entries.map((e) => e.kg)
  const min = Math.min(...kgs)
  const max = Math.max(...kgs)
  // A perfectly flat log would divide by zero; draw it down the middle instead.
  const range = max - min || 1

  const points = entries
    .map((e) => {
      const x = (daysBetween(first, e.date) / span) * VB_W
      const y = VB_H - ((e.kg - min) / range) * VB_H
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#1e3a5f"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
