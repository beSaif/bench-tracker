import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile, UserPresence } from "@/lib/types"

function presenceKey(email: string): string {
  return `user:${email.trim().toLowerCase()}:presence`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const profileKeys = await kv.keys("user:*:profile")
    if (profileKeys.length === 0) return NextResponse.json([])

    const profiles = await kv.mget<UserProfile[]>(...profileKeys)
    const validProfiles = profiles.filter((p): p is UserProfile => p !== null && typeof p === "object")

    const pKeys = validProfiles.map((p) => presenceKey(p.email))
    const rawPresences = pKeys.length > 0 ? await kv.mget(...pKeys) : []

    const result: UserPresence[] = validProfiles.map((profile, i) => {
      const rec = rawPresences[i] as { inSession?: boolean; startedAt?: string | null } | null
      return {
        email: profile.email,
        name: profile.name,
        inSession: rec?.inSession ?? false,
        startedAt: rec?.startedAt ?? null,
      }
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const inSession = Boolean(body.inSession)
    const record = {
      inSession,
      startedAt: inSession ? new Date().toISOString() : null,
    }
    // 3-hour TTL clears stale presence if app crashes mid-session
    await kv.set(presenceKey(email), record, { ex: 10800 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
