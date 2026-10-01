"use client"

import type { CSSProperties } from "react"

/** Resting state — what the buddy looks like between moments. */
export type BuddyMood = "idle" | "happy" | "sleepy"
/** A one-shot animation played over the mood. */
export type BuddyReaction = "nod" | "celebrate" | "wiggle"

const STEP = 17
const R = 6.5
const CX = 50
const CY = 52

/** Row widths of the blob, top to bottom. The third row carries the eyes. */
const ROWS = [3, 5, 5, 3]
const EYE_ROW = 2
const EYE_COLS = [-1, 1]

interface Dot {
  x: number
  y: number
  /** Position in the breathing wave, so the body ripples instead of pulsing as one. */
  wave: number
  eye: boolean
}

const DOTS: Dot[] = ROWS.flatMap((width, row) => {
  const y = CY + (row - (ROWS.length - 1) / 2) * STEP
  const half = (width - 1) / 2
  return Array.from({ length: width }, (_, i) => {
    const col = i - half
    return {
      x: CX + col * STEP,
      y,
      wave: row + Math.abs(col),
      eye: row === EYE_ROW && EYE_COLS.includes(col),
    }
  })
})

function Eye({ x, y, mood }: { x: number; y: number; mood: BuddyMood }) {
  if (mood === "happy") {
    return (
      <path
        d={`M${x - 6} ${y + 2.5} Q${x} ${y - 6} ${x + 6} ${y + 2.5}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    )
  }
  if (mood === "sleepy") {
    return (
      <path
        d={`M${x - 6} ${y + 1} H${x + 6}`}
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    )
  }
  return <circle className="dots-eye" cx={x} cy={y} r={R + 1} fill="currentColor" />
}

interface Props {
  mood?: BuddyMood
  reaction?: BuddyReaction | null
  /** Bump to replay the reaction — the animated group remounts on change. */
  reactionKey?: number
  /** Rendered size in px. */
  size?: number
  /** Dot colour; the body is a faded tint of it, the eyes the full colour. */
  colour?: string
  className?: string
  label?: string
}

/**
 * The app's little companion: a cluster of dots that breathes, blinks and reacts.
 * Pure SVG + CSS, so it costs nothing to load and stays crisp at any size.
 */
export default function DotsBuddy({
  mood = "idle",
  reaction = null,
  reactionKey = 0,
  size = 32,
  colour = "#1e3a5f",
  className,
  label = "Buddy",
}: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`dots-buddy dots-mood-${mood} overflow-visible ${className ?? ""}`}
      style={{ color: colour }}
      // An empty label marks it decorative, for when the surrounding control names it.
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <g key={reactionKey} className={reaction ? `dots-${reaction}` : undefined}>
        {DOTS.map((d, i) => (
          <g
            key={i}
            className="dots-cell"
            style={{
              "--dx": `${(d.x - CX) * 0.4}px`,
              "--dy": `${(d.y - CY) * 0.4}px`,
            } as CSSProperties}
          >
            {d.eye ? (
              <Eye x={d.x} y={d.y} mood={mood} />
            ) : (
              <circle
                className="dots-body"
                cx={d.x}
                cy={d.y}
                r={R}
                fill="currentColor"
                opacity={0.32}
                style={{ animationDelay: `${d.wave * 0.14}s` }}
              />
            )}
          </g>
        ))}
      </g>
      {mood === "sleepy" && (
        <text className="dots-z" x="86" y="22" fontSize="18" fontWeight="700" fill="currentColor">
          z
        </text>
      )}
    </svg>
  )
}
