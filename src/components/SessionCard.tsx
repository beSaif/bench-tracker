"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Session, MuscleGroup, MUSCLE_GROUP_LABEL } from "@/lib/types"

const ALL_MUSCLE_GROUPS: MuscleGroup[] = ["back", "triceps", "chest", "biceps", "shoulders", "legs"]

interface SessionCardProps {
  session: Session
  onStartLogging?: (session: Session) => void
  onEdit?: (session: Session) => void
  onUnlog?: (session: Session) => void
  onUpdateMuscleGroups?: (session: Session, muscles: MuscleGroup[]) => void
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}


function BenchSummaryLine({ session }: { session: Session }) {
  const working = session.sets.filter((s) => !s.isWarmup)
  if (working.length === 0) return null

  const weight = working[0].kg
  const reps = working[0].reps
  const setCount = working.length
  const e1rms = working.map((s) => s.e1rm).filter((v): v is number => v != null)
  const bestE1RM = e1rms.length > 0 ? Math.max(...e1rms) : null

  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-sm font-semibold text-[#7a1f2e]">{weight}kg</span>
      <span className="text-sm text-[#555555]">
        × {reps} × {setCount}
      </span>
      {bestE1RM != null && (
        <>
          <span className="text-[#dddddd]">·</span>
          <span className="text-xs text-[#777777]">
            e1RM <span className="font-semibold text-[#7a1f2e]">{bestE1RM}kg</span>
          </span>
        </>
      )}
    </div>
  )
}

export default function SessionCard({ session, onStartLogging, onEdit, onUnlog, onUpdateMuscleGroups }: SessionCardProps) {
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

  const cardBorder = isUpcoming
    ? "border-dashed border-[#e0c8cb]"
    : "border-solid border-[#e8e8e8]"
  const cardBg = isUpcoming ? "bg-[#fdf5f6]" : "bg-white"
  const headerColor = isUpcoming ? "text-[#7a1f2e]" : "text-[#111111]"

  const summaryBody = (
    <div className="px-4 pt-4 pb-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${headerColor}`}>
          Session {String(session.id).padStart(2, "0")} · {session.type}
        </span>
        {isUpcoming ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#7a1f2e] text-white rounded-full px-2 py-0.5">
            Up next
          </span>
        ) : session.date ? (
          <span className="text-xs text-[#aaaaaa]">{formatDate(session.date)}</span>
        ) : null}
      </div>

      {/* BW */}
      {session.bw && (
        <p className="text-xs text-[#777777] mb-2">{session.bw}kg BW</p>
      )}

      {/* Compact bench summary */}
      <BenchSummaryLine session={session} />
    </div>
  )

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${cardBorder} ${cardBg}`}>
      {/* Card body — link to detail page for confirmed sessions */}
      {!isUpcoming ? (
        <Link href={`/session/${session.id}`} className="block hover:bg-[#fafafa] transition-colors">
          {summaryBody}
        </Link>
      ) : (
        summaryBody
      )}


      {/* Muscle group picker panel — upcoming only */}
      {isUpcoming && pickerOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-[#e8e8e8]">
          <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-3">
            Additional Muscle Groups
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ALL_MUSCLE_GROUPS.map((g) => {
              const checked = selectedGroups.includes(g)
              return (
                <label
                  key={g}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-[#7a1f2e]/40 bg-[#7a1f2e]/[0.04] text-[#7a1f2e]"
                      : "border-[#e8e8e8] text-[#111111]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedGroups((prev) =>
                        prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                      )
                    }
                    className="accent-[#7a1f2e]"
                  />
                  <span className="font-medium text-xs">{MUSCLE_GROUP_LABEL[g]}</span>
                </label>
              )
            })}
          </div>
          <button
            onClick={() => {
              onUpdateMuscleGroups?.(session, selectedGroups)
              setPickerOpen(false)
            }}
            className="w-full rounded-lg border border-[#7a1f2e] text-[#7a1f2e] text-xs font-semibold py-2 hover:bg-[#7a1f2e] hover:text-white transition-colors"
          >
            Save Selection
          </button>
        </div>
      )}

      {/* Card Footer */}
      <div className={`${isUpcoming ? "bg-[#f5e6e8]" : "bg-[#fdf5f6]"} px-4 py-3 flex items-center justify-between`}>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const muscles = isUpcoming
              ? (session.selectedMuscleGroups ?? [])
              : (session.extraWorkouts?.map((w) => w.muscle) ?? [])
            return muscles.map((g) => (
              <span
                key={g}
                className="text-[10px] font-semibold uppercase tracking-wide bg-[#7a1f2e]/10 text-[#7a1f2e] rounded-full px-2 py-0.5"
              >
                {MUSCLE_GROUP_LABEL[g]}
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
                className="text-xs font-semibold text-[#7a1f2e] border border-[#7a1f2e] rounded-lg px-3 py-1.5 hover:bg-[#7a1f2e] hover:text-white transition-colors"
              >
                Log Session
              </button>
            )}
          </div>
        )}

        {!isUpcoming && (onEdit || onUnlog) && (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(session)}
                className="text-xs font-semibold text-[#7a1f2e] border border-[#7a1f2e] rounded-lg px-3 py-1.5 hover:bg-[#7a1f2e] hover:text-white transition-colors"
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
