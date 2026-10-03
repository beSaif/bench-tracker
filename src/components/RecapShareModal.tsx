"use client"

import { useCallback, useRef } from "react"
import RecapShareCard, { RecapShareProps } from "@/components/RecapShareCard"
import ShareImageSheet from "@/components/ShareImageSheet"

/** Share sheet for a block or cycle recap: the 1080px card rendered offscreen, then captured. */
export default function RecapShareModal({ onClose, ...card }: RecapShareProps & { onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)

  const capture = useCallback(async () => {
    const node = cardRef.current
    if (!node) throw new Error("no node")
    const { toBlob } = await import("html-to-image")
    return toBlob(node, {
      width: 1080,
      height: Math.ceil(node.offsetHeight),
      pixelRatio: 1,
      backgroundColor: "#ffffff",
      cacheBust: true,
    })
  }, [])

  const name =
    card.kind === "block"
      ? `cycle-${card.summary.cycle}-${card.summary.phaseLabel.toLowerCase()}.png`
      : `cycle-${card.summary.cycle}.png`

  return (
    <>
      <ShareImageSheet
        title={card.kind === "block" ? "share your block" : "share your cycle"}
        fileName={name}
        alt={card.kind === "block" ? "Block recap card" : "Cycle recap card"}
        capture={capture}
        onClose={onClose}
      />
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}>
        <RecapShareCard ref={cardRef} {...card} />
      </div>
    </>
  )
}
