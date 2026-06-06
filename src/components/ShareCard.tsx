"use client"

import { forwardRef } from "react"
import { Session } from "@/lib/types"
import { sessionSummary } from "@/lib/stats"

export interface ShareCardProps {
  session: Session
  bestWeight: number | null
  bodyweight: number | null
  target: number
  date: string | null
  mainLiftLabel: string
}

// Palette mirrors the app tokens in globals.css. Inline hex only — no Tailwind
// color utilities — so html-to-image never has to serialize Tailwind v4 oklch().
const ACCENT = "#1e3a5f"
const ACCENT_BG = "#eff6ff"
const FG = "#111111"
const MUTED = "#777777"
const MUTED_LIGHT = "#aaaaaa"
const BORDER = "#e8e8e8"
const FONT = '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const SHARE_PHASES = [
  { label: "Volume",    color: "#2d6a2d" },
  { label: "Intensity", color: "#5a2d8a" },
  { label: "Peak",      color: "#1e3a5f" },
  { label: "Deload",    color: "#888888" },
] as const

const PHASE_INDEX: Record<string, number> = {
  Volume: 0, Intensity: 1, Peak: 2, Deload: 3,
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function StatCell({
  label,
  value,
  hero,
}: {
  label: string
  value: string
  hero?: boolean
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "20px 16px",
        borderRadius: 20,
        backgroundColor: hero ? ACCENT_BG : "#f8f8f8",
      }}
    >
      <span
        style={{
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1,
          color: hero ? ACCENT : FG,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: MUTED_LIGHT,
        }}
      >
        {label}
      </span>
    </div>
  )
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { session, bestWeight, bodyweight, target, date, mainLiftLabel },
  ref
) {
  const summary = sessionSummary(session)
  const hasSets = summary.weight != null && summary.reps != null && summary.setCount > 0

  const activeIdx = PHASE_INDEX[session.type] ?? 0

  return (
    <div
      ref={ref}
      style={{
        width: 1200,
        backgroundColor: "#ffffff",
        color: FG,
        fontFamily: FONT,
        padding: 60,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          {mainLiftLabel} · {session.type}
        </span>
        {date && (
          <span style={{ fontSize: 24, color: MUTED_LIGHT }}>{formatDate(date)}</span>
        )}
      </div>

      {/* Hero set line */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 20 }}>
          {hasSets ? (
            <>
              <span style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, color: ACCENT }}>
                {summary.weight}kg
              </span>
              <span style={{ fontSize: 72, fontWeight: 600, color: "#555555" }}>
                × {summary.reps} × {summary.setCount}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 110, fontWeight: 800, lineHeight: 1, color: ACCENT }}>
              Session logged
            </span>
          )}
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: "flex", gap: 20, marginTop: 32 }}>
        <StatCell label="Current Best" value={bestWeight != null ? `${bestWeight}kg` : "—"} hero />
        <StatCell label="Goal" value={`${target}kg`} />
        <StatCell label="Bodyweight" value={bodyweight != null ? `${bodyweight}kg` : "—"} />
      </div>

      {/* Phase line */}
      <div style={{ marginTop: 28 }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Training Phase
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          {SHARE_PHASES.map((phase, i) => (
            <div key={phase.label} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 140,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    backgroundColor: i <= activeIdx ? phase.color : "#dddddd",
                    opacity: i < activeIdx ? 0.55 : i > activeIdx ? 0.4 : 1,
                    boxShadow: i === activeIdx ? `0 0 0 7px ${phase.color}40` : "none",
                  }}
                />
                <span
                  style={{
                    fontSize: 22,
                    textAlign: "center",
                    color: i === activeIdx ? phase.color : i < activeIdx ? "#999999" : "#aaaaaa",
                    fontWeight: i === activeIdx ? 700 : 500,
                    opacity: i < activeIdx ? 0.75 : 1,
                  }}
                >
                  {i < activeIdx ? "✓ " : ""}{phase.label}
                </span>
                {i === activeIdx && (
                  <span style={{ fontSize: 16, color: phase.color, opacity: 0.6, marginTop: -2 }}>
                    now
                  </span>
                )}
              </div>
              {i < SHARE_PHASES.length - 1 && (
                <span style={{ color: "#cccccc", fontSize: 32, margin: "0 12px", marginTop: 8 }}>
                  ›
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Branding — sits just below the progress bar */}
      <div
        style={{
          marginTop: 28,
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingTop: 32,
          borderTop: `2px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: ACCENT,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            fontWeight: 800,
          }}
        >
          b
        </div>
        <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: -0.5, color: FG }}>
          best workout tracker
        </span>
      </div>
    </div>
  )
})

export default ShareCard
