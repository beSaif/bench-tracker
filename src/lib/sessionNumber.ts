import { Session } from "./types"

/**
 * Per-phase session numbering: within each training block, number sessions 1..N in
 * chronological order (confirmed sessions by date; the not-yet-logged upcoming session
 * sorts last). Returns session id -> 1-based number within its block. Sessions with no
 * blockId (pre-blocks history) are omitted so callers fall back to the global id.
 */
export function buildBlockSessionNumbers(sessions: Session[]): Map<number, number> {
  const byBlock = new Map<number, Session[]>()
  for (const s of sessions) {
    if (s.blockId == null) continue
    const arr = byBlock.get(s.blockId)
    if (arr) arr.push(s)
    else byBlock.set(s.blockId, [s])
  }
  const numbers = new Map<number, number>()
  for (const arr of byBlock.values()) {
    arr.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : Infinity // upcoming (null date) last
      const tb = b.date ? new Date(b.date).getTime() : Infinity
      return ta === tb ? a.id - b.id : ta - tb
    })
    arr.forEach((s, i) => numbers.set(s.id, i + 1))
  }
  return numbers
}
