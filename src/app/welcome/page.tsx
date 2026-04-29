import { signIn } from "@/auth"

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

        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
          className="w-full"
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 border border-[#e8e8e8] rounded-xl py-3.5 text-sm font-semibold text-[#111111] hover:bg-[#fafafa] active:bg-[#f5f5f5] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.165 6.656 3.58 9 3.58z"/>
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  )
}
