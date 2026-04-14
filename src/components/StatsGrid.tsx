"use client"

interface StatsGridProps {
  e1rm: number | null
  best: number | null
  sessions: number
  bw: number | null
}

interface StatPanelProps {
  label: string
  value: string
  variant?: "maroon" | "gold" | "default"
}

function StatPanel({ label, value, variant = "default" }: StatPanelProps) {
  const valueColor =
    variant === "maroon"
      ? "#8b2a1e"
      : variant === "gold"
      ? "#b8882a"
      : "#2c2724"

  const panelStyle: React.CSSProperties = {
    backgroundColor:
      variant === "maroon"
        ? "#fdeee9"
        : variant === "gold"
        ? "#fdf6e3"
        : "#faf7f2",
    border: `1.5px solid ${
      variant === "maroon"
        ? "#f0c4b8"
        : variant === "gold"
        ? "#e8d090"
        : "#e2d9d0"
    }`,
    borderRadius: "16px 10px 14px 12px / 12px 14px 10px 16px",
  }

  return (
    <div className="flex flex-col gap-1.5 p-4" style={panelStyle}>
      <span
        className="font-hand text-sm font-semibold uppercase tracking-wider"
        style={{ color: "#9a8f87" }}
      >
        {label}
      </span>
      <span
        className="text-2xl font-semibold leading-none"
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  )
}

export default function StatsGrid({ e1rm, best, sessions, bw }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 mb-6">
      <StatPanel
        label="Current e1RM"
        value={e1rm != null ? `${e1rm}kg` : "—"}
        variant="maroon"
      />
      <StatPanel label="Target" value="140kg" />
      <StatPanel
        label="Sessions"
        value={String(sessions)}
        variant="gold"
      />
      <StatPanel
        label="Best e1RM"
        value={best != null ? `${best}kg` : "—"}
      />
    </div>
  )
}
