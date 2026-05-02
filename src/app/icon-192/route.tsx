import { ImageResponse } from 'next/og'

const BG = '#111827'
const HI = '#fde68a'
const MN = '#f59e0b'
const SH = '#92400e'

// 32 grid units * 5px = 160px content, centred in 192px → 16px padding each side
const S = 5
const P = 16

const rects = [
  { x: 0,  y: 8,  w: 3,  h: 1,  c: HI },
  { x: 0,  y: 9,  w: 3,  h: 13, c: MN },
  { x: 0,  y: 22, w: 3,  h: 2,  c: SH },
  { x: 3,  y: 11, w: 3,  h: 1,  c: HI },
  { x: 3,  y: 12, w: 3,  h: 7,  c: MN },
  { x: 3,  y: 19, w: 3,  h: 2,  c: SH },
  { x: 6,  y: 13, w: 2,  h: 1,  c: HI },
  { x: 6,  y: 14, w: 2,  h: 3,  c: MN },
  { x: 6,  y: 17, w: 2,  h: 2,  c: SH },
  { x: 8,  y: 14, w: 16, h: 1,  c: HI },
  { x: 8,  y: 15, w: 16, h: 2,  c: MN },
  { x: 8,  y: 17, w: 16, h: 1,  c: SH },
  { x: 24, y: 13, w: 2,  h: 1,  c: HI },
  { x: 24, y: 14, w: 2,  h: 3,  c: MN },
  { x: 24, y: 17, w: 2,  h: 2,  c: SH },
  { x: 26, y: 11, w: 3,  h: 1,  c: HI },
  { x: 26, y: 12, w: 3,  h: 7,  c: MN },
  { x: 26, y: 19, w: 3,  h: 2,  c: SH },
  { x: 29, y: 8,  w: 3,  h: 1,  c: HI },
  { x: 29, y: 9,  w: 3,  h: 13, c: MN },
  { x: 29, y: 22, w: 3,  h: 2,  c: SH },
]

export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: 192,
        height: 192,
        background: BG,
        position: 'relative',
        display: 'flex',
      }}
    >
      {rects.map(({ x, y, w, h, c }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x * S + P,
            top: y * S + P,
            width: w * S,
            height: h * S,
            background: c,
          }}
        />
      ))}
    </div>,
    { width: 192, height: 192 },
  )
}
