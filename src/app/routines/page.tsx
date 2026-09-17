"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import RoutineCard from "@/components/RoutineCard"
import {
  RoutineListing,
  buildRoutineBundle,
  matchesRoutineQuery,
  parseRoutineCode,
  routineFingerprint,
} from "@/lib/routines"
import {
  loadExerciseConfigLocal,
  loadExerciseConfig,
  loadTrainingDaysLocal,
  loadTrainingDays,
} from "@/lib/storage"

/**
 * The routine directory.
 *
 * Two lists: what you have published (with a nudge when your live split has moved
 * past the snapshot) and everything else that opted into being findable. An unlisted
 * routine never shows up in the browse list — the code box is how you reach one.
 */
export default function RoutinesPage() {
  const router = useRouter()

  const [mine, setMine] = useState<RoutineListing[]>([])
  const [directory, setDirectory] = useState<RoutineListing[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)

  /**
   * The fingerprint of the split currently on this device, for the drift badge.
   * Seeded from localStorage so the badge is right on the first paint; the KV read
   * below replaces it. Nothing renders it directly, so there is no hydration risk.
   */
  const [liveFingerprint, setLiveFingerprint] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : routineFingerprint(buildRoutineBundle(loadExerciseConfigLocal(), loadTrainingDaysLocal()))
  )

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch("/api/routines?mine=1").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/routines").then((r) => (r.ok ? r.json() : [])),
      loadExerciseConfig(),
      loadTrainingDays(),
    ])
      .then(([mineData, dirData, config, days]) => {
        if (cancelled) return
        setMine(Array.isArray(mineData) ? mineData : [])
        setDirectory(Array.isArray(dirData) ? dirData : [])
        setLiveFingerprint(routineFingerprint(buildRoutineBundle(config, days)))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  /** Every tag in the directory, most used first, so the chips stay useful as it grows. */
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const routine of directory) {
      for (const tag of routine.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tag]) => tag)
  }, [directory])

  const results = useMemo(() => {
    return directory
      .filter((r) => matchesRoutineQuery(r, query))
      .filter((r) => (activeTag ? r.tags.includes(activeTag) : true))
      .sort((a, b) => b.adoptionCount - a.adoptionCount)
  }, [directory, query, activeTag])

  function openCode() {
    const parsed = parseRoutineCode(code)
    if (!parsed) {
      setCodeError("That doesn't look like a routine code.")
      return
    }
    setCodeError(null)
    router.push(`/routines/${parsed}`)
  }

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Link
        href="/exercises"
        className="inline-flex items-center gap-1 text-sm text-[#1e3a5f] mb-6 hover:underline"
      >
        ← Exercise Selection
      </Link>

      <h1 className="text-2xl font-semibold text-[#111111] tracking-tight mb-1">Routines</h1>
      <p className="text-sm text-[#777777] mb-6">
        Training splits people have published. Adopting one replaces your muscle groups
        and training days — your logged sessions stay exactly as they are.
      </p>

      {/* ─── Open by code ─── */}
      <div className="bg-white border border-[#e8e8e8] rounded-xl px-4 py-4 mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
          Have a code?
        </p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setCodeError(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") openCode() }}
            placeholder="paste a code or link"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 min-w-0 text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-1"
          />
          <button
            onClick={openCode}
            disabled={!code.trim()}
            className="shrink-0 text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors disabled:opacity-40"
          >
            Open
          </button>
        </div>
        {codeError && <p className="text-xs text-red-500 mt-2">{codeError}</p>}
      </div>

      {/* ─── Your routines ─── */}
      {mine.length > 0 && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
            Published by you
          </p>
          <div className="space-y-2 mb-8">
            {mine.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                drifted={liveFingerprint !== null && liveFingerprint !== routine.fingerprint}
              />
            ))}
          </div>
        </>
      )}

      {/* ─── Browse ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
        Browse
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, author, gym or muscle"
        className="w-full text-sm text-[#111111] border border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-white rounded-xl px-3.5 py-2.5 mb-3"
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                activeTag === tag
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                  : "bg-white text-[#777777] border-[#e8e8e8] hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#e8e8e8] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="border border-dashed border-[#e8e8e8] rounded-xl px-4 py-8 text-center">
          <p className="text-sm text-[#777777]">
            {directory.length === 0
              ? "Nobody has published a routine yet."
              : "Nothing matches that."}
          </p>
          <p className="text-xs text-[#aaaaaa] mt-1">
            {directory.length === 0
              ? "Set up your split on Exercise Selection, then publish it."
              : "Try a different word, or clear the tag filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}
    </main>
  )
}
