/** Brzycki e1RM formula: weight × (36 / (37 − reps)) */
export function calcE1RM(kg: number, reps: number): number | null {
  if (reps <= 0 || reps >= 37) return null
  const raw = kg * (36 / (37 - reps))
  return Math.round(raw * 10) / 10
}

/** Round value to nearest increment (default 2.5kg plate) */
export function roundToPlate(value: number, increment = 2.5): number {
  return Math.round(value / increment) * increment
}
