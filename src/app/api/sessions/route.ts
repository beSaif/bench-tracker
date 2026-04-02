import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { generateSeedData } from "@/lib/seed"

const KV_KEY = "bench-tracker-sessions"

export async function GET() {
  try {
    const sessions = await kv.get(KV_KEY)
    if (!sessions) {
      const seed = generateSeedData()
      await kv.set(KV_KEY, seed)
      return NextResponse.json(seed)
    }
    return NextResponse.json(sessions)
  } catch {
    // KV not configured — return empty so client falls back to localStorage
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
