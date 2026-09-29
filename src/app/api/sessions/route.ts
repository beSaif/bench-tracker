import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sessionsKey } from "@/lib/userKeys"
import { parseSessionsPayload } from "@/lib/validate"

export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const data = await kv.get(sessionsKey(email))
    // null means "never synced" — the client falls back to localStorage for migration
    if (!data) return NextResponse.json(null)
    if (Array.isArray(data)) return NextResponse.json({ sessions: data, blocks: [] })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const payload = parseSessionsPayload(body)
  if (!payload) return NextResponse.json({ error: "expected { sessions, blocks }" }, { status: 400 })

  try {
    await kv.set(sessionsKey(email), payload)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
