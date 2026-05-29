import type { Metadata } from 'next'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'myWatch',
  description: 'Your media watchlist',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-900 text-zinc-100 min-h-screen">
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  )
}
