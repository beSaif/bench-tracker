"use client"

interface StatsGridProps {
  e1rm: number | null
  best: number | null
  sessions: number
  bw: number | null
  target: number
}

function HeroCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] py-3 px-2 min-h-20 gap-1" style={{ backgroundColor: "#eff6ff" }}>
      <span className="text-2xl font-bold leading-none" style={{ color: "#1e3a5f" }}>
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "#aaaaaa" }}>
        {label}
      </span>
    </div>
  )
}

function StatCell({
  label,
  value,
  bg,
}: {
  label: string
  value: string
  bg: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] py-3 px-2 min-h-20 gap-1" style={{ backgroundColor: bg }}>
      <span className="text-xl font-semibold leading-none" style={{ color: "#111111" }}>
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "#aaaaaa" }}>
        {label}
      </span>
    </div>
  )
}

export default function StatsGrid({ e1rm, best, sessions, bw, target }: StatsGridProps) {
  void bw
  return (
    <div className="flex flex-col gap-2 mb-6">
      <HeroCell
        label="Current Best"
        value={best != null ? `${best}kg` : "—"}
      />
      <div className="grid grid-cols-3 gap-2">
        <StatCell
          label="Target"
          value={`${target}kg`}
          bg="#f8f8f8"
        />
        <StatCell
          label="E1RM"
          value={e1rm != null ? `${e1rm}kg` : "—"}
          bg="#eff6ff"
        />
        <StatCell
          label="Sessions"
          value={String(sessions)}
          bg="#f5f8f8"
        />
      </div>
    </div>
  )
}
