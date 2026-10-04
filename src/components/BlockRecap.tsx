"use client"

import { ReactNode } from "react"
import { BlockSummary, CycleSummary } from "@/lib/blockSummary"
import { formatDay } from "@/lib/weight"
import { PHASE_STYLE } from "@/components/BlockHeader"

/** Which recap is open: one block's, or a whole cycle's. */
export type RecapTarget = { kind: "block"; blockId: number } | { kind: "cycle"; cycle: number }

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

function Header({ dotClass, title, meta, dates }: { dotClass: string; title: string; meta: string; dates: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span className="text-base font-semibold text-foreground">{title}</span>
        </span>
        <span className="text-xs text-muted-light">{dates}</span>
      </div>
      <p className="text-xs text-muted-light mt-0.5 ml-4">{meta}</p>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-xs text-muted-light">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

function Note({ text }: { text: string | null }) {
  return text ? <p className="text-xs text-muted mt-3">{text}</p> : null
}

function ShareLink({ onShare }: { onShare: () => void }) {
  return (
    <button onClick={onShare} className="mt-3 text-xs font-semibold text-accent active:opacity-60">
      Share
    </button>
  )
}

/** What a block took: first top set against the last, and the few numbers around it. */
export function BlockRecapCard({
  summary,
  liftLabel,
  onShare,
  bare = false,
}: {
  summary: BlockSummary
  liftLabel: string
  onShare?: () => void
  /** Inside a sheet the card drops its own border. */
  bare?: boolean
}) {
  const s = summary
  const style = PHASE_STYLE[s.block.phase] ?? PHASE_STYLE.accumulation

  return (
    <div className={bare ? "" : "rounded-xl border border-border bg-white px-4 py-4 mb-3"}>
      <Header
        dotClass={style.bar}
        title={s.phaseLabel}
        dates={span(s.startDate, s.endDate)}
        meta={`Cycle ${s.cycle} · ${s.block.anchorWeight}kg anchor · ${plural(s.sessions, "session")} · ${plural(s.days, "day")}`}
      />

      {/* First top set → last top set */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-lighter mb-1">First</p>
          <p className="text-2xl font-semibold text-foreground leading-none">
            {kg(s.start.kg)}<span className="text-sm font-medium text-muted-light"> × {s.start.reps}</span>
          </p>
        </div>
        <span className="text-muted-lighter mb-1">→</span>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted-lighter mb-1">Last</p>
          <p className="text-2xl font-semibold text-foreground leading-none">
            {kg(s.end.kg)}<span className="text-sm font-medium text-muted-light"> × {s.end.reps}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border divide-y divide-[#f0f0f0]">
        <Row label="e1RM">
          {change(s.sessions > 1 ? s.start.e1rm : null, s.end.e1rm)}
          {s.e1rmChange != null && s.e1rmChange !== 0 && s.sessions > 1 && (
            <span className={`ml-1.5 text-xs ${s.e1rmChange > 0 ? "text-[#2d6a2d]" : "text-muted-light"}`}>{signed(s.e1rmChange)}</span>
          )}
          {s.isPR && <span className="ml-1.5 text-xs font-semibold text-accent">PR</span>}
        </Row>
        {s.avgRPE != null && (
          <Row label="RPE">
            {s.sessions > 1 && s.rpeStart != null && s.rpeEnd != null ? `${s.rpeStart} → ${s.rpeEnd}` : s.avgRPE}
          </Row>
        )}
        <Row label="Volume">
          {s.volume >= 1000 ? `${kg(s.volume / 1000)}t` : `${s.volume}kg`}
          <span className="text-xs text-muted-light"> · {s.workingSets} {liftLabel.toLowerCase()} sets</span>
        </Row>
        {s.end.bw != null && <Row label="Bodyweight">{change(s.start.bw, s.end.bw)}</Row>}
        {s.skipped > 0 && <Row label={`${liftLabel} skipped`}>{plural(s.skipped, "session")}</Row>}
        {s.next && (
          <Row label={s.next.resumed ? "Resumes" : "Next"}>
            {s.next.phaseLabel} · {s.next.anchor}kg
          </Row>
        )}
      </div>

      <Note text={s.coachNote} />
      {onShare && <ShareLink onShare={onShare} />}
    </div>
  )
}

/** A whole cycle, Volume through Deload: what moved, and the blocks that moved it. */
export function CycleRecapCard({
  summary,
  liftLabel,
  target,
  onShare,
  onOpenBlock,
  bare = false,
}: {
  summary: CycleSummary
  liftLabel: string
  target: number | null
  onShare?: () => void
  /** Tapping a block row opens that block's own recap, when given. */
  onOpenBlock?: (blockId: number) => void
  bare?: boolean
}) {
  const s = summary
  const weeks = Math.round((s.days / 7) * 10) / 10
  const pct = s.bestEnd != null && target ? Math.min(100, Math.round((s.bestEnd / target) * 100)) : null

  return (
    <div className={bare ? "" : "rounded-xl border border-border bg-white px-4 py-4 mb-3"}>
      <Header
        dotClass="bg-[#1e3a5f]"
        title={`Cycle ${s.cycle}`}
        dates={span(s.startDate, s.endDate)}
        meta={`${plural(s.sessions, "session")} · ${weeks} weeks`}
      />

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

      {/* The blocks that made the cycle */}
      <div className="mt-3 border-t border-border divide-y divide-[#f0f0f0]">
        {s.blocks.map((b) => {
          const style = PHASE_STYLE[b.block.phase] ?? PHASE_STYLE.accumulation
          const content = (
            <>
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${style.bar}`} />
                <span className="text-sm text-foreground">{b.phaseLabel}</span>
                <span className="text-xs text-muted-light">{plural(b.sessions, "session")}</span>
              </span>
              <span className="text-xs text-muted">
                {b.e1rmChange != null && b.sessions > 1 ? `e1RM ${signed(b.e1rmChange)}` : `${kg(b.end.kg)} × ${b.end.reps}`}
                {onOpenBlock && <span className="text-muted-lighter"> ›</span>}
              </span>
            </>
          )
          return onOpenBlock ? (
            <button
              key={b.block.id}
              onClick={() => onOpenBlock(b.block.id)}
              className="w-full flex items-center justify-between py-2 text-left active:opacity-60"
            >
              {content}
            </button>
          ) : (
            <div key={b.block.id} className="flex items-center justify-between py-2">{content}</div>
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

      <Note text={s.coachNote} />
      {onShare && <ShareLink onShare={onShare} />}
    </div>
  )
}

/** Bottom sheet that carries a recap: after the session that ends a block, or from History. */
export default function RecapSheet({
  label,
  primaryLabel,
  onClose,
  onShare,
  children,
}: {
  /** Small caption above the card, e.g. "Block complete". */
  label?: string
  primaryLabel: string
  onClose: () => void
  onShare: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[393px] rounded-t-2xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[92dvh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-[#e0e0e0] rounded-full mx-auto mb-4" />
        {label && <p className="text-[10px] uppercase tracking-widest text-muted-lighter mb-3">{label}</p>}
        {children}
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
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The sheet for one recap target, worked out from the stored blocks and sessions. */
export function RecapSheetFor({
  target,
  block,
  cycle,
  liftLabel,
  goal,
  justFinished,
  onClose,
  onShare,
  onOpenBlock,
}: {
  target: RecapTarget
  block: BlockSummary | null
  cycle: CycleSummary | null
  liftLabel: string
  goal: number | null
  /** True straight after logging: says so, and points at what's next. */
  justFinished: boolean
  onClose: () => void
  onShare: () => void
  onOpenBlock?: (blockId: number) => void
}) {
  if (target.kind === "cycle" && cycle) {
    return (
      <RecapSheet
        label={justFinished ? "Cycle complete" : undefined}
        primaryLabel={justFinished ? `Start cycle ${cycle.cycle + 1}` : "Close"}
        onClose={onClose}
        onShare={onShare}
      >
        <CycleRecapCard summary={cycle} liftLabel={liftLabel} target={goal} onOpenBlock={onOpenBlock} bare />
      </RecapSheet>
    )
  }
  if (target.kind === "block" && block) {
    return (
      <RecapSheet
        label={justFinished ? "Block complete" : undefined}
        primaryLabel={justFinished && block.next ? `On to ${block.next.phaseLabel}` : justFinished ? "Continue" : "Close"}
        onClose={onClose}
        onShare={onShare}
      >
        <BlockRecapCard summary={block} liftLabel={liftLabel} bare />
      </RecapSheet>
    )
  }
  return null
}
