import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile, Session, TrainingBlock } from "@/lib/types"
import { profileKey, sessionsKey, friendsKey } from "@/lib/userKeys"

interface SessionsData {
  sessions: Session[]
  blocks: TrainingBlock[]
}

export async function GET(request: Request) {
  const session = await auth()
  const myEmail = session?.user?.email
  if (!myEmail) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetEmail = searchParams.get("email")?.trim().toLowerCase()
  if (!targetEmail) return NextResponse.json({ error: "email required" }, { status: 400 })

  const isFriend = await kv.sismember(friendsKey(myEmail), targetEmail)
  if (!isFriend) return NextResponse.json({ error: "not a friend" }, { status: 403 })

  const [profile, sessionsRaw] = await Promise.all([
    kv.get<UserProfile>(profileKey(targetEmail)),
    kv.get<SessionsData | Session[]>(sessionsKey(targetEmail)),
  ])

  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 })

  let lastSession: Session | null = null
  let recentSessions: Session[] = []
  if (sessionsRaw) {
    const sessions: Session[] = Array.isArray(sessionsRaw)
      ? sessionsRaw
      : sessionsRaw.sessions ?? []
    const confirmed = sessions
      .filter((s) => s.confirmed && s.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    lastSession = confirmed[0] ?? null
    recentSessions = confirmed.slice(0, 5)
  }

  return NextResponse.json({ profile, lastSession, recentSessions })
}
