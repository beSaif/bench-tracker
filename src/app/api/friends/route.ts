import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"
import { friendsKey, profileKey } from "@/lib/userKeys"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  try {
    const friendEmails = (await kv.smembers(friendsKey(me))) as string[]
    if (friendEmails.length === 0) return NextResponse.json([])

    const profiles = await kv.mget<UserProfile[]>(...friendEmails.map(profileKey))
    const valid = profiles
      .filter((p): p is UserProfile => p !== null && typeof p === "object")
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(valid)
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  const { friendEmail } = await req.json()
  if (!friendEmail || typeof friendEmail !== "string") {
    return NextResponse.json({ error: "friendEmail required" }, { status: 400 })
  }
  const friend = friendEmail.trim().toLowerCase()

  try {
    await Promise.all([
      kv.srem(friendsKey(me), friend),
      kv.srem(friendsKey(friend), me),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
