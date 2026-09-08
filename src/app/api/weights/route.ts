import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile, WeightEntry } from "@/lib/types"
import { profileKey, weightsKey } from "@/lib/userKeys"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** Twenty years of daily weigh-ins. A payload larger than this is a bug, not a user. */
const MAX_ENTRIES = 7500

/**
 * Trust nothing from the client: a bad `date` would poison every streak and delta
 * computation from here on, and the log is append-forever data.
 */
function sanitize(input: unknown): WeightEntry[] | null {
  if (!Array.isArray(input)) return null

  const byDate = new Map<string, WeightEntry>()
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const { date, kg, loggedAt } = raw as Partial<WeightEntry>
    if (typeof date !== "string" || !DATE_RE.test(date)) continue
    const n = Number(kg)
    if (!Number.isFinite(n) || n <= 0) continue
    // Last one wins, so a client that somehow sent a date twice still converges.
    byDate.set(date, {
      date,
      kg: Math.round(n * 10) / 10,
      loggedAt: typeof loggedAt === "string" ? loggedAt : new Date().toISOString(),
    })
  }

  const entries = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  return entries.slice(-MAX_ENTRIES)
}

export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const data = await kv.get<WeightEntry[]>(weightsKey(email))
    // null means "never synced" and tells the client to keep whatever it has locally.
    // An empty array is a real state — someone deleted their last entry on another
    // device — and must be sent as such so that deletion propagates.
    return NextResponse.json(Array.isArray(data) ? data : null)
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const entries = sanitize(body)
  if (!entries) return NextResponse.json({ error: "expected an array of entries" }, { status: 400 })

  try {
    await kv.set(weightsKey(email), entries)

    // `profile.bw` is the number the profile page, ShareCard and getLatestBW read, and
    // before this feature it was whatever was typed at onboarding. Keep it pinned to the
    // newest reading here rather than round-tripping through /api/profile, so a check-in
    // stays a single best-effort request. Newest by date, so backfilling an old day
    // never rewrites the current bodyweight.
    const newest = entries[entries.length - 1]
    if (newest) {
      const profile = await kv.get<UserProfile>(profileKey(email))
      if (profile && profile.bw !== newest.kg) {
        await kv.set(profileKey(email), { ...profile, bw: newest.kg })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
