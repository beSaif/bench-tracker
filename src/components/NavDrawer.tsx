"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { wipeLocalUserData } from "@/lib/storage"

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetch("/api/friends/requests")
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((d) => { if (typeof d.count === "number") setPendingCount(d.count) })
      .catch(() => {})
  }, [])

  function handleSignOut() {
    wipeLocalUserData()
    signOut({ callbackUrl: "/welcome" })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-white shadow-2xl transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pt-14 px-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-4">
            Menu
          </p>
          <nav className="space-y-1">
            <Link
              href="/"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/"
                  ? "bg-[#eff6ff] text-[#1e3a5f]"
                  : "text-[#333333] hover:bg-[#f5f5f5]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M6.5 14.5v-4h3v4a1 1 0 001 1h3a1 1 0 001-1V7.5h1.5a.5.5 0 00.35-.854l-7-6.5a.5.5 0 00-.7 0l-7 6.5A.5.5 0 001 7.5H2.5v7a1 1 0 001 1h3a1 1 0 001-1z" />
              </svg>
              Home
            </Link>

            <Link
              href="/exercises"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/exercises"
                  ? "bg-[#eff6ff] text-[#1e3a5f]"
                  : "text-[#333333] hover:bg-[#f5f5f5]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <rect x="1.5" y="6" width="2.5" height="4" rx="0.5" />
                <rect x="12" y="6" width="2.5" height="4" rx="0.5" />
                <line x1="4" y1="8" x2="5.5" y2="8" />
                <line x1="10.5" y1="8" x2="12" y2="8" />
                <rect x="5.5" y="4.5" width="5" height="7" rx="0.5" />
              </svg>
              Exercise Selection
            </Link>

            <Link
              href="/history"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/history"
                  ? "bg-[#eff6ff] text-[#1e3a5f]"
                  : "text-[#333333] hover:bg-[#f5f5f5]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" />
                <polyline points="8,4.5 8,8 10.5,9.5" />
              </svg>
              History
            </Link>

            <Link
              href="/gymbros"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/gymbros"
                  ? "bg-[#eff6ff] text-[#1e3a5f]"
                  : "text-[#333333] hover:bg-[#f5f5f5]"
              }`}
            >
              <span className="relative">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="5.5" cy="5" r="2.5" />
                  <circle cx="10.5" cy="5" r="2.5" />
                  <path d="M1 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
                  <path d="M10.5 9.5c2 0 4 1 4 4" />
                </svg>
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 leading-none">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </span>
              Gymbros
            </Link>
          </nav>

          <div className="mt-8 pt-4 border-t border-[#f0f0f0]">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#777777] hover:bg-[#f5f5f5] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" />
                <polyline points="10.5,11.5 14,8 10.5,4.5" />
                <line x1="14" y1="8" x2="6" y2="8" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
