"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname()

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
                  ? "bg-[#fdf5f6] text-[#7a1f2e]"
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
                  ? "bg-[#fdf5f6] text-[#7a1f2e]"
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
          </nav>
        </div>
      </div>
    </>
  )
}
