"use client"

import { useState } from "react"
import Link from "next/link"
import { Session, TrainingDay } from "@/lib/types"
import { MuscleGroupConfig, getMuscleLabel } from "@/lib/exerciseConfig"
import { getSessionLabel } from "@/lib/trainingMode"
import { sessionWork } from "@/lib/stats"
import { relativeDate } from "@/lib/time"

interface Props {
  session: Session
  exerciseConfig: MuscleGroupConfig[]
  trainingDays: TrainingDay[]
  /** Labels the top set of sessions carried over from lift-focused mode. */
  mainLiftLabel: string
  onEdit: (session: Session) => void
  onUnlog: (session: Session) => void
  onShare: (session: Session) => void
}

/**
 * A logged Balanced session, as one row of the home screen's recent-sessions card.
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
  onEdit,
  onUnlog,
  onShare,
}: Props) {
  const [open, setOpen] = useState(false)
  const work = sessionWork(session, mainLiftLabel)
  const label = getSessionLabel(session, trainingDays)
  const logged = work.sets > 0

  const date = session.date ? new Date(session.date) : null
  const dateLabel =
    date && !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
      : ""
  const muscles = work.muscles.map((id) => getMuscleLabel(exerciseConfig, id)).join(" · ")

  return (
    <article>
      <div className="flex items-start">
        <Link
          href={`/session/${session.id}`}
          className="flex-1 min-w-0 pl-4 pr-1 py-3 active:opacity-70 transition-opacity"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] font-semibold text-[#111111] truncate">{label}</span>
            <span
              title={session.date ? relativeDate(session.date) : undefined}
              className="shrink-0 text-[11px] text-[#aaaaaa] tabular-nums"
            >
              {dateLabel}
            </span>
          </div>

          {muscles && <p className="mt-0.5 text-[12px] text-[#777777] truncate">{muscles}</p>}

          {logged ? (
            <p className="mt-1.5 text-[12px] text-[#aaaaaa] tabular-nums truncate">
              <span className="font-semibold text-[#1e3a5f]">{work.sets}</span> sets
              {work.topSet && (
                <>
                  <span className="text-[#e0e0e0]"> · </span>
                  <span className="font-semibold text-[#444444]">
                    {work.topSet.kg}kg × {work.topSet.reps}
                  </span>{" "}
                  {work.topSet.exercise}
                </>
              )}
              {work.cardioMinutes > 0 && (
                <>
                  <span className="text-[#e0e0e0]"> · </span>
                  <span className="font-semibold text-[#444444]">{work.cardioMinutes}</span> min cardio
                </>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-[#aaaaaa]">No sets logged</p>
          )}
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Hide session actions" : "Show session actions"}
          aria-expanded={open}
          className="shrink-0 self-start px-3 pt-[19px] pb-3 text-[#cccccc] hover:text-[#777777] active:opacity-70 transition-colors"
        >
          <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" aria-hidden="true">
            <circle cx="2" cy="2" r="1.6" />
            <circle cx="8" cy="2" r="1.6" />
            <circle cx="14" cy="2" r="1.6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="flex gap-2 px-4 pb-3 pt-1 animate-fade-up">
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
