"use client"

import { useSyncExternalStore, type MouseEvent } from "react"
import { canTickSwitch, noteHapticTap } from "@/lib/haptics"

/**
 * Makes the button it sits in tick on an iPhone. Put it inside a `relative` button.
 *
 * iOS only plays its haptic when a real tap lands on the label of an
 * `<input type="checkbox" switch>`, so this is that label, stretched invisibly over the
 * button. The tap still reaches the button: the label's click bubbles up to it. The
 * label then clicks its switch, which toggles and ticks; that second click stops at
 * the switch, so the button's handler runs once. Renders nothing off an iPhone.
 *
 * The tick only happens if the label is still on the page once the click is over: a
 * handler that re-renders the button away must wrap its work in afterHapticTap.
 *
 * `when` overrides the Haptics setting for this tap: the menu's own Haptics switch
 * ticks on the way on, while the setting still reads off.
 */
export default function HapticTap({ when }: { when?: boolean }) {
  // Never changes on a device; off on the server and through hydration.
  const on = useSyncExternalStore(noSubscribe, canTickSwitch, () => false)
  if (!on) return null

  const onLabelClick = (e: MouseEvent<HTMLLabelElement>) => {
    // The label's own click, not the copy it forwards to the switch (stopped below).
    if (!noteHapticTap(when)) e.preventDefault()
  }

  return (
    <label
      aria-hidden="true"
      onClick={onLabelClick}
      className="absolute inset-0 z-[1] touch-manipulation [-webkit-tap-highlight-color:transparent]"
    >
      <input
        type="checkbox"
        // React has no prop for it yet; the attribute is what makes this a switch.
        {...{ switch: "" }}
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => e.stopPropagation()}
        className="absolute w-px h-px m-0 opacity-0 pointer-events-none"
      />
    </label>
  )
}

const noSubscribe = () => () => {}
