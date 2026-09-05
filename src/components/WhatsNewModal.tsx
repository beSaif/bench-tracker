"use client"

import { useState } from "react"
import { WhatsNewRelease, pendingWhatsNew, markWhatsNewSeen, WHATS_NEW_VERSION } from "@/lib/whatsNew"

interface WhatsNewModalProps {
  releases: WhatsNewRelease[]
  onDismiss: () => void
}

export default function WhatsNewModal({ releases, onDismiss }: WhatsNewModalProps) {
  const items = releases.flatMap((r) => r.items)
  if (items.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#1e3a5f] bg-[#eff6ff] rounded-full px-2 py-0.5">
            New
          </span>
          <p className="text-base font-semibold text-[#111111]">What&apos;s new</p>
        </div>
        <p className="text-sm text-[#777777] mb-5">A few things changed since you were last here.</p>

        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#1e3a5f] mt-1.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#111111]">{item.title}</p>
                <p className="text-sm text-[#777777] mt-0.5">{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-[#16304f] active:bg-[#0f2540] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

// ── Hook for consumers ────────────────────────────────────────────────────────

export function useWhatsNew() {
  const [releases, setReleases] = useState<WhatsNewRelease[]>([])

  /** Call once the user is known to be onboarded, so fresh sign-ups never see it. */
  function trigger() {
    if (typeof window === "undefined") return
    const pending = pendingWhatsNew()
    if (pending.length > 0) setReleases(pending)
  }

  function dismiss() {
    markWhatsNewSeen(WHATS_NEW_VERSION)
    setReleases([])
  }

  return { show: releases.length > 0, releases, trigger, dismiss }
}
