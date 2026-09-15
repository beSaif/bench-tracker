import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile, Session, TrainingBlock, TrainingDay, FriendSessionSummary } from "@/lib/types"
import { profileKey, sessionsKey, friendsKey, trainingDaysKey, exercisesKey } from "@/lib/userKeys"
import {
  MuscleGroupConfig,
  DEFAULT_MUSCLE_GROUPS,
  DEFAULT_TRAINING_DAYS,
  getMuscleLabel,
} from "@/lib/exerciseConfig"
import { getSessionLabel, getMainLiftLabel, isLiftFocused } from "@/lib/trainingMode"
import { sessionWork } from "@/lib/stats"
import { buildFriendCard } from "@/lib/friendCard"

interface SessionsData {
  sessions: Session[]
  blocks: TrainingBlock[]
}

export async function GET(request: Request) {
  const session = await auth()
  const myEmail = session?.user?.email
  if (!myEmail) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  // No email means "my own card": /me reads the card it would show a gymbro, of
  // the viewer. Everything below is already computed from one user's own data.
  const myEmailLower = myEmail.trim().toLowerCase()
  const targetEmail = searchParams.get("email")?.trim().toLowerCase() || myEmailLower

  if (targetEmail !== myEmailLower) {
    const isFriend = await kv.sismember(friendsKey(myEmail), targetEmail)
    if (!isFriend) return NextResponse.json({ error: "not a friend" }, { status: 403 })
  }

  const [profile, sessionsRaw, trainingDaysRaw, exercisesRaw] = await Promise.all([
    kv.get<UserProfile>(profileKey(targetEmail)),
    kv.get<SessionsData | Session[]>(sessionsKey(targetEmail)),
    kv.get<TrainingDay[]>(trainingDaysKey(targetEmail)),
    kv.get<MuscleGroupConfig[]>(exercisesKey(targetEmail)),
  ])

  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 })

  const allSessions: Session[] = Array.isArray(sessionsRaw)
    ? sessionsRaw
    : sessionsRaw?.sessions ?? []

  const confirmed = allSessions
    .filter((s) => s.confirmed && s.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  const lastSession: Session | null = confirmed[0] ?? null

  let lastSessionSummary: FriendSessionSummary | null = null
  if (lastSession) {
    const trainingDays = trainingDaysRaw?.length ? trainingDaysRaw : DEFAULT_TRAINING_DAYS
    const exerciseConfig = exercisesRaw?.length ? exercisesRaw : DEFAULT_MUSCLE_GROUPS
    const work = sessionWork(lastSession, getMainLiftLabel(profile))
    lastSessionSummary = {
      label: getSessionLabel(lastSession, trainingDays),
      muscles: work.muscles.map((m) => getMuscleLabel(exerciseConfig, m)),
      exercises: work.exercises,
      sets: work.sets,
      volume: work.volume,
      topSet: work.topSet,
    }
  }

  // Aggregated here on purpose: the viewer gets streaks and records, never the
  // friend's raw session list.
  const card = buildFriendCard(allSessions, {
    mainLiftLabel: getMainLiftLabel(profile),
    anchor: profile.anchor ?? null,
    target: profile.target ?? null,
    liftFocused: isLiftFocused(profile),
  })

  return NextResponse.json({ profile, lastSession, lastSessionSummary, card })
}
