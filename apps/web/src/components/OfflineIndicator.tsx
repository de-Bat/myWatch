'use client'
import { useEffect, useState } from 'react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)

    const handleOnline = () => {
      setIsOffline(false)
      if (wasOffline) {
        setShowReconnected(true)
        setTimeout(() => setShowReconnected(false), 3000)
      }
      setWasOffline(false)
    }
    const handleOffline = () => {
      setIsOffline(true)
      setWasOffline(true)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  if (!isOffline && !showReconnected) return null

  return (
    <div
      className="fixed left-0 right-0 z-[99] flex items-center justify-center gap-2 px-4 py-2 text-[var(--text-13)] font-semibold text-white shadow-lg"
      style={{
        // Below safe-area on iOS (status bar + notch area)
        top: 'env(safe-area-inset-top, 0px)',
        background: isOffline ? 'rgba(220,38,38,0.95)' : 'rgba(22,163,74,0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'background 0.3s',
      }}
    >
      {isOffline ? (
        <>
          <span>📡</span>
          <span>Offline — showing cached data</span>
        </>
      ) : (
        <>
          <span>✓</span>
          <span>Back online — syncing…</span>
        </>
      )}
    </div>
  )
}
