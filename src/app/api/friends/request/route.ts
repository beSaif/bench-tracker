import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"
import { profileKey, friendsKey, friendRequestsInKey, friendRequestsOutKey, friendRequestTimesKey } from "@/lib/userKeys"
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  let targetEmail: unknown
  try {
    targetEmail = (await req.json())?.targetEmail
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  if (!targetEmail || typeof targetEmail !== "string") {
    return NextResponse.json({ error: "targetEmail required" }, { status: 400 })
  }
  const target = targetEmail.trim().toLowerCase()

  if (target === me) {
    return NextResponse.json({ error: "cannot add yourself" }, { status: 400 })
  }

  try {
    const [targetProfile, alreadyFriend, alreadyPending, theyAsked] = await Promise.all([
      kv.get<UserProfile>(profileKey(target)),
      kv.sismember(friendsKey(me), target),
      kv.sismember(friendRequestsOutKey(me), target),
      kv.sismember(friendRequestsInKey(me), target),
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

    const myProfile = await kv.get<UserProfile>(profileKey(me))
    const senderName = myProfile?.name ?? session.user.name ?? me

    // They already asked me: asking back is a yes, so accept rather than leave two
    // requests crossing in the post.
    if (theyAsked) {
      await Promise.all([
        kv.sadd(friendsKey(me), target),
        kv.sadd(friendsKey(target), me),
        kv.srem(friendRequestsInKey(me), target),
        kv.srem(friendRequestsOutKey(target), me),
        kv.hdel(friendRequestTimesKey(me), target),
      ])
      import("@/lib/pushNotify").then(({ sendPushToUser }) =>
        sendPushToUser(target, {
          title: "Friend request accepted",
          body: `${senderName} accepted your gymbro request`,
          tag: "friend-accepted",
          url: "/gymbros",
        })
      ).catch(() => {})
      return NextResponse.json({ ok: true, accepted: true })
    }

    await Promise.all([
      kv.sadd(friendRequestsInKey(target), me),
      kv.sadd(friendRequestsOutKey(me), target),
      kv.hset(friendRequestTimesKey(target), { [me]: new Date().toISOString() }),
    ])
    import("@/lib/pushNotify").then(({ sendPushToUser }) =>
      sendPushToUser(target, {
        title: "New friend request",
        body: `${senderName} wants to be your gymbro`,
        tag: "friend-request",
        url: "/gymbros",
      })
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
