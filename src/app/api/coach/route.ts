import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"
import { athletesKey, coachKey, profileKey } from "@/lib/userKeys"
import {
  getCoach,
  stopTrainingUnder,
  syncAthleteSplit,
  toPersonSummary,
  wouldCycle,
} from "@/lib/coach"

/** GET /api/coach → who I train under, or null. */
export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const coach = await getCoach(email)
    if (!coach) return NextResponse.json(null)
    const profile = await kv.get<UserProfile>(profileKey(coach))
    return NextResponse.json(profile ? toPersonSummary(profile) : { email: coach, name: coach })
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

/**
 * PUT /api/coach { email } → train under someone.
 *
 * Replaces any current coach. The athlete's split is synced before answering, so
 * the client's next load already reads the new routine.
 */
export async function PUT(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let raw: unknown
  try {
    raw = (await req.json())?.email
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }
  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ error: "email required" }, { status: 400 })
  }

  const me = email.trim().toLowerCase()
  const target = raw.trim().toLowerCase()
  if (target === me) return NextResponse.json({ error: "cannot train under yourself" }, { status: 400 })

  try {
    const coachProfile = await kv.get<UserProfile>(profileKey(target))
    if (!coachProfile) return NextResponse.json({ error: "user not found" }, { status: 404 })
    if (await wouldCycle(me, target)) {
      return NextResponse.json({ error: "they train under you" }, { status: 409 })
    }

    const current = await getCoach(me)
    if (current !== target) {
      if (current) await kv.srem(athletesKey(current), me)
      await Promise.all([kv.set(coachKey(me), target), kv.sadd(athletesKey(target), me)])
    }
    const { config, days } = await syncAthleteSplit(me)

    if (current !== target) {
      const myProfile = await kv.get<UserProfile>(profileKey(me))
      const athleteName = myProfile?.name ?? session.user?.name ?? me
      const { sendPushToUser } = await import("@/lib/pushNotify")
      await sendPushToUser(target, {
        title: "New athlete 🏋️",
        body: `${athleteName} started training under you`,
        tag: `new-athlete-${me}`,
        url: `/friends/${encodeURIComponent(me)}`,
      }).catch(() => {})
    }

    return NextResponse.json({ coach: toPersonSummary(coachProfile), config, trainingDays: days })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}

/** DELETE /api/coach → stop training under my coach, keeping their routine as my own. */
export async function DELETE() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    await stopTrainingUnder(email)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
