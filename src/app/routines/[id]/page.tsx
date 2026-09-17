"use client"

import { use, useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import PublishRoutineModal from "@/components/PublishRoutineModal"
import { UserProfile } from "@/lib/types"
import {
  RoutineDetail,
  RoutineMeta,
  buildRoutineBundle,
  routineFingerprint,
} from "@/lib/routines"
import {
  applyRoutineBundle,
  loadExerciseConfig,
  loadExerciseConfigLocal,
  loadTrainingDays,
  loadTrainingDaysLocal,
} from "@/lib/storage"

type Stage = "loading" | "missing" | "ready"

export default function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [stage, setStage] = useState<Stage>("loading")
  const [routine, setRoutine] = useState<RoutineDetail | null>(null)

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

  const [confirmingAdopt, setConfirmingAdopt] = useState(false)
  const [adopting, setAdopting] = useState(false)
  const [adopted, setAdopted] = useState(false)
  const [adoptError, setAdoptError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)

  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [friends, setFriends] = useState<UserProfile[]>([])
  const [invitePickerOpen, setInvitePickerOpen] = useState(false)
  const [invitedEmails, setInvitedEmails] = useState<string[]>([])
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/routines/${id}`)
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) { setStage("missing"); return }
        setRoutine(await r.json())
        setStage("ready")
      })
      .catch(() => { if (!cancelled) setStage("missing") })

    Promise.all([loadExerciseConfig(), loadTrainingDays()])
      .then(([config, days]) => {
        if (!cancelled) setLiveFingerprint(routineFingerprint(buildRoutineBundle(config, days)))
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [id])

  // Only the author can invite, and only gymbros can be invited, so the list is
  // fetched lazily rather than on every view of every routine.
  useEffect(() => {
    if (!invitePickerOpen || friends.length > 0) return
    fetch("/api/friends")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setFriends(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [invitePickerOpen, friends.length])

  const shareUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/routines/${id}`),
    [id]
  )

  const drifted =
    routine !== null && liveFingerprint !== null && liveFingerprint !== routine.fingerprint

  async function adopt() {
    if (!routine) return
    setAdopting(true)
    setAdoptError(null)
    try {
      // The server records the adoption and hands back the routine; writing it into
      // this device's config is done here, because that write also has to retire the
      // muscle groups it replaces so old sessions keep their names.
      const res = await fetch(`/api/routines/${id}/adopt`, { method: "POST" })
      if (!res.ok) throw new Error("adopt failed")
      const fresh = (await res.json()) as RoutineDetail
      applyRoutineBundle(fresh.bundle)
      setRoutine(fresh)
      setLiveFingerprint(fresh.fingerprint)
      setAdopted(true)
      setConfirmingAdopt(false)
    } catch {
      setAdoptError("Couldn't switch over. Check your connection and try again.")
    } finally {
      setAdopting(false)
    }
  }

  async function saveEdit(meta: RoutineMeta, includeBundle: boolean) {
    setSavingEdit(true)
    setEditError(null)
    try {
      const body: Record<string, unknown> = { ...meta }
      if (includeBundle) {
        body.bundle = buildRoutineBundle(await loadExerciseConfig(), await loadTrainingDays())
      }
      const res = await fetch(`/api/routines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setEditError(data?.error ?? "Couldn't save those changes.")
        return
      }
      // PATCH answers with the listing; re-read the detail so the preview below
      // reflects a snapshot that was just replaced.
      const refreshed = await fetch(`/api/routines/${id}`).then((r) => (r.ok ? r.json() : null))
      if (refreshed) setRoutine(refreshed)
      setEditing(false)
    } catch {
      setEditError("Couldn't save those changes.")
    } finally {
      setSavingEdit(false)
    }
  }

  async function unpublish() {
    if (!routine) return
    if (!window.confirm(
      `Unpublish "${routine.name}"? The link stops working and it leaves the directory. ` +
      `Anyone already training it keeps their split.`
    )) return
    const res = await fetch(`/api/routines/${id}`, { method: "DELETE" })
    if (res.ok) router.push("/routines")
  }

  async function invite(email: string) {
    setInviteError(null)
    const res = await fetch(`/api/routines/${id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetEmail: email }),
    })
    if (res.ok) {
      setInvitedEmails((current) => [...current, email])
      return
    }
    const data = await res.json().catch(() => null)
    setInviteError(data?.error ?? "Couldn't send that invite.")
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context, or a browser that wants a gesture it
      // didn't see). The code is on screen right below, so there's nothing to say.
    }
  }

  if (stage === "loading") {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
        <div className="h-4 w-16 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        <div className="h-7 w-52 bg-[#e8e8e8] rounded animate-pulse mb-3" />
        <div className="h-4 w-32 bg-[#e8e8e8] rounded animate-pulse mb-8" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-[#e8e8e8] rounded-xl animate-pulse mb-2" />
        ))}
      </main>
    )
  }

  if (stage === "missing" || !routine) {
    return (
      <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
        <Link href="/routines" className="inline-flex items-center gap-1 text-sm text-[#1e3a5f] mb-6 hover:underline">
          ← Routines
        </Link>
        <h1 className="text-xl font-semibold text-[#111111] mb-2">Routine not found</h1>
        <p className="text-sm text-[#777777]">
          The code may be wrong, or whoever published it has taken it down.
        </p>
      </main>
    )
  }

  const { bundle, summary } = routine
  const sortedDays = [...bundle.trainingDays].sort((a, b) => a.order - b.order)
  const unassigned = bundle.muscleGroups.filter(
    (g) => !bundle.trainingDays.some((d) => d.muscleGroupIds.includes(g.id))
  )

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <Link href="/routines" className="inline-flex items-center gap-1 text-sm text-[#1e3a5f] mb-6 hover:underline">
        ← Routines
      </Link>

      <h1 className="text-2xl font-semibold text-[#111111] tracking-tight mb-1">
        {routine.name}
      </h1>
      <p className="text-sm text-[#777777] mb-4">
        {routine.mine ? "Published by you" : `By ${routine.authorName}`}
        {routine.adoptionCount > 0 && (
          <>
            {" · "}
            {routine.adoptionCount} {routine.adoptionCount === 1 ? "person" : "people"} training it
          </>
        )}
      </p>

      {routine.description && (
        <p className="text-sm text-[#333333] leading-relaxed mb-4">{routine.description}</p>
      )}

      {routine.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {routine.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-semibold text-[#1e3a5f] bg-[#f0f4f8] rounded-full px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ─── Adopt ─── */}
      {adopted ? (
        <div className="bg-[#f0f4f8] border border-[#1e3a5f]/20 rounded-xl px-4 py-3.5 mb-6">
          <p className="text-sm font-semibold text-[#1e3a5f]">You&apos;re on this routine.</p>
          <p className="text-xs text-[#555555] mt-1">
            Your muscle groups and training days now match it. Nothing you logged before
            has changed.
          </p>
          <Link href="/exercises" className="inline-block text-xs font-semibold text-[#1e3a5f] mt-2 hover:underline">
            Tweak it on Exercise Selection →
          </Link>
        </div>
      ) : !routine.mine ? (
        <div className="mb-6">
          {confirmingAdopt ? (
            <div className="border border-[#e8e8e8] rounded-xl px-4 py-4 bg-white">
              <p className="text-sm font-semibold text-[#111111] mb-2">
                Use this routine?
              </p>
              <ul className="text-xs text-[#777777] space-y-1 mb-4 list-disc pl-4">
                <li>Your muscle groups and training days are replaced by the ones below.</li>
                <li>Every session you have logged stays exactly as it is.</li>
                <li>Your training focus, main lift and target are not touched.</li>
                <li>You can edit any of it afterwards — it becomes your own copy.</li>
              </ul>
              {adoptError && <p className="text-xs text-red-500 mb-3">{adoptError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={adopt}
                  disabled={adopting}
                  className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-2 hover:bg-[#16304f] transition-colors disabled:opacity-40"
                >
                  {adopting ? "Switching…" : "Use this routine"}
                </button>
                <button
                  onClick={() => setConfirmingAdopt(false)}
                  disabled={adopting}
                  className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingAdopt(true)}
              className="w-full text-sm font-semibold text-white bg-[#1e3a5f] rounded-xl py-3 hover:bg-[#16304f] transition-colors"
            >
              Use this routine
            </button>
          )}
        </div>
      ) : null}

      {/* ─── Author controls ─── */}
      {routine.mine && (
        <div className="bg-white border border-[#e8e8e8] rounded-xl px-4 py-4 mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
            Your routine
          </p>
          {drifted ? (
            <p className="text-xs text-[#b45309] mb-3">
              Your split has changed since you published this. People adopting it still
              get the older snapshot until you push an update.
            </p>
          ) : (
            <p className="text-xs text-[#999999] mb-3">
              What&apos;s published matches your current split.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-1.5 hover:bg-[#16304f] transition-colors"
            >
              {drifted ? "Update" : "Edit details"}
            </button>
            <button
              onClick={unpublish}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
            >
              Unpublish
            </button>
          </div>
        </div>
      )}

      {/* ─── Share ─── */}
      <div className="bg-white border border-[#e8e8e8] rounded-xl px-4 py-4 mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
          Share
        </p>
        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 min-w-0 text-sm font-semibold text-[#111111] tracking-[0.2em] bg-[#fafafa] border border-[#f0f0f0] rounded-lg px-3 py-2 truncate">
            {routine.id}
          </code>
          <button
            onClick={copyLink}
            className="shrink-0 text-xs font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg px-3 py-2 hover:bg-[#f0f4f8] transition-colors"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="text-xs text-[#999999]">
          Anyone signed in can open this code, whether or not it&apos;s in the directory.
        </p>

        {routine.mine && (
          <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
            {!invitePickerOpen ? (
              <button
                onClick={() => setInvitePickerOpen(true)}
                className="text-xs font-semibold text-[#1e3a5f] hover:underline"
              >
                Invite a gymbro →
              </button>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
                  Invite a gymbro
                </p>
                {friends.length === 0 ? (
                  <p className="text-xs text-[#999999]">
                    No gymbros yet.{" "}
                    <Link href="/gymbros" className="text-[#1e3a5f] font-semibold hover:underline">
                      Add one
                    </Link>{" "}
                    and you can send them this routine.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {friends.map((friend) => {
                      const sent = invitedEmails.includes(friend.email)
                      return (
                        <button
                          key={friend.email}
                          onClick={() => invite(friend.email)}
                          disabled={sent}
                          className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg border border-[#e8e8e8] hover:border-[#1e3a5f] transition-colors disabled:opacity-50 disabled:hover:border-[#e8e8e8]"
                        >
                          <span className="text-sm text-[#111111] truncate">{friend.name}</span>
                          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-[#1e3a5f]">
                            {sent ? "Sent" : "Send"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                {inviteError && <p className="text-xs text-red-500 mt-2">{inviteError}</p>}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── What you get ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
        Training Days
      </p>
      <p className="text-xs text-[#999999] mb-3">
        {summary.dayCount} day{summary.dayCount !== 1 ? "s" : ""} ·{" "}
        {summary.exerciseCount} exercise{summary.exerciseCount !== 1 ? "s" : ""} across{" "}
        {summary.groupCount} muscle group{summary.groupCount !== 1 ? "s" : ""}
      </p>

      <div className="space-y-2 mb-6">
        {sortedDays.map((day) => (
          <div key={day.id} className="bg-white border border-[#e8e8e8] rounded-xl px-4 py-3.5">
            <p className="text-sm font-semibold text-[#111111]">{day.name}</p>
            {day.muscleGroupIds.length === 0 ? (
              <p className="text-[11px] text-[#aaaaaa] mt-0.5">No muscles assigned</p>
            ) : (
              <div className="mt-2.5 space-y-2.5">
                {day.muscleGroupIds.map((groupId) => {
                  const group = bundle.muscleGroups.find((g) => g.id === groupId)
                  if (!group) return null
                  const exercises = [...group.exercises].sort((a, b) => a.order - b.order)
                  return (
                    <div key={groupId}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1e3a5f]">
                        {group.name}
                      </p>
                      {exercises.length === 0 ? (
                        <p className="text-xs text-[#aaaaaa] mt-1">No exercises</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5">
                          {exercises.map((ex) => (
                            <li key={ex.id} className="flex items-baseline justify-between gap-2">
                              <span className="text-xs text-[#333333] truncate">{ex.name}</span>
                              {ex.defaultSets !== undefined && (
                                <span className="shrink-0 text-[10px] text-[#aaaaaa]">
                                  {ex.defaultSets} × sets
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {unassigned.length > 0 && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
            Also included
          </p>
          <p className="text-xs text-[#999999] mb-3">
            Muscle groups that come with the routine but aren&apos;t on a day yet.
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((group) => (
              <span
                key={group.id}
                className="text-xs font-semibold text-[#777777] bg-white border border-[#e8e8e8] rounded-full px-3 py-1"
              >
                {group.name}
                <span className="text-[#cccccc] font-normal"> · {group.exercises.length}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {editing && (
        <PublishRoutineModal
          mode="edit"
          initial={{
            name: routine.name,
            description: routine.description,
            tags: routine.tags,
            visibility: routine.visibility,
          }}
          summary={summary}
          drifted={drifted}
          busy={savingEdit}
          error={editError}
          onCancel={() => { setEditing(false); setEditError(null) }}
          onSubmit={saveEdit}
        />
      )}
    </main>
  )
}
