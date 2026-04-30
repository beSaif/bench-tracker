import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { Comment, UserProfile } from "@/lib/types"
import { commentsKey, profileKey } from "@/lib/userKeys"

const MAX_TEXT = 280

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ownerEmail = searchParams.get("ownerEmail")
  const sessionId = Number(searchParams.get("sessionId"))

  if (!ownerEmail || !sessionId) {
    return NextResponse.json({ error: "missing params" }, { status: 400 })
  }

  try {
    const comments = await kv.get<Comment[]>(commentsKey(ownerEmail, sessionId))
    return NextResponse.json(comments ?? [])
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { ownerEmail, sessionId, text } = body as {
      ownerEmail: string
      sessionId: number
      text: string
    }

    if (!ownerEmail || !sessionId || !text?.trim()) {
      return NextResponse.json({ error: "invalid params" }, { status: 400 })
    }

    const trimmed = text.trim().slice(0, MAX_TEXT)
    const profile = await kv.get<UserProfile>(profileKey(email))
    const name = profile?.name ?? email.split("@")[0]

    const key = commentsKey(ownerEmail, sessionId)
    const existing = (await kv.get<Comment[]>(key)) ?? []

    // upsert: one comment per person per session
    const idx = existing.findIndex((c) => c.email === email)
    const comment: Comment = { email, name, text: trimmed, timestamp: new Date().toISOString() }
    const updated =
      idx >= 0
        ? existing.map((c, i) => (i === idx ? comment : c))
        : [...existing, comment]

    await kv.set(key, updated)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
