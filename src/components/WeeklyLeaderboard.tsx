"use client"

import { LeaderboardResult } from "@/lib/types"

function formatWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z")
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
}

interface Props {
  data: LeaderboardResult
  currentEmail: string
}

function RankList({
  entries,
  unit,
  currentEmail,
}: {
  entries: LeaderboardResult["bySessionCount"]
  unit: string
  currentEmail: string
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-[#aaaaaa] mt-1">No lifts yet</p>
  }
  return (
    <ol className="space-y-1 mt-1.5">
      {entries.map((e) => (
        <li key={e.email} className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[#aaaaaa] w-4 text-right shrink-0">
            {e.rank}
          </span>
          <span
            className={`text-sm truncate flex-1 ${
              e.email === currentEmail ? "font-semibold text-[#111111]" : "text-[#333333]"
            }`}
          >
            {e.name}
          </span>
          <span className="text-xs font-medium text-[#555555] shrink-0">
            {unit === "sessions" ? `${e.value}×` : `${e.value}kg`}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function WeeklyLeaderboard({ data, currentEmail }: Props) {
  const hasData = data.bySessionCount.length > 0 || data.byE1RM.length > 0
  if (!hasData) return null

  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
          This week
        </p>
        <p className="text-[10px] text-[#cccccc]">from {formatWeekStart(data.weekStart)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#eeeeee] rounded-xl px-3 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
            Sessions
          </p>
          <RankList entries={data.bySessionCount} unit="sessions" currentEmail={currentEmail} />
        </div>
        <div className="bg-white border border-[#eeeeee] rounded-xl px-3 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
            Best e1RM
          </p>
          <RankList entries={data.byE1RM} unit="e1rm" currentEmail={currentEmail} />
        </div>
      </div>
    </div>
  )
}
