"use client"

import { useState } from "react"
import Link from "next/link"
import { Session, TrainingDay } from "@/lib/types"
import { MuscleGroupConfig } from "@/lib/exerciseConfig"
import {
  BALANCE_WINDOW_DAYS,
  Freshness,
  MuscleRecovery,
  STALE_DAYS,
  formatDays,
  muscleRecovery,
} from "@/lib/balance"

interface Props {
  /** Confirmed sessions, newest first. */
  sessions: Session[]
  exerciseConfig: MuscleGroupConfig[]
  trainingDays: TrainingDay[]
}

const STATE_COLOR: Record<Freshness, string> = {
  fresh: "#16a34a",
  due: "#b06a1e",
  stale: "#b3261e",
  never: "#cccccc",
}

/** Rows shown before the list collapses. Stalest-first, so these are the ones that matter. */
const VISIBLE = 6

function needsWork(r: MuscleRecovery): boolean {
  return r.days === null || r.days >= STALE_DAYS
}

/**
 * Whether the training is actually balanced, as a bar per muscle group.
 *
 * A full bar means the group is covered and an empty one means it has been
 * neglected — the opposite reading of a progress bar, which is why the card keeps
 * the "muscle balance" name rather than calling itself recovery.
 */
export default function MuscleRecoveryBars({ sessions, exerciseConfig, trainingDays }: Props) {
  const [showAll, setShowAll] = useState(false)
  const [metric, setMetric] = useState<"days" | "sets">("days")

  const rows = muscleRecovery(sessions, exerciseConfig, { trainingDays })
  if (rows.length === 0) return null

  const shown = showAll ? rows : rows.slice(0, VISIBLE)
  const peakSets = Math.max(1, ...rows.map((r) => r.sets))
  const unscheduled = rows.filter((r) => r.inAnyDay === false).length
  const stale = rows.filter(needsWork).length
  const untrained = rows.every((r) => r.days === null)

  return (
    <section className="mb-3 px-4 py-3.5 rounded-xl bg-white border border-[#e8e8e8]">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          Muscle balance
        </p>
        {!untrained && (
          <button
            onClick={() => setMetric((v) => (v === "days" ? "sets" : "days"))}
            className="text-[11px] font-semibold text-[#777777] hover:text-[#1e3a5f] active:opacity-70 transition-colors"
          >
            {metric === "days" ? "days since" : `${BALANCE_WINDOW_DAYS}d sets`}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-[7px]">
        {shown.map((r) => {
          const pct = metric === "days" ? r.freshness * 100 : (r.sets / peakSets) * 100
          const color = STATE_COLOR[r.state]
          return (
            <div key={r.id} className="flex items-center gap-2.5">
              <span
                title={r.label}
                className="w-[74px] shrink-0 truncate text-[11px] font-semibold text-[#444444]"
              >
                {r.label}
                {r.inAnyDay === false && <span className="text-[#cccccc]"> *</span>}
              </span>
              <div className="flex-1 min-w-0 h-1.5 rounded-full bg-[#f0f0f0] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  // Widths are inline because Tailwind cannot generate classes from
                  // runtime values. An empty bar keeps a small nub so a neglected
                  // group reads as neglected rather than as missing data.
                  style={{
                    width: `${Math.max(pct, 4)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span
                className="w-[42px] shrink-0 text-right text-[11px] font-semibold tabular-nums"
                style={{ color }}
              >
                {metric === "days" ? formatDays(r.days) : r.sets}
              </span>
            </div>
          )
        })}
      </div>

      {untrained ? (
        <p className="mt-2.5 text-[11px] text-[#777777]">
          Log a session to start tracking your balance
        </p>
      ) : (
        <p className="mt-2.5 text-[11px] text-[#777777]">
          {stale === 0
            ? "Every group trained recently"
            : `${stale} of ${rows.length} need work`}
        </p>
      )}

      {rows.length > VISIBLE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-1.5 text-[11px] font-semibold text-[#777777] hover:text-[#1e3a5f] active:opacity-70 transition-colors"
        >
          {showAll ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}

      {unscheduled > 0 && (
        <p className="mt-2 text-[10px] text-[#aaaaaa]">
          * not in any training day —{" "}
          <Link href="/exercises" className="underline">
            edit days
          </Link>
        </p>
      )}
    </section>
  )
}
