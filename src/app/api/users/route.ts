import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { UserProfile } from "@/lib/types"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const keys = await kv.keys("user:*:profile")
    if (keys.length === 0) return NextResponse.json([])

    const profiles = await kv.mget<UserProfile[]>(...keys)
    const valid = profiles.filter((p): p is UserProfile => p !== null && typeof p === "object")

    return NextResponse.json(valid)
  } catch {
    return NextResponse.json([], { status: 503 })
  }
}
