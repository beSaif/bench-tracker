import type { Metadata, Viewport } from "next"
import "@fontsource-variable/inter"
import "./globals.css"
import SwRegistrar from "@/components/SwRegistrar"
import MiniPlayerBar from "@/components/MiniPlayerBar"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "Lift Tracker",
  description: "Block periodization for your one main lift.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lift Tracker",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light" />
        <script dangerouslySetInnerHTML={{ __html: `try{screen.orientation.lock('portrait')}catch(_){}` }} />
        {/*
          Chrome fires beforeinstallprompt once, often before React has hydrated, and the
          event is only usable if it was preventDefault()ed. Stash it here so the install
          sheet can fire the real system dialog whenever it opens, however late that is.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__installPrompt=null;" +
              "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;dispatchEvent(new Event('installpromptchange'))});" +
              "addEventListener('appinstalled',function(){window.__installPrompt=null;dispatchEvent(new Event('installpromptchange'))});",
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <SwRegistrar />
        {children}
        <MiniPlayerBar />
      </body>
    </html>
  )
}
