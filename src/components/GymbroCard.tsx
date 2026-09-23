"use client"

import { PublicProfile, MainLift, MAIN_LIFT_LABEL, TRAINING_MODE_LABEL, FriendSessionSummary } from "@/lib/types"
import { isLiftFocused } from "@/lib/trainingMode"
import { FriendCardStats, FriendPR, CARD_WINDOW_DAYS } from "@/lib/friendCard"
import { RARITY, LIFT_PILL, BALANCED_PILL } from "@/lib/cardTheme"
import PixelAvatar from "@/components/PixelAvatar"

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** The app's micro-label: the same 10px uppercase run used across every screen. */
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] ${className ?? ""}`}
    >
      {children}
    </span>
  )
}

/** Stable key for a record, used for both React and the "already reacted" set. */
export function prKey(pr: FriendPR): string {
  return `${pr.exercise}-${pr.kg}`
}

/**
 * The hype affordance. Drawn rather than set in emoji so it sits on the app's own
 * stroke weight, and so "already hyped" can be the same flame filled in.
 */
function FlameIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? "#b06a1e" : "none"}
      stroke={filled ? "#b06a1e" : "#bbbbbb"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}

/**
 * One personal record. Tappable on a gymbro's card to hype it, which is what the
 * flame on the right is for — the row read as static text without it.
 */
function RecordRow({
  pr,
  onReact,
  reacted,
}: {
  pr: FriendPR
  /** Omitted on your own card: there is nobody to hype but yourself. */
  onReact?: () => void
  reacted: boolean
}) {
  return (
    <button
      onClick={onReact}
      disabled={reacted || !onReact}
      className={`w-full flex items-center gap-3 py-3 text-left transition-colors ${
        onReact && !reacted ? "active:bg-black/[0.03]" : "cursor-default"
      }`}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-[#111111]">{pr.exercise}</span>
        {/* The badge rides the meta line rather than the title: a long exercise name
            wraps, and a badge beside it ends up floating against the wrapped block. */}
        <span className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-[#aaaaaa]">
            {pr.reps} rep{pr.reps === 1 ? "" : "s"} · {formatDate(pr.date)}
          </span>
          {pr.isFresh && (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[#fdf3e7] text-[#8a4d14]">
              New
            </span>
          )}
        </span>
      </span>

      <span className="flex items-baseline gap-0.5 shrink-0">
        <span className="text-lg font-semibold text-[#111111] tabular-nums">{pr.kg}</span>
        <span className="text-[11px] text-[#aaaaaa]">kg</span>
      </span>

      {/* The row itself is the button, so this is a styled span rather than a
          nested one — it exists to make the tap target look like what it is. */}
      {onReact && (
        <span
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
            reacted ? "bg-[#fdf3e7] border-transparent" : "bg-white border-[#e8e8e8]"
          }`}
        >
          <FlameIcon filled={reacted} />
        </span>
      )}
    </button>
  )
}

/**
 * The consistency grid: one pip per day, a week to a row, most recent last. Four
 * rows of seven reads as a month at a glance, the way a calendar does.
 */
function StreakGrid({ dots }: { dots: boolean[] }) {
  const weeks: boolean[][] = []
  for (let i = 0; i < dots.length; i += 7) weeks.push(dots.slice(i, i + 7))

  return (
    <div className="flex flex-col gap-[3px]" aria-hidden="true">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex gap-[3px]">
          {week.map((trained, di) => (
            <span
              key={di}
              className="w-[10px] h-[10px] rounded-[2px]"
              style={{ backgroundColor: trained ? "#1e3a5f" : "#eeeeee" }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface Props {
  profile: PublicProfile
  card: FriendCardStats
  lastSessionSummary: FriendSessionSummary | null
  isLive: boolean
  /** Keys (see `prKey`) of records this viewer has already hyped. */
  reactedPRs?: string[]
  /** Left out on your own card, which renders the same layout without reactions. */
  onReactPR?: (pr: FriendPR) => void
}

/**
 * A gymbro at a glance. Presentational only — the page owns fetching and messaging,
 * which is what lets this render standalone with mock data.
 *
 * The collectible reading survives in the data (rarity, a sprite, progress to
 * target) but not in the chrome: this is the same white card, Inter type and navy
 * accent every other screen is built from.
 */
export default function GymbroCard({
  profile,
  card,
  lastSessionSummary,
  isLive,
  reactedPRs = [],
  onReactPR,
}: Props) {
  const liftFocused = isLiftFocused(profile)
  const lift: MainLift | undefined = liftFocused ? profile.mainLift : undefined
  const rarity = RARITY[card.rarity]

  const anchor = profile.anchor ?? 0
  const target = profile.target ?? 0
  const hasProgress = liftFocused && target > 0 && anchor > 0

  return (
    <div className="rounded-2xl border border-[#eeeeee] bg-white shadow-sm overflow-hidden animate-fade-up">
      {/* Artwork */}
      <div
        className="relative flex items-center justify-center py-7 overflow-hidden"
        style={{ backgroundColor: rarity.bg }}
      >
        {rarity.holo && (
          <span
            className="pointer-events-none absolute -inset-y-12 -left-1/3 w-1/3 animate-holo-sweep"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)",
            }}
            aria-hidden="true"
          />
        )}

        <PixelAvatar seed={profile.email} colour={rarity.bar} className="w-24 h-24" />

        {isLive && (
          <span className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/90">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#555555]">
              In session
            </span>
          </span>
        )}

        <span
          className="absolute bottom-3 right-3 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/90"
          style={{ color: rarity.ink }}
        >
          {rarity.label}
        </span>
      </div>

      <div className="px-4 pt-4 pb-4">
        {/* Name + main lift */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-2xl font-semibold text-[#111111] tracking-tight truncate">
            {profile.name}
          </h2>
          <span
            className={`shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              lift ? LIFT_PILL[lift] : BALANCED_PILL
            }`}
          >
            {lift ? MAIN_LIFT_LABEL[lift] : TRAINING_MODE_LABEL.balanced}
          </span>
        </div>

        {/* Progress to target */}
        {hasProgress && (
          <div className="mb-4">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <Label>Current best</Label>
              {card.progressPct != null && (
                <span className="text-xs font-medium text-[#1e3a5f]">{card.progressPct}%</span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-semibold text-[#111111] tabular-nums leading-none">
                {anchor}
              </span>
              <span className="text-sm text-[#aaaaaa]">/ {target}kg</span>
            </div>
            <div className="h-1 rounded-full bg-[#f5f5f5] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${card.progressPct ?? 0}%`,
                  backgroundColor: rarity.bar,
                }}
              />
            </div>
          </div>
        )}

        {/* Records */}
        <div className="border-t border-[#f5f5f5]">
          {card.records.length > 0 ? (
            card.records.map((pr) => (
              <RecordRow
                key={prKey(pr)}
                pr={pr}
                reacted={reactedPRs.includes(prKey(pr))}
                onReact={onReactPR ? () => onReactPR(pr) : undefined}
              />
            ))
          ) : (
            <p className="py-6 text-center text-sm text-[#aaaaaa]">No records yet</p>
          )}
        </div>

        {/* Consistency */}
        <div className="flex items-end justify-between gap-3 pt-4 mt-1 border-t border-[#f5f5f5]">
          <div>
            <Label>Streak</Label>
            <div className="flex items-baseline gap-1.5 mt-1.5">
              <span className="text-2xl font-semibold text-[#111111] tabular-nums leading-none">
                {card.weekStreak}
              </span>
              <span className="text-sm text-[#777777]">
                week{card.weekStreak === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[11px] text-[#aaaaaa] mt-1">
              {card.avgPerWeek}×/wk over {CARD_WINDOW_DAYS / 7}w
            </p>
          </div>
          <StreakGrid dots={card.dayDots} />
        </div>

        {/* Last session */}
        {lastSessionSummary && (
          <div className="rounded-xl bg-[#f5f5f5] px-4 py-3 mt-4">
            <div className="flex items-center justify-between gap-2">
              <Label>Last seen</Label>
              <span className="text-[11px] text-[#999999]">
                {card.daysSinceLast === 0
                  ? "today"
                  : card.daysSinceLast === 1
                    ? "yesterday"
                    : `${card.daysSinceLast}d ago`}
              </span>
            </div>
            <p className="text-sm font-medium text-[#333333] mt-1.5 truncate">
              {lastSessionSummary.label}
              {lastSessionSummary.muscles.length > 0 &&
                ` · ${lastSessionSummary.muscles.join(" + ")}`}
            </p>
            {lastSessionSummary.sets > 0 && (
              <p className="text-[11px] text-[#999999] mt-0.5">
                {lastSessionSummary.exercises} ex · {lastSessionSummary.sets} sets ·{" "}
                {lastSessionSummary.volume.toLocaleString("en-GB")} kg
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[#f5f5f5]">
          <Label>
            {card.level} session{card.level === 1 ? "" : "s"}
          </Label>
          <Label>{card.sessionsThisWeek} this week</Label>
        </div>
      </div>
    </div>
  )
}
