"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MainLift, MAIN_LIFT_LABEL } from "@/lib/types"
import { loadProfile, saveProfile } from "@/lib/storage"

type Step = 0 | 1 | 2 | 3 | 4

const LIFTS: MainLift[] = ["bench", "deadlift", "squat"]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState("")
  const [bw, setBw] = useState("")
  const [lift, setLift] = useState<MainLift | null>(null)
  const [anchor, setAnchor] = useState("")
  const [target, setTarget] = useState("")

  useEffect(() => {
    loadProfile().then((p) => {
      if (p) {
        router.replace("/")
        return
      }
      setChecking(false)
    })
  }, [router])

  function next() {
    setStep((s) => Math.min(4, s + 1) as Step)
  }

  function back() {
    setStep((s) => Math.max(0, s - 1) as Step)
  }

  async function finish() {
    if (!lift) return
    setSubmitting(true)
    const result = await saveProfile({
      name: name.trim(),
      bw: parseFloat(bw),
      mainLift: lift,
      anchor: parseFloat(anchor),
      target: parseFloat(target),
    })
    setSubmitting(false)
    if (result) router.replace("/")
  }

  const canAdvance = (() => {
    if (step === 0) return name.trim().length > 0
    if (step === 1) {
      const v = parseFloat(bw)
      return Number.isFinite(v) && v > 0
    }
    if (step === 2) return lift !== null
    if (step === 3) {
      const v = parseFloat(anchor)
      return Number.isFinite(v) && v > 0
    }
    if (step === 4) {
      const v = parseFloat(target)
      return Number.isFinite(v) && v > 0
    }
    return false
  })()

  if (checking) {
    return <main className="min-h-dvh bg-white" />
  }

  return (
    <main className="min-h-dvh flex flex-col bg-white">
      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pt-8 pb-12">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === step ? "w-8 bg-[#7a1f2e]" : i < step ? "w-1.5 bg-[#7a1f2e]/40" : "w-1.5 bg-[#e8e8e8]"
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[360px]">
          {step === 0 && (
            <Question label="What should we call you?" hint="Your first name is fine.">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) next() }}
                placeholder="Saif"
                className="w-full text-2xl font-semibold text-[#111111] border-b-2 border-[#e8e8e8] focus:border-[#7a1f2e] outline-none bg-transparent pb-2"
              />
            </Question>
          )}

          {step === 1 && (
            <Question label="What's your bodyweight?" hint="In kilograms — we use this to track relative strength.">
              <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#7a1f2e] pb-2">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={bw}
                  onChange={(e) => setBw(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) next() }}
                  placeholder="60"
                  className="flex-1 text-2xl font-semibold text-[#111111] outline-none bg-transparent"
                />
                <span className="text-base text-[#aaaaaa]">kg</span>
              </div>
            </Question>
          )}

          {step === 2 && (
            <Question label="Which lift are you tracking?" hint="Pick the one whose progression you want to plan around.">
              <div className="space-y-2">
                {LIFTS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLift(l)}
                    className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-colors ${
                      lift === l
                        ? "border-[#7a1f2e] bg-[#fdf5f6] text-[#7a1f2e]"
                        : "border-[#e8e8e8] text-[#111111] hover:border-[#cccccc]"
                    }`}
                  >
                    <span className="text-base font-semibold">{MAIN_LIFT_LABEL[l]}</span>
                  </button>
                ))}
              </div>
            </Question>
          )}

          {step === 3 && (
            <Question
              label={`What's your current 1RM on ${lift ? MAIN_LIFT_LABEL[lift].toLowerCase() : "your lift"}?`}
              hint="Your honest best — every block is built around this anchor."
            >
              <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#7a1f2e] pb-2">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  step="2.5"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) next() }}
                  placeholder="100"
                  className="flex-1 text-2xl font-semibold text-[#111111] outline-none bg-transparent"
                />
                <span className="text-base text-[#aaaaaa]">kg</span>
              </div>
            </Question>
          )}

          {step === 4 && (
            <Question
              label="What's your target?"
              hint="The number on the bar you're chasing."
            >
              <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#7a1f2e] pb-2">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  step="2.5"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) finish() }}
                  placeholder="140"
                  className="flex-1 text-2xl font-semibold text-[#111111] outline-none bg-transparent"
                />
                <span className="text-base text-[#aaaaaa]">kg</span>
              </div>
            </Question>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-10 pt-6">
        <div className="max-w-[360px] mx-auto flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={back}
              className="text-sm font-semibold text-[#777777] hover:text-[#111111] px-4 py-3"
            >
              Back
            </button>
          )}
          <button
            onClick={step === 4 ? finish : next}
            disabled={!canAdvance || submitting}
            className="flex-1 bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors disabled:opacity-40"
          >
            {step === 4 ? (submitting ? "Saving…" : "Get started") : "Continue"}
          </button>
        </div>
      </div>
    </main>
  )
}

function Question({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#111111] tracking-tight mb-2 leading-snug">
        {label}
      </h2>
      {hint && <p className="text-sm text-[#777777] mb-8">{hint}</p>}
      {children}
    </div>
  )
}
