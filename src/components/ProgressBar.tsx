"use client"

interface ProgressBarProps {
  current: number | null
  target: number
}

function CubeSegment({ filled }: { filled: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        height: 30,
        borderRadius: "7px",
        background: filled
          ? "linear-gradient(180deg, #d48c72 0%, #c4785a 55%, #a85e42 100%)"
          : "linear-gradient(180deg, #e6e0d8 0%, #d8d2c8 100%)",
        boxShadow: filled
          ? "0 5px 0 #8a4830, 0 7px 6px rgba(0,0,0,0.13)"
          : "0 3px 0 #c8c2b8, 0 5px 5px rgba(0,0,0,0.06)",
        transition: "all 0.3s ease",
      }}
    />
  )
}

export default function ProgressBar({ current, target }: ProgressBarProps) {
  const SEGMENTS = 10
  const pct = current != null ? Math.min((current / target) * 100, 100) : 0
  const pctStr = pct.toFixed(1)
  const filledCount = Math.round((pct / 100) * SEGMENTS)

  return (
    <div className="mb-6">
      {/* Motivational sentence */}
      <p className="text-sm mb-3 leading-relaxed" style={{ color: "#2c2724" }}>
        <span className="font-bold">{pctStr}%</span> towards {target}kg.{" "}
        {current != null ? (
          <>
            <span className="font-bold">{current}kg</span> logged.{" "}
          </>
        ) : null}
        <span style={{ color: "#7a6e66" }}>you&apos;re on a roll!</span>
      </p>

      {/* 3D cube segments */}
      <div className="flex gap-1.5">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <CubeSegment key={i} filled={i < filledCount} />
        ))}
      </div>
    </div>
  )
}
