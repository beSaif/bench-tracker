"use client"

import { ReactNode } from "react"
import { CycleSummary } from "@/lib/blockSummary"
import { formatDay } from "@/lib/weight"
import { PHASE_STYLE } from "@/components/BlockHeader"

function kg(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : "±"}${kg(Math.abs(n))}`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? "s" : ""}`
}

function span(a: string, b: string): string {
  return a === b ? formatDay(a) : `${formatDay(a)} – ${formatDay(b)}`
}

/** "60.4 → 59.9kg", or just the one number when there's nothing to compare. */
function change(start: number | null, end: number | null, unit = "kg"): string {
  if (end == null) return "—"
  if (start == null || start === end) return `${kg(end)}${unit}`
  return `${kg(start)} → ${kg(end)}${unit}`
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-xs text-muted-light">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

/** A whole cycle, Volume through Deload: where it started, where it ended, and each block on the way. */
export function CycleRecapCard({
  summary,
  liftLabel,
  target,
}: {
  summary: CycleSummary
  liftLabel: string
  target: number | null
}) {
  const s = summary
  const weeks = Math.round((s.days / 7) * 10) / 10
  const pct = s.bestEnd != null && target ? Math.min(100, Math.round((s.bestEnd / target) * 100)) : null

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-semibold text-foreground">Cycle {s.cycle}</span>
        <span className="text-xs text-muted-light">{span(s.startDate, s.endDate)}</span>
      </div>
      <p className="text-xs text-muted-light mt-0.5">
        {plural(s.sessions, "session")} · {plural(s.days, "day")} ({weeks} weeks)
      </p>

      <div className="mt-4 border-t border-border divide-y divide-[#f0f0f0]">
        <Row label="Anchor">{change(s.anchorStart, s.anchorEnd)}</Row>
        <Row label="Best e1RM">
          {change(s.e1rmStart, s.e1rmEnd)}
          {s.isPR && <span className="ml-1.5 text-xs font-semibold text-accent">PR</span>}
        </Row>
        <Row label={`Best ${liftLabel.toLowerCase()}`}>{change(s.bestStart, s.bestEnd)}</Row>
        {s.peak && (
          <Row label="Peak single">
            {kg(s.peak.kg)}kg × {s.peak.reps}
            {s.peak.rpe != null && <span className="text-xs text-muted-light"> @ {s.peak.rpe}</span>}
          </Row>
        )}
        {s.bwEnd != null && <Row label="Bodyweight">{change(s.bwStart, s.bwEnd)}</Row>}
        {s.skipped > 0 && <Row label={`${liftLabel} skipped`}>{plural(s.skipped, "session")}</Row>}
      </div>

      {/* Each block of the cycle: first top set → last */}
      <div className="mt-3 border-t border-border divide-y divide-[#f0f0f0]">
        {s.blocks.map((b) => {
          const style = PHASE_STYLE[b.block.phase] ?? PHASE_STYLE.accumulation
          return (
            <div key={b.block.id} className="py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${style.bar} self-center`} />
                  <span className="text-sm text-foreground">{b.phaseLabel}</span>
                </span>
                <span className="text-xs text-muted-light">
                  {plural(b.sessions, "session")} · {plural(b.days, "day")}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5 ml-3.5">
                <span className="text-xs text-muted">
                  {b.sessions > 1
                    ? `${kg(b.start.kg)}×${b.start.reps} → ${kg(b.end.kg)}×${b.end.reps}`
                    : `${kg(b.end.kg)}×${b.end.reps}`}
                </span>
                {b.e1rmChange != null && b.e1rmChange !== 0 && b.sessions > 1 && (
                  <span className={`text-xs ${b.e1rmChange > 0 ? "text-[#2d6a2d]" : "text-muted-light"}`}>
                    e1RM {signed(b.e1rmChange)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {pct != null && target != null && s.bestEnd != null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-light mb-1">
            <span>{kg(s.bestEnd)} / {target}kg</span>
            <span>{pct}%</span>
          </div>
          <div className="h-[2px] bg-[#e8e8e8]">
            <div className="h-full bg-[#1e3a5f]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {s.coachNote && <p className="text-xs text-muted mt-3">{s.coachNote}</p>}
    </div>
  )
}

/** The cycle recap in a bottom sheet: once, straight after the Deload, and from History. */
export default function CycleRecapSheet({
  summary,
  liftLabel,
  target,
  justFinished,
  onClose,
  onShare,
}: {
  summary: CycleSummary
  liftLabel: string
  target: number | null
  /** True straight after the Deload is logged: says so, and the button starts the next cycle. */
  justFinished: boolean
  onClose: () => void
  onShare: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[393px] rounded-t-2xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[92dvh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-[#e0e0e0] rounded-full mx-auto mb-4" />
        {justFinished && (
          <p className="text-[10px] uppercase tracking-widest text-muted-lighter mb-3">Cycle complete</p>
        )}
        <CycleRecapCard summary={summary} liftLabel={liftLabel} target={target} />
        <div className="flex gap-2 mt-6">
          <button
            onClick={onShare}
            className="px-5 text-sm font-semibold text-[#1e3a5f] border border-border rounded-xl py-3.5 active:bg-[#f5f5f5]"
          >
            Share
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-3.5 active:bg-[#0f2540] transition-colors"
          >
            {justFinished ? `Start cycle ${summary.cycle + 1}` : "Close"}
          </button>
        </div>
      </div>
    </div>
  )
}
