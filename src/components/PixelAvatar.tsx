"use client"

const GRID = 8
/** Only half the grid is generated; the rest is mirrored, which is what makes it read as a creature. */
const HALF = GRID / 2

/** FNV-1a. Small, stable across runs, and good enough to scatter neighbouring emails apart. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A deterministic 0..1 stream, so every visual choice below is reproducible from the seed. */
function rng(seed: number): () => number {
  let s = seed || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 0xffffffff
  }
}

interface Props {
  /** Identity the sprite is derived from — stable per gymbro. */
  seed: string
  /** Body colour; the sprite picks its own shade for depth. */
  colour: string
  className?: string
}

/**
 * A symmetric pixel sprite standing in for a portrait. Drawn as SVG rects rather
 * than an image so it stays crisp at any size and costs no network request.
 */
export default function PixelAvatar({ seed, colour, className }: Props) {
  const h = hash(seed)
  const next = rng(h)

  // Rows at the very top and bottom stay sparser, which keeps the silhouette
  // from filling the frame as a solid block.
  const cells: Array<{ x: number; y: number; shade: boolean }> = []
  for (let y = 0; y < GRID; y++) {
    const edgeRow = y === 0 || y === GRID - 1
    for (let x = 0; x < HALF; x++) {
      const threshold = edgeRow ? 0.72 : x === HALF - 1 ? 0.32 : 0.46
      if (next() > threshold) continue
      const shade = next() > 0.76
      cells.push({ x, y, shade })
      cells.push({ x: GRID - 1 - x, y, shade })
    }
  }

  // Eyes are drawn last, always on the same row, so every sprite reads as a face.
  const eyeRow = 3
  const eyeCol = h % 2 === 0 ? 2 : 1

  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      className={`pixel-crisp ${className ?? ""}`}
      role="img"
      aria-label="Pixel portrait"
    >
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width="1"
          height="1"
          fill={colour}
          opacity={c.shade ? 0.55 : 1}
        />
      ))}
      <rect x={eyeCol} y={eyeRow} width="1" height="1" fill="#ffffff" />
      <rect x={GRID - 1 - eyeCol} y={eyeRow} width="1" height="1" fill="#ffffff" />
    </svg>
  )
}
