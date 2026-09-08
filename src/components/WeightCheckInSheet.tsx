"use client"

import { useState } from "react"
import { DrumRollPicker } from "@/components/DrumRollPicker"
import { WeightEntry } from "@/lib/types"
import { dateKey, describeDay, entryFor, streak } from "@/lib/weight"

// Two drums rather than one: 0.1kg precision over a sane bodyweight range is ~1650
// values, and the picker renders every item. Whole kg plus a decimal drum keeps the
// DOM small and reads the way a scale does.
const WHOLE_VALUES = Array.from({ length: 171 }, (_, i) => 30 + i)
const DECIMAL_VALUES = Array.from({ length: 10 }, (_, i) => i)

interface Props {
  entries: WeightEntry[]
  /** The day being logged. Defaults to today; /weight passes a past date to backfill. */
  date?: string
  /** Seed for the picker when the day has no entry yet — usually the last weigh-in. */
  fallbackKg: number
  onSave: (date: string, kg: number) => void
  onClose: () => void
  /** "skip today" is only offered for the daily prompt, not when editing a past day. */
  skippable?: boolean
}

export default function WeightCheckInSheet({
  entries,
  date,
  fallbackKg,
  onSave,
  onClose,
  skippable = false,
}: Props) {
  const day = date ?? dateKey()
  const existing = entryFor(entries, day)
  const seed = existing?.kg ?? fallbackKg

  const [whole, setWhole] = useState(() =>
    Math.min(200, Math.max(30, Math.floor(seed)))
  )
  const [decimal, setDecimal] = useState(() => Math.round((seed - Math.floor(seed)) * 10))

  const s = streak(entries)
  const kg = Math.round((whole + decimal / 10) * 10) / 10

  // The nudge, in order of what is actually worth saying. Never scold a missed day —
  // the point is to get today logged, not to litigate yesterday.
  const nudge = existing
    ? `logged ${describeDay(day)} — this replaces it`
    : s.current > 1
      ? `${s.current} days in a row${s.loggedToday ? "" : " — keep it going"}`
      : s.missedYesterday
        ? "missed yesterday — no big deal, pick it back up"
        : entries.length === 0
          ? "first one. from here it's a trend."
          : "one number, that's it"

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[430px] bg-white rounded-t-2xl px-6 pt-6 pb-10 shadow-2xl">
        <div className="mb-4">
          <p className="text-lg font-semibold text-[#111111] leading-snug mb-1">
            {date && day !== dateKey()
              ? `weight for ${describeDay(day)}`
              : "what did you weigh in at?"}
          </p>
          <p className="text-sm text-[#777777]">{nudge}</p>
        </div>

        <div className="flex items-end justify-center gap-2 mb-2">
          <DrumRollPicker
            values={WHOLE_VALUES}
            selected={whole}
            onChange={(v) => { if (v !== null) setWhole(v) }}
            label="kg"
          />
          <DrumRollPicker
            values={DECIMAL_VALUES}
            selected={decimal}
            onChange={(v) => { if (v !== null) setDecimal(v) }}
            label=""
            format={(v) => (v == null ? "—" : `.${v}`)}
          />
        </div>

        <p className="text-center text-sm text-[#aaaaaa] mb-6 tabular-nums">
          {kg.toFixed(1)} kg
        </p>

        <button
          onClick={() => onSave(day, kg)}
          className="w-full bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-3.5 active:bg-[#0f2540] transition-colors"
        >
          {existing ? "update" : "log it"}
        </button>
        <button onClick={onClose} className="w-full text-sm text-[#aaaaaa] py-3 mt-1">
          {skippable ? "skip today" : "cancel"}
        </button>
      </div>
    </div>
  )
}
