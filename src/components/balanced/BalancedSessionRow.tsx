"use client"

import { useState } from "react"
import Link from "next/link"
import { Session, TrainingDay } from "@/lib/types"
import { MuscleGroupConfig, getMuscleLabel } from "@/lib/exerciseConfig"
import { getSessionLabel } from "@/lib/trainingMode"
import { sessionWork } from "@/lib/stats"
import { formatVolume } from "@/lib/balance"
import { relativeDate } from "@/lib/time"

interface Props {
  session: Session
  exerciseConfig: MuscleGroupConfig[]
  trainingDays: TrainingDay[]
  /** Labels the top set of sessions carried over from lift-focused mode. */
  mainLiftLabel: string
  /** Largest recent session volume, for the comparison hairline. 0 hides it. */
  peakVolume: number
  onEdit: (session: Session) => void
  onUnlog: (session: Session) => void
  onShare: (session: Session) => void
}

/**
 * A logged Balanced session, with the work it actually contained.
 *
 * The shared SessionCard reads its numbers from `session.sets`, which a Balanced
 * session never has — every set lives in `extraWorkouts` instead, so those cards
 * render blank. `sessionWork` is the summary that covers both.
 */
export default function BalancedSessionRow({
  session,
  exerciseConfig,
  trainingDays,
  mainLiftLabel,
  peakVolume,
  onEdit,
  onUnlog,
  onShare,
}: Props) {
  const [open, setOpen] = useState(false)
  const work = sessionWork(session, mainLiftLabel)
  const label = getSessionLabel(session, trainingDays)
  const logged = work.sets > 0

  return (
    <article className="relative mb-2 rounded-xl bg-white border border-[#e8e8e8] overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#16a34a]" aria-hidden="true" />
      <div className="flex items-stretch">
        <Link
          href={`/session/${session.id}`}
          className="flex-1 min-w-0 pl-4 pr-2 py-2.5 active:opacity-70 transition-opacity"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-bold text-[#111111] truncate">{label}</span>
            <span className="shrink-0 text-[11px] text-[#aaaaaa]">
              {session.date ? relativeDate(session.date) : ""}
            </span>
          </div>

          {logged ? (
            <div className="flex items-baseline gap-1.5 mt-1 text-[12px] text-[#444444] tabular-nums">
              <span className="font-semibold">{work.sets}</span>
              <span className="text-[#aaaaaa]">sets</span>
              <span className="text-[#e0e0e0]">·</span>
              <span className="font-semibold">{work.exercises}</span>
              <span className="text-[#aaaaaa]">{work.exercises === 1 ? "exercise" : "exercises"}</span>
              <span className="text-[#e0e0e0]">·</span>
              <span className="font-semibold">{formatVolume(work.volume)}</span>
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-[#aaaaaa]">No sets logged</p>
          )}

          {work.topSet && (
            <p className="mt-0.5 text-[11px] text-[#777777] truncate">
              top {work.topSet.kg}kg × {work.topSet.reps} — {work.topSet.exercise}
            </p>
          )}

          {work.muscles.length > 0 && (
            <p className="mt-0.5 text-[11px] text-[#aaaaaa] truncate">
              {work.muscles.map((id) => getMuscleLabel(exerciseConfig, id)).join(" · ")}
            </p>
          )}

          {peakVolume > 0 && logged && (
            <div className="mt-2 h-[2px] rounded-full bg-[#f0f0f0] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#16a34a]/40 transition-all duration-500"
                // Inline width: Tailwind cannot generate classes from runtime values.
                style={{ width: `${Math.min(100, (work.volume / peakVolume) * 100)}%` }}
              />
            </div>
          )}
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Hide session actions" : "Show session actions"}
          aria-expanded={open}
          className="shrink-0 px-3 text-[#cccccc] hover:text-[#777777] active:opacity-70 transition-colors"
        >
          <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" aria-hidden="true">
            <circle cx="2" cy="2" r="1.6" />
            <circle cx="8" cy="2" r="1.6" />
            <circle cx="14" cy="2" r="1.6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="flex gap-2 px-4 pb-3 pt-2 border-t border-[#f0f0f0] animate-fade-up">
          <button
            onClick={() => onShare(session)}
            className="text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-[#1e3a5f] hover:text-white transition-colors"
          >
            Share
          </button>
          <button
            onClick={() => onEdit(session)}
            className="text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-[#1e3a5f] hover:text-white transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onUnlog(session)}
            className="text-xs font-semibold text-[#aaaaaa] border border-[#e8e8e8] rounded-lg px-3 py-1.5 hover:border-[#aaaaaa] transition-colors"
          >
            Unlog
          </button>
        </div>
      )}
    </article>
  )
}
