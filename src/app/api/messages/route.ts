import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { GymbroMessage } from "@/lib/types"
import { messageInboxKey } from "@/lib/userKeys"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  const raw = await kv.lrange(messageInboxKey(me), 0, -1)
  const messages: GymbroMessage[] = raw
    .map((item) => {
      try {
        return typeof item === "string" ? JSON.parse(item) : item
      } catch {
        return null
      }
    })
    .filter((m): m is GymbroMessage => m !== null)
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())

  return NextResponse.json(messages)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()
  const key = messageInboxKey(me)

  let fromEmail: string | null = null
  try {
    const body = await req.json()
    if (body?.fromEmail && typeof body.fromEmail === "string") {
      fromEmail = body.fromEmail.trim().toLowerCase()
    }
  } catch {
    // no body — delete all
  }

  if (!fromEmail) {
    await kv.del(key)
    return NextResponse.json({ ok: true })
  }

  // Selective delete: keep messages not from this sender
  const raw = await kv.lrange(key, 0, -1)
  const remaining = raw
    .map((item) => {
      try { return typeof item === "string" ? JSON.parse(item) : item } catch { return null }
    })
    .filter((m): m is GymbroMessage => m !== null && m.fromEmail !== fromEmail)

  await kv.del(key)
  if (remaining.length > 0) {
    await kv.rpush(key, ...remaining.map((m) => JSON.stringify(m)))
    await kv.expire(key, 60 * 60 * 24 * 7)
  }

  return NextResponse.json({ ok: true })
}
