"use client"

import { forwardRef, ReactNode } from "react"
import { BlockPhase } from "@/lib/types"
import { BlockSummary, CycleSummary } from "@/lib/blockSummary"

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
} & ({ kind: "block"; summary: BlockSummary } | { kind: "cycle"; summary: CycleSummary })

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
  const { liftLabel, target, bestWeight } = props
  const isBlock = props.kind === "block"
  const color = isBlock ? PHASE_COLOR[props.summary.block.phase] : ACCENT
  const s = props.summary
  const progressPct = bestWeight != null && target ? Math.min(100, Math.round((bestWeight / target) * 100)) : null

  return (
    <div
      ref={ref}
      style={{ width: 1080, backgroundColor: "#ffffff", color: FG, fontFamily: FONT, display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden" }}
    >
      <div style={{ height: 8, backgroundColor: color }} />
      <div style={{ padding: "52px 64px 56px", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Caps color={ACCENT} size={22}>{liftLabel}</Caps>
            <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color, display: "inline-block" }} />
            <Caps color={color} size={22}>
              {isBlock ? `Cycle ${props.summary.cycle} · ${props.summary.phaseLabel}` : `Cycle ${props.summary.cycle}`}
            </Caps>
          </div>
          <span style={{ fontSize: 22, color: MUTED_LIGHT }}>
            {day(s.startDate)} – {day(s.endDate)}
          </span>
        </div>

        {/* First → last, then a single line of numbers */}
        {props.kind === "block" ? (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
              <Endpoint label="First" value={`${kg(props.summary.start.kg)}×${props.summary.start.reps}`} align="left" />
              <span style={{ fontSize: 48, color: "#cccccc", paddingBottom: 8 }}>→</span>
              <Endpoint label="Last" value={`${kg(props.summary.end.kg)}×${props.summary.end.reps}`} align="right" />
            </div>
            <Line
              items={[
                props.summary.end.e1rm != null
                  ? `e1RM ${props.summary.sessions > 1 && props.summary.start.e1rm != null ? `${kg(props.summary.start.e1rm)} → ` : ""}${kg(props.summary.end.e1rm)}kg`
                  : null,
                `${props.summary.sessions} sessions`,
                `${props.summary.days} days`,
                props.summary.avgRPE != null ? `RPE ${props.summary.avgRPE}` : null,
              ]}
            />
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 12 }}>
              <Endpoint label="Anchor in" value={`${kg(props.summary.anchorStart)}kg`} align="left" />
              <span style={{ fontSize: 48, color: "#cccccc", paddingBottom: 8 }}>→</span>
              <Endpoint label="Anchor out" value={`${kg(props.summary.anchorEnd)}kg`} align="right" />
            </div>
            <Line
              items={[
                props.summary.peak ? `Peak ${kg(props.summary.peak.kg)}×${props.summary.peak.reps}` : null,
                props.summary.e1rmEnd != null ? `e1RM ${kg(props.summary.e1rmEnd)}kg` : null,
                `${props.summary.sessions} sessions`,
                `${Math.round((props.summary.days / 7) * 10) / 10} weeks`,
              ]}
            />
          </>
        )}

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
