"use client"

interface StatsGridProps {
  e1rm: number | null
  best: number | null
  sessions: number
  bw: number | null
  target: number
}

interface StatCellProps {
  label: string
  value: string
  accent?: boolean
}

function StatCell({ label, value, accent }: StatCellProps) {
  return (
    <div className="flex flex-col gap-1 p-3">
      <span className="text-[10px] font-medium text-[#aaaaaa] uppercase tracking-widest">
        {label}
      </span>
      <span
        className={`text-lg font-semibold leading-none ${
          accent ? "text-[#7a1f2e]" : "text-[#111111]"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

export default function StatsGrid({ e1rm, best, sessions, bw, target }: StatsGridProps) {
  void bw
  return (
    <div className="grid grid-cols-2 border border-[#e8e8e8] rounded-[10px] overflow-hidden mb-6">
      <div className="border-b border-r border-[#e8e8e8]">
        <StatCell
          label="Current Best"
          value={best != null ? `${best}kg` : "—"}
          accent
        />
      </div>
      <div className="border-b border-[#e8e8e8]">
        <StatCell
          label="Target"
          value={`${target}kg`}
        />
      </div>
      <div className="border-r border-[#e8e8e8]">
        <StatCell
          label="e1RM"
          value={e1rm != null ? `${e1rm}kg` : "—"}
        />
      </div>
      <div>
        <StatCell
          label="Sessions"
          value={String(sessions)}
        />
      </div>
    </div>
  )
}
