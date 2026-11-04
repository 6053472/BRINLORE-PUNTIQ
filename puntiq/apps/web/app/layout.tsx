import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BRINLORE PUNTIQ — Vastgoedbeheer',
  description: 'Slim vastgoedbeheer en betrouwbare WWS-berekeningen.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}</body></html>
}
}
