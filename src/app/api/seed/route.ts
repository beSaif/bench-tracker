import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { generateSeedData } from "@/lib/seed"

const KV_KEY = "bench-tracker-sessions"

/** POST /api/seed — write seed data to KV (only if empty) */
export async function POST() {
  try {
    const existing = await kv.get(KV_KEY)
    if (existing) {
      return NextResponse.json({ seeded: false, message: "Data already exists" })
    }
    const seed = generateSeedData()
    await kv.set(KV_KEY, seed)
    return NextResponse.json({ seeded: true, sessions: seed.length })
  } catch {
    return NextResponse.json({ error: "KV not configured" }, { status: 503 })
  }
}
