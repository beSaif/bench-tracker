"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"

export default function PreviewLoginForm() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    await signIn("credentials", { redirect: false })
    window.location.href = "/"
  }

  return (
    <div className="mt-10 w-full flex flex-col items-center gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#cccccc]">
        preview access
      </p>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center border border-[#e8e8e8] rounded-xl py-3.5 text-sm font-semibold text-[#aaaaaa] hover:bg-[#fafafa] active:bg-[#f5f5f5] disabled:opacity-40 transition-colors"
      >
        {loading ? "signing in…" : "continue as preview"}
      </button>
    </div>
  )
}
