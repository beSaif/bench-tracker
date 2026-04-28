"use client"

import { Session, TrainingBlock } from "@/lib/types"
import { MuscleGroupConfig } from "@/lib/exerciseConfig"
import BlockHeader from "@/components/BlockHeader"
import SessionCard from "@/components/SessionCard"

interface HistorySidebarProps {
  open: boolean
  onClose: () => void
  activeBlock: TrainingBlock | undefined
  activeBlockSessions: Session[]
  completedCycleGroups: { block: TrainingBlock; sessions: Session[] }[]
  archiveSessions: Session[]
  blockIndexMap: Map<number, number>
  exerciseConfig: MuscleGroupConfig[]
  onEdit: (session: Session) => void
  onUnlog: (session: Session) => void
}

export default function HistorySidebar({
  open,
  onClose,
  activeBlock,
  activeBlockSessions,
  completedCycleGroups,
  archiveSessions,
  blockIndexMap,
  exerciseConfig,
  onEdit,
  onUnlog,
}: HistorySidebarProps) {
  const totalSessions =
    activeBlockSessions.length +
    completedCycleGroups.reduce((acc, g) => acc + g.sessions.length, 0) +
    archiveSessions.length

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
        className={`fixed top-0 right-0 bottom-0 z-50 w-[300px] bg-white shadow-2xl flex flex-col transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-[#e8e8e8] shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa]">
              History
            </p>
            <p className="text-xs text-[#777777] mt-0.5">{totalSessions} session{totalSessions !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#aaaaaa] hover:text-[#444444] transition-colors"
            aria-label="Close history"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M3.293 3.293a1 1 0 011.414 0L8 6.586l3.293-3.293a1 1 0 111.414 1.414L9.414 8l3.293 3.293a1 1 0 01-1.414 1.414L8 9.414l-3.293 3.293a1 1 0 01-1.414-1.414L6.586 8 3.293 4.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {totalSessions === 0 ? (
            <p className="text-sm text-[#aaaaaa] text-center mt-8">No sessions logged yet</p>
          ) : (
            <>
              {/* Active block sessions */}
              {activeBlock && activeBlockSessions.length > 0 && (
                <div className="mb-4">
                  <BlockHeader block={activeBlock} confirmedCount={activeBlockSessions.length} />
                  {activeBlockSessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      blockIndex={blockIndexMap.get(s.id)}
                      onEdit={onEdit}
                      onUnlog={onUnlog}
                      exerciseConfig={exerciseConfig}
                    />
                  ))}
                </div>
              )}

              {/* Completed blocks in current cycle */}
              {completedCycleGroups.map(({ block, sessions }) => (
                <div key={block.id} className="mb-4">
                  <BlockHeader block={block} confirmedCount={sessions.length} />
                  {sessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onEdit={onEdit}
                      onUnlog={onUnlog}
                      exerciseConfig={exerciseConfig}
                    />
                  ))}
                </div>
              ))}

              {/* Archive */}
              {archiveSessions.length > 0 && (
                <div className="mb-4">
                  {(activeBlock || completedCycleGroups.length > 0) && (
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-3 px-1">
                      Archive
                    </p>
                  )}
                  {archiveSessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onEdit={onEdit}
                      onUnlog={onUnlog}
                      exerciseConfig={exerciseConfig}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
