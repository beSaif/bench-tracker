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
      if (isPublic) {
        if (isLoggedIn && path === "/welcome") return Response.redirect(new URL("/", nextUrl))
        return true
      }
      return isLoggedIn
    },
  },
})
