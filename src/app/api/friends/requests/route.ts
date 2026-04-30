import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile, FriendRequest } from "@/lib/types"
import { friendRequestsInKey, profileKey } from "@/lib/userKeys"

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

    const profiles = await kv.mget<UserProfile[]>(...requesterEmails.map(profileKey))
    const requests: FriendRequest[] = profiles
      .filter((p): p is UserProfile => p !== null && typeof p === "object")
      .map((p) => ({ email: p.email, name: p.name, sentAt: p.createdAt }))

    return NextResponse.json({ requests, count: requests.length })
  } catch {
    return NextResponse.json({ requests: [], count: 0 }, { status: 503 })
  }
}
