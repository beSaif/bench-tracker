This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Daily reminders

Two push notifications are sent by a single Vercel cron job declared in `vercel.json`,
which calls `/api/cron/reminders` once a day at 06:00 UTC (08:00 in Zurich over summer,
07:00 in winter).

- **Weigh-in reminder** — sent to anyone with daily check-ins switched on who has not
  logged a bodyweight for the current day. It names the streak once it reaches three
  days, and says so when a streak broke yesterday.
- **Time-off nudge** — sent once the last confirmed session is two days behind, then at
  most weekly until training resumes. Logging a session moves that date forward, which
  is what cancels the pending nudge.

At most one push goes out per user per day; the time-off nudge takes priority and leaves
the weigh-in reminder for the following day.

The rules live in `src/lib/reminders.ts` and read only stored data, so they work with the
app closed. Timers held inside the service worker cannot: the browser evicts an idle
worker within minutes, so `src/lib/swNotify.ts` is now only used for the two-hour
unfinished-session nudge.

### Configuration

| Variable | Purpose |
| --- | --- |
| `CRON_SECRET` | Required. The job rejects every request whose `Authorization` header is not `Bearer $CRON_SECRET`, and refuses to run at all when the variable is unset. Vercel sends this header automatically. |
| `VAPID_EMAIL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push credentials. Without them no push is sent. |

To see what today would send you without waiting for the cron, open
`/api/cron/reminders?preview=1` while signed in. Preview never sends and never writes.

The job asks "did you log today" in each user's own calendar day. The browser reports its
IANA timezone when it registers a push subscription; users who registered before that
existed are treated as UTC until their next visit.

## Routine planner

`/plan` (linked from the Routine page as "Plan with Dot") replaces the user's training
days, muscle groups and exercises with a plan written by an LLM. Two ways in, one import
path (`src/lib/routinePlan.ts`): the plan is parsed and validated, laid over the current
routine so kept groups, days and exercises keep their ids and history, previewed with a
summary of what changes, and only saved when applied. Groups the plan drops are retired,
not deleted, and the previous routine is kept on the device for a week so the switch can
be undone.

- **Plan with Dot**: five tap-to-answer questions, then one call to `/api/plan`, which
  plans from the stored routine with any OpenAI-compatible chat API. Each user gets 5
  plans a day (tweaks included); a reply that can't be read gets one free repair attempt.
  Only the routine and the answers are sent, never the user's name, email or sessions.
- **Use your own AI**: copies a prompt carrying the routine and the format rules (shared
  with Dot, in `src/lib/planPrompt.ts`) for the user's own chatbot, and reads the reply
  pasted back, prose, code fences and curly quotes included.

| Variable | Purpose |
| --- | --- |
| `PLANNER_API_KEY` | Turns Dot's planner on. Without it only the copy-and-paste path is offered. A free [Groq](https://console.groq.com) key works with the defaults. |
| `PLANNER_BASE_URL` | Optional. Any OpenAI-compatible endpoint; defaults to `https://api.groq.com/openai/v1`. |
| `PLANNER_MODEL` | Optional. Defaults to `openai/gpt-oss-120b`. |

Don't point it at Google's free Gemini tier: its terms only allow paid use for apps
serving users in the EEA, Switzerland or the UK.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The app deploys to Vercel through the Git integration: every push to `main` ships to
production, other branches get preview deployments. `vercel.json` only declares the
reminders cron. Server state lives in Vercel KV; the environment variables above are set
in the project's Settings → Environment Variables.

### Domain

Production is served at `https://workout.codesaif.dev`. `https://bench-tracker.vercel.app`
keeps working and serves the same deployment. It is not redirected, because the installed
Home Screen app, push subscriptions and the local cache all belong to one origin (see
"Moving to a new address" below).

1. Vercel: Project → Settings → Domains → add `workout.codesaif.dev`
   (`vercel domains add workout.codesaif.dev bench-tracker`). Vercel shows the record to
   create; for this project it is a project-specific CNAME, not `cname.vercel-dns.com`.
2. Cloudflare DNS for `codesaif.dev` (the zone is in the same Cloudflare account as
   [Tally](https://github.com/beSaif/tally), which gets `tally.codesaif.dev` from a Worker
   route instead):

   | Type | Name | Target | Proxy status | TTL |
   | --- | --- | --- | --- | --- |
   | CNAME | `workout` | `92d2ee0b0bc4b2df.vercel-dns-017.com` | DNS only (grey cloud) | Auto |

   Keep it DNS only: Vercel must receive the traffic directly to issue and renew the
   certificate. `vercel domains verify workout.codesaif.dev --project bench-tracker`
   confirms the setup.
3. Google sign-in: the OAuth client behind `AUTH_GOOGLE_ID` needs, next to the existing
   `*.vercel.app` entries, the authorized redirect URI
   `https://workout.codesaif.dev/api/auth/callback/google` and the authorized JavaScript
   origin `https://workout.codesaif.dev`. The callback of every address the app is served
   from must be listed.
4. Auth.js v5 takes the host from the request and trusts it on Vercel, so `src/auth.ts`
   needs nothing. Leave `AUTH_URL` / `NEXTAUTH_URL` unset (or set to the new address); a
   value pinning the old host would send sign-ins back there.

### Moving to a new address

Everything synced (profile, sessions, blocks, exercises, training days, weights, friends,
coach links) is in KV and follows the account. What belongs to the old origin is the
Home Screen app, its push subscription and its `localStorage`. Each user does this once:

1. Open the old address while online and let the home screen load. Saves that never
   reached the server are marked pending (`lift-tracker-pending-sync`) and re-sent on load.
2. Open `https://workout.codesaif.dev` and sign in with Google.
3. Add it to the Home Screen again (Share → Add to Home Screen on iPhone), then delete
   the old icon.
4. Turn notifications back on in the new app. The server keeps one subscription per user,
   so this replaces the old one and the old install stops receiving reminders.

These device-only settings do not carry over and start from their defaults:

| Key | What resets |
| --- | --- |
| `lift-tracker-draft` | a session in progress that was not finished |
| `lift-tracker-mini-player` | the minimised in-progress session bar |
| `lift-tracker-routine-undo` | the one-week undo of the last applied plan |
| `lift-tracker-dot` | Dot switched off (comes back on) |
| `lift-tracker-haptics` | haptics switched off (comes back on) |
| `lift-tracker-weigh-in-skipped` | "skip this week" on the weigh-in prompt |
| `lift-tracker-layoff-dismissed` | a dismissed layoff banner |
| `lift-tracker-whats-new-seen` | the "what's new" sheet shows once more |
| `installGuideDismissed` | the install guide shows once more |

The remaining keys (`lift-tracker-sessions`, `-blocks`, `-exercises`, `-profile`,
`-training-days`, `-weights`, `-friends`, `-presences`, `bench_friend_last_active`,
`lift-tracker-exercises-migration`) are caches of server data and refill on first load;
`lift-tracker-pending-onboarding` only lives for the length of a sign-in redirect.
