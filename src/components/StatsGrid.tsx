"use client"

interface StatsGridProps {
  e1rm: number | null
  best: number | null
  sessions: number
  bw: number | null
}

const SAGE = "#aabba4"

export default function StatsGrid({ e1rm, best, sessions, bw }: StatsGridProps) {
  void e1rm
  void bw
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: SAGE,
          borderRadius: "14px 10px 12px 10px / 10px 12px 10px 14px",
        }}
      >
        <p className="font-bold text-[15px] leading-snug" style={{ color: "#2c2724" }}>
          {sessions} sessions so far
        </p>
      </div>
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: SAGE,
          borderRadius: "10px 14px 10px 12px / 14px 10px 12px 10px",
        }}
      >
        <p className="font-bold text-[15px] leading-snug" style={{ color: "#2c2724" }}>
          best so far: {best != null ? `${best}kg` : "—"}
        </p>
      </div>
    </div>
  )
}
