"use client"

import { useState, useEffect, useCallback } from "react"
import { ActivityEvent, ReactionsMap, ReactionEmoji, REACTION_EMOJIS, Comment } from "@/lib/types"
import { relativeTime } from "@/lib/time"

function eventLabel(event: ActivityEvent): string {
  if (event.type === "pr_hit") {
    return `${event.name} hit a new PR: ~${event.payload.weight}kg e1RM`
  }
  return `${event.name} logged a ${event.payload.sessionType ?? ""} session`.trim()
}

const EMPTY_REACTIONS: ReactionsMap = { "🔥": [], "💪": [], "💀": [] }

interface Props {
  events: ActivityEvent[]
  currentUserEmail: string
}

export default function ActivityFeed({ events, currentUserEmail }: Props) {
  const friendEvents = events.filter((e) => e.email !== currentUserEmail).slice(0, 5)

  const [reactions, setReactions] = useState<Record<string, ReactionsMap>>({})
  const [myReactions, setMyReactions] = useState<Record<string, ReactionEmoji[]>>({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [draftText, setDraftText] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  const sessionKey = useCallback(
    (event: ActivityEvent) => `${event.email}:${event.payload.sessionId}`,
    []
  )

  // Batch-load reactions for all visible events that have a sessionId
  useEffect(() => {
    const interactive = friendEvents.filter((e) => e.payload.sessionId != null)
    if (interactive.length === 0) return

    Promise.all(
      interactive.map((e) =>
        fetch(
          `/api/reactions?ownerEmail=${encodeURIComponent(e.email)}&sessionId=${e.payload.sessionId}`
        )
          .then((r) => r.json())
          .then((data) => ({ key: sessionKey(e), data }))
          .catch(() => null)
      )
    ).then((results) => {
      const rMap: Record<string, ReactionsMap> = {}
      const myMap: Record<string, ReactionEmoji[]> = {}
      for (const res of results) {
        if (!res) continue
        rMap[res.key] = res.data.reactions ?? EMPTY_REACTIONS
        myMap[res.key] = res.data.myReactions ?? []
      }
      setReactions((prev) => ({ ...prev, ...rMap }))
      setMyReactions((prev) => ({ ...prev, ...myMap }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendEvents.map((e) => e.id).join(",")])

  async function handleReact(event: ActivityEvent, emoji: ReactionEmoji) {
    if (!event.payload.sessionId) return
    const key = sessionKey(event)

    // Optimistic update
    setReactions((prev) => {
      const cur = prev[key] ?? EMPTY_REACTIONS
      const arr = cur[emoji] ?? []
      const isAdding = !arr.includes(currentUserEmail)
      return {
        ...prev,
        [key]: {
          ...cur,
          [emoji]: isAdding
            ? [...arr, currentUserEmail]
            : arr.filter((e) => e !== currentUserEmail),
        },
      }
    })
    setMyReactions((prev) => {
      const cur = prev[key] ?? []
      const isAdding = !cur.includes(emoji)
      return {
        ...prev,
        [key]: isAdding ? [...cur, emoji] : cur.filter((e) => e !== emoji),
      }
    })

    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: event.email,
          sessionId: event.payload.sessionId,
          emoji,
        }),
      })
      const data = await res.json()
      setReactions((prev) => ({ ...prev, [key]: data.reactions ?? EMPTY_REACTIONS }))
      setMyReactions((prev) => ({ ...prev, [key]: data.myReactions ?? [] }))
    } catch {
      // revert on error
      setReactions((prev) => {
        const cur = prev[key] ?? EMPTY_REACTIONS
        const arr = cur[emoji] ?? []
        return {
          ...prev,
          [key]: {
            ...cur,
            [emoji]: arr.includes(currentUserEmail)
              ? arr.filter((e) => e !== currentUserEmail)
              : [...arr, currentUserEmail],
          },
        }
      })
    }
  }

  async function toggleComments(event: ActivityEvent) {
    if (!event.payload.sessionId) return
    const key = sessionKey(event)
    const isExpanding = !expandedComments.has(key)

    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (isExpanding) next.add(key)
      else next.delete(key)
      return next
    })

    if (isExpanding && !comments[key]) {
      try {
        const res = await fetch(
          `/api/comments?ownerEmail=${encodeURIComponent(event.email)}&sessionId=${event.payload.sessionId}`
        )
        const data: Comment[] = await res.json()
        setComments((prev) => ({ ...prev, [key]: Array.isArray(data) ? data : [] }))
      } catch {
        setComments((prev) => ({ ...prev, [key]: [] }))
      }
    }
  }

  async function submitComment(event: ActivityEvent) {
    if (!event.payload.sessionId) return
    const key = sessionKey(event)
    const text = draftText[key]?.trim()
    if (!text) return

    setSubmitting((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEmail: event.email,
          sessionId: event.payload.sessionId,
          text,
        }),
      })
      const data: Comment[] = await res.json()
      setComments((prev) => ({ ...prev, [key]: Array.isArray(data) ? data : [] }))
      setDraftText((prev) => ({ ...prev, [key]: "" }))
    } catch {
      // silent
    } finally {
      setSubmitting((prev) => ({ ...prev, [key]: false }))
    }
  }

  if (friendEvents.length === 0) return null

  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
        Activity
      </p>
      <ul className="space-y-3">
        {friendEvents.map((event) => {
          const key = sessionKey(event)
          const hasSession = event.payload.sessionId != null
          const rMap = reactions[key] ?? EMPTY_REACTIONS
          const mine = myReactions[key] ?? []
          const isExpanded = expandedComments.has(key)
          const threadComments = comments[key]
          const commentCount = threadComments?.length ?? 0

          return (
            <li key={event.id} className="bg-white border border-[#eeeeee] rounded-xl px-3 py-2.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-[#333333]">{eventLabel(event)}</span>
                <span className="text-[11px] text-[#aaaaaa] shrink-0 mt-0.5">
                  {relativeTime(event.timestamp)}
                </span>
              </div>

              {hasSession && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {REACTION_EMOJIS.map((emoji) => {
                      const count = rMap[emoji]?.length ?? 0
                      const isActive = mine.includes(emoji)
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReact(event, emoji)}
                          className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-sm transition-colors ${
                            isActive
                              ? "bg-[#f5f0ff] text-[#333333]"
                              : "bg-[#f5f5f5] text-[#666666] hover:bg-[#eeeeee]"
                          }`}
                          aria-label={`React with ${emoji}`}
                        >
                          <span>{emoji}</span>
                          {count > 0 && (
                            <span className="text-[10px] font-medium text-[#666666]">{count}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => toggleComments(event)}
                    className="text-[11px] text-[#aaaaaa] hover:text-[#555555] transition-colors shrink-0"
                  >
                    {isExpanded
                      ? "hide"
                      : commentCount > 0
                        ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}`
                        : "comment"}
                  </button>
                </div>
              )}

              {hasSession && isExpanded && (
                <div className="mt-2 border-t border-[#f0f0f0] pt-2 space-y-1.5">
                  {threadComments === undefined ? (
                    <p className="text-xs text-[#aaaaaa]">Loading…</p>
                  ) : threadComments.length === 0 ? (
                    <p className="text-xs text-[#cccccc]">No comments yet</p>
                  ) : (
                    threadComments.map((c) => (
                      <div key={`${c.email}-${c.timestamp}`} className="flex gap-2">
                        <span className="text-xs font-medium text-[#333333] shrink-0">{c.name}</span>
                        <span className="text-xs text-[#555555] flex-1">{c.text}</span>
                      </div>
                    ))
                  )}
                  <div className="flex gap-2 pt-0.5">
                    <input
                      type="text"
                      value={draftText[key] ?? ""}
                      onChange={(e) =>
                        setDraftText((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          submitComment(event)
                        }
                      }}
                      placeholder="Add a comment…"
                      maxLength={280}
                      className="flex-1 text-xs border border-[#e0e0e0] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#aaaaaa] bg-[#fafafa] placeholder:text-[#cccccc]"
                    />
                    <button
                      onClick={() => submitComment(event)}
                      disabled={submitting[key] || !draftText[key]?.trim()}
                      className="text-xs font-medium text-[#555555] hover:text-[#111111] disabled:opacity-40 transition-colors px-1"
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
