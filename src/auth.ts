import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

const isPreview = process.env.VERCEL_ENV !== "production"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google,
    ...(isPreview
      ? [
          Credentials({
            credentials: { token: { label: "Preview Token", type: "password" } },
            authorize(credentials) {
              const bypassToken = process.env.PREVIEW_BYPASS_TOKEN
              if (bypassToken && credentials?.token === bypassToken) {
                return { id: "preview-user", email: "preview@bench-tracker.local", name: "Preview" }
              }
              return null
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/welcome",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const path = nextUrl.pathname
      const publicPaths = ["/welcome", "/onboarding"]
      const isPublic = publicPaths.includes(path)
      if (isPublic) {
        if (isLoggedIn && path === "/welcome") return Response.redirect(new URL("/", nextUrl))
        return true
      }
      return isLoggedIn
    },
  },
})
