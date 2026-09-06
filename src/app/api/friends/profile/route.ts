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
import { getSessionLabel, getMainLiftLabel } from "@/lib/trainingMode"
import { sessionWork } from "@/lib/stats"

interface SessionsData {
  sessions: Session[]
  blocks: TrainingBlock[]
}

export async function GET(request: Request) {
  const session = await auth()
  const myEmail = session?.user?.email
  if (!myEmail) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetEmail = searchParams.get("email")?.trim().toLowerCase()
  if (!targetEmail) return NextResponse.json({ error: "email required" }, { status: 400 })

  const isFriend = await kv.sismember(friendsKey(myEmail), targetEmail)
  if (!isFriend) return NextResponse.json({ error: "not a friend" }, { status: 403 })

  const [profile, sessionsRaw, trainingDaysRaw, exercisesRaw] = await Promise.all([
    kv.get<UserProfile>(profileKey(targetEmail)),
    kv.get<SessionsData | Session[]>(sessionsKey(targetEmail)),
    kv.get<TrainingDay[]>(trainingDaysKey(targetEmail)),
    kv.get<MuscleGroupConfig[]>(exercisesKey(targetEmail)),
  ])

  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 })

  let lastSession: Session | null = null
  if (sessionsRaw) {
    const sessions: Session[] = Array.isArray(sessionsRaw)
      ? sessionsRaw
      : sessionsRaw.sessions ?? []
    const confirmed = sessions
      .filter((s) => s.confirmed && s.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    lastSession = confirmed[0] ?? null
  }

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

  return NextResponse.json({ profile, lastSession, lastSessionSummary })
}
