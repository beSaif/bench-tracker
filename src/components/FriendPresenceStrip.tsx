"use client"

import Link from "next/link"
import { UserPresence } from "@/lib/types"

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function relativeDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "1d ago"
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

interface Props {
  presences: UserPresence[]
  currentUserEmail: string
  lastActiveDates?: Record<string, string>
}

export default function FriendPresenceStrip({ presences, currentUserEmail, lastActiveDates }: Props) {
  if (presences.length === 0) return null

  const others = presences.filter((p) => p.email !== currentUserEmail)
  if (others.length === 0) return null

  const anyOnline = others.some((p) => p.inSession)

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        {others.map((p) => (
          <Link
            key={p.email}
            href={`/friends/${encodeURIComponent(p.email)}`}
            className="flex flex-col items-center gap-1"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs font-bold text-[#555555] select-none cursor-pointer active:opacity-70 transition-opacity">
                {initials(p.name)}
              </div>
              {p.inSession && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white">
                  <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#aaaaaa] font-medium leading-none">
              {p.name.split(" ")[0]}
            </span>
            {lastActiveDates?.[p.email.trim().toLowerCase()] && (
              <span className="text-[9px] text-[#cccccc] leading-none">
                {relativeDate(lastActiveDates[p.email.trim().toLowerCase()]!)}
              </span>
            )}
          </Link>
        ))}

        <div className="ml-auto">
          {anyOnline ? (
            <span className="text-[11px] text-green-600 font-medium">lifting now</span>
          ) : (
            <span className="text-[11px] text-[#cccccc]">no one lifting</span>
          )}
        </div>
      </div>
    </div>
  )
}
