import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/welcome",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname
      const publicPaths = ["/welcome", "/onboarding"]
      const isPublic = publicPaths.includes(path)
      // The cron route authenticates itself with CRON_SECRET; Vercel calls it without a cookie.
      if (path.startsWith("/api/cron/")) return true
      if (isPublic) {
        if (isLoggedIn && path === "/welcome") return Response.redirect(new URL("/", nextUrl))
        return true
      }
      // API callers expect JSON: a redirect to /welcome would be followed and fail to parse.
      if (!isLoggedIn && path.startsWith("/api/")) {
        return Response.json({ error: "unauthorized" }, { status: 401 })
      }
      return isLoggedIn
    },
  },
})
