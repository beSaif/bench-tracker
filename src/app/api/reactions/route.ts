import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { ReactionsMap, ReactionEmoji, REACTION_EMOJIS, UserProfile } from "@/lib/types"
import { reactionsKey, profileKey } from "@/lib/userKeys"

const EMPTY_REACTIONS: ReactionsMap = { "🔥": [], "💪": [], "💀": [] }

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ownerEmail = searchParams.get("ownerEmail")
  const sessionId = Number(searchParams.get("sessionId"))

  if (!ownerEmail || !sessionId) {
    return NextResponse.json({ error: "missing params" }, { status: 400 })
  }

  try {
    const reactions = await kv.get<ReactionsMap>(reactionsKey(ownerEmail, sessionId))
    const map = reactions ?? EMPTY_REACTIONS
    const myReactions = REACTION_EMOJIS.filter((e) => map[e].includes(session.user!.email!))
    return NextResponse.json({ reactions: map, myReactions })
  } catch {
    return NextResponse.json({ reactions: EMPTY_REACTIONS, myReactions: [] })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { ownerEmail, sessionId, emoji } = body as {
      ownerEmail: string
      sessionId: number
      emoji: ReactionEmoji
    }

    if (!ownerEmail || !sessionId || !REACTION_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "invalid params" }, { status: 400 })
    }

    const key = reactionsKey(ownerEmail, sessionId)
    const current = (await kv.get<ReactionsMap>(key)) ?? { ...EMPTY_REACTIONS }

    const arr = current[emoji] ?? []
    const isAdding = !arr.includes(email)
    current[emoji] = isAdding ? [...arr, email] : arr.filter((e) => e !== email)

    await kv.set(key, current)

    const myReactions = REACTION_EMOJIS.filter((e) => current[e].includes(email))

    // Trigger push to session owner when adding a reaction (fire-and-forget)
    if (isAdding && ownerEmail !== email) {
      const [reactorProfile] = await Promise.all([kv.get<UserProfile>(profileKey(email))])
      const reactorName = reactorProfile?.name ?? email.split("@")[0]
      import("@/lib/pushNotify")
        .then(({ sendPushToUser }) =>
          sendPushToUser(ownerEmail, {
            title: `${reactorName} reacted to your session`,
            body: emoji,
            tag: `reaction-${sessionId}`,
          })
        )
        .catch(() => {})
    }

    return NextResponse.json({ reactions: current, myReactions })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
