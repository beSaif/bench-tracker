"use client"

import { ActivityEvent } from "@/lib/types"
import { relativeTime } from "@/lib/time"

function eventLabel(event: ActivityEvent): string {
  if (event.type === "pr_hit") {
    return `${event.name} hit a new PR: ${event.payload.weight}kg`
  }
  return `${event.name} logged a ${event.payload.sessionType ?? ""} session`.trim()
}

interface Props {
  events: ActivityEvent[]
  currentUserEmail: string
}

export default function ActivityFeed({ events, currentUserEmail }: Props) {
  const friendEvents = events.filter((e) => e.email !== currentUserEmail).slice(0, 5)

  if (friendEvents.length === 0) return null

  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
        Activity
      </p>
      <ul className="space-y-2">
        {friendEvents.map((event) => (
          <li key={event.id} className="flex items-start justify-between gap-2">
            <span className="text-sm text-[#333333]">
              {eventLabel(event)}
            </span>
            <span className="text-[11px] text-[#aaaaaa] shrink-0 mt-0.5">
              {relativeTime(event.timestamp)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
