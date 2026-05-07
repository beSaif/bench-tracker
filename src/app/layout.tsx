import type { Metadata, Viewport } from "next"
import "@fontsource-variable/inter"
import "./globals.css"
import SwRegistrar from "@/components/SwRegistrar"
import MiniPlayerBar from "@/components/MiniPlayerBar"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f59e0b",
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
      </head>
      <body className="min-h-dvh antialiased">
        <SwRegistrar />
        {children}
        <MiniPlayerBar />
      </body>
    </html>
  )
}
