"use client"

import { Session, BenchSet } from "@/lib/types"

interface SessionCardProps {
  session: Session
  onStartLogging?: (session: Session) => void
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

export default function SessionCard({ session, onStartLogging }: SessionCardProps) {
  const isUpcoming = !session.confirmed
  const e1rm = getSessionE1RM(session)
  const workingWeight = getWorkingWeight(session)

  const cardBorder = isUpcoming
    ? "border-dashed border-[#e0c8cb]"
    : "border-solid border-[#e8e8e8]"

  const headerColor = isUpcoming ? "text-[#7a1f2e]" : "text-[#111111]"

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${cardBorder}`}>
      {/* Card Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className={`text-sm font-semibold ${headerColor}`}>
            Session {String(session.id).padStart(2, "0")} · {session.type}
          </span>
          <span className="text-xs text-[#aaaaaa]">
            {isUpcoming ? (
              <em>Upcoming</em>
            ) : session.date ? (
              formatDate(session.date)
            ) : null}
          </span>
        </div>
        {session.bw && (
          <span className="text-xs text-[#777777]">{session.bw}kg BW</span>
        )}
      </div>

      {/* Sets */}
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

      {/* Coach Note */}
      {session.coachNote && (
        <div className="px-4 pb-3">
          <p className="text-xs italic text-[#777777]">{session.coachNote}</p>
        </div>
      )}

      {/* Card Footer */}
      <div className="bg-[#fdf5f6] px-4 py-3 flex items-center justify-between">
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

        {isUpcoming && onStartLogging && (
          <button
            onClick={() => onStartLogging(session)}
            className="text-xs font-semibold text-[#7a1f2e] border border-[#7a1f2e] rounded-lg px-3 py-1.5 hover:bg-[#7a1f2e] hover:text-white transition-colors"
          >
            Log Session
          </button>
        )}
      </div>
    </div>
  )
}
