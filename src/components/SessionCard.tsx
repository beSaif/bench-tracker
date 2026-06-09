"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Session, MuscleGroup } from "@/lib/types"
import { MuscleGroupConfig, getMuscleLabel } from "@/lib/exerciseConfig"

interface SessionCardProps {
  session: Session
  blockIndex?: number
  onStartLogging?: (session: Session) => void
  onEdit?: (session: Session) => void
  onUnlog?: (session: Session) => void
  onShare?: (session: Session) => void
  onUpdateMuscleGroups?: (session: Session, muscles: MuscleGroup[]) => void
  exerciseConfig: MuscleGroupConfig[]
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

export default function SessionCard({
  session,
  blockIndex,
  onStartLogging,
  onEdit,
  onUnlog,
  onShare,
  onUpdateMuscleGroups,
  exerciseConfig,
}: SessionCardProps) {
  const isUpcoming = !session.confirmed

  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedGroups, setSelectedGroups] = useState<MuscleGroup[]>(
    session.selectedMuscleGroups ?? []
  )

  useEffect(() => {
    if (pickerOpen) {
      setSelectedGroups(session.selectedMuscleGroups ?? [])
    }
  }, [pickerOpen, session.selectedMuscleGroups])

  const allGroups = [...exerciseConfig].sort((a, b) => a.name.localeCompare(b.name))

  const working = session.sets.filter((s) => !s.isWarmup)
  const topWeight = working[0]?.kg ?? null
  const topReps = working[0]?.reps ?? null
  const setCount = working.length
  const e1rms = working.map((s) => s.e1rm).filter((v): v is number => v != null)
  const bestE1RM = e1rms.length > 0 ? Math.max(...e1rms) : null

  const upcomingBody = (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1e3a5f]">
          BENCH · {session.type}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f] inline-block" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1e3a5f]">
            Up next
          </span>
        </div>
      </div>

      {topWeight != null && (
        <div className="flex items-center gap-4">
          <span className="text-5xl font-extrabold text-[#1e3a5f] leading-none tracking-tight">
            {topWeight}kg
          </span>
          <div className="flex flex-col gap-1">
            {topReps != null && (
              <span className="text-xl font-bold text-[#444444] leading-none">
                {topReps} reps
              </span>
            )}
            {setCount > 0 && (
              <span className="text-base font-medium text-[#aaaaaa] leading-none">
                {setCount} sets
              </span>
            )}
          </div>
        </div>
      )}

      {session.bw && (
        <p className="text-xs text-[#aaaaaa] mt-2">{session.bw}kg BW</p>
      )}
    </div>
  )

  const confirmedBody = (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#777777]">
          Session {blockIndex !== undefined ? String(blockIndex) : String(session.id).padStart(2, "0")} · {session.type}
          {session.bw ? ` · ${session.bw}kg BW` : ""}
        </span>
        {session.date && (
          <span className="text-[11px] text-[#aaaaaa]">{formatDate(session.date)}</span>
        )}
      </div>

      <div className="flex border border-[#e8e8e8] rounded-xl overflow-hidden">
        <div className="flex-1 px-3 py-3 flex flex-col gap-1 bg-[#eff6ff]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
            Top Set
          </span>
          <span className="text-2xl font-bold text-[#1e3a5f] leading-none">
            {topWeight != null ? `${topWeight}kg` : "—"}
          </span>
        </div>

        <div className="flex-1 px-3 py-3 flex flex-col gap-1 bg-white border-l border-r border-[#e8e8e8]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
            Reps × Sets
          </span>
          <span className="text-2xl font-bold text-[#111111] leading-none">
            {topReps != null && setCount > 0 ? `${topReps} × ${setCount}` : "—"}
          </span>
        </div>

        <div className="flex-1 px-3 py-3 flex flex-col gap-1 bg-white">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
            e1RM
          </span>
          <span className="text-2xl font-bold text-[#1e3a5f] leading-none">
            {bestE1RM != null ? `${bestE1RM}kg` : "—"}
          </span>
        </div>
      </div>
    </div>
  )

  const cardBorder = isUpcoming
    ? "border-dashed border-[#bfdbfe]"
    : "border-solid border-[#e8e8e8]"
  const cardBg = isUpcoming ? "bg-[#eff6ff]" : "bg-white"

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${cardBorder} ${cardBg}`}>
      <div className="h-1 bg-[#1e3a5f]" />

      {isUpcoming ? (
        upcomingBody
      ) : (
        <Link href={`/session/${session.id}`} className="block hover:bg-[#fafafa] transition-colors">
          {confirmedBody}
        </Link>
      )}

      {isUpcoming && pickerOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-[#e8e8e8]">
          <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-3">
            Additional Muscle Groups
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {allGroups.map((g) => {
              const checked = selectedGroups.includes(g.id)
              return (
                <label
                  key={g.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-[#1e3a5f]/40 bg-[#1e3a5f]/[0.04] text-[#1e3a5f]"
                      : "border-[#e8e8e8] text-[#111111]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedGroups((prev) =>
                        prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                      )
                    }
                    className="accent-[#1e3a5f]"
                  />
                  <span className="font-medium text-xs">{g.name}</span>
                </label>
              )
            })}
          </div>
          <button
            onClick={() => {
              onUpdateMuscleGroups?.(session, selectedGroups)
              setPickerOpen(false)
            }}
            className="w-full rounded-lg border border-[#1e3a5f] text-[#1e3a5f] text-xs font-semibold py-2 hover:bg-[#1e3a5f] hover:text-white transition-colors"
          >
            Save Selection
          </button>
        </div>
      )}

      <div className={`${isUpcoming ? "bg-[#dbeafe]" : "bg-[#eff6ff]"} px-4 py-3 flex items-center justify-between`}>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const muscles = isUpcoming
              ? (session.selectedMuscleGroups ?? [])
              : (session.extraWorkouts?.map((w) => w.muscle) ?? [])
            return muscles.map((id) => (
              <span
                key={id}
                className="text-[10px] font-semibold uppercase tracking-wide bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-full px-2 py-0.5"
              >
                {getMuscleLabel(exerciseConfig, id)}
              </span>
            ))
          })()}
        </div>

        {isUpcoming && (
          <div className="flex gap-2 items-center">
            {onUpdateMuscleGroups && (
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="text-xs font-semibold text-[#777777] border border-[#e8e8e8] rounded-lg px-3 py-1.5 hover:border-[#aaaaaa] transition-colors"
              >
                {pickerOpen
                  ? "Close"
                  : session.selectedMuscleGroups?.length
                  ? `${session.selectedMuscleGroups.length} group${session.selectedMuscleGroups.length > 1 ? "s" : ""}`
                  : "+ Groups"}
              </button>
            )}
            {onStartLogging && (
              <button
                onClick={() => onStartLogging(session)}
                className="text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-[#1e3a5f] hover:text-white transition-colors"
              >
                Log Session
              </button>
            )}
          </div>
        )}

        {!isUpcoming && (onEdit || onUnlog || onShare) && (
          <div className="flex gap-2">
            {onShare && (
              <button
                onClick={() => onShare(session)}
                className="text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-[#1e3a5f] hover:text-white transition-colors"
              >
                Share
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(session)}
                className="text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-1.5 hover:bg-[#1e3a5f] hover:text-white transition-colors"
              >
                Edit
              </button>
            )}
            {onUnlog && (
              <button
                onClick={() => onUnlog(session)}
                className="text-xs font-semibold text-[#aaaaaa] border border-[#e8e8e8] rounded-lg px-3 py-1.5 hover:border-[#aaaaaa] transition-colors"
              >
                Unlog
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
