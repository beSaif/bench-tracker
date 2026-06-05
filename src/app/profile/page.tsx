"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Session, UserProfile, MAIN_LIFT_LABEL } from "@/lib/types"
import {
  loadProfile,
  loadProfileLocal,
  saveProfile,
  loadAll,
  loadSessionsLocal,
  wipeLocalUserData,
} from "@/lib/storage"
import { getBestE1RM, getBestWeight, getLatestBW } from "@/lib/stats"
import ProgressBar from "@/components/ProgressBar"

function formatJoined(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

export default function ProfilePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])

  const [name, setName] = useState("")
  const [bw, setBw] = useState("")
  const [target, setTarget] = useState("")

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function seedForm(p: UserProfile) {
    setProfile(p)
    setName(p.name)
    setBw(String(p.bw))
    setTarget(String(p.target))
  }

  useEffect(() => {
    let cancelled = false

    const cached = loadProfileLocal()
    if (cached) {
      seedForm(cached)
      setSessions(loadSessionsLocal())
      setMounted(true)
    }

    loadProfile().then((p) => {
      if (cancelled) return
      if (!p) {
        router.replace("/onboarding")
        return
      }
      seedForm(p)
      setMounted(true)
    })

    loadAll().then(({ sessions: data }) => {
      if (cancelled) return
      setSessions(data)
    })

    return () => {
      cancelled = true
    }
  }, [router])

  const bwVal = parseFloat(bw)
  const targetVal = parseFloat(target)
  const trimmedName = name.trim()
  const valid =
    trimmedName.length > 0 &&
    Number.isFinite(bwVal) &&
    bwVal > 0 &&
    Number.isFinite(targetVal) &&
    targetVal > 0
  const changed =
    profile != null &&
    (trimmedName !== profile.name || bwVal !== profile.bw || targetVal !== profile.target)

  async function handleSave() {
    if (!profile || !valid || saving) return
    setSaving(true)
    setError(null)
    const updated = await saveProfile({
      name: trimmedName,
      bw: bwVal,
      mainLift: profile.mainLift,
      anchor: profile.anchor,
      target: targetVal,
    })
    setSaving(false)
    if (!updated) {
      setError("Couldn't save. Check your connection and try again.")
      return
    }
    seedForm(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await fetch("/api/profile", { method: "DELETE" })
    } catch {
      // best-effort — still wipe local and sign out
    }
    wipeLocalUserData()
    signOut({ callbackUrl: "/welcome" })
  }

  if (!mounted || !profile) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="h-8 w-32 bg-[#e8e8e8] rounded animate-pulse mb-6" />
        <div className="h-40 w-full bg-[#f5f5f5] rounded-xl animate-pulse mb-4" />
        <div className="h-40 w-full bg-[#f5f5f5] rounded-xl animate-pulse" />
      </main>
    )
  }

  const bestE1RM = getBestE1RM(sessions)
  const bestWeight = getBestWeight(sessions)
  const latestBW = getLatestBW(sessions)

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/")}
          className="p-1 -ml-1 text-[#555555] hover:text-[#111111] transition-colors shrink-0"
          aria-label="Back to home"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="10,3 5,8 10,13" />
          </svg>
        </button>
        <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">Profile</h1>
      </header>

      {/* Personal */}
      <section className="mb-4 px-4 py-4 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-4">
          Personal
        </p>

        <label className="block text-sm text-[#777777] mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Saif"
          className="w-full text-lg font-semibold text-[#111111] border-b-2 border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-2 mb-5"
        />

        <label className="block text-sm text-[#777777] mb-1.5">Bodyweight</label>
        <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#1e3a5f] pb-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={bw}
            onChange={(e) => setBw(e.target.value)}
            placeholder="60"
            className="flex-1 text-lg font-semibold text-[#111111] outline-none bg-transparent"
          />
          <span className="text-base text-[#aaaaaa]">kg</span>
        </div>
      </section>

      {/* Goal */}
      <section className="mb-4 px-4 py-4 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-4">
          Goal
        </p>

        <label className="block text-sm text-[#777777] mb-1.5">Target</label>
        <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#1e3a5f] pb-2 mb-5">
          <input
            type="number"
            inputMode="decimal"
            step="2.5"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="140"
            className="flex-1 text-lg font-semibold text-[#111111] outline-none bg-transparent"
          />
          <span className="text-base text-[#aaaaaa]">kg</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-[#777777]">Main lift</span>
          <span className="text-sm font-semibold text-[#111111]">
            {MAIN_LIFT_LABEL[profile.mainLift]}
          </span>
        </div>
      </section>

      {/* Stats (read-only) */}
      <section className="mb-4 px-4 py-4 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-4">
          Stats
        </p>
        <ProgressBar current={bestWeight} target={targetVal > 0 ? targetVal : profile.target} />
        <div className="grid grid-cols-3 gap-2 -mt-2">
          <div>
            <p className="text-lg font-semibold text-[#111111]">{bestE1RM != null ? `${bestE1RM}` : "—"}</p>
            <p className="text-xs text-[#999999]">current e1RM</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-[#111111]">{bestWeight != null ? `${bestWeight}` : "—"}</p>
            <p className="text-xs text-[#999999]">best lift</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-[#111111]">{latestBW != null ? `${latestBW}` : profile.bw}</p>
            <p className="text-xs text-[#999999]">bodyweight</p>
          </div>
        </div>
      </section>

      {/* Save */}
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      <button
        onClick={handleSave}
        disabled={!valid || !changed || saving}
        className="w-full bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-[#16304f] active:bg-[#0f2540] transition-colors disabled:opacity-40 disabled:pointer-events-none"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>

      {/* Account */}
      <section className="mt-8 px-4 py-4 rounded-xl bg-[#f5f5f5] border border-[#e8e8e8]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-4">
          Account
        </p>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#777777]">Email</span>
          <span className="text-sm text-[#111111] truncate ml-3">{profile.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#777777]">Member since</span>
          <span className="text-sm text-[#111111]">{formatJoined(profile.createdAt)}</span>
        </div>
      </section>

      <button
        onClick={() => setShowDelete(true)}
        className="w-full mt-4 border border-red-200 rounded-xl py-3 text-sm font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
      >
        Delete account &amp; data
      </button>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => !deleting && setShowDelete(false)}>
          <div
            className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-[#111111] mb-1">Delete everything?</p>
            <p className="text-sm text-[#777777] mb-6">
              This permanently wipes your profile, sessions, and exercise setup, then signs you out.
              This can&apos;t be undone.
            </p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full bg-red-500 text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-red-600 active:bg-red-700 transition-colors disabled:opacity-50 mb-3"
            >
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>
            <button
              onClick={() => setShowDelete(false)}
              disabled={deleting}
              className="w-full border border-[#e8e8e8] rounded-xl py-3 text-sm font-semibold text-[#111111] hover:bg-[#fafafa] active:bg-[#f5f5f5] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
