"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Session, MuscleGroup, MUSCLE_GROUP_LABEL } from "@/lib/types"

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  "back",
  "triceps",
  "chest",
  "biceps",
  "shoulders",
  "legs",
]

const SALMON = "#c4785a"
const SAGE = "#aabba4"

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
  })
    .format(new Date(iso))
    .toLowerCase()
}

function BenchSummaryLine({
  session,
  isUpcoming,
}: {
  session: Session
  isUpcoming: boolean
}) {
  const working = session.sets.filter((s) => !s.isWarmup)
  if (working.length === 0) return null

  const weight = working[0].kg
  const reps = working[0].reps
  const setCount = working.length
  const e1rms = working.map((s) => s.e1rm).filter((v): v is number => v != null)
  const bestE1RM = e1rms.length > 0 ? Math.max(...e1rms) : null

  const textColor = isUpcoming ? "rgba(255,255,255,0.9)" : "#5a4f47"

  return (
    <p className="text-sm mt-1" style={{ color: textColor }}>
      {weight}kg × {reps}{isUpcoming ? " reps" : ""} × {setCount}
      {isUpcoming ? " sets" : ""}
      {bestE1RM != null ? `. estimated max: ${bestE1RM}kg` : ""}
    </p>
  )
}

function MuscleTag({
  label,
  isUpcoming,
}: {
  label: string
  isUpcoming: boolean
}) {
  return (
    <span
      className="text-xs font-medium px-3 py-1"
      style={{
        backgroundColor: isUpcoming ? "rgba(255,255,255,0.22)" : "#ede8e0",
        color: isUpcoming ? "#fff" : "#5a4f47",
        borderRadius: "20px",
        border: isUpcoming
          ? "1px solid rgba(255,255,255,0.28)"
          : "1px solid #ddd6cc",
        whiteSpace: "nowrap",
      }}
    >
      {label.toLowerCase()}
    </span>
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

  const muscles = isUpcoming
    ? session.selectedMuscleGroups ?? []
    : session.extraWorkouts?.map((w) => w.muscle) ?? []

  const upcomingStyle: React.CSSProperties = {
    backgroundColor: SALMON,
    borderRadius: "16px",
  }

  const confirmedStyle: React.CSSProperties = {
    backgroundColor: "#faf6ef",
    border: "1px solid #e4dcd0",
    borderRadius: "14px",
  }

  const cardStyle = isUpcoming ? upcomingStyle : confirmedStyle

  const summaryBody = (
    <div className="px-4 pt-4 pb-3">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline flex-wrap gap-x-2">
            <span
              className="font-bold text-base"
              style={{ color: isUpcoming ? "#fff" : "#2c2724" }}
            >
              session {String(session.id).padStart(2, "0")} · {session.type.toLowerCase()}
            </span>
            {!isUpcoming && session.date && (
              <span className="text-sm" style={{ color: "#9a8f87" }}>
                {formatDate(session.date)}
              </span>
            )}
          </div>
          {session.bw && !isUpcoming && (
            <p className="text-xs mt-0.5" style={{ color: "#9a8f87" }}>
              {session.bw}kg BW
            </p>
          )}
        </div>

        {/* "up next" underlined — upcoming only */}
        {isUpcoming && (
          <span
            className="text-sm font-medium shrink-0"
            style={{
              color: "rgba(255,255,255,0.85)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            up next
          </span>
        )}
      </div>

      {/* Bench summary */}
      <BenchSummaryLine session={session} isUpcoming={isUpcoming} />
    </div>
  )

  return (
    <div className="mb-3 overflow-hidden" style={cardStyle}>
      {/* Card body */}
      {!isUpcoming ? (
        <Link
          href={`/session/${session.id}`}
          className="block hover:opacity-90 transition-opacity"
        >
          {summaryBody}
        </Link>
      ) : (
        summaryBody
      )}

      {/* Muscle group picker panel — upcoming only */}
      {isUpcoming && pickerOpen && (
        <div
          className="px-4 pb-4 pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Additional Muscle Groups
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {ALL_MUSCLE_GROUPS.map((g) => {
              const checked = selectedGroups.includes(g)
              return (
                <label
                  key={g}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                  style={{
                    border: checked
                      ? "1.5px solid rgba(255,255,255,0.5)"
                      : "1.5px solid rgba(255,255,255,0.22)",
                    backgroundColor: checked
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.08)",
                    color: "#fff",
                    borderRadius: "10px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedGroups((prev) =>
                        prev.includes(g)
                          ? prev.filter((x) => x !== g)
                          : [...prev, g]
                      )
                    }
                    className="accent-white"
                  />
                  <span className="font-medium text-xs">
                    {MUSCLE_GROUP_LABEL[g]}
                  </span>
                </label>
              )
            })}
          </div>
          <button
            onClick={() => {
              onUpdateMuscleGroups?.(session, selectedGroups)
              setPickerOpen(false)
            }}
            className="w-full text-xs font-semibold py-2 transition-opacity hover:opacity-80"
            style={{
              border: "1.5px solid rgba(255,255,255,0.45)",
              color: "#fff",
              borderRadius: "10px",
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          >
            Save Selection
          </button>
        </div>
      )}

      {/* Footer */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{
          backgroundColor: isUpcoming ? "rgba(0,0,0,0.09)" : "transparent",
          borderTop: isUpcoming ? "none" : "1px solid #e8e0d4",
        }}
      >
        {/* Muscle tags */}
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {muscles.map((g) => (
            <MuscleTag
              key={g}
              label={MUSCLE_GROUP_LABEL[g]}
              isUpcoming={isUpcoming}
            />
          ))}
        </div>

        {/* Action buttons */}
        {isUpcoming && (
          <div className="flex gap-2 items-center shrink-0">
            {onUpdateMuscleGroups && (
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="text-xs font-medium px-3 py-1.5 transition-opacity hover:opacity-80"
                style={{
                  color: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "20px",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  whiteSpace: "nowrap",
                }}
              >
                {pickerOpen
                  ? "close"
                  : session.selectedMuscleGroups?.length
                  ? `${session.selectedMuscleGroups.length} groups`
                  : "+ groups"}
              </button>
            )}
            {onStartLogging && (
              <button
                onClick={() => onStartLogging(session)}
                className="text-xs font-semibold px-4 py-1.5 transition-opacity hover:opacity-80"
                style={{
                  color: "#fff",
                  backgroundColor: "#8a4830",
                  borderRadius: "20px",
                  border: "none",
                  whiteSpace: "nowrap",
                }}
              >
                ready to log?
              </button>
            )}
          </div>
        )}

        {!isUpcoming && (onEdit || onUnlog) && (
          <div className="flex gap-2 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(session)}
                className="text-xs font-medium px-3 py-1.5 transition-opacity hover:opacity-80"
                style={{
                  color: "#2c2724",
                  backgroundColor: SAGE,
                  borderRadius: "20px",
                  border: "none",
                  whiteSpace: "nowrap",
                }}
              >
                edit session
              </button>
            )}
            {onUnlog && (
              <button
                onClick={() => onUnlog(session)}
                className="text-xs font-medium px-3 py-1.5 transition-opacity hover:opacity-80"
                style={{
                  color: "#2c2724",
                  backgroundColor: SAGE,
                  borderRadius: "20px",
                  border: "none",
                  whiteSpace: "nowrap",
                }}
              >
                oops, unlog
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
