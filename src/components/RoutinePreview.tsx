"use client"

import { RoutineBundle, summarizeRoutine } from "@/lib/routines"

/** Someone's split, day by day: the Routine tab of a profile. */
export default function RoutinePreview({ routine }: { routine: RoutineBundle }) {
  const summary = summarizeRoutine(routine)
  const sortedDays = [...routine.trainingDays].sort((a, b) => a.order - b.order)
  const assigned = new Set(sortedDays.flatMap((d) => d.muscleGroupIds))
  const unassigned = routine.muscleGroups.filter((g) => !assigned.has(g.id))

  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
        Training Days
      </p>
      <p className="text-xs text-[#999999] mb-3">
        {summary.dayCount} day{summary.dayCount !== 1 ? "s" : ""} ·{" "}
        {summary.exerciseCount} exercise{summary.exerciseCount !== 1 ? "s" : ""} across{" "}
        {summary.groupCount} muscle group{summary.groupCount !== 1 ? "s" : ""}
      </p>

      <div className="space-y-2 mb-6">
        {sortedDays.map((day) => (
          <div key={day.id} className="bg-white border border-[#e8e8e8] rounded-xl px-4 py-3.5">
            <p className="text-sm font-semibold text-[#111111]">{day.name}</p>
            {day.muscleGroupIds.length === 0 ? (
              <p className="text-[11px] text-[#aaaaaa] mt-0.5">No muscles assigned</p>
            ) : (
              <div className="mt-2.5 space-y-2.5">
                {day.muscleGroupIds.map((groupId) => {
                  const group = routine.muscleGroups.find((g) => g.id === groupId)
                  if (!group) return null
                  const exercises = [...group.exercises].sort((a, b) => a.order - b.order)
                  return (
                    <div key={groupId}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1e3a5f]">
                        {group.name}
                      </p>
                      {exercises.length === 0 ? (
                        <p className="text-xs text-[#aaaaaa] mt-1">No exercises</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5">
                          {exercises.map((ex) => (
                            <li key={ex.id} className="flex items-baseline justify-between gap-2">
                              <span className="text-xs text-[#333333] truncate">{ex.name}</span>
                              {ex.defaultSets !== undefined && (
                                <span className="shrink-0 text-[10px] text-[#aaaaaa]">
                                  {ex.defaultSets} × sets
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {unassigned.length > 0 && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
            Also in the list
          </p>
          <p className="text-xs text-[#999999] mb-3">
            Muscle groups that aren&apos;t on a day yet.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {unassigned.map((group) => (
              <span
                key={group.id}
                className="text-xs font-semibold text-[#777777] bg-white border border-[#e8e8e8] rounded-full px-3 py-1"
              >
                {group.name}
                <span className="text-[#cccccc] font-normal"> · {group.exercises.length}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </>
  )
}
