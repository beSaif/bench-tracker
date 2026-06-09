import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { trainingDaysKey } from "@/lib/userKeys"

export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const data = await kv.get(trainingDaysKey(email))
    if (!data) return NextResponse.json(null)
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
    await kv.set(trainingDaysKey(email), body)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
