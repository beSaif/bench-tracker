import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"
import { toPersonSummary } from "@/lib/coach"
import { PersonSummary } from "@/lib/routines"

const MAX_RESULTS = 20

/**
 * GET /api/users/search?q= → people whose name matches every word of the query, or
 * whose email is exactly the query. Answers with summaries, never full profiles.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const myEmail = session?.user?.email
  if (!myEmail) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase()
  if (q.length < 2) return NextResponse.json([])
  const terms = q.split(/\s+/)
  const me = myEmail.trim().toLowerCase()

  try {
    const keys = await kv.keys("user:*:profile")
    if (keys.length === 0) return NextResponse.json([])
    const profiles = await kv.mget<(UserProfile | null)[]>(...keys)

    const results: PersonSummary[] = []
    for (const p of profiles) {
      if (!p || typeof p !== "object" || !p.email || !p.name) continue
      const email = p.email.trim().toLowerCase()
      if (email === me) continue
      const name = p.name.toLowerCase()
      if (email === q || terms.every((t) => name.includes(t))) results.push(toPersonSummary(p))
    }
    results.sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json(results.slice(0, MAX_RESULTS))
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}
