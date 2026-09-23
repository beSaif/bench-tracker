"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserProfile, UserPresence, FriendSessionSummary } from "@/lib/types"
import { FriendCardStats } from "@/lib/friendCard"
import { ProfileSocial, RoutineBundle } from "@/lib/routines"
import GymbroCard from "@/components/GymbroCard"
import ShareImageSheet from "@/components/ShareImageSheet"
import ProfileTabs, { ProfileTab } from "@/components/ProfileTabs"
import ProfileSocialBar from "@/components/ProfileSocial"
import RoutinePreview from "@/components/RoutinePreview"

interface CardData {
  profile: UserProfile
  lastSessionSummary: FriendSessionSummary | null
  card: FriendCardStats
  social: ProfileSocial
  routine: RoutineBundle
}

/**
 * Your own card, exactly as your gymbros see it. Same component and same endpoint
 * as /friends/[email] — the API answers for the viewer when no email is given —
 * minus the reactions and jabs, which only make sense pointed at someone else.
 */
export default function MyCardPage() {
  const router = useRouter()

  const [data, setData] = useState<CardData | null>(null)
  const [presence, setPresence] = useState<UserPresence | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [tab, setTab] = useState<ProfileTab>("card")
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/friends/profile").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/presence")
        .then((r) => r.json())
        .then((arr: UserPresence[]) => arr)
        .catch(() => [] as UserPresence[]),
    ])
      .then(([cardData, presences]: [CardData, UserPresence[]]) => {
        setData(cardData)
        const mine = cardData.profile.email.trim().toLowerCase()
        setPresence(presences.find((p) => p.email.trim().toLowerCase() === mine) ?? null)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // Snapshotted where it sits, at 3× so the shared PNG isn't a phone-width thumbnail.
  const capture = useCallback(async () => {
    const node = cardRef.current
    if (!node) throw new Error("no node")
    const { toBlob } = await import("html-to-image")
    return toBlob(node, {
      pixelRatio: 3,
      backgroundColor: "#ffffff",
      cacheBust: true,
    })
  }, [])

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
        <div className="rounded-2xl bg-[#f5f5f5] animate-pulse h-[520px]" />
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
        {backButton}
        <p className="text-sm text-[#aaaaaa] text-center mt-20">No card found</p>
      </main>
    )
  }

  const { profile, lastSessionSummary, card, social, routine } = data
  const fileName = `gymbro-card-${profile.email.split("@")[0]}.png`

  return (
    <main className="mx-auto w-full max-w-[393px] px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      {backButton}

      <ProfileSocialBar email={profile.email} social={social} />
      <ProfileTabs tab={tab} onChange={setTab} />

      {tab === "card" ? (
        <>
          <div ref={cardRef}>
            <GymbroCard
              profile={profile}
              card={card}
              lastSessionSummary={lastSessionSummary}
              isLive={presence?.inSession ?? false}
            />
          </div>

          <p className="text-center text-[10px] text-[#bbbbbb] mt-3">
            this is what your gymbros see · {profile.email}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-[#999999] mb-4">
            {social.coach
              ? `You train under ${social.coach.name}, so this is their routine. `
              : "Everyone can see your routine and train under you. "}
            <Link href="/exercises" className="font-semibold text-[#1e3a5f] hover:underline">
              {social.coach ? "Manage" : "Edit it"} →
            </Link>
          </p>
          <RoutinePreview routine={routine} />
        </>
      )}

      {/* Sticky share bar — the jab bar has no meaning on your own card. */}
      {tab === "card" && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={() => setSharing(true)}
            className="w-full h-11 rounded-xl bg-[#111111] text-white text-[11px] font-medium active:scale-[0.98] transition-transform"
          >
            share my card 🔱
          </button>
        </div>
      )}

      {sharing && (
        <ShareImageSheet
          title="share your card"
          fileName={fileName}
          alt="Your gymbro card"
          capture={capture}
          onClose={() => setSharing(false)}
        />
      )}
    </main>
  )
}
