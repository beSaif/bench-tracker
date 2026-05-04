"use client"

import { useState } from "react"
import { UserProfile, MainLift, MAIN_LIFT_LABEL, LiftConfig, LIFT_ORDER } from "@/lib/types"
import { saveProfile } from "@/lib/storage"

interface Props {
  profile: UserProfile
  onDone: (updatedProfile: UserProfile) => void
}

type ModalStep = "intro" | "wizard" | "saving"

function roundTo2p5(kg: number): number {
  return Math.round(kg / 2.5) * 2.5
}

function isPositive(val: string): boolean {
  const v = parseFloat(val)
  return Number.isFinite(v) && v > 0
}

export default function MigrationPromptModal({ profile, onDone }: Props) {
  const [modalStep, setModalStep] = useState<ModalStep>("intro")

  // The two non-primary lifts in LIFT_ORDER
  const otherLifts = LIFT_ORDER.filter((l) => l !== profile.mainLift) as MainLift[]

  // Anchors/targets for the other 2 lifts
  const [anchors, setAnchors] = useState<Record<string, string>>({
    [otherLifts[0]]: "",
    [otherLifts[1]]: "",
  })
  const [targets, setTargets] = useState<Record<string, string>>({
    [otherLifts[0]]: "",
    [otherLifts[1]]: "",
  })
  const [wizardPhase, setWizardPhase] = useState<"anchors" | "targets">("anchors")

  const anchorsValid = otherLifts.every((l) => isPositive(anchors[l]))
  const targetsValid = otherLifts.every((l) => isPositive(targets[l]))

  async function handleKeepSingle() {
    setModalStep("saving")
    const saved = await saveProfile({
      ...profile,
      liftMode: "single",
      migrationPromptSeen: true,
    })
    if (saved) onDone(saved)
  }

  async function handleConfirmMulti() {
    setModalStep("saving")
    const liftConfigs: LiftConfig[] = LIFT_ORDER.map((l) => {
      if (l === profile.mainLift) {
        return { lift: l, anchor: profile.anchor, target: profile.target }
      }
      return {
        lift: l,
        anchor: parseFloat(anchors[l]),
        target: parseFloat(targets[l]),
      }
    })
    const saved = await saveProfile({
      ...profile,
      liftMode: "multi",
      liftConfigs,
      migrationPromptSeen: true,
    })
    if (saved) onDone(saved)
  }

  if (modalStep === "saving") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
        <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10 flex items-center justify-center min-h-[160px]">
          <p className="text-sm text-[#777777]">saving…</p>
        </div>
      </div>
    )
  }

  if (modalStep === "intro") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
        <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10">
          <p className="text-base font-semibold text-[#111111] mb-1">a new option is available.</p>
          <p className="text-sm text-[#777777] mb-6">
            you can now track all three powerlifting lifts in one rotating program — squat, bench, and deadlift, each with its own progression. or keep your current {MAIN_LIFT_LABEL[profile.mainLift].toLowerCase()} focus. your call.
          </p>
          <button
            onClick={() => setModalStep("wizard")}
            className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 mb-3 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors"
          >
            switch to all three lifts
          </button>
          <button
            onClick={handleKeepSingle}
            className="w-full border border-[#e8e8e8] text-[#555555] text-sm font-semibold rounded-xl py-3.5 hover:bg-[#f5f5f5] active:bg-[#eeeeee] transition-colors"
          >
            keep {MAIN_LIFT_LABEL[profile.mainLift].toLowerCase()} only
          </button>
        </div>
      </div>
    )
  }

  // Wizard: collect anchors then targets for the 2 non-primary lifts
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white w-full max-w-[393px] rounded-t-2xl px-6 pt-6 pb-10">
        {wizardPhase === "anchors" && (
          <>
            <p className="text-base font-semibold text-[#111111] mb-1">current 1 rep maxes</p>
            <p className="text-sm text-[#777777] mb-6">
              we already have your {MAIN_LIFT_LABEL[profile.mainLift].toLowerCase()} ({profile.anchor}kg). what are the other two?
            </p>
            <div className="space-y-5 mb-6">
              {otherLifts.map((l) => (
                <div key={l}>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1.5">
                    {MAIN_LIFT_LABEL[l]}
                  </label>
                  <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#7a1f2e] pb-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="2.5"
                      value={anchors[l]}
                      onChange={(e) => setAnchors((prev) => ({ ...prev, [l]: e.target.value }))}
                      placeholder="100"
                      className="flex-1 text-2xl font-semibold text-[#111111] outline-none bg-transparent"
                    />
                    <span className="text-base text-[#aaaaaa]">kg</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setWizardPhase("targets")}
              disabled={!anchorsValid}
              className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 mb-3 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors disabled:opacity-40"
            >
              continue
            </button>
            <button
              onClick={() => setModalStep("intro")}
              className="w-full text-center text-sm text-[#aaaaaa] hover:text-[#777777] py-2"
            >
              back
            </button>
          </>
        )}

        {wizardPhase === "targets" && (
          <>
            <p className="text-base font-semibold text-[#111111] mb-1">goal weights</p>
            <p className="text-sm text-[#777777] mb-6">
              your {MAIN_LIFT_LABEL[profile.mainLift].toLowerCase()} goal is already {profile.target}kg. what about the others?
            </p>
            <div className="space-y-5 mb-6">
              {otherLifts.map((l) => {
                const anchorForLift = parseFloat(anchors[l])
                const suggestions =
                  Number.isFinite(anchorForLift) && anchorForLift > 0
                    ? [
                        { kg: roundTo2p5(anchorForLift * 1.1), label: "+10%" },
                        { kg: roundTo2p5(anchorForLift * 1.2), label: "+20%" },
                        { kg: roundTo2p5(anchorForLift * 1.3), label: "+30%" },
                      ]
                    : []
                return (
                  <div key={l}>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1.5">
                      {MAIN_LIFT_LABEL[l]}
                    </label>
                    {suggestions.length > 0 && (
                      <div className="flex gap-2 mb-2">
                        {suggestions.map(({ kg, label }) => (
                          <button
                            key={kg}
                            onClick={() => setTargets((prev) => ({ ...prev, [l]: String(kg) }))}
                            className={`flex-1 flex flex-col items-center py-2 rounded-xl border-2 transition-colors text-xs ${
                              targets[l] === String(kg)
                                ? "border-[#7a1f2e] bg-[#fdf5f6] text-[#7a1f2e]"
                                : "border-[#e8e8e8] text-[#111111] hover:border-[#cccccc]"
                            }`}
                          >
                            <span className="font-semibold">{kg}kg</span>
                            <span className="text-[#aaaaaa] mt-0.5">{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#7a1f2e] pb-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="2.5"
                        value={targets[l]}
                        onChange={(e) => setTargets((prev) => ({ ...prev, [l]: e.target.value }))}
                        placeholder="140"
                        className="flex-1 text-2xl font-semibold text-[#111111] outline-none bg-transparent"
                      />
                      <span className="text-base text-[#aaaaaa]">kg</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={handleConfirmMulti}
              disabled={!targetsValid}
              className="w-full bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 mb-3 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors disabled:opacity-40"
            >
              switch to all three lifts
            </button>
            <button
              onClick={() => setWizardPhase("anchors")}
              className="w-full text-center text-sm text-[#aaaaaa] hover:text-[#777777] py-2"
            >
              back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
