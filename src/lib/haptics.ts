/**
 * One place for every buzz the app makes, so each moment feels the same wherever
 * it fires and the platform split lives here instead of at every call site.
 *
 * Android gets real patterns through the Vibration API. iOS Safari has no such API,
 * but toggling a native `<input switch>` plays the system's selection tick (iOS 18+),
 * so iOS gets a count of ticks instead of a pattern. Anything else stays silent.
 */

export type Haptic =
  /** Smallest acknowledgement — moving between sets, tapping a dash. */
  | "tick"
  /** A set logged. Felt dozens of times a session, so it stays crisp, never long. */
  | "success"
  /** A new best e1RM. The one moment that is allowed to feel big. */
  | "pr"
  /** Rest is over — has to cut through a phone in a pocket. */
  | "alert"

const VIBRATE: Record<Haptic, number[]> = {
  tick: [6],
  success: [10, 50, 16],
  pr: [24, 60, 24, 60, 70],
  alert: [300, 100, 300],
}

/** iOS can't vary strength or length, so the only lever is how many ticks, and the gap. */
const IOS_TICKS: Record<Haptic, number> = {
  tick: 1,
  success: 2,
  pr: 3,
  alert: 2,
}
const IOS_TICK_GAP_MS = 110

function iosTick() {
  const label = document.createElement("label")
  label.ariaHidden = "true"
  label.style.display = "none"
  const input = document.createElement("input")
  input.type = "checkbox"
  input.setAttribute("switch", "")
  label.appendChild(input)
  document.head.appendChild(label)
  label.click()
  label.remove()
}

export function haptic(kind: Haptic) {
  if (typeof window === "undefined") return
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(VIBRATE[kind])
    return
  }
  // Only touch devices have a motor worth reaching for; desktop Safari would just
  // churn hidden elements for nothing.
  if (!window.matchMedia?.("(pointer: coarse)").matches) return
  for (let i = 0; i < IOS_TICKS[kind]; i++) {
    if (i === 0) iosTick()
    else setTimeout(iosTick, i * IOS_TICK_GAP_MS)
  }
}
