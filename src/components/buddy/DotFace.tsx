/**
 * Dot standing still in a page's own layout, for the places it talks to you directly
 * (the routine planner) rather than wandering the screen like DotBuddy does. Same
 * body and eyes, drawn by the same classes; `thinking` makes it hop in place.
 */
export default function DotFace({ thinking = false, happy = false }: { thinking?: boolean; happy?: boolean }) {
  return (
    <div className={`dot-anim shrink-0 ${thinking ? "dot-think" : ""}`} aria-hidden="true">
      <div className="dot-shadow" />
      <div className="dot-body">
        {happy ? (
          <>
            <span className="dot-arc" style={{ left: 6, top: 9, width: 8, height: 5 }} />
            <span className="dot-arc" style={{ left: 16, top: 9, width: 8, height: 5 }} />
          </>
        ) : (
          <>
            <span className="dot-eye" style={{ left: 8, top: thinking ? 6 : 8, width: 4, height: 7 }} />
            <span className="dot-eye" style={{ left: 18, top: thinking ? 6 : 8, width: 4, height: 7 }} />
          </>
        )}
      </div>
    </div>
  )
}
