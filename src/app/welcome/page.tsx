import Link from "next/link"
import { signIn } from "@/auth"
import PreviewLoginForm from "./PreviewLoginForm"

const isPreview = process.env.VERCEL_ENV !== "production"

export default function WelcomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-full max-w-[360px] flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#aaaaaa] mb-3">
          lift tracker
        </p>
        <h1 className="text-[34px] font-semibold text-[#111111] tracking-tight leading-tight mb-3">
          best workout tracker.
        </h1>
        <p className="text-sm text-[#777777] mb-12 leading-relaxed">
          built around your one main lift. logs the work, plans what's next, and stays out of the way.
        </p>

        <Link
          href="/onboarding"
          className="w-full flex items-center justify-center border border-[#e8e8e8] rounded-xl py-3.5 text-sm font-semibold text-[#111111] hover:bg-[#fafafa] active:bg-[#f5f5f5] transition-colors"
        >
          get started
        </Link>

        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
          className="mt-8"
        >
          <button type="submit" className="text-xs text-[#cccccc] hover:text-[#999999] transition-colors">
            i've done this before
          </button>
        </form>

        {isPreview && <PreviewLoginForm />}
      </div>
    </main>
  )
}
