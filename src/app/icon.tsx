import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const BG = '#111827'
const HI = '#fde68a'
const MN = '#f59e0b'
const SH = '#92400e'

const rects = [
  // Left outer plate
  { x: 0,  y: 8,  w: 3,  h: 1,  c: HI },
  { x: 0,  y: 9,  w: 3,  h: 13, c: MN },
  { x: 0,  y: 22, w: 3,  h: 2,  c: SH },
  // Left inner plate
  { x: 3,  y: 11, w: 3,  h: 1,  c: HI },
  { x: 3,  y: 12, w: 3,  h: 7,  c: MN },
  { x: 3,  y: 19, w: 3,  h: 2,  c: SH },
  // Left collar
  { x: 6,  y: 13, w: 2,  h: 1,  c: HI },
  { x: 6,  y: 14, w: 2,  h: 3,  c: MN },
  { x: 6,  y: 17, w: 2,  h: 2,  c: SH },
  // Bar
  { x: 8,  y: 14, w: 16, h: 1,  c: HI },
  { x: 8,  y: 15, w: 16, h: 2,  c: MN },
  { x: 8,  y: 17, w: 16, h: 1,  c: SH },
  // Right collar
  { x: 24, y: 13, w: 2,  h: 1,  c: HI },
  { x: 24, y: 14, w: 2,  h: 3,  c: MN },
  { x: 24, y: 17, w: 2,  h: 2,  c: SH },
  // Right inner plate
  { x: 26, y: 11, w: 3,  h: 1,  c: HI },
  { x: 26, y: 12, w: 3,  h: 7,  c: MN },
  { x: 26, y: 19, w: 3,  h: 2,  c: SH },
  // Right outer plate
  { x: 29, y: 8,  w: 3,  h: 1,  c: HI },
  { x: 29, y: 9,  w: 3,  h: 13, c: MN },
  { x: 29, y: 22, w: 3,  h: 2,  c: SH },
]

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
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
            left: x,
            top: y,
            width: w,
            height: h,
            background: c,
          }}
        />
      ))}
    </div>,
    { ...size },
  )
}
