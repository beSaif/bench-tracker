"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { UserProfile, MAIN_LIFT_LABEL, UserPresence, FriendRequest, GymbroMessage } from "@/lib/types"

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function LiftBadge({ lift }: { lift: UserProfile["mainLift"] }) {
  const colours: Record<UserProfile["mainLift"], string> = {
    bench: "bg-[#eff6ff] text-[#1e3a5f]",
    squat: "bg-[#f0f5ff] text-[#1e3a7a]",
    deadlift: "bg-[#f2fdf0] text-[#1e5c1a]",
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${colours[lift]}`}>
      {MAIN_LIFT_LABEL[lift]}
    </span>
  )
}

type AddState = "idle" | "sending" | "sent" | "not_found" | "already_friends" | "already_pending" | "self" | "error"

export default function GymBrosPage() {
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [presences, setPresences] = useState<UserPresence[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [addEmail, setAddEmail] = useState("")
  const [addState, setAddState] = useState<AddState>("idle")
  const [loading, setLoading] = useState(true)
  const [currentEmail, setCurrentEmail] = useState<string>("")
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [messages, setMessages] = useState<GymbroMessage[]>([])
  const addInputRef = useRef<HTMLInputElement>(null)

  function fetchAll() {
    Promise.all([
      fetch("/api/friends").then((r) => r.json()),
      fetch("/api/friends/requests").then((r) => r.json()),
      fetch("/api/messages").then((r) => r.json()),
    ])
      .then(([f, req, msgs]: [UserProfile[], { requests: FriendRequest[]; count: number }, GymbroMessage[]]) => {
        setFriends(Array.isArray(f) ? f : [])
        setRequests(req?.requests ?? [])
        setPendingCount(req?.count ?? 0)
        setMessages(Array.isArray(msgs) ? msgs : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  async function dismissMessages() {
    setMessages([])
    await fetch("/api/messages", { method: "DELETE" }).catch(() => {})
  }

  function fetchPresence() {
    fetch("/api/presence")
      .then((r) => r.json())
      .then((data: UserPresence[]) => { if (Array.isArray(data)) setPresences(data) })
      .catch(() => {})
  }

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => { if (p?.email) setCurrentEmail(p.email) })
      .catch(() => {})

    fetchAll()
    fetchPresence()

    const presenceInterval = setInterval(fetchPresence, 15000)
    const friendsInterval = setInterval(fetchAll, 30000)
    return () => {
      clearInterval(presenceInterval)
      clearInterval(friendsInterval)
    }
  }, [])

  function getPresence(email: string): UserPresence | undefined {
    return presences.find((p) => p.email === email)
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault()
    const email = addEmail.trim().toLowerCase()
    if (!email) return
    setAddState("sending")
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: email }),
      })
      if (res.ok) {
        setAddState("sent")
        setAddEmail("")
      } else {
        const body = await res.json()
        if (body.error === "user not found") setAddState("not_found")
        else if (body.error === "already friends") setAddState("already_friends")
        else if (body.error === "request already sent") setAddState("already_pending")
        else if (body.error === "cannot add yourself") setAddState("self")
        else setAddState("error")
      }
    } catch {
      setAddState("error")
    }
    setTimeout(() => setAddState("idle"), 3000)
  }

  async function handleAccept(requesterEmail: string) {
    await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterEmail }),
    })
    fetchAll()
  }

  async function handleReject(requesterEmail: string) {
    await fetch("/api/friends/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterEmail }),
    })
    fetchAll()
  }

  async function handleRemoveFriend(friendEmail: string) {
    setRemovingEmail(friendEmail)
    await fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendEmail }),
    })
    setRemovingEmail(null)
    fetchAll()
  }

  const addFeedback: Record<AddState, string> = {
    idle: "",
    sending: "",
    sent: "Request sent",
    not_found: "No user with that email",
    already_friends: "Already friends",
    already_pending: "Request already sent",
    self: "That's you",
    error: "Something went wrong",
  }

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
      <header className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1 -ml-1 text-[#555555] hover:text-[#111111] transition-colors"
              aria-label="Back to home"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="11,4 6,9 11,14" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">Gymbros</h1>
          </div>
          <button
            onClick={() => setRequestsOpen((o) => !o)}
            className="relative p-1.5 text-[#555555] hover:text-[#111111] transition-colors"
            aria-label="Friend requests"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 2a5 5 0 0 1 5 5c0 1.5-.5 2.8-1.4 3.8L17 17H3l3.4-6.2A5 5 0 0 1 5 7a5 5 0 0 1 5-5z" />
              <line x1="10" y1="17" x2="10" y2="19" />
            </svg>
            {pendingCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 leading-none">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>
        </div>
        {!loading && (
          <p className="text-sm text-[#777777] ml-8">
            {friends.length} gymbro{friends.length !== 1 ? "s" : ""}
          </p>
        )}
      </header>

      {/* Incoming messages */}
      {messages.length > 0 && (
        <div className="mb-5 bg-zinc-900 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              🔥 {messages.length} message{messages.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={dismissMessages}
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none"
              aria-label="Dismiss messages"
            >
              ✕
            </button>
          </div>
          <ul className="divide-y divide-zinc-800">
            {messages.map((msg) => (
              <li key={msg.id} className="px-4 py-3">
                <p className="text-xs text-zinc-400 mb-0.5 font-medium">{msg.fromName}</p>
                <p className="text-sm text-white">{msg.text}</p>
              </li>
            ))}
          </ul>
          <button
            onClick={dismissMessages}
            className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            got it 👍
          </button>
        </div>
      )}

      {/* Requests panel */}
      {requestsOpen && (
        <div className="mb-5 bg-white border border-[#eeeeee] rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f5f5f5]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#aaaaaa]">Pending requests</p>
          </div>
          {requests.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#aaaaaa]">No pending requests</p>
          ) : (
            <ul className="divide-y divide-[#f5f5f5]">
              {requests.map((req) => (
                <li key={req.email} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111111] truncate">{req.name}</p>
                    <p className="text-[11px] text-[#aaaaaa] truncate">{req.email}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAccept(req.email)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#111111] text-white hover:bg-[#333333] transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(req.email)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#f5f5f5] text-[#555555] hover:bg-[#eeeeee] transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add friend */}
      <form onSubmit={handleAddFriend} className="mb-5">
        <div className="flex gap-2">
          <input
            ref={addInputRef}
            type="email"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="Add gymbro by email"
            className="flex-1 text-sm px-3 py-2.5 border border-[#dddddd] rounded-xl bg-white text-[#111111] placeholder-[#bbbbbb] focus:outline-none focus:border-[#111111] transition-colors"
          />
          <button
            type="submit"
            disabled={addState === "sending" || !addEmail.trim()}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#111111] text-white disabled:opacity-40 hover:bg-[#333333] transition-colors shrink-0"
          >
            {addState === "sending" ? "…" : "Add"}
          </button>
        </div>
        {addState !== "idle" && addState !== "sending" && (
          <p className={`mt-1.5 text-[12px] ml-1 ${addState === "sent" ? "text-green-600" : "text-red-500"}`}>
            {addFeedback[addState]}
          </p>
        )}
      </form>

      {/* Friends list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-[#e8e8e8] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : friends.length === 0 ? (
        <p className="text-sm text-[#aaaaaa] text-center mt-16">No gymbros yet — add one by email above</p>
      ) : (
        <ul className="space-y-3">
          {friends.map((bro) => {
            const presence = getPresence(bro.email)
            const isLive = presence?.inSession ?? false
            const isRemoving = removingEmail === bro.email
            return (
              <li
                key={bro.email}
                className={`bg-white border rounded-xl px-4 py-3.5 shadow-sm transition-colors ${
                  isLive ? "border-green-300 bg-green-50/30" : "border-[#eeeeee]"
                } ${isRemoving ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/friends/${encodeURIComponent(bro.email)}`}
                    className="flex items-center gap-2.5 min-w-0 active:opacity-70 transition-opacity"
                  >
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs font-bold text-[#555555] select-none">
                        {initials(bro.name)}
                      </div>
                      {isLive && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#111111] truncate">{bro.name}</span>
                    {isLive && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                        </span>
                        In session
                      </span>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <LiftBadge lift={bro.mainLift} />
                    <button
                      onClick={() => handleRemoveFriend(bro.email)}
                      disabled={isRemoving}
                      className="text-[#cccccc] hover:text-red-400 transition-colors p-0.5"
                      aria-label={`Remove ${bro.name}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                        <line x1="2" y1="2" x2="12" y2="12" />
                        <line x1="12" y1="2" x2="2" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold">BW</p>
                    <p className="text-sm font-medium text-[#333333]">{bro.bw} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold">Current</p>
                    <p className="text-sm font-medium text-[#333333]">{bro.anchor} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold">Target</p>
                    <p className="text-sm font-medium text-[#333333]">{bro.target} kg</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
