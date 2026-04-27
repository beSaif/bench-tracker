export interface ExerciseConfig {
  id: string
  name: string
  order: number
}

export interface MuscleGroupConfig {
  id: string
  name: string
  exercises: ExerciseConfig[]
  order: number
}

export const DEFAULT_MUSCLE_GROUPS: MuscleGroupConfig[] = [
  {
    id: "back",
    name: "Back",
    order: 0,
    exercises: [
      { id: "lat-pulldown", name: "Lat Pulldown", order: 0 },
      { id: "single-cable-seated-pulldown", name: "Single Cable Seated Pulldown", order: 1 },
      { id: "cross-rear-delt-fly", name: "Cross Rear Delt Fly", order: 2 },
    ],
  },
  {
    id: "triceps",
    name: "Triceps",
    order: 1,
    exercises: [
      { id: "overhead-extension", name: "Overhead Extension", order: 0 },
      { id: "bar-pulldown", name: "Bar Pulldown", order: 1 },
      { id: "single-arm-cable-pulldown", name: "Single Arm Cable Pulldown", order: 2 },
    ],
  },
  {
    id: "chest",
    name: "Chest",
    order: 2,
    exercises: [
      { id: "dumbbell-incline-press", name: "Dumbbell Incline Press", order: 0 },
      { id: "machine-seated-chest-press", name: "Machine Seated Chest Press", order: 1 },
    ],
  },
  {
    id: "biceps",
    name: "Biceps",
    order: 3,
    exercises: [
      { id: "zbar-curls", name: "ZBar Curls", order: 0 },
      { id: "dumbbell-curl", name: "Dumbbell Curl", order: 1 },
      { id: "hammer-curl", name: "Hammer Curl", order: 2 },
    ],
  },
  {
    id: "shoulders",
    name: "Shoulders",
    order: 4,
    exercises: [
      { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", order: 0 },
      { id: "cable-lateral-raise", name: "Cable Lateral Raise", order: 1 },
      { id: "face-pulls", name: "Face Pulls", order: 2 },
    ],
  },
  {
    id: "legs",
    name: "Legs",
    order: 5,
    exercises: [
      { id: "leg-extension", name: "Leg Extension", order: 0 },
      { id: "leg-curl", name: "Leg Curl", order: 1 },
      { id: "leg-press", name: "Leg Press", order: 2 },
    ],
  },
]

export function sortedMuscleGroups(config: MuscleGroupConfig[]): MuscleGroupConfig[] {
  return [...config].sort((a, b) => a.order - b.order)
}

export function getMuscleLabel(config: MuscleGroupConfig[], id: string): string {
  const found = config.find((g) => g.id === id)
  if (found) return found.name
  return id.charAt(0).toUpperCase() + id.slice(1)
}

export function getExercisesForMuscle(config: MuscleGroupConfig[], id: string): string[] {
  const group = config.find((g) => g.id === id)
  if (!group) return []
  return [...group.exercises].sort((a, b) => a.order - b.order).map((e) => e.name)
}

export function buildMuscleRotation(config: MuscleGroupConfig[]): string[][] {
  const sorted = sortedMuscleGroups(config).map((g) => g.id)
  const pairs: string[][] = []
  for (let i = 0; i < sorted.length; i += 2) {
    if (i + 1 < sorted.length) {
      pairs.push([sorted[i], sorted[i + 1]])
    } else {
      pairs.push([sorted[i]])
    }
  }
  return pairs
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function findSimilarExercises(name: string, config: MuscleGroupConfig[]): string[] {
  const na = normalize(name)
  if (na.length < 3) return []
  const similar: string[] = []
  for (const group of config) {
    for (const ex of group.exercises) {
      const nb = normalize(ex.name)
      if (nb === na) { similar.push(ex.name); continue }
      const maxLen = Math.max(na.length, nb.length)
      if (maxLen === 0) continue
      const dist = levenshtein(na, nb)
      if (dist / maxLen < 0.3) similar.push(ex.name)
    }
  }
  return similar
}

export function generateId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") +
    "-" +
    Date.now().toString(36)
  )
}
