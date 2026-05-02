import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lift Tracker',
    short_name: 'Lift',
    description: 'Block periodization for your one main lift.',
    start_url: '/',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#f59e0b',
    icons: [
      {
        src: '/apple-icon.png',
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
        purpose: 'any maskable',
      },
    ],
  }
}
