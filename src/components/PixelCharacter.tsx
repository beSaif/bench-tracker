"use client"

import { useState, useEffect, CSSProperties } from "react"

type AnimationType = "walk" | "run" | "idle"
type Direction =
  | "east"
  | "west"
  | "north"
  | "south"
  | "north-east"
  | "north-west"
  | "south-east"
  | "south-west"

interface PixelCharacterProps {
  animation: AnimationType
  direction?: Direction
  fps?: number
  size?: number
  className?: string
  style?: CSSProperties
  onAnimationEnd?: () => void
}

const FRAME_COUNT = 6

export default function PixelCharacter({
  animation,
  direction = "south",
  fps = 10,
  size = 48,
  className,
  style,
  onAnimationEnd,
}: PixelCharacterProps) {
  const [frame, setFrame] = useState(0)
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    setFrame(0)
    setHasFailed(false)
    if (animation === "idle") return
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % FRAME_COUNT)
    }, 1000 / fps)
    return () => clearInterval(interval)
  }, [animation, direction, fps])

  if (hasFailed) return null

  const src =
    animation === "idle"
      ? `/sprites/idle/${direction}.png`
      : `/sprites/${animation}/${direction}/frame_${frame}.png`

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      onError={() => setHasFailed(true)}
      onAnimationEnd={onAnimationEnd}
      style={{ imageRendering: "pixelated", ...style }}
      className={className}
    />
  )
}
