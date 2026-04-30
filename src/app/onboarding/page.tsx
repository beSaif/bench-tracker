"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { MainLift, MAIN_LIFT_LABEL } from "@/lib/types"
import { loadProfile, saveProfile } from "@/lib/storage"
import InstallGuideModal, { useInstallGuide } from "@/components/InstallGuideModal"

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

const LIFTS: MainLift[] = ["bench", "deadlift", "squat"]
const PENDING_KEY = "lift-tracker-pending-onboarding"

function roundTo2p5(kg: number): number {
  return Math.round(kg / 2.5) * 2.5
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const installGuide = useInstallGuide()

  const [name, setName] = useState("")
  const [bw, setBw] = useState("")
  const [lift, setLift] = useState<MainLift | null>(null)
  const [anchor, setAnchor] = useState("")
  const [target, setTarget] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isPostAuth = params.get("auth") === "1"

    if (isPostAuth) {
      const raw = localStorage.getItem(PENDING_KEY)
      if (raw) {
        try {
          const d = JSON.parse(raw) as { name: string; bw: string; lift: MainLift; anchor: string; target: string }
          localStorage.removeItem(PENDING_KEY)
          autoFinish(d)
          return
        } catch {
          localStorage.removeItem(PENDING_KEY)
        }
      }
    }

    // Normal path: check if the user already has a profile
    loadProfile().then((p) => {
      if (p) {
        router.replace("/")
        return
      }
      setChecking(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function autoFinish(d: { name: string; bw: string; lift: MainLift; anchor: string; target: string }) {
    setSubmitting(true)
    const result = await saveProfile({
      name: d.name.trim(),
      bw: parseFloat(d.bw),
      mainLift: d.lift,
      anchor: parseFloat(d.anchor),
      target: parseFloat(d.target),
    })
    setSubmitting(false)
    if (result) installGuide.trigger()
  }

  function next() {
    setStep((s) => Math.min(9, s + 1) as Step)
  }

  function back() {
    setStep((s) => Math.max(0, s - 1) as Step)
  }

  async function handleGoogleSignIn() {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ name, bw, lift, anchor, target }))
    await signIn("google", { callbackUrl: "/onboarding?auth=1" })
  }

  const canAdvance = (() => {
    if (step === 0) return name.trim().length > 0
    if (step === 1) {
      const v = parseFloat(bw)
      return Number.isFinite(v) && v > 0
    }
    if (step === 2) return true
    if (step === 3) return true
    if (step === 4) return lift !== null
    if (step === 5) return true
    if (step === 6) return true
    if (step === 7) {
      const v = parseFloat(anchor)
      return Number.isFinite(v) && v > 0
    }
    if (step === 8) {
      const v = parseFloat(target)
      return Number.isFinite(v) && v > 0
    }
    if (step === 9) return true
    return false
  })()

  const anchorVal = parseFloat(anchor)
  const targetSuggestions: { kg: number; label: string }[] =
    Number.isFinite(anchorVal) && anchorVal > 0
      ? [
          { kg: roundTo2p5(anchorVal * 1.1), label: "+10%" },
          { kg: roundTo2p5(anchorVal * 1.2), label: "+20%" },
          { kg: roundTo2p5(anchorVal * 1.3), label: "+30%" },
        ]
      : []

  if (checking || submitting) {
    return (
      <main className="min-h-dvh bg-white flex items-center justify-center">
        {submitting && <p className="text-sm text-[#777777]">saving…</p>}
      </main>
    )
  }

  if (installGuide.show) {
    return (
      <main className="min-h-dvh bg-white">
        <InstallGuideModal
          onDismiss={() => {
            installGuide.dismiss()
            router.replace("/")
          }}
        />
      </main>
    )
  }

  return (
    <main className="min-h-dvh flex flex-col bg-white">
      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pt-8 pb-12">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
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

          {/* Step 0: name */}
          {step === 0 && (
            <Question label="what do we call you?" hint="first name is fine.">
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

          {/* Step 1: bodyweight */}
          {step === 1 && (
            <Question label="how much do you weigh?" hint="in kg — we use this to track your relative strength over time.">
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

          {/* Step 2: hook */}
          {step === 2 && (
            <Question
              label="most people track everything. most people quit."
              hint="this app does it differently. one lift. one goal. actually works."
            />
          )}

          {/* Step 3: two parts */}
          {step === 3 && (
            <Question label="the program has two parts.">
              <div className="space-y-5 mt-2">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7a1f2e] mt-1.5 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-[#111111]">main lift</span>
                    <span className="text-sm text-[#777777]"> — one exercise. tracked weekly. you always have a target.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#888888] mt-1.5 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-[#111111]">accessories</span>
                    <span className="text-sm text-[#777777]"> — everything else. chest, back, whatever. you pick these each session.</span>
                  </div>
                </div>
              </div>
            </Question>
          )}

          {/* Step 4: lift selection */}
          {step === 4 && (
            <Question label="what lift are you training?" hint="pick the one you're building your program around.">
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

          {/* Step 5: 4-phase cycle */}
          {step === 5 && (
            <Question label="your main lift runs in 4-phase cycles.">
              <div className="space-y-4 mt-2">
                {([
                  { color: "#2d6a2d", name: "volume", desc: "more reps, lighter. build the base. 4 sessions." },
                  { color: "#5a2d8a", name: "intensity", desc: "fewer reps, heavier. 4 sessions." },
                  { color: "#7a1f2e", name: "peak", desc: "near your max. 3 sessions." },
                  { color: "#888888", name: "deload", desc: "back off. let it sink in. 1 session." },
                ] as const).map(({ color, name: phaseName, desc }) => (
                  <div key={phaseName} className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                    <div>
                      <span className="text-sm font-semibold text-[#111111]">{phaseName}</span>
                      <span className="text-sm text-[#777777]"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm text-[#777777]">then you reset and go again — heavier than before.</p>
            </Question>
          )}

          {/* Step 6: anchor + e1RM */}
          {step === 6 && (
            <Question label="two numbers you'll see everywhere.">
              <div className="space-y-5 mt-2">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#7a1f2e] mt-1.5 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-[#111111]">anchor</span>
                    <span className="text-sm text-[#777777]"> — your 1 rep max. every session is a % of this.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#888888] mt-1.5 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-[#111111]">e1RM</span>
                    <span className="text-sm text-[#777777]"> — estimated max, recalculated from every set you log.</span>
                  </div>
                </div>
              </div>
            </Question>
          )}

          {/* Step 7: current 1RM */}
          {step === 7 && (
            <Question
              label={`what's your current 1 rep max on ${lift ? MAIN_LIFT_LABEL[lift].toLowerCase() : "your lift"}?`}
              hint="your best single rep. be honest — every session is a percentage of this."
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

          {/* Step 8: target weight */}
          {step === 8 && (
            <Question
              label="what's your goal weight?"
              hint="the number on the bar you want to hit. doesn't have to be realistic right now."
            >
              {targetSuggestions.length > 0 && (
                <div className="flex gap-2 mb-6">
                  {targetSuggestions.map(({ kg, label }) => (
                    <button
                      key={kg}
                      onClick={() => setTarget(String(kg))}
                      className={`flex-1 flex flex-col items-center py-3 rounded-xl border-2 transition-colors ${
                        target === String(kg)
                          ? "border-[#7a1f2e] bg-[#fdf5f6] text-[#7a1f2e]"
                          : "border-[#e8e8e8] text-[#111111] hover:border-[#cccccc]"
                      }`}
                    >
                      <span className="text-base font-semibold">{kg}kg</span>
                      <span className="text-xs text-[#aaaaaa] mt-0.5">{label}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-baseline gap-2 border-b-2 border-[#e8e8e8] focus-within:border-[#7a1f2e] pb-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="2.5"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) next() }}
                  placeholder="140"
                  className="flex-1 text-2xl font-semibold text-[#111111] outline-none bg-transparent"
                />
                <span className="text-base text-[#aaaaaa]">kg</span>
              </div>
            </Question>
          )}

          {/* Step 9: commitment gate */}
          {step === 9 && (
            <Question
              label="only do this if you're actually going to show up."
              hint="no judgment. but this only works if you use it."
            >
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 border border-[#e8e8e8] rounded-xl py-3.5 text-sm font-semibold text-[#111111] hover:bg-[#fafafa] active:bg-[#f5f5f5] transition-colors mt-4"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.165 6.656 3.58 9 3.58z"/>
                </svg>
                sign in with google
              </button>
              <button
                onClick={back}
                className="w-full text-center text-sm text-[#aaaaaa] hover:text-[#777777] mt-4 py-2"
              >
                back
              </button>
            </Question>
          )}

        </div>
      </div>

      {/* Footer — hidden on step 9 (Google button is in content area) */}
      {step !== 9 && (
        <div className="px-6 pb-10 pt-6">
          <div className="max-w-[360px] mx-auto flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={back}
                className="text-sm font-semibold text-[#777777] hover:text-[#111111] px-4 py-3"
              >
                back
              </button>
            )}
            <button
              onClick={next}
              disabled={!canAdvance}
              className="flex-1 bg-[#7a1f2e] text-white text-sm font-semibold rounded-xl py-3.5 hover:bg-[#6a1926] active:bg-[#5a1520] transition-colors disabled:opacity-40"
            >
              continue
            </button>
          </div>
        </div>
      )}
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
  children?: React.ReactNode
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
