"use client"

import { forwardRef, ReactNode } from "react"
import { BlockPhase } from "@/lib/types"
import { CycleSummary } from "@/lib/blockSummary"

// Inline hex only, like ShareCard: html-to-image can't serialize Tailwind v4 oklch().
const ACCENT = "#1e3a5f"
const FG = "#111111"
const MUTED = "#777777"
const MUTED_LIGHT = "#aaaaaa"
const BORDER = "#e8e8e8"
const FONT = '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const PHASE_COLOR: Record<BlockPhase, string> = {
  accumulation: "#2d6a2d",
  transmutation: "#5a2d8a",
  realization: "#1e3a5f",
  deload: "#888888",
  reacclimation: "#b06a1e",
}

export type RecapShareProps = {
  liftLabel: string
  target: number | null
  /** Heaviest set ever logged, for the "% to goal" pill — the same number the session card uses. */
  bestWeight: number | null
  summary: CycleSummary
}

function kg(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function day(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d))
}

function Caps({ children, color = MUTED_LIGHT, size = 20 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color }}>
      {children}
    </span>
  )
}

function Endpoint({ label, value, align }: { label: string; value: string; align: "left" | "right" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "flex-end", gap: 14 }}>
      <Caps size={18}>{label}</Caps>
      <span style={{ fontSize: 104, fontWeight: 800, color: ACCENT, letterSpacing: -4, lineHeight: 1 }}>{value}</span>
    </div>
  )
}

function Line({ items }: { items: Array<string | null> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0 28px", marginTop: 44, marginBottom: 48, fontSize: 28, color: MUTED }}>
      {items.filter(Boolean).map((t, i) => (
        <span key={i}>{t}</span>
      ))}
    </div>
  )
}

const RecapShareCard = forwardRef<HTMLDivElement, RecapShareProps>(function RecapShareCard(props, ref) {
  const { liftLabel, target, bestWeight, summary: s } = props
  const progressPct = bestWeight != null && target ? Math.min(100, Math.round((bestWeight / target) * 100)) : null

  return (
    <div
      ref={ref}
      style={{ width: 1080, backgroundColor: "#ffffff", color: FG, fontFamily: FONT, display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden" }}
    >
      <div style={{ height: 8, backgroundColor: ACCENT }} />
      <div style={{ padding: "52px 64px 56px", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Caps color={ACCENT} size={22}>{liftLabel}</Caps>
            <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: ACCENT, display: "inline-block" }} />
            <Caps color={ACCENT} size={22}>Cycle {s.cycle}</Caps>
          </div>
          <span style={{ fontSize: 22, color: MUTED_LIGHT }}>
            {day(s.startDate)} – {day(s.endDate)}
          </span>
        </div>

        {/* Anchor in → out, a line of numbers, then the four blocks */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
          <Endpoint label="Anchor in" value={`${kg(s.anchorStart)}kg`} align="left" />
          <span style={{ fontSize: 48, color: "#cccccc", paddingBottom: 8 }}>→</span>
          <Endpoint label="Anchor out" value={`${kg(s.anchorEnd)}kg`} align="right" />
        </div>
        <Line
          items={[
            s.peak ? `Peak ${kg(s.peak.kg)}×${s.peak.reps}` : null,
            s.e1rmEnd != null ? `e1RM ${kg(s.e1rmEnd)}kg` : null,
            `${s.sessions} sessions`,
            `${Math.round((s.days / 7) * 10) / 10} weeks`,
          ]}
        />
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 44, borderTop: `2px solid ${BORDER}` }}>
          {s.blocks.map((b) => (
            <div
              key={b.block.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0", borderBottom: `1px solid #f0f0f0` }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: PHASE_COLOR[b.block.phase], display: "inline-block" }} />
                <span style={{ fontSize: 30, fontWeight: 600, color: FG, width: 180 }}>{b.phaseLabel}</span>
                <span style={{ fontSize: 28, color: MUTED }}>
                  {b.sessions > 1
                    ? `${kg(b.start.kg)}×${b.start.reps} → ${kg(b.end.kg)}×${b.end.reps}`
                    : `${kg(b.end.kg)}×${b.end.reps}`}
                </span>
              </div>
              <span style={{ fontSize: 24, color: MUTED_LIGHT }}>
                {b.sessions} session{b.sessions !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>

        {/* Footer, as on the session card */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 32, borderTop: `2px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: ACCENT, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800 }}
            >
              b
            </div>
            <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5, color: FG }}>best workout tracker</span>
          </div>
          {progressPct !== null && (
            <div style={{ padding: "10px 22px", borderRadius: 100, backgroundColor: `${ACCENT}12` }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: ACCENT, letterSpacing: 0.5 }}>{progressPct}% to goal</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default RecapShareCard
