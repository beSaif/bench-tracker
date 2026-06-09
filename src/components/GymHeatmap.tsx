"use client"

import { useMemo } from "react"
import { Session } from "@/lib/types"
import { parseLocalDate, dateKey } from "@/lib/time"

interface GymHeatmapProps {
  sessions: Session[]
  weeks?: number
}

const DAY_MS = 86_400_000

export default function GymHeatmap({ sessions, weeks = 16 }: GymHeatmapProps) {
  const cells = useMemo(() => {
    const daySet = new Set(
      sessions
        .filter((s) => s.confirmed && s.date != null)
        .map((s) => dateKey(parseLocalDate(s.date!)))
    )

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // Monday of the current week (Mon=0 … Sun=6)
    const mondayOffset = (today.getDay() + 6) % 7
    const thisMonday = new Date(today.getTime() - mondayOffset * DAY_MS)
    const firstMonday = new Date(thisMonday.getTime() - (weeks - 1) * 7 * DAY_MS)

    const todayKey = dateKey(today)
    // Column-first order: cell i = firstMonday + i days → each 7-cell run is one Mon→Sun week
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const d = new Date(firstMonday.getTime() + i * DAY_MS)
      const key = dateKey(d)
      return {
        key,
        inFuture: d.getTime() > today.getTime(),
        trained: daySet.has(key),
        isToday: key === todayKey,
      }
    })
  }, [sessions, weeks])

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "#aaaaaa" }}>
          Gym Days
        </span>
        <span className="text-[10px]" style={{ color: "#aaaaaa" }}>
          Last {weeks} weeks
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: "repeat(7, 1fr)",
          gridTemplateColumns: `repeat(${weeks}, 1fr)`,
          gap: "3px",
        }}
      >
        {cells.map((c) => (
          <div
            key={c.key}
            style={{
              aspectRatio: "1 / 1",
              borderRadius: "3px",
              backgroundColor: c.inFuture ? "transparent" : c.trained ? "#1e3a5f" : "#eff6ff",
              boxShadow: c.isToday ? "inset 0 0 0 1px #1e3a5f" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  )
}
