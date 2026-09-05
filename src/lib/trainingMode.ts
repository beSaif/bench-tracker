import { MainLift, MAIN_LIFT_LABEL, TrainingMode, UserProfile } from "./types"

type ModeSource = Pick<UserProfile, "trainingMode"> | null | undefined

/** Profiles saved before the mode existed have no field; they keep the original behaviour. */
export function getTrainingMode(profile: ModeSource): TrainingMode {
  return profile?.trainingMode ?? "lift-focused"
}

export function isLiftFocused(profile: ModeSource): boolean {
  return getTrainingMode(profile) === "lift-focused"
}

/** Display label for the main lift, with a neutral fallback for profiles without one. */
export function getMainLiftLabel(profile: Pick<UserProfile, "mainLift"> | null | undefined): string {
  const lift: MainLift | undefined = profile?.mainLift
  return lift ? MAIN_LIFT_LABEL[lift] : "Main Lift"
}

/** True when the profile carries everything lift-focused mode needs to prescribe a block. */
export function hasLiftSetup(
  profile: Pick<UserProfile, "mainLift" | "anchor" | "target"> | null | undefined
): profile is { mainLift: MainLift; anchor: number; target: number } {
  return (
    !!profile &&
    profile.mainLift !== undefined &&
    typeof profile.anchor === "number" && profile.anchor > 0 &&
    typeof profile.target === "number" && profile.target > 0
  )
}
