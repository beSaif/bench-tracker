import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { parseRoutineCode, toDetail } from "@/lib/routines"
import { loadRoutine, loadAdoptionCount } from "@/lib/routineStore"
import { routineAdoptersKey, routineAdoptionsKey } from "@/lib/userKeys"

/**
 * POST /api/routines/[id]/adopt
 *
 * Records the adoption and hands back the routine. Writing the bundle into the
 * adopter's own config is the client's job (`applyRoutineBundle`), because that
 * write also has to retire the groups it replaces so the adopter's history keeps
 * resolving its muscle names — which needs the config on the device.
 *
 * The adopters set is what makes the count idempotent: `sadd` reports whether the
 * email was new, and only a new one bumps the counter. Re-adopting the same routine
 * after a few weeks off it is a no-op for the count, which is the honest reading of
 * "how many people use this".
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const id = parseRoutineCode((await ctx.params).id)
  if (!id) return NextResponse.json({ error: "not found" }, { status: 404 })

  try {
    const routine = await loadRoutine(id)
    if (!routine) return NextResponse.json({ error: "not found" }, { status: 404 })

    const me = email.trim().toLowerCase()
    // An author browsing their own routine shouldn't inflate its count.
    if (me !== routine.authorEmail) {
      const added = await kv.sadd(routineAdoptersKey(id), me)
      if (added === 1) await kv.incr(routineAdoptionsKey(id))
    }

    const adoptionCount = await loadAdoptionCount(id)
    return NextResponse.json(toDetail(routine, { adoptionCount, viewerEmail: email }))
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
