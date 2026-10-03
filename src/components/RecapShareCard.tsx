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
const CELL_BG = "#f8f8f8"
const UP = "#2d6a2d"
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

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${kg(Math.abs(n))}`
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

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: CELL_BG,
        borderRadius: 20,
        padding: "26px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 44, fontWeight: 700, color: FG, lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 20, color: MUTED, lineHeight: 1 }}>{sub}</span>}
      <Caps size={16}>{label}</Caps>
    </div>
  )
}

function Endpoint({ label, value, sub, align }: { label: string; value: string; sub: string; align: "left" | "right" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "flex-end", gap: 10 }}>
      <Caps size={18}>{label}</Caps>
      <span style={{ fontSize: 84, fontWeight: 800, color: ACCENT, letterSpacing: -3, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 24, color: MUTED, lineHeight: 1 }}>{sub}</span>
    </div>
  )
}

function Pill({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return (
    <div style={{ alignSelf: "center", padding: "14px 30px", borderRadius: 100, backgroundColor: bg }}>
      <span style={{ fontSize: 30, fontWeight: 700, color }}>{children}</span>
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

        <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, color: FG, marginBottom: 40 }}>
          {isBlock ? `${props.summary.phaseLabel} block done.` : `Cycle ${props.summary.cycle} done.`}
        </span>

        {/* Started → finished */}
        {props.kind === "block" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
              <Endpoint
                label="Started"
                value={`${kg(props.summary.start.kg)}×${props.summary.start.reps}`}
                sub={props.summary.start.e1rm != null ? `e1RM ${kg(props.summary.start.e1rm)}kg` : ""}
                align="left"
              />
              <span style={{ fontSize: 56, color: "#cccccc" }}>→</span>
              <Endpoint
                label="Finished"
                value={`${kg(props.summary.end.kg)}×${props.summary.end.reps}`}
                sub={props.summary.end.e1rm != null ? `e1RM ${kg(props.summary.end.e1rm)}kg` : ""}
                align="right"
              />
            </div>
            {props.summary.e1rmChange != null && props.summary.sessions > 1 && (
              <Pill color={props.summary.e1rmChange > 0 ? UP : MUTED} bg={props.summary.e1rmChange > 0 ? "#f0f7f0" : "#f5f5f5"}>
                e1RM {signed(props.summary.e1rmChange)}kg
              </Pill>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 40, marginBottom: 44 }}>
              <StatCell label="Sessions" value={`${props.summary.sessions}/${props.summary.plannedSessions}`} />
              <StatCell label="Days" value={String(props.summary.days)} />
              <StatCell label="Avg RPE" value={props.summary.avgRPE != null ? String(props.summary.avgRPE) : "—"} />
              <StatCell
                label="Volume"
                value={props.summary.volume >= 1000 ? `${kg(props.summary.volume / 1000)}t` : `${props.summary.volume}`}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
              <Endpoint label="Anchor in" value={`${kg(props.summary.anchorStart)}kg`} sub={props.summary.e1rmStart != null ? `e1RM ${kg(props.summary.e1rmStart)}kg` : ""} align="left" />
              <span style={{ fontSize: 56, color: "#cccccc" }}>→</span>
              <Endpoint label="Anchor out" value={`${kg(props.summary.anchorEnd)}kg`} sub={props.summary.e1rmEnd != null ? `e1RM ${kg(props.summary.e1rmEnd)}kg` : ""} align="right" />
            </div>
            {props.summary.e1rmStart != null && props.summary.e1rmEnd != null && (
              <Pill
                color={props.summary.e1rmEnd > props.summary.e1rmStart ? UP : MUTED}
                bg={props.summary.e1rmEnd > props.summary.e1rmStart ? "#f0f7f0" : "#f5f5f5"}
              >
                e1RM {signed(props.summary.e1rmEnd - props.summary.e1rmStart)}kg this cycle
              </Pill>
            )}
            {/* The four phases */}
            <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
              {props.summary.blocks.map((b) => (
                <div
                  key={b.block.id}
                  style={{ flex: 1, borderRadius: 16, padding: "18px 16px", backgroundColor: `${PHASE_COLOR[b.block.phase]}14`, display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <span style={{ fontSize: 22, fontWeight: 700, color: PHASE_COLOR[b.block.phase] }}>{b.phaseLabel}</span>
                  <span style={{ fontSize: 20, color: MUTED }}>
                    {b.e1rmChange != null && b.sessions > 1 ? `e1RM ${signed(b.e1rmChange)}` : `${kg(b.end.kg)}×${b.end.reps}`}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 16, marginBottom: 44 }}>
              <StatCell label="Sessions" value={String(props.summary.sessions)} />
              <StatCell label="Weeks" value={String(Math.round((props.summary.days / 7) * 10) / 10)} />
              <StatCell
                label="Peak single"
                value={props.summary.peak ? `${kg(props.summary.peak.kg)}` : "—"}
                sub={props.summary.peak?.rpe != null ? `RPE ${props.summary.peak.rpe}` : undefined}
              />
            </div>
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
