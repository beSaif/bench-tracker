import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { friendRequestsInKey, friendRequestsOutKey } from "@/lib/userKeys"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  const { requesterEmail } = await req.json()
  if (!requesterEmail || typeof requesterEmail !== "string") {
    return NextResponse.json({ error: "requesterEmail required" }, { status: 400 })
  }
  const requester = requesterEmail.trim().toLowerCase()

  try {
    await Promise.all([
      kv.srem(friendRequestsInKey(me), requester),
      kv.srem(friendRequestsOutKey(requester), me),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
