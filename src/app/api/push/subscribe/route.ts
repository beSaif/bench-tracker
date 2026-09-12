import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { ReminderState } from "@/lib/reminders"
import { pushSubKey, reminderStateKey } from "@/lib/userKeys"

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    // The app sends `{ subscription, tz }`; the service worker's `pushsubscriptionchange`
    // handler re-registers with a bare subscription, so both shapes are accepted.
    const sub = body?.subscription ?? body
    const tz = typeof body?.tz === "string" ? body.tz : null

    if (!sub?.endpoint) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 })
    }
    await kv.set(pushSubKey(email), sub)

    // The daily job runs in UTC and has to ask "did they weigh in today" in the user's
    // own calendar day. This is the one moment we know the answer: the device that can
    // receive the reminder is right here telling us where it is.
    if (tz) {
      const state = (await kv.get<ReminderState>(reminderStateKey(email))) ?? {}
      if (state.tz !== tz) {
        await kv.set(reminderStateKey(email), { ...state, tz })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
