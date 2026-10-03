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

function Endpoint({ label, kg: load, reps, e1rm, date, align }: {
  label: string
  kg: number
  reps: number
  e1rm: number | null
  date: string
  align: "left" | "right"
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-lighter">{label}</span>
      <span className="text-xl font-bold leading-tight text-foreground">
        {kg(load)}<span className="text-sm font-semibold">kg</span>
        <span className="text-sm font-semibold text-muted-light"> × {reps}</span>
      </span>
      <span className="text-[11px] text-muted-light">
        {e1rm != null ? `e1RM ${kg(e1rm)}kg` : "e1RM —"} · {formatDay(date)}
      </span>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] bg-[#f8f8f8] py-2.5 px-1 gap-0.5 min-h-16">
      <span className="text-base font-semibold leading-none text-foreground">{value}</span>
      {sub && <span className="text-[10px] leading-none text-muted-light">{sub}</span>}
      <span className="text-[9px] font-medium uppercase tracking-widest text-muted-lighter mt-0.5">{label}</span>
    </div>
  )
}

function CoachNote({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-xl bg-accent-bg px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-accent mb-0.5">Coach</p>
      <p className="text-xs leading-relaxed text-[#1e3a5f]">{text}</p>
    </div>
  )
}

function PRBadge({ e1rm }: { e1rm: number }) {
  return (
    <span className="text-[10px] font-semibold rounded-full bg-[#1e3a5f] text-white px-2 py-0.5">
      New e1RM PR · {kg(e1rm)}kg
    </span>
  )
}

function ShareButton({ onShare, label }: { onShare: () => void; label: string }) {
  return (
    <button
      onClick={onShare}
      className="mt-3 w-full text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg py-2 hover:bg-[#1e3a5f] hover:text-white transition-colors"
    >
      {label}
    </button>
  )
}

function bodyweightStat(start: number | null, end: number | null) {
  if (start != null && end != null && start !== end) return { value: kg(end), sub: `${signed(end - start)}kg` }
  if (end != null) return { value: kg(end), sub: "kg" }
  return { value: "—", sub: undefined }
}

/** The end-of-block recap: where the block started, where it finished, and what it took. */
export function BlockRecapCard({
  summary,
  liftLabel,
  onShare,
}: {
  summary: BlockSummary
  liftLabel: string
  onShare?: () => void
}) {
  const s = summary
  const style = PHASE_STYLE[s.block.phase] ?? PHASE_STYLE.accumulation
  const bw = bodyweightStat(s.start.bw, s.end.bw)

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-white mb-3">
      <div className={`${style.bg} px-4 pt-3.5 pb-3`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${style.meta}`}>
            Cycle {s.cycle} · block complete
          </span>
          {s.isPR && s.bestE1RM != null && <PRBadge e1rm={s.bestE1RM} />}
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-5 rounded-full ${style.bar}`} />
          <span className={`text-lg font-bold ${style.label}`}>{s.phaseLabel}</span>
          <span className={`text-xs ${style.meta}`}>· {s.block.anchorWeight}kg anchor</span>
        </div>
        <p className={`text-xs mt-1 ${style.meta}`}>
          {formatDay(s.startDate)} → {formatDay(s.endDate)} · {plural(s.days, "day")}
        </p>
      </div>

      <div className="px-4 pt-4 pb-4">
        {/* Where it started → where it finished */}
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-lighter mb-2">{liftLabel} · top set</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Endpoint label="Started" {...s.start} align="left" />
          <span className="text-muted-lighter text-lg">→</span>
          <Endpoint label="Finished" {...s.end} align="right" />
        </div>
        {s.e1rmChange != null && s.sessions > 1 && (
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-center text-xs font-semibold ${
              s.e1rmChange > 0 ? "bg-[#f0f7f0] text-[#2d6a2d]" : "bg-[#f5f5f5] text-muted"
            }`}
          >
            e1RM {signed(s.e1rmChange)}kg across the block
          </div>
        )}

        {/* What it took */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat
            label="Sessions"
            value={`${s.sessions}/${s.plannedSessions}`}
            sub={s.skipped > 0 ? `+${s.skipped} skipped` : undefined}
          />
          <Stat label="Days" value={String(s.days)} sub={s.sessions > 1 ? `${kg(s.days / s.sessions)}/session` : undefined} />
          <Stat label="Avg RPE" value={s.avgRPE != null ? String(s.avgRPE) : "—"} sub={
            s.rpeStart != null && s.rpeEnd != null && s.sessions > 1 ? `${s.rpeStart} → ${s.rpeEnd}` : undefined
          } />
          <Stat label="Volume" value={s.volume >= 1000 ? `${kg(s.volume / 1000)}t` : `${s.volume}kg`} sub={`${s.workingSets} ${liftLabel.toLowerCase()} sets`} />
          <Stat label="All sets" value={String(s.totalSets)} sub="incl. accessories" />
          <Stat label="Bodyweight" value={bw.value} sub={bw.sub} />
        </div>

        <CoachNote text={s.coachNote} />

        {s.next && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-light">{s.next.resumed ? "Resumes" : "Next up"}</span>
            <span className="font-semibold text-foreground">
              {s.next.phaseLabel} · {plural(s.next.sessions, "session")} · {s.next.anchor}kg anchor
              {s.next.anchor !== s.block.anchorWeight && (
                <span className="text-[#2d6a2d]"> ({signed(s.next.anchor - s.block.anchorWeight)})</span>
              )}
            </span>
          </div>
        )}

        {onShare && <ShareButton onShare={onShare} label="Share block" />}
      </div>
    </div>
  )
}

function ChangeRow({ label, start, end, unit = "kg" }: {
  label: string
  start: number | null
  end: number | null
  unit?: string
}) {
  const delta = start != null && end != null ? Math.round((end - start) * 10) / 10 : null
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-b-0">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-lighter">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-sm text-muted-light">{start != null ? `${kg(start)}` : "—"}</span>
        <span className="text-muted-lighter text-xs">→</span>
        <span className="text-sm font-semibold text-foreground">{end != null ? `${kg(end)}${unit}` : "—"}</span>
        {delta != null && delta !== 0 && (
          <span
            className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
              delta > 0 && unit === "kg" && label !== "Bodyweight" ? "bg-[#f0f7f0] text-[#2d6a2d]" : "bg-[#f5f5f5] text-muted"
            }`}
          >
            {signed(delta)}
          </span>
        )}
      </span>
    </div>
  )
}

/** The end-of-cycle recap: Volume through Deload, start to finish. */
export function CycleRecapCard({
  summary,
  liftLabel,
  target,
  onShare,
  onOpenBlock,
}: {
  summary: CycleSummary
  liftLabel: string
  target: number | null
  onShare?: () => void
  /** Tapping a block row opens that block's own recap, when given. */
  onOpenBlock?: (blockId: number) => void
}) {
  const s = summary
  const weeks = Math.round((s.days / 7) * 10) / 10
  const pct = s.bestEnd != null && target ? Math.min(100, Math.round((s.bestEnd / target) * 100)) : null

  return (
    <div className="rounded-2xl border border-border overflow-hidden bg-white mb-3">
      <div className="bg-accent-bg px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#3b5f8a]">
            Full cycle · complete
          </span>
          {s.isPR && s.e1rmEnd != null && <PRBadge e1rm={s.e1rmEnd} />}
        </div>
        <span className="text-lg font-bold text-accent">Cycle {s.cycle}</span>
        <p className="text-xs mt-0.5 text-[#3b5f8a]">
          {formatDay(s.startDate)} → {formatDay(s.endDate)} · {plural(s.days, "day")} ({weeks} weeks)
        </p>
      </div>

      <div className="px-4 pt-3 pb-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-lighter mb-1">Started → finished</p>
        <ChangeRow label="Anchor" start={s.anchorStart} end={s.anchorEnd} />
        <ChangeRow label="Best e1RM" start={s.e1rmStart} end={s.e1rmEnd} />
        <ChangeRow label={`Best ${liftLabel.toLowerCase()}`} start={s.bestStart} end={s.bestEnd} />
        <ChangeRow label="Bodyweight" start={s.bwStart} end={s.bwEnd} />

        {s.peak && (
          <div className="mt-3 rounded-xl bg-[#eff6ff] px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#3b5f8a]">Peak single</span>
            <span className="text-sm font-bold text-accent">
              {kg(s.peak.kg)}kg × {s.peak.reps}
              <span className="text-xs font-medium text-[#3b5f8a]"> · {s.peak.rpe != null ? `RPE ${s.peak.rpe}` : "no RPE"} · {formatDay(s.peak.date)}</span>
            </span>
          </div>
        )}

        {/* The blocks that made the cycle */}
        <div className="mt-3 flex flex-col gap-1.5">
          {s.blocks.map((b) => {
            const style = PHASE_STYLE[b.block.phase] ?? PHASE_STYLE.accumulation
            const Row = onOpenBlock ? "button" : "div"
            return (
              <Row
                key={b.block.id}
                {...(onOpenBlock ? { onClick: () => onOpenBlock(b.block.id) } : {})}
                className={`${style.bg} rounded-lg px-3 py-2 flex items-center justify-between text-left w-full${onOpenBlock ? " active:opacity-70" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-1 h-3.5 rounded-full ${style.bar}`} />
                  <span className={`text-xs font-semibold ${style.label}`}>{b.phaseLabel}</span>
                  <span className={`text-[11px] ${style.meta}`}>
                    {b.sessions}/{b.plannedSessions} · {plural(b.days, "day")}
                  </span>
                </span>
                <span className={`text-[11px] font-semibold ${style.label}`}>
                  {b.e1rmChange != null && b.sessions > 1 ? `e1RM ${signed(b.e1rmChange)}` : `${kg(b.end.kg)}kg × ${b.end.reps}`}
                  {onOpenBlock && <span className="opacity-50"> ›</span>}
                </span>
              </Row>
            )
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Stat label="Sessions" value={String(s.sessions)} sub={s.skipped > 0 ? `+${s.skipped} skipped` : undefined} />
          <Stat label="Weeks" value={String(weeks)} sub={plural(s.days, "day")} />
          <Stat label="Avg RPE" value={s.avgRPE != null ? String(s.avgRPE) : "—"} sub="excl. deload" />
        </div>

        {pct != null && target != null && s.bestEnd != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium uppercase tracking-widest text-muted-lighter">Road to {target}kg</span>
              <span className="text-muted-light">
                {kg(s.bestEnd)} / {target}kg · <span className="font-semibold text-accent">{pct}%</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#e8e8e8] overflow-hidden">
              <div className="h-full rounded-full bg-[#1e3a5f]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <CoachNote text={s.coachNote} />

        {onShare && <ShareButton onShare={onShare} label="Share cycle" />}
      </div>
    </div>
  )
}

/** Bottom sheet that carries a recap: after the session that ends a block, or from History. */
export default function RecapSheet({
  emoji,
  title,
  subtitle,
  primaryLabel,
  onClose,
  children,
}: {
  emoji?: string
  title: string
  subtitle?: string
  primaryLabel: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[393px] rounded-t-2xl px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-h-[92dvh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          {emoji && <span className="text-4xl inline-block animate-bounce-in select-none">{emoji}</span>}
          <p className="text-base font-semibold text-foreground mt-1">{title}</p>
          {subtitle && <p className="text-xs text-muted-light">{subtitle}</p>}
        </div>
        {children}
        <button
          onClick={onClose}
          className="w-full bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-3.5 active:bg-[#0f2540] transition-colors"
        >
          {primaryLabel}
        </button>
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
  /** True straight after logging: celebrates and points at what's next. */
  justFinished: boolean
  onClose: () => void
  onShare: () => void
  onOpenBlock?: (blockId: number) => void
}) {
  if (target.kind === "cycle" && cycle) {
    return (
      <RecapSheet
        emoji={justFinished ? "🏆" : undefined}
        title={justFinished ? `Cycle ${cycle.cycle} done` : `Cycle ${cycle.cycle}`}
        subtitle={`${plural(cycle.sessions, "session")} in ${plural(cycle.days, "day")}`}
        primaryLabel={justFinished ? `Start cycle ${cycle.cycle + 1}` : "Close"}
        onClose={onClose}
      >
        <CycleRecapCard summary={cycle} liftLabel={liftLabel} target={goal} onShare={onShare} onOpenBlock={onOpenBlock} />
      </RecapSheet>
    )
  }
  if (target.kind === "block" && block) {
    return (
      <RecapSheet
        emoji={justFinished ? "🏁" : undefined}
        title={`Cycle ${block.cycle} · ${block.phaseLabel}${justFinished ? " done" : ""}`}
        subtitle={`${plural(block.sessions, "session")} in ${plural(block.days, "day")}`}
        primaryLabel={justFinished && block.next ? `On to ${block.next.phaseLabel}` : justFinished ? "Continue" : "Close"}
        onClose={onClose}
      >
        <BlockRecapCard summary={block} liftLabel={liftLabel} onShare={onShare} />
      </RecapSheet>
    )
  }
  return null
}
