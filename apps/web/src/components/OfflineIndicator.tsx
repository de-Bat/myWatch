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
        setTimeout(() => setShowReconnected(false), 4000)
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
    <>
      <style>{`
        @keyframes offline-glow {
          0% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes online-glow {
          0% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}</style>

      <div
        className="fixed z-[999] flex items-center gap-3 px-4 py-2.5 rounded-full text-[var(--text-12)] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.5)] border transition-all duration-300 ease-out"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          background: isOffline ? 'rgba(30, 30, 35, 0.85)' : 'rgba(20, 35, 25, 0.85)',
          borderColor: isOffline ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: isOffline ? '#fca5a5' : '#86efac',
        }}
      >
        {/* Pulse Dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: isOffline ? '#ef4444' : '#22c55e',
            animation: isOffline ? 'offline-glow 2s infinite ease-in-out' : 'online-glow 2s infinite ease-in-out',
          }}
        />

        {isOffline ? (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span>📡</span>
            <span>Offline Mode — showing cached data</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span>⚡</span>
            <span>Back Online — syncing watchlist…</span>
          </div>
        )}
      </div>
    </>
  )
}

