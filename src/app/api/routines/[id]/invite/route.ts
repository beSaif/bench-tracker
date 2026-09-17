import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"
import { parseRoutineCode } from "@/lib/routines"
import { loadRoutine } from "@/lib/routineStore"
import { profileKey, friendsKey } from "@/lib/userKeys"

/**
 * POST /api/routines/[id]/invite → push an invite to one of your gymbros.
 *
 * Restricted to people already on the caller's friends list. Any signed-in user can
 * reach any user's inbox through the friend-request flow, but that is a one-per-pair
 * handshake; an unrestricted invite here would be a repeatable push to strangers.
 * Sharing outside your gymbros is what the share link is for.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const id = parseRoutineCode((await ctx.params).id)
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 })

  let targetEmail: unknown
  try {
    targetEmail = (await req.json())?.targetEmail
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }
  if (!targetEmail || typeof targetEmail !== "string") {
    return NextResponse.json({ error: "targetEmail required" }, { status: 400 })
  }

  const me = email.trim().toLowerCase()
  const target = targetEmail.trim().toLowerCase()
  if (target === me) {
    return NextResponse.json({ error: "cannot invite yourself" }, { status: 400 })
  }

  try {
    const [routine, isFriend] = await Promise.all([
      loadRoutine(id),
      kv.sismember(friendsKey(me), target),
    ])
    if (!routine) return NextResponse.json({ error: "not found" }, { status: 404 })
    if (!isFriend) {
      return NextResponse.json({ error: "you can only invite your gymbros" }, { status: 403 })
    }

    const myProfile = await kv.get<UserProfile>(profileKey(me))
    const senderName = myProfile?.name ?? session.user?.name ?? me

    const { sendPushToUser } = await import("@/lib/pushNotify")
    await sendPushToUser(target, {
      title: `${senderName} shared a routine`,
      body: `${routine.name} · ${routine.summary.dayCount} day${routine.summary.dayCount !== 1 ? "s" : ""}`,
      tag: `routine-invite-${id}`,
      url: `/routines/${id}`,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
