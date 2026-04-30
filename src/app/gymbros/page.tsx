"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { UserProfile, MAIN_LIFT_LABEL, UserPresence, ActivityEvent } from "@/lib/types"
import ActivityFeed from "@/components/ActivityFeed"

function LiftBadge({ lift }: { lift: UserProfile["mainLift"] }) {
  const colours: Record<UserProfile["mainLift"], string> = {
    bench: "bg-[#fdf5f6] text-[#7a1f2e]",
    squat: "bg-[#f0f5ff] text-[#1e3a7a]",
    deadlift: "bg-[#f2fdf0] text-[#1e5c1a]",
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${colours[lift]}`}>
      {MAIN_LIFT_LABEL[lift]}
    </span>
  )
}

export default function GymBrosPage() {
  const [bros, setBros] = useState<UserProfile[]>([])
  const [presences, setPresences] = useState<UserPresence[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentEmail, setCurrentEmail] = useState<string>("")

  useEffect(() => {
    const fetchAll = () => {
      Promise.all([
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/presence").then((r) => r.json()),
        fetch("/api/activity").then((r) => r.json()),
      ])
        .then(([users, pres, acts]: [UserProfile[], UserPresence[], ActivityEvent[]]) => {
          const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name))
          setBros(sorted)
          setPresences(Array.isArray(pres) ? pres : [])
          setActivity(Array.isArray(acts) ? acts : [])
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }

    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => { if (p?.email) setCurrentEmail(p.email) })
      .catch(() => {})
  }, [])

  function getPresence(email: string): UserPresence | undefined {
    return presences.find((p) => p.email === email)
  }

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 py-6">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
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
        {!loading && (
          <p className="text-sm text-[#777777] ml-8">
            {bros.length} member{bros.length !== 1 ? "s" : ""}
          </p>
        )}
      </header>

      <ActivityFeed events={activity} currentUserEmail={currentEmail} />

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#e8e8e8] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : bros.length === 0 ? (
        <p className="text-sm text-[#aaaaaa] text-center mt-16">No gymbros yet</p>
      ) : (
        <ul className="space-y-3">
          {bros.map((bro) => {
            const presence = getPresence(bro.email)
            const isLive = presence?.inSession ?? false
            return (
              <li
                key={bro.email}
                className={`bg-white border rounded-xl px-4 py-3.5 shadow-sm transition-colors ${
                  isLive ? "border-green-300 bg-green-50/30" : "border-[#eeeeee]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#111111]">{bro.name}</span>
                    {isLive && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                        </span>
                        In session
                      </span>
                    )}
                  </div>
                  <LiftBadge lift={bro.mainLift} />
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold">Anchor</p>
                    <p className="text-sm font-medium text-[#333333]">{bro.anchor} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold">Target</p>
                    <p className="text-sm font-medium text-[#333333]">{bro.target} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#aaaaaa] font-semibold">BW</p>
                    <p className="text-sm font-medium text-[#333333]">{bro.bw} kg</p>
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
