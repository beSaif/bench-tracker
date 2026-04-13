"use client"

import { useState, useEffect } from "react"
import { Session, BenchSet, MuscleGroup, MUSCLE_GROUP_LABEL, MUSCLE_GROUP_EXERCISES } from "@/lib/types"

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

function SetRow({ set }: { set: BenchSet }) {
  const isWarmup = set.isWarmup
  const textColor = isWarmup ? "text-[#aaaaaa]" : "text-[#111111]"
  const e1rmColor = isWarmup ? "text-[#aaaaaa]" : "text-[#7a1f2e]"

  return (
    <>
      <div className={`grid grid-cols-[2rem_2.5rem_4.5rem_3.5rem] gap-x-3 py-[3px] text-sm ${textColor}`}>
        <span className="font-medium">{set.id}</span>
        <span>{set.kg}kg</span>
        <span>
          {set.reps} reps
          {set.rpe != null && (
            <span className="text-[#aaaaaa]"> · {set.rpe}</span>
          )}
        </span>
        <span className={`text-right ${e1rmColor} font-medium`}>
          {set.e1rm != null ? `${set.e1rm}` : "—"}
        </span>
      </div>
      {set.note && (
        <div className="text-xs italic text-[#aaaaaa] pb-1 pl-[5.5rem]">
          {set.note}
        </div>
      )}
    </>
  )
}

function getSessionE1RM(session: Session): number | null {
  const working = session.sets.filter((s) => !s.isWarmup)
  const e1rms = working.map((s) => s.e1rm).filter((v): v is number => v != null)
  if (e1rms.length === 0) return null
  return Math.max(...e1rms)
}

function getWorkingWeight(session: Session): number | null {
  const first = session.sets.find((s) => !s.isWarmup)
  return first?.kg ?? null
}

export default function SessionCard({ session, onStartLogging, onEdit, onUnlog, onUpdateMuscleGroups }: SessionCardProps) {
  const isUpcoming = !session.confirmed
  const e1rm = getSessionE1RM(session)
  const workingWeight = getWorkingWeight(session)

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

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${cardBorder} ${cardBg}`}>
      {/* Card Header */}
      <div className="px-4 pt-4 pb-3">
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
        {session.bw && (
          <span className="text-xs text-[#777777]">{session.bw}kg BW</span>
        )}
      </div>

      {/* Bench Sets */}
      <div className="px-4 pb-3">
        {/* Column headers */}
        <div className="grid grid-cols-[2rem_2.5rem_4.5rem_3.5rem] gap-x-3 mb-1">
          <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide">Set</span>
          <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide">kg</span>
          <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide">Reps · RPE</span>
          <span className="text-[10px] text-[#aaaaaa] uppercase tracking-wide text-right">e1RM</span>
        </div>
        {session.sets.map((set) => (
          <SetRow key={set.id} set={set} />
        ))}
      </div>

      {/* Extra Workouts — completed sessions only */}
      {!isUpcoming && session.extraWorkouts && session.extraWorkouts.length > 0 && (
        <div className="px-4 pb-3">
          <div className="h-px bg-[#e8e8e8] mb-3" />
          {session.extraWorkouts.map((workout) => (
            <div key={workout.muscle} className="mb-4 last:mb-0">
              <p className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest mb-2">
                {MUSCLE_GROUP_LABEL[workout.muscle]}
              </p>
              {workout.exercises.map((exercise) => (
                <div key={exercise.name} className="mb-2">
                  <p className="text-xs font-medium text-[#777777] mb-1">{exercise.name}</p>
                  {exercise.sets.map((set, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[2rem_2.5rem_4.5rem] gap-x-3 py-[3px] text-sm text-[#111111]"
                    >
                      <span className="font-medium text-[#aaaaaa]">{i + 1}</span>
                      <span>{set.kg}kg</span>
                      <span>
                        {set.reps} reps
                        {set.rpe != null && (
                          <span className="text-[#aaaaaa]"> · {set.rpe}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Coach Note */}
      {session.coachNote && (
        <div className="px-4 pb-3">
          <p className="text-xs italic text-[#777777]">{session.coachNote}</p>
        </div>
      )}

      {/* Selected muscle group tags — upcoming only, picker closed */}
      {isUpcoming && !pickerOpen && session.selectedMuscleGroups && session.selectedMuscleGroups.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {session.selectedMuscleGroups.map((g) => (
            <span
              key={g}
              className="text-[10px] font-semibold uppercase tracking-wide bg-[#7a1f2e]/10 text-[#7a1f2e] rounded-full px-2 py-0.5"
            >
              {MUSCLE_GROUP_LABEL[g]}
            </span>
          ))}
        </div>
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
        <div className="flex gap-4">
          {workingWeight && (
            <span className="text-xs text-[#777777]">
              <span className="font-semibold text-[#7a1f2e]">{workingWeight}kg</span>
              {" "}working
            </span>
          )}
          {e1rm && (
            <span className="text-xs text-[#777777]">
              e1RM <span className="font-semibold text-[#7a1f2e]">{e1rm}kg</span>
            </span>
          )}
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
