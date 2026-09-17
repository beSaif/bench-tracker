import "server-only"
import { kv } from "@vercel/kv"
import {
  PublishedRoutine,
  RoutineListing,
  summarizeRoutine,
  routineFingerprint,
  toListing,
} from "./routines"
import { routineKey, routineAdoptionsKey } from "./userKeys"

/**
 * Server-side reads for published routines.
 *
 * Adoption counts live in their own integer keys so a directory page costs two
 * round trips (one `mget` for the routines, one for the counts) rather than one
 * `scard` per routine.
 */

function countOf(value: unknown): number {
  const n = typeof value === "string" ? parseInt(value, 10) : value
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * Fill in fields a routine saved by an older build might not carry, so one stale
 * record cannot break a listing for everyone.
 */
function hydrate(routine: PublishedRoutine): PublishedRoutine {
  return {
    ...routine,
    description: routine.description ?? "",
    tags: Array.isArray(routine.tags) ? routine.tags : [],
    visibility: routine.visibility === "unlisted" ? "unlisted" : "public",
    summary: routine.summary ?? summarizeRoutine(routine.bundle),
    fingerprint: routine.fingerprint ?? routineFingerprint(routine.bundle),
  }
}

export async function loadRoutine(id: string): Promise<PublishedRoutine | null> {
  const stored = await kv.get<PublishedRoutine>(routineKey(id))
  if (!stored || typeof stored !== "object" || !stored.bundle) return null
  return hydrate(stored)
}

export async function loadAdoptionCount(id: string): Promise<number> {
  return countOf(await kv.get(routineAdoptionsKey(id)))
}

/**
 * Listings for a set of ids, newest first, skipping ids whose routine has since
 * been deleted — an index entry can outlive its record if a delete half-failed,
 * and a stale id should not put a hole in the directory.
 */
export async function loadListings(
  ids: string[],
  viewerEmail: string
): Promise<RoutineListing[]> {
  if (ids.length === 0) return []

  const [stored, counts] = await Promise.all([
    kv.mget<(PublishedRoutine | null)[]>(...ids.map(routineKey)),
    kv.mget<unknown[]>(...ids.map(routineAdoptionsKey)),
  ])

  const listings: RoutineListing[] = []
  stored.forEach((routine, i) => {
    if (!routine || typeof routine !== "object" || !routine.bundle) return
    listings.push(
      toListing(hydrate(routine), {
        adoptionCount: countOf(counts[i]),
        viewerEmail,
      })
    )
  })

  return listings.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}
