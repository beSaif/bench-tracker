"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { UserProfile, UserPresence, Session, MAIN_LIFT_LABEL } from "@/lib/types"
import MessageComposer from "@/components/MessageComposer"

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function topSet(sets: Session["sets"]): Session["sets"][0] | null {
  const work = sets.filter((s) => !s.isWarmup && s.kg > 0)
  if (!work.length) return null
  return work.reduce((best, s) => (s.kg > best.kg ? s : best), work[0])
}

interface ProfileData {
  profile: UserProfile
  lastSession: Session | null
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

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
        <button onClick={() => router.back()} className="mb-10 p-1 -ml-1 text-[#aaaaaa]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11,4 6,9 11,14" />
          </svg>
        </button>
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-[#eeeeee] animate-pulse" />
          <div className="w-32 h-5 bg-[#eeeeee] rounded animate-pulse" />
          <div className="w-20 h-4 bg-[#eeeeee] rounded animate-pulse" />
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
        <button onClick={() => router.back()} className="mb-10 p-1 -ml-1 text-[#aaaaaa]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="11,4 6,9 11,14" />
          </svg>
        </button>
        <p className="text-sm text-[#aaaaaa] text-center mt-20">
          {error === "forbidden" ? "You're not friends with this person." : "Profile not found."}
        </p>
      </main>
    )
  }

  const { profile, lastSession } = data
  const isLive = presence?.inSession ?? false

  const liftColours: Record<UserProfile["mainLift"], string> = {
    bench: "bg-[#eff6ff] text-[#1e3a5f]",
    squat: "bg-[#f0f5ff] text-[#1e3a7a]",
    deadlift: "bg-[#f2fdf0] text-[#1e5c1a]",
  }

  const best = lastSession ? topSet(lastSession.sets) : null

  return (
    <main className="mx-auto w-full max-w-[393px] px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="mb-10 p-1 -ml-1 text-[#555555] hover:text-[#111111] transition-colors"
        aria-label="Go back"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="11,4 6,9 11,14" />
        </svg>
      </button>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xl font-bold text-[#555555] select-none">
            {initials(profile.name)}
          </div>
          {isLive && (
            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
            </span>
          )}
        </div>

        {isLive && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-green-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            In session
          </span>
        )}

        <div className="text-center">
          <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">{profile.name}</h1>
          <p className="text-[12px] text-[#aaaaaa] mt-0.5">{profile.email}</p>
        </div>

        <span className={`text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full ${liftColours[profile.mainLift]}`}>
          {MAIN_LIFT_LABEL[profile.mainLift]}
        </span>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <div className="flex gap-6 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold mb-1">BW</p>
            <p className="text-lg font-semibold text-[#111111]">{profile.bw}<span className="text-sm font-normal text-[#aaaaaa] ml-0.5">kg</span></p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold mb-1">Current</p>
            <p className="text-lg font-semibold text-[#111111]">{profile.anchor}<span className="text-sm font-normal text-[#aaaaaa] ml-0.5">kg</span></p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold mb-1">Target</p>
            <p className="text-lg font-semibold text-[#111111]">{profile.target}<span className="text-sm font-normal text-[#aaaaaa] ml-0.5">kg</span></p>
          </div>
        </div>

        {/* Progress bar */}
        {profile.target > 0 && profile.anchor > 0 && (
          <div>
            <div className="h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#111111] rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((profile.anchor / profile.target) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-[#aaaaaa] mt-1.5">
              {Math.min(100, Math.round((profile.anchor / profile.target) * 100))}% to goal
            </p>
          </div>
        )}
      </div>

      {/* Last session */}
      {lastSession && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold mb-3">Last session</p>
          <div className="bg-white border border-[#eeeeee] rounded-xl px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#111111]">{lastSession.type}</span>
              {lastSession.date && (
                <span className="text-[11px] text-[#aaaaaa]">{formatDate(lastSession.date)}</span>
              )}
            </div>
            {best ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-[#111111]">{best.kg} kg</span>
                <span className="text-sm text-[#aaaaaa]">× {best.reps}</span>
                {best.e1rm && (
                  <>
                    <span className="text-[#dddddd] mx-0.5">·</span>
                    <span className="text-[11px] text-[#aaaaaa]">e1RM {best.e1rm} kg</span>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#aaaaaa]">No sets logged</p>
            )}
          </div>
        </div>
      )}

      {/* Send message */}
      <button
        onClick={() => setShowComposer(true)}
        className="mt-8 w-full py-3 rounded-xl border border-[#e8e8e8] text-sm font-medium text-[#555555] hover:bg-[#f8f8f8] active:bg-[#f0f0f0] transition-colors"
      >
        💬 send a message
      </button>

      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowComposer(false)}>
          <div
            className="w-full max-w-md rounded-t-2xl bg-zinc-900 px-5 pt-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageComposer
              recipientLabel={profile.name.split(" ")[0]}
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
