import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { isLegacyOwner } from "@/lib/userKeys"
import DevTools from "./DevTools"

/**
 * Reset, recalibrate and delete tools. Open in development; in production only for the
 * owner account, or for everyone when DEV_TOOLS=1 is set, so the hidden long-press on
 * the home greeting can't hand these to a user who stumbles on it.
 */
export default async function DevPage() {
  if (process.env.NODE_ENV === "production" && process.env.DEV_TOOLS !== "1") {
    const email = (await auth())?.user?.email
    if (!email || !isLegacyOwner(email)) notFound()
  }
  return <DevTools />
}
