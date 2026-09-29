"use client"

import { useEffect } from "react"

export default function SwRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Build assets are only content-hashed in production; the dev server reuses
      // chunk URLs, so caching them there would serve stale code.
      const url = process.env.NODE_ENV === "production" ? "/sw.js?static=1" : "/sw.js"
      navigator.serviceWorker.register(url).catch(() => {})
    }
  }, [])
  return null
}
