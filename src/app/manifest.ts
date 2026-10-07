import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Workout',
    short_name: 'Workout',
    description: 'Block periodization for your one main lift.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Match the app: a white splash, and the accent navy for the system bars.
    background_color: '#ffffff',
    theme_color: '#1e3a5f',
    icons: [
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
