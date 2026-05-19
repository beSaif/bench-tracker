export function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function relativeDate(dateStr: string): string {
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const d = new Date(dateStr)
  const sessionMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((todayMidnight - sessionMidnight) / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "1d ago"
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}
