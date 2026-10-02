"use client"

import Link from "next/link"
import WeightSparkline from "@/components/WeightSparkline"
import { WeightEntry } from "@/lib/types"
import { delta, describeDay, latestEntry, recentEntries } from "@/lib/weight"

interface Props {
  entries: WeightEntry[]
  /** The log hasn't arrived yet: hold the row's space instead of claiming it's empty. */
  loading?: boolean
  /** Opens the check-in sheet for today. The app only asks weekly; this is every other day. */
  onLog: () => void
}

interface Pill {
  text: string
  className: string
}

/**
 * Bodyweight has no universally "good" direction — a cut and a bulk want opposite
 * signs — so the delta is coloured by size, not by direction: a big weekly swing is
 * worth noticing either way, a small one is just water.
 */
function pillFor(d: number | null, entryCount: number): Pill {
  if (d === null) {
    // Either the very first entry, or a log too young to have a week-old reading to
    // compare against.
    return {
      text: entryCount < 2 ? "first weigh-in" : "first week",
      className: "bg-[#f5f5f5] text-[#777777]",
    }
  }
  if (Math.abs(d) < 0.3) return { text: "steady", className: "bg-[#f5f5f5] text-[#777777]" }
  const sign = d > 0 ? "+" : "−"
  const text = `${sign}${Math.abs(d).toFixed(1)}kg`
  return Math.abs(d) >= 1.5
    ? { text, className: "bg-[#fff8ed] text-[#b06a1e]" }
    : { text, className: "bg-[#f3faf4] text-[#16a34a]" }
}

function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Log weight"
      className="w-9 h-9 shrink-0 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center active:bg-[#0f2540] transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
        <path d="M8 2.5v11M2.5 8h11" />
      </svg>
    </button>
  )
}

/**
 * One compact row: the latest reading, a 30-day sparkline, the weekly delta, and a +
 * to log by hand. The row links to /weight for the full chart; the + is a sibling of
 * that link rather than inside it, so tapping it never navigates.
 */
export default function WeightCard({ entries, loading = false, onLog }: Props) {
  const latest = latestEntry(entries)

  if (loading && !latest) {
    return (
      <div className="mb-3 flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl bg-white border border-[#e8e8e8]">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] leading-tight">
            Bodyweight
          </p>
          {/* Same type as the real reading, so the row doesn't change height when it lands. */}
          <p className="leading-tight">
            <span className="text-lg font-bold tabular-nums text-transparent rounded bg-[#f0f0f0] animate-pulse">
              00.0 kg
            </span>
          </p>
        </div>
        <PlusButton onClick={onLog} />
      </div>
    )
  }

  if (!latest) {
    return (
      <div className="mb-3 flex items-center gap-3 pl-4 pr-2 py-2 rounded-xl bg-white border border-[#e8e8e8]">
        <button onClick={onLog} className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
            Bodyweight
          </p>
          <p className="text-sm text-[#777777] truncate">log your first weigh-in</p>
        </button>
        <PlusButton onClick={onLog} />
      </div>
    )
  }

  const d7 = delta(entries, 7)
  const pill = pillFor(d7, entries.length)
  const window = recentEntries(entries, 30)

  return (
    <div className="mb-3 flex items-center gap-2 pl-4 pr-2 py-2 rounded-xl bg-white border border-[#e8e8e8]">
      <Link
        href="/weight"
        className="flex-1 min-w-0 flex items-center gap-3 rounded-lg active:opacity-70 transition-opacity"
      >
        <div className="shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] leading-tight">
            Bodyweight
          </p>
          <p className="flex items-baseline gap-1 leading-tight">
            <span className="text-lg font-bold text-[#111111] tabular-nums">
              {latest.kg.toFixed(1)}
            </span>
            <span className="text-[10px] font-semibold text-[#aaaaaa]">kg</span>
            <span className="text-[10px] text-[#aaaaaa] ml-0.5">{describeDay(latest.date)}</span>
          </p>
        </div>
        <div className="flex-1 min-w-0">
          {window.length >= 2 && <WeightSparkline entries={window} className="w-full h-5" />}
        </div>
        <span className={`shrink-0 text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${pill.className}`}>
          {pill.text}
        </span>
      </Link>
      <PlusButton onClick={onLog} />
    </div>
  )
}
