"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { MuscleGroupConfig } from "@/lib/exerciseConfig"
import { TrainingDay } from "@/lib/types"
import PublishRoutineModal from "@/components/PublishRoutineModal"
import {
  RoutineListing,
  RoutineMeta,
  buildRoutineBundle,
  routineFingerprint,
  summarizeRoutine,
} from "@/lib/routines"

/**
 * The publishing half of the Exercise Selection screen.
 *
 * Takes the page's live config and days rather than reloading them, so the moment
 * you add an exercise the drift notice under a published routine is correct.
 */
export default function RoutineShareSection({
  config,
  trainingDays,
}: {
  config: MuscleGroupConfig[]
  trainingDays: TrainingDay[]
}) {
  const [mine, setMine] = useState<RoutineListing[]>([])
  const [loaded, setLoaded] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/routines?mine=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setMine(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  const bundle = useMemo(() => buildRoutineBundle(config, trainingDays), [config, trainingDays])
  const summary = useMemo(() => summarizeRoutine(bundle), [bundle])
  const fingerprint = useMemo(() => routineFingerprint(bundle), [bundle])

  /**
   * A split with no day carrying a muscle group has nothing to hand anyone, and the
   * publish route would reject it — so the button says why instead of failing later.
   */
  const publishable = bundle.trainingDays.some((d) => d.muscleGroupIds.length > 0)

  async function publish(meta: RoutineMeta) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...meta, bundle }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Couldn't publish that.")
        return
      }
      const published = (await res.json()) as RoutineListing
      setMine((current) => [published, ...current])
      setPublishing(false)
    } catch {
      setError("Couldn't publish that. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-8">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
        Routines
      </p>

      <div className="bg-white border border-[#e8e8e8] rounded-xl px-4 py-4">
        <p className="text-sm font-semibold text-[#111111] mb-1">Share this split</p>
        <p className="text-xs text-[#999999] mb-3.5">
          Publish your muscle groups and training days so a gymbro can pick them up
          without setting everything up again.
        </p>

        {loaded && mine.length > 0 && (
          <div className="space-y-1.5 mb-3.5">
            {mine.map((routine) => {
              const drifted = routine.fingerprint !== fingerprint
              return (
                <Link
                  key={routine.id}
                  href={`/routines/${routine.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#e8e8e8] hover:border-[#1e3a5f] transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-[#111111] truncate">{routine.name}</span>
                    <span className="block text-[10px] text-[#aaaaaa] mt-0.5">
                      {drifted
                        ? "Unpublished changes"
                        : routine.adoptionCount > 0
                          ? `${routine.adoptionCount} ${routine.adoptionCount === 1 ? "person" : "people"} training it`
                          : "Up to date"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[9px] font-semibold uppercase tracking-widest rounded-full px-2 py-1 ${
                      drifted ? "text-[#b45309] bg-[#fef3c7]" : "text-[#1e3a5f] bg-[#f0f4f8]"
                    }`}
                  >
                    {drifted ? "Update" : "Open"}
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setPublishing(true); setError(null) }}
            disabled={!publishable}
            className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors disabled:opacity-40"
          >
            {mine.length > 0 ? "Publish another" : "Publish routine"}
          </button>
          <Link
            href="/routines"
            className="text-xs font-semibold text-[#1e3a5f] hover:underline"
          >
            Browse routines →
          </Link>
        </div>

        {!publishable && (
          <p className="text-xs text-[#aaaaaa] mt-2.5">
            Assign at least one muscle group to a training day first.
          </p>
        )}
      </div>

      {publishing && (
        <PublishRoutineModal
          mode="publish"
          summary={summary}
          busy={busy}
          error={error}
          onCancel={() => { setPublishing(false); setError(null) }}
          onSubmit={publish}
        />
      )}
    </div>
  )
}
