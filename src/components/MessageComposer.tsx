"use client"

import { useState } from "react"

const PRESETS = [
  "skipping again? 🐔",
  "seen your last set lol 😂",
  "my grandma moves more weight bro",
  "GET IN THE GYM 🔱",
  "actually showed up today?? 👀",
  "still waiting on that 100kg... 😴",
  "LET'S GO 🔥",
]

interface Props {
  recipientLabel: string
  toEmail: string
  onSent: () => void
  onClose: () => void
}

export default function MessageComposer({ recipientLabel, toEmail, onSent, onClose }: Props) {
  const [custom, setCustom] = useState("")
  const [sending, setSending] = useState(false)
  const [sentText, setSentText] = useState<string | null>(null)

  async function send(text: string) {
    if (sending) return
    setSending(true)
    try {
      await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail, text }),
      })
      setSentText(text)
      setTimeout(onSent, 900)
    } finally {
      setSending(false)
    }
  }

  if (sentText !== null) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-fade-in">
        <span className="text-4xl animate-bounce-in select-none">🔥</span>
        <p className="text-white font-semibold">sent</p>
        <p className="text-zinc-500 text-sm">"{sentText}"</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold">
            roasting
          </p>
          <p className="text-white font-bold text-lg leading-tight">{recipientLabel}</p>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 transition-colors mt-0.5 shrink-0"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="4" y1="4" x2="14" y2="14" />
            <line x1="14" y1="4" x2="4" y2="14" />
          </svg>
        </button>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-col gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p}
            onClick={() => send(p)}
            disabled={sending}
            className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] transition-all text-white text-sm font-medium disabled:opacity-40 animate-fade-up"
            style={{ animationDelay: `${i * 35}ms` }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div className="flex gap-2 animate-fade-up" style={{ animationDelay: "260ms" }}>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && custom.trim() && send(custom.trim())}
          placeholder="or type your own..."
          maxLength={300}
          className="flex-1 bg-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600 transition-shadow"
        />
        <button
          onClick={() => custom.trim() && send(custom.trim())}
          disabled={!custom.trim() || sending}
          className="px-4 py-2.5 bg-white text-zinc-900 font-semibold text-sm rounded-xl disabled:opacity-25 active:scale-95 transition-all"
        >
          send
        </button>
      </div>
    </div>
  )
}
