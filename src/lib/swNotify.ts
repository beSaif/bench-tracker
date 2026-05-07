const TWO_HOURS = 2 * 60 * 60 * 1000
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000

function sw() {
  return typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller : null
}

export function scheduleIncompleteSessionReminder() {
  sw()?.postMessage({
    type: 'SCHEDULE',
    id: 'incomplete-session',
    delay: TWO_HOURS,
    title: 'Yo, finish your session',
    body: 'You started a session and walked away. Get back to it.',
    url: '/',
  })
}

export function cancelIncompleteSessionReminder() {
  sw()?.postMessage({ type: 'CANCEL', id: 'incomplete-session' })
}

export function scheduleInactivityReminder() {
  sw()?.postMessage({
    type: 'SCHEDULE',
    id: 'inactivity',
    delay: THREE_DAYS,
    title: 'The bar misses you',
    body: "You haven't trained in a while. Get back under it.",
    url: '/',
  })
}
