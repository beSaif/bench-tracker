"use client"

export type ProfileTab = "card" | "routine"

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "card", label: "Card" },
  { id: "routine", label: "Routine" },
]

/** The profile's two views: the gymbro card, and the split they train. */
export default function ProfileTabs({
  tab,
  onChange,
}: {
  tab: ProfileTab
  onChange: (tab: ProfileTab) => void
}) {
  return (
    <div role="tablist" className="flex gap-1 p-1 mb-4 rounded-xl bg-[#f5f5f5]">
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
  )
}
