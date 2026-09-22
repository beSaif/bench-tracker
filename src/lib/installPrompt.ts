"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Chrome's `beforeinstallprompt` event. Not in lib.dom yet, so it is spelled out here.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window {
    __installPrompt: BeforeInstallPromptEvent | null
  }
}

/**
 * Exposes the real system install dialog when the browser offers one.
 *
 * The event itself is captured by an inline script in the root layout, because Chrome
 * fires it once and early — usually before React has hydrated. This hook just reads
 * what that script stashed and re-renders when it appears or is spent.
 *
 * `available` is false on iOS Safari and on desktop Firefox, which have no such API —
 * those users still need the hand-written steps.
 */
export function useNativeInstallPrompt() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const sync = () => setAvailable(window.__installPrompt != null)
    sync()
    window.addEventListener("installpromptchange", sync)
    return () => window.removeEventListener("installpromptchange", sync)
  }, [])

  /**
   * Fires the system dialog. Must be called straight off a user gesture or Chrome
   * rejects it. Resolves to true if the user accepted the install.
   *
   * The event is single-use: once prompted it is cleared either way, so a second tap
   * falls back to the written steps rather than silently doing nothing.
   */
  const promptInstall = useCallback(async () => {
    const event = window.__installPrompt
    if (!event) return false

    window.__installPrompt = null
    window.dispatchEvent(new Event("installpromptchange"))

    try {
      await event.prompt()
      const { outcome } = await event.userChoice
      return outcome === "accepted"
    } catch {
      return false
    }
  }, [])

  return { available, promptInstall }
}
