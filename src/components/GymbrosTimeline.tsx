"use client"

import Link from "next/link"
import { GymbroMessage, UserPresence } from "@/lib/types"
import { relativeDate } from "@/lib/time"

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

const TRACK_WIDTH_PX = 360
const AVATAR_PX = 40
const MIN_GAP_PX = 44
const THIRTY_DAYS_HOURS = 720

const CHECKPOINTS: { hours: number; label: string }[] = [
  { hours: 0, label: "now" },
  { hours: 336, label: "2w+" },
]

function hoursAgo(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 3_600_000)
}

function positionPct(h: number, maxH: number): number {
  if (!isFinite(h)) return 100
  return (Math.log(h + 1) / Math.log(maxH + 1)) * 100
}

interface Entry {
  key: string
  presence: UserPresence
  isMe: boolean
  lastLiftDate: string | null
  hours: number
  posPct: number
  msgCount: number
}

interface Props {
  friendPresences: UserPresence[]
  currentUserEmail: string
  currentUserName: string
  currentUserInSession: boolean
  currentUserLastSessionDate: string | null
  friendLastActive?: Record<string, string>
  messagesByFriend?: Record<string, GymbroMessage[]>
  onAvatarClick?: (presence: UserPresence) => void
}

export default function GymbrosTimeline({
  friendPresences,
  currentUserEmail,
  currentUserName,
  currentUserInSession,
  currentUserLastSessionDate,
  friendLastActive,
  messagesByFriend,
  onAvatarClick,
}: Props) {
  const friends = friendPresences.filter((p) => p.email !== currentUserEmail)

  const mePresence: UserPresence = {
    email: currentUserEmail,
    name: currentUserName,
    inSession: currentUserInSession,
    startedAt: null,
  }

  const meEntry = {
    presence: mePresence,
    isMe: true,
    lastLiftDate: currentUserLastSessionDate,
  }

  const friendEntries = friends.map((p) => {
    const k = p.email.trim().toLowerCase()
    return {
      presence: p,
      isMe: false,
      lastLiftDate: friendLastActive?.[k] ?? null,
    }
  })

  const allRaw = [meEntry, ...friendEntries]

  const finiteHours = allRaw
    .map((e) => hoursAgo(e.lastLiftDate))
    .filter((h) => isFinite(h))
  const maxH = Math.max(THIRTY_DAYS_HOURS, ...finiteHours)

  const entryHours = allRaw.map((e) => {
    if (e.isMe && currentUserInSession) return 0
    if (!e.isMe && e.presence.inSession && e.presence.startedAt) return hoursAgo(e.presence.startedAt)
    return hoursAgo(e.lastLiftDate)
  })
  const finiteEntryHours = entryHours.filter((h) => isFinite(h))
  const minFiniteH = finiteEntryHours.length > 0 ? Math.min(...finiteEntryHours) : 0

  const entries: Entry[] = allRaw
    .map((e, i) => {
      const h = entryHours[i]
      const shifted = isFinite(h) ? Math.max(0, h - minFiniteH) : h
      const k = e.presence.email.trim().toLowerCase()
      return {
        key: k,
        presence: e.presence,
        isMe: e.isMe,
        lastLiftDate: e.lastLiftDate,
        hours: h,
        posPct: positionPct(shifted, maxH),
        msgCount: e.isMe ? 0 : messagesByFriend?.[k]?.length ?? 0,
      }
    })
    .sort((a, b) => a.posPct - b.posPct)

  // Collision avoidance: push items right if they'd overlap.
  let lastPx = -Infinity
  const usableWidth = TRACK_WIDTH_PX - AVATAR_PX
  for (const e of entries) {
    let px = (e.posPct / 100) * usableWidth + AVATAR_PX / 2
    if (px - lastPx < MIN_GAP_PX) px = lastPx + MIN_GAP_PX
    e.posPct = Math.min(100, (px / TRACK_WIDTH_PX) * 100)
    lastPx = px
  }

  return (
    <div className="mb-5">
      <p className="text-[10px] uppercase tracking-widest font-medium text-[#aaaaaa] mb-2">gymbros</p>

      <div className="relative h-[88px] w-full">
        {/* Rail */}
        <div className="absolute left-0 right-0 top-[20px] h-px bg-[#e8e8e8]" />

        {/* Checkpoint ticks + bottom-axis labels */}
        {CHECKPOINTS.map((cp, i) => {
          const pct = positionPct(cp.hours, maxH)
          const isFirst = i === 0
          const isLast = i === CHECKPOINTS.length - 1
          const labelTransform = isFirst
            ? "translateX(0)"
            : isLast
              ? "translateX(-100%)"
              : "translateX(-50%)"
          return (
            <span
              key={cp.label}
              className="absolute text-[9px] text-[#bbbbbb] font-medium whitespace-nowrap bg-white px-1 leading-none"
              style={{ left: `${pct}%`, top: "20px", transform: `${labelTransform} translateY(-50%)` }}
            >
              {cp.label}
            </span>
          )
        })}

        {entries.map((e) => {
          const timeLabel = (e.isMe ? currentUserInSession : e.presence.inSession)
            ? "lifting now"
            : e.lastLiftDate
              ? relativeDate(e.lastLiftDate)
              : "never"
          const displayName = e.isMe ? "me" : e.presence.name.split(" ")[0]

          const avatar = (
            <div className="relative">
              <div
                className={`w-10 h-10 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs font-bold text-[#555555] select-none active:opacity-70 transition-opacity ${
                  e.isMe ? "ring-2 ring-[#1e3a5f]/40" : ""
                }`}
              >
                {initials(e.presence.name)}
              </div>
              {e.presence.inSession && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white">
                  <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                </span>
              )}
              {e.msgCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-0.5 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center border-2 border-white leading-none">
                  {e.msgCount > 9 ? "9+" : e.msgCount}
                </span>
              )}
            </div>
          )

          const labelBlock = (
            <div className="flex flex-col items-center gap-0.5 mt-1 leading-none">
              <span className="text-[10px] text-[#aaaaaa] font-medium">{displayName}</span>
              <span className="text-[9px] text-[#cccccc]">{timeLabel}</span>
            </div>
          )

          const inner = (
            <>
              {avatar}
              {labelBlock}
            </>
          )

          const wrapperClass = "absolute top-0 flex flex-col items-center"
          const style = { left: `${e.posPct}%`, transform: "translateX(-50%)", transition: "left 0.6s cubic-bezier(0.32, 0.72, 0, 1)" }

          if (e.isMe) {
            return (
              <div key={e.key} className={wrapperClass} style={style}>
                {inner}
              </div>
            )
          }

          if (e.msgCount > 0) {
            return (
              <button
                key={e.key}
                onClick={() => onAvatarClick?.(e.presence)}
                className={wrapperClass}
                style={style}
              >
                {inner}
              </button>
            )
          }

          return (
            <Link
              key={e.key}
              href={`/friends/${encodeURIComponent(e.presence.email)}`}
              className={wrapperClass}
              style={style}
            >
              {inner}
            </Link>
          )
        })}

        {friends.length === 0 && (
          <Link
            href="/gymbros"
            className="absolute top-0 flex flex-col items-center"
            style={{ left: "55%", transform: "translateX(-50%)" }}
          >
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#cccccc] flex items-center justify-center text-[#aaaaaa] text-lg font-light active:opacity-70 transition-opacity">
              +
            </div>
            <div className="flex flex-col items-center gap-0.5 mt-1 leading-none">
              <span className="text-[10px] text-[#aaaaaa] font-medium">add gymbro</span>
              <span className="text-[9px] text-[#cccccc]">&nbsp;</span>
            </div>
          </Link>
        )}
      </div>

    </div>
  )
}
