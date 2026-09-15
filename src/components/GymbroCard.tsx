"use client"

import { UserProfile, MainLift, FriendSessionSummary } from "@/lib/types"
import { isLiftFocused } from "@/lib/trainingMode"
import { FriendCardStats, FriendPR, CARD_WINDOW_DAYS } from "@/lib/friendCard"
import { RARITY, LIFT_ENERGY, BALANCED_ENERGY, stageFor, weaknessFor } from "@/lib/cardTheme"
import PixelAvatar from "@/components/PixelAvatar"

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** The pixel-type heading face, wrapped so every use picks up the same fallback stack. */
function Pixel({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span className={`font-pixel ${className ?? ""}`} style={style}>
      {children}
    </span>
  )
}

/** Stable key for a record, used for both React and the "already reacted" set. */
export function prKey(pr: FriendPR): string {
  return `${pr.exercise}-${pr.kg}`
}

/**
 * An attack row: one personal record, dressed as a move. The energy pips are the
 * rep count, the damage is the weight.
 */
function AttackRow({
  pr,
  energy,
  onReact,
  reacted,
}: {
  pr: FriendPR
  energy: { pip: string; colour: string }
  onReact: () => void
  reacted: boolean
}) {
  // Reps become the energy cost, capped so a 15-rep set doesn't overrun the row.
  const pips = Math.min(4, Math.max(1, Math.round(pr.reps / 3)))

  return (
    <button
      onClick={onReact}
      disabled={reacted}
      className="w-full flex items-start gap-2.5 py-2.5 px-1 text-left rounded-lg transition-colors hover:bg-black/[0.03] active:bg-black/[0.06] disabled:hover:bg-transparent"
    >
      <span className="flex shrink-0 gap-0.5 pt-0.5" aria-hidden="true">
        {Array.from({ length: pips }).map((_, i) => (
          <span
            key={i}
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] leading-none"
            style={{ backgroundColor: `${energy.colour}1a`, color: energy.colour }}
          >
            {energy.pip}
          </span>
        ))}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <Pixel className="text-[8px] leading-[1.5] text-[#111111] truncate">
            {pr.exercise.toUpperCase()}
          </Pixel>
          <Pixel className="text-[11px] leading-none text-[#111111] shrink-0">{pr.kg}</Pixel>
        </span>
        <span className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] text-[#888888]">
            {pr.reps} rep{pr.reps === 1 ? "" : "s"} · {formatDate(pr.date)}
          </span>
          {pr.isFresh && (
            <span className="text-[8px] font-semibold uppercase tracking-wider px-1 py-px rounded bg-[#fff3cd] text-[#7a4a05]">
              new
            </span>
          )}
          {reacted && <span className="text-[10px]">🔥 sent</span>}
        </span>
      </span>
    </button>
  )
}

/** The consistency strip: one pip per day in week-columns, most recent on the right. */
function StreakGrid({ dots }: { dots: boolean[] }) {
  const weeks: boolean[][] = []
  for (let i = 0; i < dots.length; i += 7) weeks.push(dots.slice(i, i + 7))

  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((trained, di) => (
            <span
              key={di}
              className="w-[7px] h-[7px] rounded-[1px]"
              style={{ backgroundColor: trained ? "#111111" : "#dcdcdc" }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface Props {
  profile: UserProfile
  card: FriendCardStats
  lastSessionSummary: FriendSessionSummary | null
  isLive: boolean
  /** Keys (see `prKey`) of records this viewer has already hyped. */
  reactedPRs: string[]
  onReactPR: (pr: FriendPR) => void
}

/**
 * A gymbro as a trading card. Presentational only — the page owns fetching and
 * messaging, which is what lets this render standalone with mock data.
 */
export default function GymbroCard({
  profile,
  card,
  lastSessionSummary,
  isLive,
  reactedPRs,
  onReactPR,
}: Props) {
  const liftFocused = isLiftFocused(profile)
  const friendLift: MainLift | undefined = liftFocused ? profile.mainLift : undefined
  const energy = friendLift ? LIFT_ENERGY[friendLift] : BALANCED_ENERGY
  const rarity = RARITY[card.rarity]
  const weakness = weaknessFor(card.daysSinceLast)

  const anchor = profile.anchor ?? 0
  const target = profile.target ?? 0
  const hasHp = liftFocused && target > 0 && anchor > 0

  return (
    <div
      className="relative rounded-[18px] p-[10px] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)] animate-card-enter overflow-hidden"
      style={{ background: rarity.frame }}
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

      <div
        className="relative rounded-[11px] px-3.5 pt-3 pb-3.5 border border-black/10"
        style={{ backgroundColor: rarity.mat }}
      >
        {/* Stage + HP */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <Pixel className="text-[7px] leading-none text-[#777777]">{stageFor(card.level)}</Pixel>
            <span className="text-[8px] leading-none" style={{ color: rarity.ink }}>
              {rarity.stars}
            </span>
          </span>

          {hasHp ? (
            <span className="flex items-baseline gap-1 shrink-0">
              <Pixel className="text-[7px] leading-none text-[#c23b3b]">HP</Pixel>
              <Pixel className="text-[13px] leading-none text-[#111111]">{anchor}</Pixel>
              <span className="text-[9px] text-[#999999]">/{target}</span>
            </span>
          ) : (
            <Pixel className="text-[7px] leading-none text-[#999999] shrink-0">
              {card.level} SESSIONS
            </Pixel>
          )}
        </div>

        {/* Artwork */}
        <div
          className="relative rounded-[6px] border-2 overflow-hidden mb-2"
          style={{
            borderColor: energy.colour,
            background: `linear-gradient(170deg, ${energy.bg} 0%, #ffffff 70%)`,
          }}
        >
          <div className="flex items-center justify-center py-5">
            <PixelAvatar seed={profile.email} colour={energy.colour} className="w-24 h-24" />
          </div>

          {isLive && (
            <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-1 rounded bg-[#111111]/85">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-green-400 animate-pixel-blink" />
              <Pixel className="text-[6px] leading-none text-white">IN SESSION</Pixel>
            </span>
          )}

          <span className="absolute bottom-1.5 right-1.5">
            <Pixel className="text-[6px] leading-none text-[#999999]">LV.{card.level}</Pixel>
          </span>
        </div>

        {/* Name + energy type */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <Pixel className="text-[11px] leading-[1.4] text-[#111111] truncate">
            {profile.name.toUpperCase()}
          </Pixel>
          <span
            className="flex items-center gap-1 shrink-0 px-1.5 py-1 rounded"
            style={{ backgroundColor: energy.bg, color: energy.colour }}
          >
            <span className="text-[8px] leading-none">{energy.pip}</span>
            <Pixel className="text-[6px] leading-none">{energy.name}</Pixel>
          </span>
        </div>

        {/* Attacks — their records */}
        <div className="border-t border-b border-black/10 py-1 mb-2.5">
          {card.records.length > 0 ? (
            card.records.map((pr) => (
              <AttackRow
                key={prKey(pr)}
                pr={pr}
                energy={energy}
                reacted={reactedPRs.includes(prKey(pr))}
                onReact={() => onReactPR(pr)}
              />
            ))
          ) : (
            <p className="py-4 text-center text-[11px] text-[#aaaaaa]">No moves learned yet.</p>
          )}
        </div>

        {/* Consistency */}
        <div className="flex items-end justify-between gap-3 mb-2.5">
          <div>
            <Pixel className="text-[6px] leading-none text-[#999999]">STREAK</Pixel>
            <div className="flex items-baseline gap-1 mt-1.5">
              <Pixel className="text-[13px] leading-none text-[#111111]">{card.weekStreak}</Pixel>
              <span className="text-[9px] text-[#888888]">
                week{card.weekStreak === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[9px] text-[#999999] mt-1">
              {card.avgPerWeek}×/wk over {CARD_WINDOW_DAYS / 7}w
            </p>
          </div>
          <StreakGrid dots={card.dayDots} />
        </div>

        {/* Last session */}
        {lastSessionSummary && (
          <div className="rounded-md bg-black/[0.03] px-2.5 py-2 mb-2.5">
            <div className="flex items-center justify-between gap-2">
              <Pixel className="text-[6px] leading-none text-[#999999]">LAST SEEN</Pixel>
              <span className="text-[9px] text-[#888888]">
                {card.daysSinceLast === 0
                  ? "today"
                  : card.daysSinceLast === 1
                    ? "yesterday"
                    : `${card.daysSinceLast}d ago`}
              </span>
            </div>
            <p className="text-[11px] text-[#333333] mt-1.5 truncate">
              {lastSessionSummary.label}
              {lastSessionSummary.muscles.length > 0 &&
                ` · ${lastSessionSummary.muscles.join(" + ")}`}
            </p>
            {lastSessionSummary.sets > 0 && (
              <p className="text-[10px] text-[#999999] mt-0.5">
                {lastSessionSummary.exercises} ex · {lastSessionSummary.sets} sets ·{" "}
                {lastSessionSummary.volume.toLocaleString("en-GB")} kg
              </p>
            )}
          </div>
        )}

        {/* Footer: weakness, rarity */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <Pixel className="text-[6px] leading-none text-[#999999]">WEAKNESS</Pixel>
            <span className="text-[9px] text-[#555555] truncate">
              {/* One text node, always: a conditional empty string here renders an
                  empty node on the client that the server never emitted. */}
              {[weakness.pip, weakness.label.toLowerCase()].filter(Boolean).join(" ")}
            </span>
          </span>
          <Pixel className="text-[6px] leading-none shrink-0" style={{ color: rarity.ink }}>
            {rarity.label}
          </Pixel>
        </div>

        {/* Progress to target reads as the card's XP bar. */}
        {card.progressPct != null && (
          <div className="mt-2">
            <div className="h-[6px] bg-black/10 rounded-[2px] overflow-hidden flex gap-[2px] p-[1px]">
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-[1px]"
                  style={{
                    backgroundColor:
                      i < Math.round(card.progressPct! / 5) ? energy.colour : "transparent",
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <Pixel className="text-[6px] leading-none text-[#999999]">
                {card.progressPct}% TO GOAL
              </Pixel>
              <Pixel className="text-[6px] leading-none text-[#999999]">{target}KG</Pixel>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
