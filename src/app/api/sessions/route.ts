import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { sessionsKey } from "@/lib/userKeys"

export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const data = await kv.get(sessionsKey(email))
    // 404 means "never synced" — client should fall back to localStorage for migration
    if (!data) return NextResponse.json(null, { status: 404 })
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

  try {
    const body = await request.json()
    const payload = Array.isArray(body) ? { sessions: body, blocks: [] } : body
    await kv.set(sessionsKey(email), payload)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
