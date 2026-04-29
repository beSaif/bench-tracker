import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { Session, TrainingBlock, UserProfile, MainLift } from "@/lib/types"
import {
  profileKey,
  sessionsKey,
  exercisesKey,
  isLegacyOwner,
  LEGACY_SESSIONS_KEY,
  LEGACY_EXERCISES_KEY,
} from "@/lib/userKeys"

const ALLOWED_LIFTS: MainLift[] = ["bench", "deadlift", "squat"]

interface LegacySessionsData {
  sessions: Session[]
  blocks: TrainingBlock[]
}

async function tryLegacyMigration(email: string): Promise<UserProfile | null> {
  if (!isLegacyOwner(email)) return null

  const [legacySessionsRaw, legacyExercises] = await Promise.all([
    kv.get(LEGACY_SESSIONS_KEY),
    kv.get(LEGACY_EXERCISES_KEY),
  ])

  if (!legacySessionsRaw && !legacyExercises) return null

  const legacy: LegacySessionsData = Array.isArray(legacySessionsRaw)
    ? { sessions: legacySessionsRaw as Session[], blocks: [] }
    : ((legacySessionsRaw as LegacySessionsData) ?? { sessions: [], blocks: [] })

  const confirmed = legacy.sessions.filter((s) => s.confirmed && s.date)
  const latestBW = [...confirmed]
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .find((s) => s.bw != null)?.bw ?? 60

  const activeBlock = legacy.blocks.find((b) => b.status === "active")
  const anchor = activeBlock?.anchorWeight
    ?? legacy.blocks[legacy.blocks.length - 1]?.anchorWeight
    ?? 60

  const profile: UserProfile = {
    email,
    name: "Saif",
    bw: latestBW,
    mainLift: "bench",
    anchor,
    target: 140,
    createdAt: new Date().toISOString(),
  }

  const writes: Array<Promise<unknown>> = [
    kv.set(profileKey(email), profile),
    kv.set(sessionsKey(email), legacy),
  ]
  if (legacyExercises) {
    writes.push(kv.set(exercisesKey(email), legacyExercises))
  }
  await Promise.all(writes)

  return profile
}

export async function GET() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const existing = await kv.get<UserProfile>(profileKey(email))
    if (existing) return NextResponse.json(existing)

    const migrated = await tryLegacyMigration(email)
    if (migrated) return NextResponse.json(migrated)

    return NextResponse.json(null)
  } catch {
    return NextResponse.json(null, { status: 503 })
  }
}

export async function DELETE() {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    await Promise.all([
      kv.del(profileKey(email)),
      kv.del(sessionsKey(email)),
      kv.del(exercisesKey(email)),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "KV delete failed" }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: Partial<UserProfile>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const bw = Number(body.bw)
  const mainLift = body.mainLift as MainLift
  const anchor = Number(body.anchor)
  const target = Number(body.target)

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
  if (!Number.isFinite(bw) || bw <= 0) return NextResponse.json({ error: "bw invalid" }, { status: 400 })
  if (!ALLOWED_LIFTS.includes(mainLift)) return NextResponse.json({ error: "mainLift invalid" }, { status: 400 })
  if (!Number.isFinite(anchor) || anchor <= 0) return NextResponse.json({ error: "anchor invalid" }, { status: 400 })
  if (!Number.isFinite(target) || target <= 0) return NextResponse.json({ error: "target invalid" }, { status: 400 })

  const existing = await kv.get<UserProfile>(profileKey(email))
  const profile: UserProfile = {
    email,
    name,
    bw,
    mainLift,
    anchor,
    target,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }

  try {
    await kv.set(profileKey(email), profile)
    return NextResponse.json(profile)
  } catch {
    return NextResponse.json({ error: "KV write failed" }, { status: 503 })
  }
}
