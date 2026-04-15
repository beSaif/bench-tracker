"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { loadSessionsLocal, saveSessions } from "@/lib/storage"
import { Session } from "@/lib/types"

type KvStatus = "loading" | "ok" | "error"
type Copied = "local" | "kv" | null

export default function DevPage() {
  const [localData, setLocalData] = useState<Session[]>([])
  const [kvData, setKvData] = useState<Session[] | null>(null)
  const [kvStatus, setKvStatus] = useState<KvStatus>("loading")
  const [copied, setCopied] = useState<Copied>(null)

  useEffect(() => {
    setLocalData(loadSessionsLocal())
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => {
        setKvData(Array.isArray(data) ? data : null)
        setKvStatus("ok")
      })
      .catch(() => setKvStatus("error"))
  }, [])

  function copy(data: unknown, which: Copied) {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  function clearLocal() {
    if (!confirm("Clear localStorage? This cannot be undone.")) return
    localStorage.removeItem("bench-tracker-sessions")
    setLocalData([])
  }

  function pullFromKV() {
    if (!kvData) return
    saveSessions(kvData)
    setLocalData(kvData)
  }

  function pushToKV() {
    saveSessions(localData)
  }

  const kvCount = kvData?.length ?? 0

  return (
    <main className="mx-auto w-full max-w-[393px] px-4 py-6">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/" className="text-sm text-[#777777]">← Back</Link>
        <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">Dev Tools</h1>
      </header>

      {/* localStorage */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[#111111]">
            localStorage{" "}
            <span className="text-[#777777] font-normal">({localData.length} sessions)</span>
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => copy(localData, "local")}
              className="text-xs font-medium text-[#7a1f2e]"
            >
              {copied === "local" ? "Copied!" : "Copy JSON"}
            </button>
            <button onClick={clearLocal} className="text-xs text-[#aaaaaa]">
              Clear
            </button>
          </div>
        </div>
        <pre className="bg-[#f5f5f5] rounded-xl p-3 text-[11px] leading-relaxed text-[#333333] overflow-x-auto max-h-52 overflow-y-auto">
          {localData.length > 0 ? JSON.stringify(localData, null, 2) : "[]"}
        </pre>
      </section>

      {/* Vercel KV */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[#111111]">
            Vercel KV{" "}
            <span className="text-[#777777] font-normal">
              {kvStatus === "loading" && "(loading…)"}
              {kvStatus === "error" && "(unavailable)"}
              {kvStatus === "ok" && `(${kvCount} sessions)`}
            </span>
          </h2>
          {kvStatus === "ok" && (
            <button
              onClick={() => copy(kvData, "kv")}
              className="text-xs font-medium text-[#7a1f2e]"
            >
              {copied === "kv" ? "Copied!" : "Copy JSON"}
            </button>
          )}
        </div>
        {kvStatus === "ok" && (
          <pre className="bg-[#f5f5f5] rounded-xl p-3 text-[11px] leading-relaxed text-[#333333] overflow-x-auto max-h-52 overflow-y-auto">
            {kvCount > 0 ? JSON.stringify(kvData, null, 2) : "[]"}
          </pre>
        )}
        {kvStatus === "loading" && (
          <div className="bg-[#f5f5f5] rounded-xl p-4 text-xs text-[#aaaaaa]">Fetching from KV…</div>
        )}
        {kvStatus === "error" && (
          <div className="bg-[#f5f5f5] rounded-xl p-4 text-xs text-[#aaaaaa]">KV is unavailable in this environment.</div>
        )}
      </section>

      {/* Sync actions */}
      <section>
        <h2 className="text-sm font-semibold text-[#111111] mb-3">Sync</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={pullFromKV}
            disabled={kvStatus !== "ok" || kvCount === 0}
            className="w-full py-3 rounded-xl bg-[#f5f5f5] text-sm text-[#111111] disabled:opacity-40"
          >
            Pull KV → localStorage
          </button>
          <button
            onClick={pushToKV}
            disabled={localData.length === 0}
            className="w-full py-3 rounded-xl bg-[#7a1f2e] text-sm text-white disabled:opacity-40"
          >
            Push localStorage → KV
          </button>
        </div>
      </section>
    </main>
  )
}
