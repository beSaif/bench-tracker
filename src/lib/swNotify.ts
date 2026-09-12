/**
 * Notifications the page arms directly in the service worker. These are held by a
 * `setTimeout` inside the worker, so they only survive while it is alive — fine for a
 * nudge that fires within the hour, useless for anything measured in days. The two-day
 * layoff reminder that used to live here is now sent from the daily cron in
 * `/api/cron/reminders`, which reads the last session out of KV instead of holding a
 * timer that the browser was always going to evict.
 */

const TWO_HOURS = 2 * 60 * 60 * 1000

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
