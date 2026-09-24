"use client"

import { useState } from "react"
import Link from "next/link"
import { Session, TrainingDay } from "@/lib/types"
import { getSessionLabel } from "@/lib/trainingMode"
import { sessionWork } from "@/lib/stats"
import { relativeDate } from "@/lib/time"

interface Props {
  session: Session
  trainingDays: TrainingDay[]
  /** Labels the top set of sessions carried over from lift-focused mode. */
  mainLiftLabel: string
  onEdit: (session: Session) => void
  onUnlog: (session: Session) => void
  onShare: (session: Session) => void
}

/**
 * A logged Balanced session, as a card in the home screen's recent sessions.
 *
 * The shared SessionCard reads its numbers from `session.sets`, which a Balanced
 * session never has — every set lives in `extraWorkouts` instead, so those cards
 * render blank. `sessionWork` is the summary that covers both.
 */
export default function BalancedSessionRow({
  session,
  trainingDays,
  mainLiftLabel,
  onEdit,
  onUnlog,
  onShare,
}: Props) {
  const [open, setOpen] = useState(false)
  const work = sessionWork(session, mainLiftLabel)
  const label = getSessionLabel(session, trainingDays)

  const date = session.date ? new Date(session.date) : null
  const dateLabel =
    date && !isNaN(date.getTime())
      ? [
          date.toLocaleDateString(undefined, { weekday: "short" }),
          date.getDate(),
          date.toLocaleDateString(undefined, { month: "short" }),
        ].join(" ")
      : ""
  const highlight =
    work.sets === 0
      ? "No sets logged"
      : work.topSet
      ? `${work.topSet.exercise} ${work.topSet.kg}×${work.topSet.reps}`
      : work.cardioMinutes > 0
      ? `${work.cardioMinutes} min cardio`
      : ""
  const subtitle = [dateLabel, highlight].filter(Boolean).join(" · ")

  return (
    <article className="mb-2 rounded-xl bg-white border border-[#e8e8e8] overflow-hidden">
      <div className="flex items-center">
        <Link
          href={`/session/${session.id}`}
          className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-1 py-3.5 active:opacity-70 transition-opacity"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-[#111111] truncate">{label}</p>
            <p
              title={session.date ? relativeDate(session.date) : undefined}
              className="mt-0.5 text-[12px] text-[#aaaaaa] truncate"
            >
              {subtitle}
            </p>
          </div>
          <span className="shrink-0 min-w-[64px] text-center rounded-lg bg-[#eef3f9] text-[#1e3a5f] text-[12px] font-bold px-2.5 py-1.5 tabular-nums">
            {work.sets} sets
          </span>
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Hide session actions" : "Show session actions"}
          aria-expanded={open}
          className="shrink-0 self-stretch px-3 text-[#cccccc] hover:text-[#777777] active:opacity-70 transition-colors"
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
