"use client"

import Link from "next/link"
import { RoutineListing } from "@/lib/routines"

/**
 * One routine in a list. Everything shown here comes off the listing, so the
 * directory never has to load a bundle to render.
 *
 * `drifted` is only ever true on your own routines: it means your live split has
 * moved on from the snapshot people are adopting.
 */
export default function RoutineCard({
  routine,
  drifted = false,
}: {
  routine: RoutineListing
  drifted?: boolean
}) {
  const { summary } = routine
  const adopters =
    routine.adoptionCount === 0
      ? null
      : `${routine.adoptionCount} ${routine.adoptionCount === 1 ? "person" : "people"}`

  return (
    <Link
      href={`/routines/${routine.id}`}
      className="block bg-white border border-[#e8e8e8] rounded-xl px-4 py-3.5 hover:border-[#1e3a5f] transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#111111] truncate">{routine.name}</p>
          <p className="text-[11px] text-[#aaaaaa] mt-0.5 truncate">
            {routine.mine ? "You" : routine.authorName}
            {" · "}
            {summary.dayCount} day{summary.dayCount !== 1 ? "s" : ""}
            {" · "}
            {summary.exerciseCount} exercise{summary.exerciseCount !== 1 ? "s" : ""}
            {adopters ? ` · ${adopters}` : ""}
          </p>
        </div>
        {drifted && (
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-[#b45309] bg-[#fef3c7] rounded-full px-2 py-1">
            Changes
          </span>
        )}
        {routine.visibility === "unlisted" && (
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-[#777777] bg-[#f4f4f4] rounded-full px-2 py-1">
            Link only
          </span>
        )}
      </div>

      {routine.description && (
        <p className="text-xs text-[#777777] mt-2 line-clamp-2">{routine.description}</p>
      )}

      {summary.dayLabels.length > 0 && (
        <p className="text-[11px] text-[#999999] mt-2 truncate">
          {summary.dayLabels.join(" · ")}
        </p>
      )}

      {routine.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {routine.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-semibold text-[#1e3a5f] bg-[#f0f4f8] rounded-full px-2 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
