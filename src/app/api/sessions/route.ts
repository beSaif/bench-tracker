import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"

const KV_KEY = "bench-tracker-sessions"

export async function GET() {
  try {
    const sessions = await kv.get(KV_KEY)
    return NextResponse.json(sessions ?? [])
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const sessions = await request.json()
    await kv.set(KV_KEY, sessions)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
