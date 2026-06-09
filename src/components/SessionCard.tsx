"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Session, MuscleGroup, TrainingDay } from "@/lib/types"
import { MuscleGroupConfig, getMuscleLabel } from "@/lib/exerciseConfig"

interface SessionCardProps {
  session: Session
  blockIndex?: number
  onStartLogging?: (session: Session) => void
  onEdit?: (session: Session) => void
  onUnlog?: (session: Session) => void
  onShare?: (session: Session) => void
  onUpdateMuscleGroups?: (session: Session, muscles: MuscleGroup[], dayId?: string) => void
  exerciseConfig: MuscleGroupConfig[]
  trainingDays?: TrainingDay[]
  recommendedDayId?: string
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
  trainingDays,
  recommendedDayId,
}: SessionCardProps) {
  const isUpcoming = !session.confirmed

  const sortedDays = trainingDays ? [...trainingDays].sort((a, b) => a.order - b.order) : []
  const hasDays = sortedDays.length > 0

  const [selectedDayId, setSelectedDayId] = useState<string | null>(
    session.selectedTrainingDayId ?? sortedDays[0]?.id ?? null
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dayPickerOpen, setDayPickerOpen] = useState(false)
  const [extraMuscles, setExtraMuscles] = useState<MuscleGroup[]>(() => {
    if (!hasDays) return session.selectedMuscleGroups ?? []
    const dayMuscles = sortedDays.find((d) => d.id === (session.selectedTrainingDayId ?? sortedDays[0]?.id))?.muscleGroupIds ?? []
    return (session.selectedMuscleGroups ?? []).filter((m) => !dayMuscles.includes(m))
  })

  // Sync state when the session prop changes (e.g. after save)
  useEffect(() => {
    const dayId = session.selectedTrainingDayId ?? sortedDays[0]?.id ?? null
    setSelectedDayId(dayId)
    if (hasDays) {
      const dayMuscles = sortedDays.find((d) => d.id === dayId)?.muscleGroupIds ?? []
      setExtraMuscles((session.selectedMuscleGroups ?? []).filter((m) => !dayMuscles.includes(m)))
    } else {
      setExtraMuscles(session.selectedMuscleGroups ?? [])
    }
  }, [session.selectedTrainingDayId, session.selectedMuscleGroups])

  useEffect(() => {
    if (pickerOpen) {
      const dayMuscles = sortedDays.find((d) => d.id === selectedDayId)?.muscleGroupIds ?? []
      setExtraMuscles((session.selectedMuscleGroups ?? []).filter((m) => !dayMuscles.includes(m)))
    }
  }, [pickerOpen])

  const selectedDay = sortedDays.find((d) => d.id === selectedDayId) ?? null
  const dayMuscles: MuscleGroup[] = selectedDay?.muscleGroupIds ?? []

  // Muscles available for "add extra" picker — everything not already in the day
  const pickableMuscles = [...exerciseConfig]
    .filter((g) => !dayMuscles.includes(g.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  function handleDayChange(dayId: string) {
    const day = sortedDays.find((d) => d.id === dayId)
    if (!day) return
    setSelectedDayId(dayId)
    setExtraMuscles([])
    onUpdateMuscleGroups?.(session, day.muscleGroupIds, dayId)
  }

  function handleSaveExtras() {
    const fullList = [...dayMuscles, ...extraMuscles]
    onUpdateMuscleGroups?.(session, fullList, selectedDayId ?? undefined)
    setPickerOpen(false)
  }

  const working = session.sets.filter((s) => !s.isWarmup)
  const topWeight = working[0]?.kg ?? null
  const topReps = working[0]?.reps ?? null
  const setCount = working.length

  // Muscles trained in a completed session (for its training-day card)
  const confirmedMuscles: MuscleGroup[] =
    session.selectedMuscleGroups && session.selectedMuscleGroups.length > 0
      ? session.selectedMuscleGroups
      : session.extraWorkouts?.map((w) => w.muscle) ?? []
  const confirmedDay = sortedDays.find((d) => d.id === session.selectedTrainingDayId) ?? null

  const upcomingBody = (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#777777]">
          Session {blockIndex !== undefined ? String(blockIndex) : String(session.id).padStart(2, "0")}
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

      {hasDays && selectedDay && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
              Training Day
            </p>
            <div className="flex items-center gap-3">
              {onUpdateMuscleGroups && (
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  className="text-[11px] font-semibold text-[#777777] hover:text-[#1e3a5f] transition-colors"
                >
                  {pickerOpen
                    ? "Close"
                    : extraMuscles.length > 0
                    ? `${extraMuscles.length} extra${extraMuscles.length > 1 ? "s" : ""}`
                    : "+ Extras"}
                </button>
              )}
              {sortedDays.length > 1 && (
                <button
                  onClick={() => setDayPickerOpen((v) => !v)}
                  className="text-[11px] font-semibold text-[#777777] hover:text-[#1e3a5f] transition-colors"
                >
                  {dayPickerOpen ? "Close" : "Switch day"}
                </button>
              )}
            </div>
          </div>

          {/* Prescribed day — single, informative line */}
          <div className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-3 py-2 text-white">
            <div className="flex flex-col">
              <span className="text-[13px] font-bold leading-tight">{selectedDay.name}</span>
              {(dayMuscles.length > 0 || extraMuscles.length > 0) && (
                <span className="text-[11px] font-medium text-white/70 leading-tight">
                  {dayMuscles.map((id) => getMuscleLabel(exerciseConfig, id)).join(" + ")}
                  {extraMuscles.length > 0 && (
                    <span className="text-white">
                      {dayMuscles.length > 0 ? " + " : ""}
                      {extraMuscles.map((id) => getMuscleLabel(exerciseConfig, id)).join(" + ")}
                    </span>
                  )}
                </span>
              )}
            </div>
            {recommendedDayId && selectedDayId === recommendedDayId && (
              <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide bg-white/15 rounded-full px-2 py-0.5">
                Coach pick
              </span>
            )}
          </div>

          {/* Inline-expandable alternatives */}
          {dayPickerOpen && (
            <div className="mt-1.5 flex flex-col gap-1.5">
              {sortedDays
                .filter((day) => day.id !== selectedDayId)
                .map((day) => (
                  <button
                    key={day.id}
                    onClick={() => {
                      handleDayChange(day.id)
                      setDayPickerOpen(false)
                    }}
                    className="flex items-center gap-2 rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-left hover:border-[#1e3a5f] transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold leading-tight text-[#1e3a5f]">{day.name}</span>
                      {day.muscleGroupIds.length > 0 && (
                        <span className="text-[11px] font-medium text-[#aaaaaa] leading-tight">
                          {day.muscleGroupIds.map((id) => getMuscleLabel(exerciseConfig, id)).join(" + ")}
                        </span>
                      )}
                    </div>
                    {recommendedDayId && day.id === recommendedDayId && (
                      <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-[#777777]">
                        Coach pick
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}
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
          Session {blockIndex !== undefined ? String(blockIndex) : String(session.id).padStart(2, "0")}
          {session.bw ? ` · ${session.bw}kg BW` : ""}
        </span>
        {session.date && (
          <span className="text-[11px] text-[#aaaaaa]">{formatDate(session.date)}</span>
        )}
      </div>

      {topWeight != null && (
        <div className="flex items-center gap-4">
          <span className="text-5xl font-extrabold text-[#1f2937] leading-none tracking-tight">
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

      {confirmedMuscles.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1.5">
            {confirmedDay ? "Training Day" : "Trained"}
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-[#16a34a] px-3 py-2 text-white">
            <div className="flex flex-col">
              {confirmedDay ? (
                <>
                  <span className="text-[13px] font-bold leading-tight">{confirmedDay.name}</span>
                  <span className="text-[11px] font-medium text-white/70 leading-tight">
                    {confirmedMuscles.map((id) => getMuscleLabel(exerciseConfig, id)).join(" + ")}
                  </span>
                </>
              ) : (
                <span className="text-[13px] font-bold leading-tight">
                  {confirmedMuscles.map((id) => getMuscleLabel(exerciseConfig, id)).join(" + ")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const cardBorder = isUpcoming
    ? "border-dashed border-[#bfdbfe]"
    : "border-solid border-[#d6e9d9]"
  const cardBg = isUpcoming ? "bg-[#eff6ff]" : "bg-white"

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${cardBorder} ${cardBg}`}>
      <div className={`h-1 ${isUpcoming ? "bg-[#1e3a5f]" : "bg-[#16a34a]"}`} />

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
            {hasDays ? "Add for this session only" : "Additional Muscle Groups"}
          </p>
          {hasDays && pickableMuscles.length === 0 ? (
            <p className="text-xs text-[#aaaaaa] mb-4">All muscle groups are already in this day.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(hasDays ? pickableMuscles : [...exerciseConfig].sort((a, b) => a.name.localeCompare(b.name))).map((g) => {
                const checked = extraMuscles.includes(g.id)
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
                        setExtraMuscles((prev) =>
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
          )}
          <button
            onClick={handleSaveExtras}
            className="w-full rounded-lg border border-[#1e3a5f] text-[#1e3a5f] text-xs font-semibold py-2 hover:bg-[#1e3a5f] hover:text-white transition-colors"
          >
            Save
          </button>
        </div>
      )}

      <div className={`${isUpcoming ? "bg-[#dbeafe]" : "bg-[#f3faf4]"} px-4 py-3 flex items-center justify-between`}>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            // Completed: muscles are shown in the training-day card above, not here
            if (!isUpcoming) return null

            // Upcoming with a Training Day card: muscles are shown there, not here
            if (hasDays) return null

            // Upcoming with no training days: show selected muscles here as a fallback
            return extraMuscles.map((id) => (
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
            {!hasDays && onUpdateMuscleGroups && (
              <button
                onClick={() => setPickerOpen((v) => !v)}
                className="text-xs font-semibold text-[#777777] border border-[#e8e8e8] rounded-lg px-3 py-1.5 hover:border-[#aaaaaa] transition-colors"
              >
                {pickerOpen
                  ? "Close"
                  : extraMuscles.length > 0
                  ? `${extraMuscles.length} extra${extraMuscles.length > 1 ? "s" : ""}`
                  : "+ Extras"}
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
