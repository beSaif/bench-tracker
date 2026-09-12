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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
