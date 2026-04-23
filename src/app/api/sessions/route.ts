import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"

const KV_KEY = "bench-tracker-sessions"

export async function GET() {
  try {
    const data = await kv.get(KV_KEY)
    if (!data) return NextResponse.json({ sessions: [], blocks: [] })
    // Handle legacy format (plain array of sessions)
    if (Array.isArray(data)) return NextResponse.json({ sessions: data, blocks: [] })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Accept both legacy (array) and new ({sessions, blocks}) formats
    const payload = Array.isArray(body) ? { sessions: body, blocks: [] } : body
    await kv.set(KV_KEY, payload)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
