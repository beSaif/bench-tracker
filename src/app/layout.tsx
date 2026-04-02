import type { Metadata } from "next"
import "@fontsource-variable/inter"
import "./globals.css"

export const metadata: Metadata = {
  title: "Bench Tracker",
  description: "Bench press progression tracker — Saif's road to 140kg",
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
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
