"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { loadProfile } from "./storage"

/**
 * Send an account that never finished onboarding to /onboarding. Home does this in its
 * own load; the other signed-in pages would otherwise render against a profile that
 * does not exist. loadProfile falls back to the cached copy offline, so a returning
 * user with no signal is never bounced.
 */
export function useOnboardingGuard(): void {
  const router = useRouter()
  useEffect(() => {
    let cancelled = false
    loadProfile().then((p) => {
      if (!cancelled && !p) router.replace("/onboarding")
    })
    return () => {
      cancelled = true
    }
  }, [router])
}
