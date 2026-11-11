import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BRINLORE PUNTIQ — Vastgoedbeheer',
  description: 'Slim vastgoedbeheer en betrouwbare WWS-berekeningen. Ruimte voor vandaag. Waarde voor morgen.',
}

export const viewport: Viewport = { themeColor: '#142B3B', width: 'device-width', initialScale: 1 }

// Zet het thema vóór de eerste render om flitsen te voorkomen.
const themeScript = `try{var t=localStorage.getItem('puntiq-theme');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
