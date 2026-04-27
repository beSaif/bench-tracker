import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"

const KV_KEY = "bench-tracker-exercises"

export async function GET() {
  try {
    const data = await kv.get(KV_KEY)
    if (!data) return NextResponse.json(null)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await kv.set(KV_KEY, body)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
