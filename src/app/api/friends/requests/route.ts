import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile, FriendRequest } from "@/lib/types"
import { friendRequestTimesKey, friendRequestsInKey, profileKey } from "@/lib/userKeys"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  try {
    const requesterEmails = (await kv.smembers(friendRequestsInKey(me))) as string[]
    if (requesterEmails.length === 0) {
      return NextResponse.json({ requests: [], count: 0 })
    }

    const [profiles, times] = await Promise.all([
      kv.mget<UserProfile[]>(...requesterEmails.map(profileKey)),
      kv.hgetall<Record<string, string>>(friendRequestTimesKey(me)),
    ])
    // Requests sent before the time was recorded fall back to the requester's signup.
    const requests: FriendRequest[] = profiles
      .filter((p): p is UserProfile => p !== null && typeof p === "object")
      .map((p) => ({
        email: p.email,
        name: p.name,
        sentAt: times?.[p.email.trim().toLowerCase()] ?? p.createdAt,
      }))

    return NextResponse.json({ requests, count: requests.length })
  } catch {
    return NextResponse.json({ requests: [], count: 0 }, { status: 503 })
  }
}
