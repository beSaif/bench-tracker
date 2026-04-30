import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"
import { profileKey, friendsKey, friendRequestsInKey, friendRequestsOutKey } from "@/lib/userKeys"
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  const { targetEmail } = await req.json()
  if (!targetEmail || typeof targetEmail !== "string") {
    return NextResponse.json({ error: "targetEmail required" }, { status: 400 })
  }
  const target = targetEmail.trim().toLowerCase()

  if (target === me) {
    return NextResponse.json({ error: "cannot add yourself" }, { status: 400 })
  }

  try {
    const [targetProfile, alreadyFriend, alreadyPending] = await Promise.all([
      kv.get<UserProfile>(profileKey(target)),
      kv.sismember(friendsKey(me), target),
      kv.sismember(friendRequestsOutKey(me), target),
    ])

    if (!targetProfile) {
      return NextResponse.json({ error: "user not found" }, { status: 404 })
    }
    if (alreadyFriend) {
      return NextResponse.json({ error: "already friends" }, { status: 409 })
    }
    if (alreadyPending) {
      return NextResponse.json({ error: "request already sent" }, { status: 409 })
    }

    await Promise.all([
      kv.sadd(friendRequestsInKey(target), me),
      kv.sadd(friendRequestsOutKey(me), target),
    ])

    const myProfile = await kv.get<UserProfile>(profileKey(me))
    const senderName = myProfile?.name ?? session.user.name ?? me
    import("@/lib/pushNotify").then(({ sendPushToUser }) =>
      sendPushToUser(target, {
        title: "New friend request",
        body: `${senderName} wants to be your gymbro`,
        tag: "friend-request",
      })
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
