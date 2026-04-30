import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { pushSubKey } from "@/lib/userKeys"

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const sub = await request.json()
    if (!sub?.endpoint) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 })
    }
    await kv.set(pushSubKey(email), sub)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
