"use client"

import { useState } from "react"
import { UserProfile } from "@/lib/types"

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function msToShortLabel(ms: number): string {
  const day = ms / 86400_000
  const yr = day / 365.25
  if (ms < 3600_000) return `${Math.round(ms / 60000)}m ago`
  if (day < 1) return `${Math.round(ms / 3600_000)}h ago`
  if (day < 14) return `${Math.round(day)}d ago`
  if (day < 60) return `${Math.round(day / 7)}w ago`
  if (day < 365) return `${Math.round(day / 30)}mo ago`
  if (yr < 100) return `${Math.round(yr)}yr ago`
  if (yr < 1_000_000) return `${Math.round(yr / 1000)}kyr ago`
  if (yr < 1_000_000_000) return `${Math.round(yr / 1_000_000)}Myr ago`
  return `${(yr / 1_000_000_000).toFixed(1)}Byr ago`
}

const MS = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_628_000_000,
  year: 31_536_000_000,
}

interface Milestone {
  ms: number
  label: string
}

const ALL_MILESTONES: Milestone[] = [
  { ms: MS.hour,                      label: "1 hour ago" },
  { ms: MS.hour * 4,                  label: "4 hours ago" },
  { ms: MS.day,                       label: "1 day ago" },
  { ms: MS.day * 3,                   label: "3 days ago" },
  { ms: MS.week,                      label: "last week" },
  { ms: MS.week * 2,                  label: "2 weeks ago" },
  { ms: MS.month,                     label: "last month" },
  { ms: MS.month * 3,                 label: "when it was warm" },
  { ms: MS.month * 6,                 label: "before the holidays" },
  { ms: MS.year,                      label: "new year, same excuses" },
  { ms: MS.year * 2,                  label: "2 years ago" },
  { ms: MS.year * 5,                  label: "half a decade of talk" },
  { ms: MS.year * 10,                 label: "a whole decade" },
  { ms: MS.year * 100,                label: "before your grandpa was born" },
  { ms: MS.year * 2000,               label: "since Jesus" },
  { ms: MS.year * 65_000_000,         label: "when dinosaurs roamed" },
  { ms: MS.year * 13_800_000_000,     label: "The Big Bang" },
]

const ZOOM_LEVELS = [
  { label: "week",    maxMs: MS.week * 2,                minMs: MS.hour },
  { label: "month",   maxMs: MS.month * 3,               minMs: MS.day },
  { label: "year",    maxMs: MS.year * 2,                minMs: MS.week },
  { label: "history", maxMs: MS.year * 2000,             minMs: MS.month },
  { label: "cosmic",  maxMs: MS.year * 13_800_000_000,   minMs: MS.year },
]

const TIMELINE_W = 1600
const AXIS_TOP_PERCENT = 52

function logPos(msAgo: number, maxMs: number): number {
  if (msAgo <= 0) return 0
  const clamped = Math.min(msAgo, maxMs)
  return Math.log(clamped + 1) / Math.log(maxMs + 1)
}

interface Props {
  friends: (UserProfile & { lastSessionDate?: string | null })[]
  currentUserName: string
  onClose: () => void
}

export default function FriendLiftTimeline({ friends, currentUserName, onClose }: Props) {
  const [zoomIdx, setZoomIdx] = useState(0)
  const [sentSet, setSentSet] = useState<Set<string>>(new Set())
  const [sendingSet, setSendingSet] = useState<Set<string>>(new Set())

  const zoom = ZOOM_LEVELS[zoomIdx]
  const now = Date.now()

  const milestones = ALL_MILESTONES.filter(
    (m) => m.ms >= zoom.minMs && m.ms <= zoom.maxMs
  )

  async function handleAvatarTap(friend: UserProfile & { lastSessionDate?: string | null }) {
    if (sentSet.has(friend.email) || sendingSet.has(friend.email)) return

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([50, 30, 50])
    }

    setSendingSet((prev) => new Set(prev).add(friend.email))
    try {
      await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: friend.email,
          text: `${currentUserName} just completed a lift`,
        }),
      })
      setSentSet((prev) => new Set(prev).add(friend.email))
    } finally {
      setSendingSet((prev) => {
        const next = new Set(prev)
        next.delete(friend.email)
        return next
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 animate-slide-up select-none"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-widest font-semibold">session done</p>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-0.5">just lifted.</h2>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all active:scale-90 mt-1"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="12" y2="12" />
            <line x1="12" y1="1" x2="1" y2="12" />
          </svg>
        </button>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-5 py-2">
        <button
          onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
          disabled={zoomIdx === 0}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-300 text-xl font-light disabled:opacity-20 hover:bg-zinc-700 active:scale-90 transition-all"
          aria-label="zoom in"
        >
          −
        </button>
        <span className="text-zinc-400 text-sm font-medium w-14 text-center tabular-nums">
          {zoom.label}
        </span>
        <button
          onClick={() => setZoomIdx((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
          disabled={zoomIdx === ZOOM_LEVELS.length - 1}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-300 text-xl font-light disabled:opacity-20 hover:bg-zinc-700 active:scale-90 transition-all"
          aria-label="zoom out"
        >
          +
        </button>
      </div>

      {/* Timeline scroll area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div
          className="relative h-full"
          style={{ width: TIMELINE_W + 120 }}
        >
          {/* Axis line */}
          <div
            className="absolute left-0 right-0 h-px bg-zinc-700"
            style={{ top: `${AXIS_TOP_PERCENT}%` }}
          />

          {/* Milestone ticks + labels */}
          {milestones.map((m) => {
            const x = 40 + logPos(m.ms, zoom.maxMs) * TIMELINE_W
            return (
              <div
                key={m.ms}
                className="absolute flex flex-col items-center"
                style={{ left: x, top: `${AXIS_TOP_PERCENT}%`, transform: "translateX(-50%)" }}
              >
                <div className="w-px h-3 bg-zinc-700" />
                <p className="text-zinc-600 text-[9px] mt-1 whitespace-nowrap text-center leading-tight max-w-[72px] break-words">
                  {m.label}
                </p>
              </div>
            )
          })}

          {/* YOU marker */}
          <div
            className="absolute flex flex-col items-center gap-0.5"
            style={{ left: 40, top: `${AXIS_TOP_PERCENT}%`, transform: "translateX(-50%) translateY(-50%)" }}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.25)]" />
            <span className="text-white text-[9px] font-bold mt-1 tracking-wide">YOU</span>
          </div>

          {/* Friend avatars */}
          {friends.map((f, i) => {
            const msAgo = f.lastSessionDate
              ? now - new Date(f.lastSessionDate).getTime()
              : zoom.maxMs * 1.1
            const x = 40 + logPos(Math.max(1, msAgo), zoom.maxMs) * TIMELINE_W
            const isOff = msAgo > zoom.maxMs
            const isSent = sentSet.has(f.email)
            const isSending = sendingSet.has(f.email)

            // Deterministic vertical jitter above axis
            const seed = (i * 97 + 13) % 100
            // avatars sit 10–48% above axis (so top% = AXIS_TOP_PERCENT - offset)
            const offsetPct = 10 + (seed % 38)

            return (
              <button
                key={f.email}
                onClick={() => handleAvatarTap(f)}
                disabled={isSent || isSending}
                className={[
                  "absolute flex flex-col items-center gap-1 transition-all duration-300",
                  "active:scale-90 disabled:cursor-default",
                  isOff ? "opacity-25" : "opacity-100",
                ].join(" ")}
                style={{
                  left: Math.min(x, TIMELINE_W + 60),
                  top: `${AXIS_TOP_PERCENT - offsetPct}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {/* Vertical stem connecting avatar to axis */}
                <div
                  className="w-px bg-zinc-800 absolute bottom-0"
                  style={{ height: `calc(${offsetPct}% - 20px)`, bottom: "-100%", left: "50%", transform: "translateX(-50%)" }}
                />

                <div
                  className={[
                    "w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center",
                    "text-xs font-bold text-zinc-200 relative transition-all duration-300",
                    isSent ? "ring-2 ring-white" : "ring-1 ring-zinc-700",
                    isSending ? "animate-pulse" : "",
                  ].join(" ")}
                >
                  {initials(f.name)}
                  {isSent && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center text-zinc-900 text-[9px] font-bold leading-none">
                      ✓
                    </span>
                  )}
                </div>

                <span className="text-zinc-500 text-[9px] whitespace-nowrap z-10">
                  {f.lastSessionDate
                    ? msToShortLabel(Math.max(0, now - new Date(f.lastSessionDate).getTime()))
                    : "never"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom hint */}
      <p className="text-center text-zinc-700 text-[11px] pb-6 pt-2 px-5">
        {friends.length > 0
          ? "tap a friend to let them know you lifted"
          : "add friends to see them on the timeline"}
      </p>
    </div>
  )
}
