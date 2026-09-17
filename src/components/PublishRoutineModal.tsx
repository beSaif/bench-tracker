"use client"

import { useState } from "react"
import {
  RoutineMeta,
  RoutineSummary,
  ROUTINE_NAME_MAX,
  ROUTINE_DESC_MAX,
  ROUTINE_TAGS_MAX,
  SUGGESTED_TAGS,
  normalizeTags,
} from "@/lib/routines"

/**
 * The publish form, also used to edit a routine's listing later.
 *
 * In "edit" mode the bundle is left alone unless the author opts in, which is what
 * makes publishing a deliberate snapshot: you can fix a typo in the description
 * without pushing a half-finished exercise change to everyone using the routine.
 */
export default function PublishRoutineModal({
  mode,
  initial,
  summary,
  drifted = false,
  busy = false,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "publish" | "edit"
  initial?: RoutineMeta
  /** What the reader will get — shown so the author can sanity-check before publishing. */
  summary: RoutineSummary
  drifted?: boolean
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onSubmit: (meta: RoutineMeta, includeBundle: boolean) => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [listed, setListed] = useState((initial?.visibility ?? "public") === "public")
  const [tagDraft, setTagDraft] = useState("")
  // Pushing the current split is the default on publish, and opt-in on an edit.
  const [includeBundle, setIncludeBundle] = useState(mode === "publish")

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : current.length >= ROUTINE_TAGS_MAX
          ? current
          : [...current, tag]
    )
  }

  function commitTagDraft() {
    const added = normalizeTags([...tags, tagDraft])
    setTags(added)
    setTagDraft("")
  }

  const canSubmit = name.trim().length > 0 && !busy

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-[393px] bg-white rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-6 max-h-[85vh] overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
          {mode === "publish" ? "Publish routine" : "Edit routine"}
        </p>
        <p className="text-xs text-[#777777] mb-5">
          {summary.dayCount} day{summary.dayCount !== 1 ? "s" : ""} ·{" "}
          {summary.groupCount} muscle group{summary.groupCount !== 1 ? "s" : ""} ·{" "}
          {summary.exerciseCount} exercise{summary.exerciseCount !== 1 ? "s" : ""}
        </p>

        {/* Name */}
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, ROUTINE_NAME_MAX))}
          placeholder="e.g. Cables-only 3 day"
          autoFocus
          className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-1 mb-5"
        />

        {/* Description */}
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2">
          What should people know?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, ROUTINE_DESC_MAX))}
          placeholder="No barbell rack at my gym, so everything pressing is dumbbells or machines."
          rows={3}
          className="w-full text-sm text-[#111111] border border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent rounded-lg px-3 py-2 resize-none"
        />
        <p className="text-[10px] text-[#cccccc] text-right mt-1 mb-5">
          {description.length}/{ROUTINE_DESC_MAX}
        </p>

        {/* Tags */}
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-1">
          Equipment
        </label>
        <p className="text-xs text-[#999999] mb-2.5">
          What the gym this was built for does and doesn&apos;t have. Up to {ROUTINE_TAGS_MAX}.
        </p>
        <div className="flex flex-wrap gap-2 mb-2.5">
          {[...new Set([...SUGGESTED_TAGS, ...tags])].map((tag) => {
            const on = tags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  on
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "bg-white text-[#777777] border-[#e8e8e8] hover:border-[#1e3a5f] hover:text-[#1e3a5f]"
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>
        <input
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              commitTagDraft()
            }
          }}
          onBlur={commitTagDraft}
          placeholder="add your own, then Enter"
          className="w-full text-sm text-[#111111] border-b border-[#e8e8e8] focus:border-[#1e3a5f] outline-none bg-transparent pb-1 mb-5"
        />

        {/* Visibility */}
        <button
          onClick={() => setListed((v) => !v)}
          className="w-full flex items-start gap-3 text-left border border-[#e8e8e8] rounded-xl px-3.5 py-3 mb-3 hover:border-[#1e3a5f] transition-colors"
        >
          <span
            className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
              listed ? "bg-[#1e3a5f] border-[#1e3a5f]" : "border-[#cccccc]"
            }`}
          >
            {listed && (
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5l2.5 2.5L9 2" />
              </svg>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#111111]">
              List it in the directory
            </span>
            <span className="block text-xs text-[#999999] mt-0.5">
              {listed
                ? "Anyone can find it by searching."
                : "Only people you send the link or code to can open it."}
            </span>
          </span>
        </button>

        {/* Snapshot opt-in, edit mode only */}
        {mode === "edit" && (
          <button
            onClick={() => setIncludeBundle((v) => !v)}
            disabled={!drifted}
            className="w-full flex items-start gap-3 text-left border border-[#e8e8e8] rounded-xl px-3.5 py-3 mb-4 hover:border-[#1e3a5f] transition-colors disabled:opacity-50 disabled:hover:border-[#e8e8e8]"
          >
            <span
              className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                includeBundle ? "bg-[#1e3a5f] border-[#1e3a5f]" : "border-[#cccccc]"
              }`}
            >
              {includeBundle && (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 5l2.5 2.5L9 2" />
                </svg>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#111111]">
                Also update the exercises and days
              </span>
              <span className="block text-xs text-[#999999] mt-0.5">
                {drifted
                  ? "Replaces the published snapshot with your split as it is now."
                  : "Your split already matches what's published."}
              </span>
            </span>
          </button>
        )}

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => onSubmit({
              name: name.trim(),
              description: description.trim(),
              tags: normalizeTags(tags),
              visibility: listed ? "public" : "unlisted",
            }, includeBundle)}
            disabled={!canSubmit}
            className="text-xs font-semibold text-white bg-[#1e3a5f] rounded-lg px-4 py-2 hover:bg-[#16304f] transition-colors disabled:opacity-40"
          >
            {busy ? "Saving…" : mode === "publish" ? "Publish" : "Save"}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-xs font-semibold text-[#777777] hover:text-[#333333] transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
