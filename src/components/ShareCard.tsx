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

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { session, bestWeight, bodyweight, target, date, mainLiftLabel },
  ref
) {
  const summary = sessionSummary(session)
  const hasSets = summary.weight != null && summary.reps != null && summary.setCount > 0
  const activeIdx = PHASE_INDEX[session.type] ?? 0
  const activePhase = SHARE_PHASES[activeIdx]
  const progressPct =
    bestWeight != null && target > 0
      ? Math.min(100, Math.round((bestWeight / target) * 100))
      : null

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        backgroundColor: "#ffffff",
        color: FG,
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 8, backgroundColor: ACCENT }} />

      {/* Body */}
      <div
        style={{
          padding: "52px 64px 56px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 48,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
              {mainLiftLabel}
            </span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: activePhase.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: activePhase.color,
              }}
            >
              {session.type}
            </span>
          </div>
          {date && (
            <span style={{ fontSize: 22, color: MUTED_LIGHT, fontWeight: 400 }}>
              {formatDate(date)}
            </span>
          )}
        </div>

        {/* Hero section */}
        <div style={{ marginBottom: 44 }}>
          {hasSets ? (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 32 }}>
              <span
                style={{
                  fontSize: 136,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: ACCENT,
                  letterSpacing: -4,
                }}
              >
                {summary.weight}kg
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  paddingBottom: 14,
                }}
              >
                <span style={{ fontSize: 48, fontWeight: 700, color: "#444444", lineHeight: 1 }}>
                  {summary.reps} reps
                </span>
                <span
                  style={{
                    fontSize: 34,
                    fontWeight: 500,
                    color: MUTED_LIGHT,
                    lineHeight: 1,
                  }}
                >
                  {summary.setCount} sets
                </span>
              </div>
            </div>
          ) : (
            <span
              style={{
                fontSize: 96,
                fontWeight: 800,
                lineHeight: 1,
                color: ACCENT,
              }}
            >
              Session logged
            </span>
          )}
        </div>

        {/* Stats strip */}
        <div
          style={{
            display: "flex",
            borderRadius: 20,
            overflow: "hidden",
            border: `2px solid ${BORDER}`,
            marginBottom: 44,
          }}
        >
          {(
            [
              {
                label: "Current Best",
                value: bestWeight != null ? `${bestWeight}kg` : "—",
                accent: true,
              },
              { label: "Goal", value: `${target}kg`, accent: false },
              {
                label: "Bodyweight",
                value: bodyweight != null ? `${bodyweight}kg` : "—",
                accent: false,
              },
            ] as const
          ).map((stat, i, arr) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                padding: "24px 30px",
                backgroundColor: stat.accent ? ACCENT_BG : "#fafafa",
                borderRight: i < arr.length - 1 ? `2px solid ${BORDER}` : "none",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: MUTED_LIGHT,
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: stat.accent ? ACCENT : FG,
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* Phase track */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {SHARE_PHASES.map((phase, i) => (
              <div
                key={phase.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  opacity: i > activeIdx ? 0.28 : 1,
                }}
              >
                <div
                  style={{
                    height: 6,
                    borderRadius: 4,
                    backgroundColor: i <= activeIdx ? phase.color : "#e0e0e0",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {i < activeIdx && (
                    <span style={{ fontSize: 18, color: phase.color, lineHeight: 1 }}>✓</span>
                  )}
                  {i === activeIdx && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: phase.color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: i === activeIdx ? 700 : 500,
                      color: i <= activeIdx ? phase.color : "#cccccc",
                      lineHeight: 1,
                    }}
                  >
                    {phase.label}
                  </span>
                  {i === activeIdx && (
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 400,
                        color: phase.color,
                        opacity: 0.55,
                      }}
                    >
                      · now
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 32,
            borderTop: `2px solid ${BORDER}`,
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                backgroundColor: ACCENT,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              b
            </div>
            <span
              style={{
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: -0.5,
                color: FG,
              }}
            >
              best workout tracker
            </span>
          </div>

          {/* Progress pill */}
          {progressPct !== null && (
            <div
              style={{
                padding: "10px 22px",
                borderRadius: 100,
                backgroundColor: `${ACCENT}12`,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: ACCENT,
                  letterSpacing: 0.5,
                }}
              >
                {progressPct}% to goal
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ShareCard
