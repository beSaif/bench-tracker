import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { exercisesKey } from "@/lib/userKeys"
import { getCoach, syncAthleteSplit } from "@/lib/coach"
import { MuscleGroupConfig } from "@/lib/exerciseConfig"

/**
 * GET answers with the split this user trains. For someone training under a coach
 * that is the coach's routine, synced into their own key on the way out — which is
 * the whole live link: the client's ordinary load picks up the coach's edits.
 */
export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    if (await getCoach(email)) {
      const { config } = await syncAthleteSplit(email)
      return NextResponse.json(config)
    }
    const data = await kv.get(exercisesKey(email))
    if (!data) return NextResponse.json(null)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

/**
 * While training under a coach the split is theirs, so a save keeps only what is
 * the athlete's own — their cardio library — and the coach's groups win. The
 * exercise screens are read-only in that state; this is the backstop.
 */
export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    if (await getCoach(email)) {
      const own = Array.isArray(body) ? (body as MuscleGroupConfig[]) : undefined
      const { config } = await syncAthleteSplit(email, own)
      return NextResponse.json({ ok: true, following: true, config })
    }
    await kv.set(exercisesKey(email), body)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
