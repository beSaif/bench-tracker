import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { ActivityEvent, ActivityEventType, UserProfile } from "@/lib/types"
import { profileKey } from "@/lib/userKeys"

const FEED_KEY = "activity:feed"
const MAX_EVENTS = 50

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const events = await kv.lrange<ActivityEvent>(FEED_KEY, 0, 9)
    return NextResponse.json(events ?? [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const profile = await kv.get<UserProfile>(profileKey(email))
    const name = profile?.name ?? email.split("@")[0]

    const body = await request.json()
    const event: ActivityEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      email,
      name,
      type: body.type as ActivityEventType,
      payload: body.payload ?? {},
      timestamp: new Date().toISOString(),
    }

    await kv.lpush(FEED_KEY, event)
    await kv.ltrim(FEED_KEY, 0, MAX_EVENTS - 1)

    if (event.type === "pr_hit") {
      import("@/lib/pushNotify")
        .then(({ sendPushToAll }) =>
          sendPushToAll(email, {
            title: `${name} hit a new PR!`,
            body: `~${event.payload.weight}kg e1RM — go react 🔥`,
            tag: "pr",
            url: "/gymbros",
          })
        )
        .catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
