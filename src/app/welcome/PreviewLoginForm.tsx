"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"

export default function PreviewLoginForm() {
  const [token, setToken] = useState("")
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)
    const result = await signIn("credentials", { token, redirect: false })
    if (result?.error) {
      setError(true)
      setLoading(false)
    } else {
      window.location.href = "/"
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 w-full flex flex-col items-center gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#cccccc]">
        preview access
      </p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="bypass token"
        className="w-full border border-[#e8e8e8] rounded-xl px-4 py-3 text-sm text-[#111111] placeholder-[#cccccc] outline-none focus:border-[#aaaaaa] transition-colors"
      />
      {error && (
        <p className="text-xs text-red-400">invalid token</p>
      )}
      <button
        type="submit"
        disabled={loading || !token}
        className="w-full flex items-center justify-center bg-[#111111] rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
      >
        {loading ? "signing in…" : "continue"}
      </button>
    </form>
  )
}
