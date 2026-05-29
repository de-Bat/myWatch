import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'myWatch',
  description: 'Your media watchlist',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-900 text-zinc-100 min-h-screen">{children}</body>
    </html>
  )
}
