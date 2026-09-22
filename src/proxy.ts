import { auth } from "@/auth"

export default auth

export const config = {
  // sw.js is exempt alongside the manifest: the browser fetches both before anyone has
  // signed in, and a redirect to the sign-in page makes the service worker fail to
  // register ("script resource is behind a redirect"), which in turn makes the app
  // uninstallable.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon|icon|sw\\.js|.*\\.png$).*)"],
}
