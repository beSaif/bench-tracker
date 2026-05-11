import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile, Session, TrainingBlock } from "@/lib/types"
import { friendsKey, profileKey, sessionsKey } from "@/lib/userKeys"

interface SessionsData {
  sessions: Session[]
  blocks: TrainingBlock[]
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  try {
    const friendEmails = (await kv.smembers(friendsKey(me))) as string[]
    if (friendEmails.length === 0) return NextResponse.json([])

    const [profiles, sessionDatas] = await Promise.all([
      kv.mget<UserProfile[]>(...friendEmails.map(profileKey)),
      kv.mget<(SessionsData | Session[])[]>(...friendEmails.map(sessionsKey)),
    ])

    const lastActiveDates: Record<string, string> = {}
    friendEmails.forEach((email, i) => {
      const raw = sessionDatas[i]
      if (!raw) return
      const sessions: Session[] = Array.isArray(raw) ? raw : (raw as SessionsData).sessions ?? []
      const confirmed = sessions
        .filter((s) => s.confirmed && s.date)
        .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
      if (confirmed[0]) lastActiveDates[email] = confirmed[0].date!
    })

    const valid = profiles
      .filter((p): p is UserProfile => p !== null && typeof p === "object")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ ...p, lastSessionDate: lastActiveDates[p.email] ?? null }))

    return NextResponse.json(valid)
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  const { friendEmail } = await req.json()
  if (!friendEmail || typeof friendEmail !== "string") {
    return NextResponse.json({ error: "friendEmail required" }, { status: 400 })
  }
  const friend = friendEmail.trim().toLowerCase()

  try {
    await Promise.all([
      kv.srem(friendsKey(me), friend),
      kv.srem(friendsKey(friend), me),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
