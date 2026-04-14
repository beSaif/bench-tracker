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
      <span className="text-sm font-semibold" style={{ color: "#8b2a1e" }}>
        {weight}kg
      </span>
      <span className="text-sm" style={{ color: "#5a4f47" }}>
        × {reps} × {setCount}
      </span>
      {bestE1RM != null && (
        <>
          <span style={{ color: "#e2d9d0" }}>·</span>
          <span className="text-xs" style={{ color: "#9a8f87" }}>
            e1RM{" "}
            <span className="font-semibold" style={{ color: "#8b2a1e" }}>
              {bestE1RM}kg
            </span>
          </span>
        </>
      )}
    </div>
  )
}

export default function SessionCard({
  session,
  onStartLogging,
  onEdit,
  onUnlog,
  onUpdateMuscleGroups,
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

  /* ── Organic border-radius per card type ── */
  const upcomingCardStyle: React.CSSProperties = {
    borderRadius: "18px 10px 16px 12px / 10px 16px 12px 18px",
    border: "2px dashed #f0c4b8",
    backgroundColor: "#fdeee9",
  }

  const confirmedCardStyle: React.CSSProperties = {
    borderRadius: "14px 8px 12px 10px / 8px 12px 10px 14px",
    border: "1.5px solid #e2d9d0",
    backgroundColor: "#fefcf9",
  }

  const cardStyle = isUpcoming ? upcomingCardStyle : confirmedCardStyle

  const summaryBody = (
    <div className="px-4 pt-4 pb-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-sm font-semibold"
          style={{ color: isUpcoming ? "#8b2a1e" : "#2c2724" }}
        >
          Session {String(session.id).padStart(2, "0")} · {session.type}
        </span>

        {isUpcoming ? (
          /* Golden "UP NEXT" badge */
          <span
            className="font-hand text-sm font-bold uppercase tracking-wide px-3 py-0.5"
            style={{
              backgroundColor: "#d4a843",
              color: "#2c2724",
              borderRadius: "8px 4px 6px 5px / 4px 6px 5px 8px",
              lineHeight: 1.3,
            }}
          >
            Up next
          </span>
        ) : session.date ? (
          <span className="text-xs" style={{ color: "#bdb5ad" }}>
            {formatDate(session.date)}
          </span>
        ) : null}
      </div>

      {/* BW */}
      {session.bw && (
        <p className="text-xs mb-2" style={{ color: "#9a8f87" }}>
          {session.bw}kg BW
        </p>
      )}

      {/* Compact bench summary */}
      <BenchSummaryLine session={session} />
    </div>
  )

  /* Muscle tags */
  const muscles = isUpcoming
    ? (session.selectedMuscleGroups ?? [])
    : (session.extraWorkouts?.map((w) => w.muscle) ?? [])

  return (
    <div className="mb-3 overflow-hidden" style={cardStyle}>
      {/* Card body */}
      {!isUpcoming ? (
        <Link href={`/session/${session.id}`} className="block transition-opacity hover:opacity-80">
          {summaryBody}
        </Link>
      ) : (
        summaryBody
      )}

      {/* Muscle group picker — upcoming only */}
      {isUpcoming && pickerOpen && (
        <div
          className="px-4 pb-4 pt-2"
          style={{ borderTop: "1px dashed #f0c4b8" }}
        >
          <p
            className="font-hand text-sm font-semibold uppercase tracking-widest mb-3"
            style={{ color: "#bdb5ad" }}
          >
            Additional Muscle Groups
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ALL_MUSCLE_GROUPS.map((g) => {
              const checked = selectedGroups.includes(g)
              return (
                <label
                  key={g}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
                  style={{
                    border: checked ? "1.5px solid #e07a65" : "1.5px solid #e2d9d0",
                    backgroundColor: checked ? "#fdeee9" : "transparent",
                    color: checked ? "#8b2a1e" : "#2c2724",
                    borderRadius: "10px 6px 10px 6px / 6px 10px 6px 10px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedGroups((prev) =>
                        prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                      )
                    }
                    className="accent-[#8b2a1e]"
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
            className="w-full text-xs font-semibold py-2 transition-colors hover:opacity-80"
            style={{
              border: "1.5px solid #8b2a1e",
              color: "#8b2a1e",
              borderRadius: "10px 6px 10px 6px / 6px 10px 6px 10px",
              backgroundColor: "transparent",
            }}
          >
            Save Selection
          </button>
        </div>
      )}

      {/* Card Footer */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          backgroundColor: isUpcoming ? "#f5d5cc" : "#f5ede8",
          borderTop: isUpcoming ? "1px dashed #f0c4b8" : "1px solid #e8ddd5",
        }}
      >
        {/* Muscle tags */}
        <div className="flex flex-wrap gap-1.5">
          {muscles.map((g) => (
            <span
              key={g}
              className="font-hand text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5"
              style={{
                backgroundColor: "#fdeee9",
                color: "#8b2a1e",
                borderRadius: "6px 3px 5px 4px / 3px 5px 4px 6px",
                border: "1px solid #f0c4b8",
              }}
            >
              {MUSCLE_GROUP_LABEL[g]}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        {isUpcoming && (
          <div className="flex gap-2 items-center">
            {onUpdateMuscleGroups && (
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="text-xs font-semibold px-3 py-1.5 transition-opacity hover:opacity-70"
                style={{
                  color: "#9a8f87",
                  border: "1.5px solid #e2d9d0",
                  borderRadius: "10px 6px 8px 7px / 6px 8px 7px 10px",
                  backgroundColor: "transparent",
                }}
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
                className="text-xs font-semibold px-3 py-1.5 transition-opacity hover:opacity-80"
                style={{
                  color: "#8b2a1e",
                  border: "1.5px solid #8b2a1e",
                  borderRadius: "10px 6px 8px 7px / 6px 8px 7px 10px",
                  backgroundColor: "transparent",
                }}
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
                className="text-xs font-semibold px-3 py-1.5 transition-opacity hover:opacity-80"
                style={{
                  color: "#8b2a1e",
                  border: "1.5px solid #8b2a1e",
                  borderRadius: "10px 6px 8px 7px / 6px 8px 7px 10px",
                  backgroundColor: "transparent",
                }}
              >
                Edit
              </button>
            )}
            {onUnlog && (
              <button
                onClick={() => onUnlog(session)}
                className="text-xs font-semibold px-3 py-1.5 transition-opacity hover:opacity-70"
                style={{
                  color: "#bdb5ad",
                  border: "1.5px solid #e2d9d0",
                  borderRadius: "10px 6px 8px 7px / 6px 8px 7px 10px",
                  backgroundColor: "transparent",
                }}
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
