import { Session, BenchSet } from "./types"
import { calcE1RM } from "./e1rm"
import { generateWarmups } from "./warmup"

function makeWorkingSets(
  weight: number,
  reps: number,
  count: number,
  rpeList: (number | null)[]
): BenchSet[] {
  return Array.from({ length: count }, (_, i) => {
    const rpe = rpeList[i] ?? null
    return {
      id: `S${i + 1}`,
      kg: weight,
      reps,
      rpe,
      e1rm: calcE1RM(weight, reps),
      note: "",
      isWarmup: false,
    }
  })
}

export function generateSeedData(): Session[] {
  return [
    {
      id: 1,
      date: "2026-03-21T00:00:00.000Z",
      type: "Push",
      bw: 54,
      confirmed: true,
      coachNote: "First session. Great to start the journey.",
      sets: [
        ...generateWarmups(60),
        ...makeWorkingSets(60, 6, 2, [7, 7]),
      ],
    },
    {
      id: 2,
      date: "2026-03-23T00:00:00.000Z",
      type: "Push",
      bw: 54,
      confirmed: true,
      coachNote: "Big jump to 70kg — both sets felt smooth.",
      sets: [
        ...generateWarmups(70),
        ...makeWorkingSets(70, 6, 2, [7, 7]),
      ],
    },
    {
      id: 3,
      date: "2026-03-26T00:00:00.000Z",
      type: "Push",
      bw: 54,
      confirmed: true,
      coachNote: "Moved to 3 sets. Solid session.",
      sets: [
        ...generateWarmups(72.5),
        ...makeWorkingSets(72.5, 5, 3, [7, 7, 7]),
      ],
    },
    {
      id: 4,
      date: "2026-03-29T00:00:00.000Z",
      type: "Push",
      bw: 54,
      confirmed: true,
      coachNote: "75kg for the first time. Last set felt heavy at RPE 8.",
      sets: [
        ...generateWarmups(75),
        ...makeWorkingSets(75, 5, 3, [7, 7, 8]),
      ],
    },
    {
      id: 5,
      date: "2026-03-31T00:00:00.000Z",
      type: "Push",
      bw: 54,
      confirmed: true,
      coachNote: "75kg second time. RPE down to 7 — ready to progress.",
      sets: [
        ...generateWarmups(75),
        ...makeWorkingSets(75, 5, 3, [7, 7, 7]),
      ],
    },
    {
      id: 6,
      date: null,
      type: "Push",
      bw: null,
      confirmed: false,
      coachNote: "Prescribed: 77.5kg × 5 × 3. Stay tight, drive the legs.",
      sets: [
        ...generateWarmups(77.5),
        ...makeWorkingSets(77.5, 5, 3, [null, null, null]),
      ],
    },
  ]
}
