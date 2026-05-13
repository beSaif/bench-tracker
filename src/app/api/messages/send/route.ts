import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { GymbroMessage } from "@/lib/types"
import { friendsKey, messageInboxKey, profileKey } from "@/lib/userKeys"
import { sendPushToUser } from "@/lib/pushNotify"
import { UserProfile } from "@/lib/types"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const me = session.user.email.trim().toLowerCase()

  const body = await req.json()
  const { toEmail, text } = body as { toEmail: string; text: string }

  if (!toEmail || !text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "toEmail and text required" }, { status: 400 })
  }
  if (text.trim().length > 300) {
    return NextResponse.json({ error: "message too long" }, { status: 400 })
  }

  const myProfile = await kv.get<UserProfile>(profileKey(me))
  const fromName = myProfile?.name ?? session.user.name ?? "Someone"

  let recipients: string[]
  if (toEmail === "all") {
    recipients = (await kv.smembers(friendsKey(me))) as string[]
  } else {
    const friend = toEmail.trim().toLowerCase()
    const isFriend = await kv.sismember(friendsKey(me), friend)
    if (!isFriend) {
      return NextResponse.json({ error: "not a friend" }, { status: 403 })
    }
    recipients = [friend]
  }

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const message: GymbroMessage = {
    id: crypto.randomUUID(),
    fromEmail: me,
    fromName,
    text: text.trim(),
    sentAt: new Date().toISOString(),
  }
  const json = JSON.stringify(message)

  await Promise.all(
    recipients.map(async (email) => {
      const key = messageInboxKey(email)
      await kv.rpush(key, json)
      await kv.expire(key, 60 * 60 * 24 * 7)
      await sendPushToUser(email, {
        title: `🔥 ${fromName}`,
        body: text.trim(),
        tag: "gymbro-message",
        url: "/gymbros",
      })
    })
  )

  return NextResponse.json({ ok: true, sent: recipients.length })
}
