import type { Metadata, Viewport } from 'next'
import { SessionProvider } from 'next-auth/react'
import { SettingsProvider } from '@/hooks/useSettings'
import { ToastProvider } from '@/components/Toast'
import { AutoSync } from '@/components/AutoSync'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { PwaUpdater } from '@/components/PwaUpdater'
import './globals.css'

export const metadata: Metadata = {
  title: 'myWatch',
  description: 'Your media watchlist',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'myWatch',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

// No server-side `auth()` here: keeping the root layout static lets every app
// page be statically prerendered and precached by the service worker, so the
// PWA renders offline. SessionProvider fetches the session client-side when
// online and resolves to null offline (local-first / guest mode).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <SessionProvider>
          <SettingsProvider>
            <ToastProvider>
              <AutoSync />
              <OfflineIndicator />
              <PwaUpdater />
              {children}
            </ToastProvider>
          </SettingsProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
