import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { athletesKey, friendsKey } from "@/lib/userKeys"
import { loadPeople } from "@/lib/coach"

/**
 * GET /api/users/people?email=&kind=gymbros|athletes → the people behind a profile's
 * counts. Private: the counts show on anyone's profile, but only the owner can see
 * who is behind them.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const myEmail = session?.user?.email
  if (!myEmail) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const params = req.nextUrl.searchParams
  const email = (params.get("email") ?? myEmail).trim().toLowerCase()
  if (email !== myEmail.trim().toLowerCase()) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  const kind = params.get("kind")
  if (kind !== "gymbros" && kind !== "athletes") {
    return NextResponse.json({ error: "kind must be gymbros or athletes" }, { status: 400 })
  }

  try {
    const emails = await kv.smembers(kind === "gymbros" ? friendsKey(email) : athletesKey(email))
    const people = await loadPeople(emails)
    people.sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(people)
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}
