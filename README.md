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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Mobile (iOS + Android)

The project ships as a native iOS and Android app via [Capacitor](https://capacitorjs.com). The native shell loads the deployed web app at launch (so NextAuth, Vercel KV, and push routes keep working) and falls back to a bundled offline screen when there's no network.

### One-time setup

1. Deploy the web app and set the URL in `.env` (copy `.env.example`):

   ```bash
   cp .env.example .env
   # edit .env -> CAP_SERVER_URL=https://your-deploy.vercel.app
   ```

2. Install deps and add the native projects (Android requires Android Studio + JDK 17; iOS requires Xcode on macOS):

   ```bash
   npm install
   npm run cap:add:android
   npm run cap:add:ios        # macOS only
   npm run cap:sync
   ```

3. Drop `icon.png` (1024 × 1024) and `splash.png` (2732 × 2732) into `resources/`, then generate every platform size:

   ```bash
   npm run mobile:assets
   npm run cap:sync
   ```

### Day-to-day

```bash
npm run cap:sync             # after any web / config change
npm run cap:open:android     # opens Android Studio
npm run cap:open:ios         # opens Xcode (macOS)
npm run cap:run:android      # build + run on device/emulator
npm run cap:run:ios          # build + run on device/simulator
```

### Bundle / package id

Defaults to `com.besaif.lifttracker`. Override before `cap add` by setting `CAP_APP_ID` in `.env`, or by editing `capacitor.config.ts`. Changing the id after `cap add` requires regenerating the native projects.

### Store submission

- **Android**: open in Android Studio → Build → Generate Signed Bundle → `.aab` → upload via Play Console (one-time $25 fee).
- **iOS**: open in Xcode → Product → Archive → Distribute App → App Store Connect. Needs an Apple Developer account ($99/yr).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
