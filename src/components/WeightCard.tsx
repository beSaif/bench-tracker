"use client"

import Link from "next/link"
import WeightSparkline from "@/components/WeightSparkline"
import { WeightEntry } from "@/lib/types"
import { delta, describeDay, latestEntry, recentEntries, streak } from "@/lib/weight"

interface Props {
  entries: WeightEntry[]
  /** Opens the check-in sheet from the empty state, so day one isn't a dead card. */
  onCheckIn: () => void
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
    // compare against. "first week" is the wording MomentumStrip already uses for the
    // same not-enough-history state.
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

export default function WeightCard({ entries, onCheckIn }: Props) {
  const latest = latestEntry(entries)

  if (!latest) {
    return (
      <button
        onClick={onCheckIn}
        className="w-full mb-3 px-4 py-3.5 rounded-xl bg-white border border-[#e8e8e8] text-left active:bg-[#fafafa] transition-colors"
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1.5">
          Bodyweight
        </p>
        <p className="text-sm text-[#777777]">
          log your first weigh-in — it takes one tap
        </p>
      </button>
    )
  }

  const d7 = delta(entries, 7)
  const pill = pillFor(d7, entries.length)
  const s = streak(entries)
  const window = recentEntries(entries, 30)

  return (
    <Link
      href="/weight"
      className="block mb-3 px-4 py-3.5 rounded-xl bg-white border border-[#e8e8e8] active:bg-[#fafafa] transition-colors"
    >
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          Bodyweight
        </p>
        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${pill.className}`}>
          {pill.text}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-3xl font-bold text-[#111111] leading-none tabular-nums">
          {latest.kg.toFixed(1)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          kg
        </span>
        <span className="ml-auto text-[11px] text-[#777777] tabular-nums">
          {s.current > 1 ? `${s.current} day streak` : describeDay(latest.date)}
        </span>
      </div>

      {window.length >= 2 && (
        <>
          <WeightSparkline entries={window} className="w-full h-7" />
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-[#cccccc]">30 days ago</span>
            <span className="text-[9px] text-[#cccccc]">now</span>
          </div>
        </>
      )}
    </Link>
  )
}
