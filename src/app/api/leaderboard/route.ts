import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { Session, UserProfile, LeaderEntry, LeaderboardResult } from "@/lib/types"
import { profileKey, sessionsKey } from "@/lib/userKeys"

function currentWeekBounds(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diffToMonday)
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function calcE1RM(kg: number, reps: number): number {
  if (reps === 1) return kg
  return kg * (36 / (37 - reps))
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const { start, end } = currentWeekBounds()

    const profileKeys = await kv.keys("user:*:profile")
    if (profileKeys.length === 0) {
      return NextResponse.json({
        bySessionCount: [],
        byE1RM: [],
        weekStart: start.toISOString().slice(0, 10),
      } satisfies LeaderboardResult)
    }

    const profiles = await kv.mget<UserProfile[]>(...profileKeys)
    const validProfiles = profiles.filter((p): p is UserProfile => p !== null && typeof p === "object")

    const userDataList = await Promise.all(
      validProfiles.map(async (profile) => {
        const raw = await kv.get<{ sessions: Session[] } | Session[]>(sessionsKey(profile.email))
        const sessions: Session[] = raw
          ? Array.isArray(raw)
            ? raw
            : raw.sessions ?? []
          : []
        return { profile, sessions }
      })
    )

    const bySessionCountEntries: Array<{ name: string; email: string; count: number }> = []
    const byE1RMEntries: Array<{ name: string; email: string; e1rm: number }> = []

    for (const { profile, sessions } of userDataList) {
      const weekSessions = sessions.filter((s) => {
        if (!s.confirmed || !s.date) return false
        const d = new Date(s.date + "T00:00:00Z")
        return d >= start && d <= end
      })

      if (weekSessions.length > 0) {
        bySessionCountEntries.push({ name: profile.name, email: profile.email, count: weekSessions.length })
      }

      let bestE1RM = 0
      for (const s of weekSessions) {
        for (const set of s.sets) {
          if (set.isWarmup || set.reps < 1) continue
          const e1rm = set.e1rm ?? calcE1RM(set.kg, set.reps)
          if (e1rm > bestE1RM) bestE1RM = e1rm
        }
      }
      if (bestE1RM > 0) {
        byE1RMEntries.push({ name: profile.name, email: profile.email, e1rm: bestE1RM })
      }
    }

    bySessionCountEntries.sort((a, b) => b.count - a.count)
    byE1RMEntries.sort((a, b) => b.e1rm - a.e1rm)

    const bySessionCount: LeaderEntry[] = bySessionCountEntries.map((e, i) => ({
      rank: i + 1,
      name: e.name,
      email: e.email,
      value: e.count,
    }))

    const byE1RM: LeaderEntry[] = byE1RMEntries.map((e, i) => ({
      rank: i + 1,
      name: e.name,
      email: e.email,
      value: Math.round(e.e1rm * 10) / 10,
    }))

    return NextResponse.json({
      bySessionCount,
      byE1RM,
      weekStart: start.toISOString().slice(0, 10),
    } satisfies LeaderboardResult)
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 503 })
  }
}
