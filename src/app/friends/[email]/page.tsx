"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { UserProfile, UserPresence, Session, FriendSessionSummary } from "@/lib/types"
import { FriendCardStats, FriendPR } from "@/lib/friendCard"
import GymbroCard, { prKey } from "@/components/GymbroCard"
import MessageComposer from "@/components/MessageComposer"

/** Jabs offered on the sticky bar; which one shows depends on what they're doing. */
const JABS = {
  live: "seen your last set lol 😂",
  slacking: "still waiting on that next session 😴",
  pr: "ok that PR was actually nasty 🔥",
  hype: "GET IN THE GYM 🔱",
}

/** A gymbro counts as slacking once they've been off this many days. */
const SLACKING_AFTER_DAYS = 5

interface ProfileData {
  profile: UserProfile
  lastSession: Session | null
  /** Resolved server-side: the viewer cannot read the friend's days or muscle names. */
  lastSessionSummary: FriendSessionSummary | null
  card: FriendCardStats
}

export default function FriendProfilePage() {
  const params = useParams()
  const router = useRouter()
  const email = decodeURIComponent(params.email as string)

  const [data, setData] = useState<ProfileData | null>(null)
  const [presence, setPresence] = useState<UserPresence | null>(null)
  const [error, setError] = useState<"forbidden" | "notfound" | null>(null)
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [reactedPRs, setReactedPRs] = useState<string[]>([])
  const [jabSent, setJabSent] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/friends/profile?email=${encodeURIComponent(email)}`).then((r) =>
        r.ok ? r.json() : r.status === 403 ? Promise.reject("forbidden") : Promise.reject("notfound")
      ),
      fetch("/api/presence")
        .then((r) => r.json())
        .then((arr: UserPresence[]) => arr.find((p) => p.email === email) ?? null)
        .catch(() => null),
    ])
      .then(([profileData, pres]) => {
        setData(profileData)
        setPresence(pres)
      })
      .catch((err) => setError(err === "forbidden" ? "forbidden" : "notfound"))
      .finally(() => setLoading(false))
  }, [email])

  /** Reactions and jabs are ordinary gymbro messages; there is no separate channel. */
  function sendMessage(text: string) {
    return fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toEmail: email, text }),
    }).catch(() => {})
  }

  function reactToPR(pr: FriendPR) {
    if (reactedPRs.includes(prKey(pr))) return
    setReactedPRs((prev) => [...prev, prKey(pr)])
    sendMessage(`🔥 ${pr.exercise} ${pr.kg}kg × ${pr.reps} — nasty`)
  }

  function sendJab(text: string) {
    setJabSent(true)
    sendMessage(text)
    setTimeout(() => setJabSent(false), 1800)
  }

  const backButton = (
    <button
      onClick={() => router.back()}
      className="mb-6 p-1 -ml-1 text-[#555555] hover:text-[#111111] transition-colors"
      aria-label="Go back"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="11,4 6,9 11,14" />
      </svg>
    </button>
  )

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
        {backButton}
        <div className="rounded-[18px] bg-[#eeeeee] animate-pulse" style={{ aspectRatio: "63/88" }} />
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
        {backButton}
        <p className="font-pixel text-[10px] leading-[1.8] text-[#aaaaaa] text-center mt-20">
          {error === "forbidden" ? "NOT YOUR GYMBRO" : "NO CARD FOUND"}
        </p>
      </main>
    )
  }

  const { profile, lastSessionSummary, card } = data
  const isLive = presence?.inSession ?? false
  const firstName = profile.name.split(" ")[0]

  // The bar offers the jab that fits what they're doing right now.
  const contextJab = isLive
    ? JABS.live
    : card.daysSinceLast != null && card.daysSinceLast >= SLACKING_AFTER_DAYS
      ? JABS.slacking
      : card.records.some((r) => r.isFresh)
        ? JABS.pr
        : JABS.hype

  return (
    <main className="mx-auto w-full max-w-[393px] px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      {backButton}

      <GymbroCard
        profile={profile}
        card={card}
        lastSessionSummary={lastSessionSummary}
        isLive={isLive}
        reactedPRs={reactedPRs}
        onReactPR={reactToPR}
      />

      <p className="text-center text-[10px] text-[#bbbbbb] mt-3">
        tap a move to hype it · {profile.email}
      </p>

      {/* Sticky jab bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-white via-white to-transparent">
        {jabSent ? (
          <div className="h-11 flex items-center justify-center rounded-xl bg-[#111111] animate-fade-in">
            <span className="font-pixel text-[8px] leading-none text-white">SENT ✓</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => sendJab(contextJab)}
              className="flex-1 h-11 px-3 rounded-xl bg-[#111111] text-white text-[11px] font-medium truncate active:scale-[0.98] transition-transform"
            >
              {contextJab}
            </button>
            <button
              onClick={() => setShowComposer(true)}
              aria-label={`Write a message to ${firstName}`}
              className="w-11 h-11 shrink-0 rounded-xl border border-[#e0e0e0] bg-white text-base active:scale-[0.98] transition-transform"
            >
              💬
            </button>
          </div>
        )}
      </div>

      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowComposer(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-zinc-900 px-5 pt-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageComposer
              recipientLabel={firstName}
              toEmail={profile.email}
              onSent={() => setShowComposer(false)}
              onClose={() => setShowComposer(false)}
            />
          </div>
        </div>
      )}
    </main>
  )
}
