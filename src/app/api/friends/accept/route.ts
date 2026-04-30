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

  const { requesterEmail } = await req.json()
  if (!requesterEmail || typeof requesterEmail !== "string") {
    return NextResponse.json({ error: "requesterEmail required" }, { status: 400 })
  }
  const requester = requesterEmail.trim().toLowerCase()

  try {
    const requestExists = await kv.sismember(friendRequestsInKey(me), requester)
    if (!requestExists) {
      return NextResponse.json({ error: "no such request" }, { status: 404 })
    }

    await Promise.all([
      kv.sadd(friendsKey(me), requester),
      kv.sadd(friendsKey(requester), me),
      kv.srem(friendRequestsInKey(me), requester),
      kv.srem(friendRequestsOutKey(requester), me),
    ])

    const myProfile = await kv.get<UserProfile>(profileKey(me))
    const acceptorName = myProfile?.name ?? session.user.name ?? me
    import("@/lib/pushNotify").then(({ sendPushToUser }) =>
      sendPushToUser(requester, {
        title: "Friend request accepted",
        body: `${acceptorName} accepted your gymbro request`,
        tag: "friend-accepted",
        url: "/gymbros",
      })
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
