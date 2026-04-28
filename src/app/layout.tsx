import type { Metadata, Viewport } from "next"
import "@fontsource-variable/inter"
import "./globals.css"
import SwRegistrar from "@/components/SwRegistrar"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f59e0b",
}

export const metadata: Metadata = {
  title: "Bench Tracker",
  description: "Bench press progression tracker — Saif's road to 140kg",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bench Tracker",
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
      </body>
    </html>
  )
}
