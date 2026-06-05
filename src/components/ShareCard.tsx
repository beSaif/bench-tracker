"use client"

import { forwardRef } from "react"
import { Session } from "@/lib/types"
import { sessionSummary } from "@/lib/stats"

export interface ShareCardProps {
  session: Session
  bestE1RM: number | null
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
        gap: 12,
        padding: "32px 16px",
        borderRadius: 20,
        backgroundColor: hero ? ACCENT_BG : "#f8f8f8",
      }}
    >
      <span
        style={{
          fontSize: 56,
          fontWeight: 700,
          lineHeight: 1,
          color: hero ? ACCENT : FG,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 22,
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
  { session, bestE1RM, bestWeight, bodyweight, target, date, mainLiftLabel },
  ref
) {
  const summary = sessionSummary(session)
  const hasSets = summary.weight != null && summary.reps != null && summary.setCount > 0

  const pct = bestWeight != null ? Math.min((bestWeight / target) * 100, 100) : 0
  const pctStr = pct.toFixed(1)

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        backgroundColor: "#ffffff",
        color: FG,
        fontFamily: FONT,
        padding: 80,
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
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          {mainLiftLabel} · {session.type}
        </span>
        {date && (
          <span style={{ fontSize: 26, color: MUTED_LIGHT }}>{formatDate(date)}</span>
        )}
      </div>

      {/* Hero set line */}
      <div style={{ marginTop: 64 }}>
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
        {summary.bestE1RM != null && (
          <div style={{ marginTop: 28, fontSize: 40, color: MUTED }}>
            e1RM{" "}
            <span style={{ fontWeight: 700, color: ACCENT }}>{summary.bestE1RM}kg</span>{" "}
            this session
          </div>
        )}
      </div>

      {/* Stat row */}
      <div style={{ display: "flex", gap: 24, marginTop: 56 }}>
        <StatCell label="Best e1RM" value={bestE1RM != null ? `${bestE1RM}kg` : "—"} hero />
        <StatCell label="Goal" value={`${target}kg`} />
        <StatCell label="Bodyweight" value={bodyweight != null ? `${bodyweight}kg` : "—"} />
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 56 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Road to {target}kg
          </span>
          <span style={{ fontSize: 26, color: MUTED }}>
            best {bestWeight != null ? `${bestWeight}kg` : "—"} / {target}kg
            <span style={{ marginLeft: 16, color: ACCENT, fontWeight: 600 }}>{pctStr}%</span>
          </span>
        </div>
        <div
          style={{
            height: 14,
            width: "100%",
            backgroundColor: BORDER,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              backgroundColor: ACCENT,
              borderRadius: 999,
            }}
          />
        </div>
      </div>

      {/* Branding — sits just below the progress bar */}
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 20,
          paddingTop: 48,
          borderTop: `2px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            backgroundColor: ACCENT,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            fontWeight: 800,
          }}
        >
          b
        </div>
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -0.5, color: FG }}>
          best workout tracker
        </span>
      </div>
    </div>
  )
})

export default ShareCard
