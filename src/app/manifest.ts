import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bench Tracker',
    short_name: 'Bench',
    description: "Saif's bench press progression tracker — road to 140kg",
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
    ],
  }
}
