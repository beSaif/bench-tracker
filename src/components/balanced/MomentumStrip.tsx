"use client"

import { Session } from "@/lib/types"
import { momentum } from "@/lib/balance"

interface Props {
  /** Confirmed sessions, newest first. */
  sessions: Session[]
}

interface Pill {
  text: string
  className: string
}

/**
 * Balanced mode has no target to chase, so "am I actually training?" is the only
 * progress question left. A week off shows up here as an amber pill, which is how
 * a layoff surfaces in this mode — LayoffBanner is tied to blocks and stays hidden.
 */
function pillFor(m: ReturnType<typeof momentum>): Pill {
  if (m.current.sessions === 0 && m.daysSinceLast != null && m.daysSinceLast >= 7) {
    return { text: `${m.daysSinceLast}d off`, className: "bg-[#fff8ed] text-[#b06a1e]" }
  }
  if (m.setsDeltaPct === null) {
    if (m.current.sets === 0) return { text: "rest week", className: "bg-[#f5f5f5] text-[#777777]" }
    // Nothing to compare against: either a genuine first week, or a return after a
    // layoff long enough that the previous week was empty.
    return m.hasEarlierHistory
      ? { text: "back at it", className: "bg-[#f3faf4] text-[#16a34a]" }
      : { text: "first week", className: "bg-[#f5f5f5] text-[#777777]" }
  }
  if (m.setsDeltaPct >= 5) {
    return { text: `+${m.setsDeltaPct}% sets`, className: "bg-[#f3faf4] text-[#16a34a]" }
  }
  if (m.setsDeltaPct <= -5) {
    return { text: `−${Math.abs(m.setsDeltaPct)}% sets`, className: "bg-[#fff8ed] text-[#b06a1e]" }
  }
  return { text: "steady", className: "bg-[#f5f5f5] text-[#777777]" }
}

export default function MomentumStrip({ sessions }: Props) {
  const m = momentum(sessions)
  if (m.empty) return null

  const pill = pillFor(m)

  return (
    <section className="mb-3 px-4 py-3.5 rounded-xl bg-white border border-[#e8e8e8]">
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          Last 7 days
        </p>
        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${pill.className}`}>
          {pill.text}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-3xl font-bold text-[#111111] leading-none tabular-nums">
          {m.current.sets}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          sets
        </span>
        <span className="ml-auto text-[11px] text-[#777777] tabular-nums">
          {m.current.sessions} session{m.current.sessions === 1 ? "" : "s"}
        </span>
      </div>

      {/* Eight rolling weeks, oldest to newest. Bars are sized inline because
          Tailwind cannot generate classes from runtime values. */}
      <div className="flex items-end gap-1 h-8">
        {m.buckets.map((b) => {
          const pct = m.peakSets > 0 ? (b.sets / m.peakSets) * 100 : 0
          const isNow = b.weeksAgo === 0
          return (
            <div
              key={b.weeksAgo}
              className="relative flex-1 h-full rounded-[3px] bg-[#f5f5f5] overflow-hidden"
              title={`${b.sets} sets`}
            >
              <div
                className={`absolute inset-x-0 bottom-0 rounded-[3px] transition-all duration-500 ${
                  isNow ? "bg-[#1e3a5f]" : "bg-[#dbeafe]"
                }`}
                // A rest week stays at zero so gaps read as gaps; anything logged
                // gets a visible floor so a 2-set week isn't invisible.
                style={{ height: `${pct === 0 ? 0 : Math.max(pct, 8)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-[#cccccc]">8 weeks ago</span>
        <span className="text-[9px] text-[#cccccc]">now</span>
      </div>
    </section>
  )
}
