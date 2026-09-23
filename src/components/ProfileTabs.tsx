"use client"

export type ProfileTab = "stats" | "routine"

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "routine", label: "Routine" },
]

/**
 * The profile's two views: their stats, and the split they train. Sticks to the top
 * on scroll so a long routine never strands you away from the other tab.
 */
export default function ProfileTabs({
  tab,
  onChange,
}: {
  tab: ProfileTab
  onChange: (tab: ProfileTab) => void
}) {
  return (
    <div className="sticky top-0 z-20 -mx-5 px-5 pt-[env(safe-area-inset-top)] pb-3 mb-1 bg-white">
      <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-[#f5f5f5]">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onChange(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.id ? "bg-white text-[#111111] shadow-sm" : "text-[#777777] hover:text-[#333333]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
