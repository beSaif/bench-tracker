"use client"

import { useState } from "react"
import { MuscleGroup, Session, TrainingDay } from "@/lib/types"
import { MuscleGroupConfig } from "@/lib/exerciseConfig"
import MomentumStrip from "./MomentumStrip"
import MuscleRecoveryBars from "./MuscleRecoveryBars"
import UpNextCard from "./UpNextCard"
import BalancedSessionRow from "./BalancedSessionRow"

interface Props {
  /** Confirmed sessions, newest first. */
  confirmedSorted: Session[]
  upcoming: Session | undefined
  exerciseConfig: MuscleGroupConfig[]
  trainingDays: TrainingDay[]
  recommendedDayId?: string
  /** Why the coach picked that day. */
  recommendedReason?: string
  mainLiftLabel: string
  onStartLogging: (session: Session) => void
  onUpdateMuscleGroups: (session: Session, muscles: MuscleGroup[], dayId?: string) => void
  onEdit: (session: Session) => void
  onUnlog: (session: Session) => void
  onShare: (session: Session) => void
}

/** Recent sessions shown before a "show more" button. */
const RECENT_PAGE_SIZE = 10

/**
 * The Balanced home screen: how the training is going, whether it's balanced, what
 * to do next, and what was done recently. There is no block or target here, so these
 * are the questions the screen has to answer on its own.
 */
export default function BalancedHome({
  confirmedSorted,
  upcoming,
  exerciseConfig,
  trainingDays,
  recommendedDayId,
  recommendedReason,
  mainLiftLabel,
  onStartLogging,
  onUpdateMuscleGroups,
  onEdit,
  onUnlog,
  onShare,
}: Props) {
  const [recentLimit, setRecentLimit] = useState(RECENT_PAGE_SIZE)

  const recent = confirmedSorted.slice(0, recentLimit)
  const remaining = confirmedSorted.length - recentLimit

  return (
    <div className="mb-4">
      <MomentumStrip sessions={confirmedSorted} />

      <MuscleRecoveryBars
        sessions={confirmedSorted}
        exerciseConfig={exerciseConfig}
        trainingDays={trainingDays}
      />

      {upcoming && (
        <UpNextCard
          session={upcoming}
          history={confirmedSorted}
          exerciseConfig={exerciseConfig}
          trainingDays={trainingDays}
          recommendedDayId={recommendedDayId}
          reason={recommendedReason}
          onStartLogging={onStartLogging}
          onUpdateMuscleGroups={onUpdateMuscleGroups}
        />
      )}

      {confirmedSorted.length > 0 && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] mb-2.5 mt-6">
          Recent sessions
        </p>
      )}

      {recent.map((s) => (
        <BalancedSessionRow
          key={s.id}
          session={s}
          exerciseConfig={exerciseConfig}
          trainingDays={trainingDays}
          mainLiftLabel={mainLiftLabel}
          onEdit={onEdit}
          onUnlog={onUnlog}
          onShare={onShare}
        />
      ))}

      {remaining > 0 && (
        <button
          onClick={() => setRecentLimit((n) => n + RECENT_PAGE_SIZE)}
          className="w-full text-xs font-semibold text-[#777777] bg-[#f5f5f5] rounded-xl px-4 py-2.5 hover:text-[#1e3a5f] active:opacity-70 transition-colors"
        >
          Show {Math.min(RECENT_PAGE_SIZE, remaining)} more
        </button>
      )}
    </div>
  )
}
