"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PersonSummary, ProfileSocial } from "@/lib/routines"
import { MAIN_LIFT_LABEL, TRAINING_MODE_LABEL } from "@/lib/types"

type Kind = "gymbros" | "athletes"

/**
 * "X gymbros · Y athletes", each count opening the list behind it, plus who the
 * person trains under. Sits between the back button and the profile's tabs.
 */
export default function ProfileSocialBar({
  email,
  social,
}: {
  email: string
  social: ProfileSocial
}) {
  const [open, setOpen] = useState<Kind | null>(null)

  return (
    <>
      <div className="flex items-center justify-center gap-5 mb-3">
        <CountButton count={social.gymbroCount} label="gymbro" onClick={() => setOpen("gymbros")} />
        <span className="w-px h-6 bg-[#eeeeee]" aria-hidden="true" />
        <CountButton count={social.athleteCount} label="athlete" onClick={() => setOpen("athletes")} />
      </div>

      {social.coach && (
        <p className="text-center text-[11px] text-[#999999] mb-4">
          Trains under{" "}
          <Link
            href={`/friends/${encodeURIComponent(social.coach.email)}`}
            className="font-semibold text-[#1e3a5f] hover:underline"
          >
            {social.coach.name}
          </Link>
        </p>
      )}

      {open && <PeopleSheet email={email} kind={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function CountButton({ count, label, onClick }: { count: number; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center active:opacity-70 transition-opacity">
      <span className="text-lg font-semibold text-[#111111] tabular-nums leading-tight">{count}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
        {label}
        {count !== 1 ? "s" : ""}
      </span>
    </button>
  )
}

function PeopleSheet({ email, kind, onClose }: { email: string; kind: Kind; onClose: () => void }) {
  const [people, setPeople] = useState<PersonSummary[] | null>(null)

  useEffect(() => {
    fetch(`/api/users/people?email=${encodeURIComponent(email)}&kind=${kind}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPeople(Array.isArray(data) ? data : []))
      .catch(() => setPeople([]))
  }, [email, kind])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[393px] rounded-t-2xl px-5 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3">
          {kind === "gymbros" ? "Gymbros" : "Athletes"}
        </p>
        {people === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-[#f5f5f5] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : people.length === 0 ? (
          <p className="text-sm text-[#aaaaaa] py-6 text-center">
            {kind === "gymbros" ? "No gymbros yet" : "Nobody trains under them yet"}
          </p>
        ) : (
          <ul className="divide-y divide-[#f5f5f5]">
            {people.map((p) => (
              <li key={p.email}>
                <PersonRow person={p} onClick={onClose} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** One person in a list: name and what they train, linking to their profile. */
export function PersonRow({ person, onClick }: { person: PersonSummary; onClick?: () => void }) {
  const badge =
    person.trainingMode === "balanced" || !person.mainLift
      ? TRAINING_MODE_LABEL.balanced
      : MAIN_LIFT_LABEL[person.mainLift]
  return (
    <Link
      href={`/friends/${encodeURIComponent(person.email)}`}
      onClick={onClick}
      className="flex items-center justify-between gap-3 py-3 active:opacity-70 transition-opacity"
    >
      <span className="text-sm font-semibold text-[#111111] truncate">{person.name}</span>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#f5f5f5] text-[#555555]">
        {badge}
      </span>
    </Link>
  )
}
