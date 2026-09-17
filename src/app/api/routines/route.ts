import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"
import {
  PublishedRoutine,
  newRoutineId,
  summarizeRoutine,
  routineFingerprint,
  toListing,
  validateRoutineBundle,
  validateRoutineMeta,
} from "@/lib/routines"
import { loadListings } from "@/lib/routineStore"
import {
  profileKey,
  routineKey,
  authoredRoutinesKey,
  ROUTINES_INDEX_KEY,
} from "@/lib/userKeys"

/** A user cannot publish more than this, so one account cannot flood the directory. */
const MAX_PER_AUTHOR = 20

/**
 * GET /api/routines           → the public directory
 * GET /api/routines?mine=1    → everything the caller has published, listed or not
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const mine = req.nextUrl.searchParams.get("mine") === "1"

  try {
    const ids = await kv.smembers<string[]>(
      mine ? authoredRoutinesKey(email) : ROUTINES_INDEX_KEY
    )
    return NextResponse.json(await loadListings(ids ?? [], email))
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}

/** POST /api/routines → publish the submitted bundle as a new routine. */
export async function POST(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const meta = validateRoutineMeta(body)
  if (!meta) return NextResponse.json({ error: "a name is required" }, { status: 400 })

  const bundle = validateRoutineBundle((body as { bundle?: unknown }).bundle)
  if (!bundle) {
    return NextResponse.json(
      { error: "this split can't be published — it needs at least one training day with a muscle group in it" },
      { status: 400 }
    )
  }

  try {
    const owned = await kv.scard(authoredRoutinesKey(email))
    if (owned >= MAX_PER_AUTHOR) {
      return NextResponse.json(
        { error: `You've published ${MAX_PER_AUTHOR} routines. Unpublish one to make room.` },
        { status: 409 }
      )
    }

    const profile = await kv.get<UserProfile>(profileKey(email))
    const now = new Date().toISOString()
    const routine: PublishedRoutine = {
      id: newRoutineId(),
      ...meta,
      authorEmail: email.trim().toLowerCase(),
      authorName: profile?.name ?? session.user?.name ?? "Anonymous",
      bundle,
      summary: summarizeRoutine(bundle),
      fingerprint: routineFingerprint(bundle),
      publishedAt: now,
      updatedAt: now,
    }

    await kv.set(routineKey(routine.id), routine)
    await kv.sadd(authoredRoutinesKey(email), routine.id)
    if (routine.visibility === "public") {
      await kv.sadd(ROUTINES_INDEX_KEY, routine.id)
    }

    return NextResponse.json(toListing(routine, { adoptionCount: 0, viewerEmail: email }))
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
