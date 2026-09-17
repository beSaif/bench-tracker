import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  parseRoutineCode,
  summarizeRoutine,
  routineFingerprint,
  toDetail,
  toListing,
  validateRoutineBundle,
  validateRoutineMeta,
} from "@/lib/routines"
import { loadRoutine, loadAdoptionCount } from "@/lib/routineStore"
import {
  routineKey,
  routineAdoptersKey,
  routineAdoptionsKey,
  authoredRoutinesKey,
  ROUTINES_INDEX_KEY,
} from "@/lib/userKeys"

/**
 * A single published routine.
 *
 * GET is open to any signed-in user whatever the routine's visibility — an unlisted
 * routine is exactly one that is reachable by its code but absent from the directory,
 * so gating the read would defeat the share link.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const id = parseRoutineCode((await ctx.params).id)
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 })

  try {
    const routine = await loadRoutine(id)
    if (!routine) return NextResponse.json({ error: "not found" }, { status: 404 })
    const adoptionCount = await loadAdoptionCount(id)
    return NextResponse.json(toDetail(routine, { adoptionCount, viewerEmail: email }))
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}

/**
 * PATCH /api/routines/[id] → author only.
 *
 * Metadata always updates. A `bundle` in the body replaces the published snapshot,
 * which is how "you have unpublished changes → Update" pushes the author's current
 * split. Leaving it out edits the listing without touching what adopters would get.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const id = parseRoutineCode((await ctx.params).id)
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const meta = validateRoutineMeta(body)
  if (!meta) return NextResponse.json({ error: "a name is required" }, { status: 400 })

  const rawBundle = (body as { bundle?: unknown }).bundle
  const bundle = rawBundle === undefined ? null : validateRoutineBundle(rawBundle)
  if (rawBundle !== undefined && !bundle) {
    return NextResponse.json(
      { error: "this split can't be published — it needs at least one training day with a muscle group in it" },
      { status: 400 }
    )
  }

  try {
    const routine = await loadRoutine(id)
    if (!routine) return NextResponse.json({ error: "not found" }, { status: 404 })
    if (routine.authorEmail !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: "not yours" }, { status: 403 })
    }

    const nextBundle = bundle ?? routine.bundle
    const updated = {
      ...routine,
      ...meta,
      bundle: nextBundle,
      summary: summarizeRoutine(nextBundle),
      fingerprint: routineFingerprint(nextBundle),
      updatedAt: new Date().toISOString(),
    }

    await kv.set(routineKey(id), updated)
    // Visibility is the directory index: flipping to unlisted takes it out of search
    // but leaves the routine, its code and its adopters exactly where they were.
    if (updated.visibility === "public") await kv.sadd(ROUTINES_INDEX_KEY, id)
    else await kv.srem(ROUTINES_INDEX_KEY, id)

    const adoptionCount = await loadAdoptionCount(id)
    return NextResponse.json(toListing(updated, { adoptionCount, viewerEmail: email }))
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}

/**
 * DELETE /api/routines/[id] → author only.
 *
 * Unpublishing takes the routine out of circulation; it never reaches back into
 * anyone's config. People who already adopted it keep the split they are training,
 * because adopting copied it into their own setup rather than pointing at this one.
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const id = parseRoutineCode((await ctx.params).id)
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 })

  try {
    const routine = await loadRoutine(id)
    if (!routine) return NextResponse.json({ ok: true })
    if (routine.authorEmail !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: "not yours" }, { status: 403 })
    }

    await Promise.all([
      kv.srem(ROUTINES_INDEX_KEY, id),
      kv.srem(authoredRoutinesKey(routine.authorEmail), id),
      kv.del(routineKey(id)),
      kv.del(routineAdoptersKey(id)),
      kv.del(routineAdoptionsKey(id)),
    ])

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
