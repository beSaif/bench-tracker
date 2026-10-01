import { HAPTICS_KEY } from "./types"

/**
 * The four buzzes the app makes for Dot's moments, on both phones.
 *
 * Android (Chrome or the installed app) has the Vibration API and plays the patterns
 * as written: on, off, on, in milliseconds. Safari has no Vibration API, but from
 * iOS 18 toggling an `<input type="checkbox" switch>` plays the system's light tap.
 * That tap has one strength, so on an iPhone a pattern becomes a count of ticks.
 * Anywhere else both routes do nothing, which is the intended fallback: a haptic is
 * never the only signal of anything.
 *
 * Call it from the tap that caused the moment, not from an effect: iOS only plays the
 * switch's tap inside a user gesture.
 */
export type HapticKind = "set" | "heavy" | "pr" | "tap"

const PATTERNS: Record<HapticKind, number[]> = {
  set: [12],
  heavy: [25, 90, 25],
  pr: [15, 70, 15, 70, 45],
  tap: [8],
}

/** Gap between the iPhone's ticks when a pattern has more than one pulse. */
const IOS_TICK_GAP_MS: Record<HapticKind, number> = { set: 0, heavy: 120, pr: 90, tap: 0 }

/** Two moments this close together would blur into one buzz, so the second is dropped. */
const MIN_GAP_MS = 600

let lastAt = 0

export const HAPTICS_CHANGE_EVENT = "haptics-change"

export function loadHapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== "off"
  } catch {
    return true
  }
}

export function saveHapticsEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(HAPTICS_KEY)
    else localStorage.setItem(HAPTICS_KEY, "off")
  } catch {
    // Private mode: the switch just will not stick past this page.
  }
  window.dispatchEvent(new Event(HAPTICS_CHANGE_EVENT))
}

export function haptic(kind: HapticKind): void {
  if (typeof window === "undefined" || !loadHapticsEnabled()) return
  const now = Date.now()
  if (now - lastAt < MIN_GAP_MS) return
  lastAt = now

  const pattern = PATTERNS[kind]
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern)
    return
  }
  const ticks = Math.ceil(pattern.length / 2)
  iosTick()
  for (let i = 1; i < ticks; i++) setTimeout(iosTick, i * IOS_TICK_GAP_MS[kind])
}

/** One system tap on iOS 18+: a throwaway switch, toggled through its label. */
function iosTick(): void {
  try {
    const label = document.createElement("label")
    label.setAttribute("aria-hidden", "true")
    label.style.display = "none"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.setAttribute("switch", "")
    label.appendChild(input)
    document.head.appendChild(label)
    label.click()
    label.remove()
  } catch {
    // Nothing to fall back to; the moment still shows on screen.
  }
}
