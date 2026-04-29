import { MainLiftSet } from "./types"
import { roundToPlate } from "./e1rm"

export function generateWarmups(workingWeight: number): MainLiftSet[] {
  return [
    {
      id: "W1",
      kg: 20,
      reps: 10,
      rpe: null,
      e1rm: null,
      note: "",
      isWarmup: true,
    },
    {
      id: "W2",
      kg: roundToPlate(workingWeight * 0.67),
      reps: 5,
      rpe: null,
      e1rm: null,
      note: "",
      isWarmup: true,
    },
    {
      id: "W3",
      kg: roundToPlate(workingWeight * 0.87),
      reps: 3,
      rpe: null,
      e1rm: null,
      note: "",
      isWarmup: true,
    },
  ]
}
