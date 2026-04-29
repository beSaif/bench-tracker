"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { UserProfile, MAIN_LIFT_LABEL } from "@/lib/types"

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: UserProfile[]) => {
        const sorted = [...data].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
        setBros(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
          {bros.map((bro) => (
            <li
              key={bro.email}
              className="bg-white border border-[#eeeeee] rounded-xl px-4 py-3.5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[#111111]">{bro.name}</span>
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
          ))}
        </ul>
      )}
    </main>
  )
}
