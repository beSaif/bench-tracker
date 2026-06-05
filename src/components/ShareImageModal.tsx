"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Session, UserProfile, MAIN_LIFT_LABEL } from "@/lib/types"
import { getBestE1RM, getBestWeight, getLatestBW } from "@/lib/stats"
import ShareCard from "@/components/ShareCard"

interface Props {
  session: Session
  sessions: Session[]
  profile: UserProfile
  onClose: () => void
}

type Status = "loading" | "ready" | "error"

export default function ShareImageModal({ session, sessions, profile, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<Blob | null>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Feature detection (client-only to avoid hydration surprises).
  const [canShare, setCanShare] = useState(false)
  const [canCopy, setCanCopy] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
    setCanCopy(
      typeof navigator !== "undefined" &&
        !!navigator.clipboard &&
        typeof navigator.clipboard.write === "function" &&
        typeof ClipboardItem !== "undefined"
    )
  }, [])

  const bestE1RM = getBestE1RM(sessions)
  const bestWeight = getBestWeight(sessions)
  const bodyweight = session.bw ?? getLatestBW(sessions) ?? profile.bw
  const dateStr = session.date ?? new Date().toISOString()
  const fileName = `bench-${dateStr.slice(0, 10)}.png`

  // Capture the offscreen card to a PNG blob once, on mount.
  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null

    async function generate() {
      try {
        const node = cardRef.current
        if (!node) throw new Error("no node")

        await document.fonts.ready
        // Let layout/paint settle before snapshotting.
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r()))
        )

        const { toBlob } = await import("html-to-image")
        // Card height is content-driven, so capture its measured height
        // rather than a fixed value to avoid empty space or clipping.
        const blob = await toBlob(node, {
          width: 1080,
          height: Math.ceil(node.offsetHeight),
          pixelRatio: 1,
          backgroundColor: "#ffffff",
          cacheBust: true,
        })
        if (!blob) throw new Error("capture failed")
        if (cancelled) return

        blobRef.current = blob
        createdUrl = URL.createObjectURL(blob)
        setPreviewUrl(createdUrl)
        setStatus("ready")
      } catch {
        if (!cancelled) setStatus("error")
      }
    }

    generate()
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1800)
  }, [])

  function save() {
    const blob = blobRef.current
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    flash("saved")
  }

  async function share() {
    const blob = blobRef.current
    if (!blob) return
    const file = new File([blob], fileName, { type: "image/png" })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "best workout tracker" })
      } else {
        save()
      }
    } catch {
      // user cancelled or share failed — no-op
    }
  }

  async function copy() {
    const blob = blobRef.current
    if (!blob) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      flash("copied")
    } catch {
      save()
    }
  }

  const btnBase =
    "flex-1 py-4 rounded-2xl text-[15px] font-semibold active:scale-[0.97] transition-all disabled:opacity-30"

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 animate-slide-up"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <p className="text-zinc-500 text-xs uppercase tracking-widest font-semibold">
          share your lift
        </p>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          close
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center px-6 pb-2 min-h-0">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-sm">building your card…</span>
          </div>
        )}
        {status === "error" && (
          <p className="text-zinc-500 text-sm text-center max-w-[260px]">
            couldn&apos;t build the image. try again.
          </p>
        )}
        {status === "ready" && previewUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="Workout share card"
            className="max-h-full max-w-full rounded-2xl shadow-2xl object-contain animate-fade-up"
          />
        )}
      </div>

      {/* Actions */}
      <div className="px-5 pb-8 pt-3" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2.5">
          {canShare && (
            <button
              onClick={share}
              disabled={status !== "ready"}
              className={`${btnBase} bg-white text-zinc-900 hover:bg-zinc-100`}
            >
              share
            </button>
          )}
          <button
            onClick={save}
            disabled={status !== "ready"}
            className={`${btnBase} bg-zinc-800 text-white hover:bg-zinc-700`}
          >
            save
          </button>
          {canCopy && (
            <button
              onClick={copy}
              disabled={status !== "ready"}
              className={`${btnBase} bg-zinc-800 text-white hover:bg-zinc-700`}
            >
              copy
            </button>
          )}
        </div>
        {toast && (
          <p className="text-center text-zinc-400 text-sm mt-3 animate-fade-in">{toast}</p>
        )}
      </div>

      {/* Offscreen full-resolution card for capture (laid out, not display:none) */}
      <div
        aria-hidden
        style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}
      >
        <ShareCard
          ref={cardRef}
          session={session}
          bestE1RM={bestE1RM}
          bestWeight={bestWeight}
          bodyweight={bodyweight}
          target={profile.target}
          date={session.date}
          mainLiftLabel={MAIN_LIFT_LABEL[profile.mainLift]}
        />
      </div>
    </div>
  )
}
