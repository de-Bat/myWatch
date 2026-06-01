'use client'
import { useEffect, useState, useRef } from 'react'

type ConnectionStatus = 'online' | 'offline' | 'unreachable'

export function OfflineIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('online')
  const [showReconnected, setShowReconnected] = useState(false)
  const [mounted, setMounted] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)

    const checkStatus = async () => {
      if (!navigator.onLine) {
        setStatus('offline')
        return
      }

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 4000)
        
        // Fetch a cache-busted endpoint. If the server is down or returning a 502 Bad Gateway,
        // it will respond with status 502 (>= 500). If the server is up and responsive,
        // it will return a < 500 status (even if it's a 404 for a non-existent API route).
        const res = await fetch(`/api/health?t=${Date.now()}`, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        })
        clearTimeout(timeout)

        if (res.status >= 500) {
          setStatus('unreachable')
        } else {
          setStatus((prev) => {
            if (prev === 'offline' || prev === 'unreachable') {
              // Transitioning from offline/unreachable back to online
              setShowReconnected(true)
              if (timeoutRef.current) clearTimeout(timeoutRef.current)
              timeoutRef.current = setTimeout(() => {
                setShowReconnected(false)
              }, 4000)
            }
            return 'online'
          })
        }
      } catch (err) {
        // If the request fails (network error, DNS failure, etc.), the server is unreachable
        setStatus('unreachable')
      }
    }

    // Run status check initially
    checkStatus()

    const handleOnline = () => {
      checkStatus()
    }

    const handleOffline = () => {
      setStatus('offline')
      setShowReconnected(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodically ping the server every 10 seconds to detect server state changes
    intervalRef.current = setInterval(checkStatus, 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  if (!mounted) return null

  const isOfflineMode = status === 'offline' || status === 'unreachable'
  if (!isOfflineMode && !showReconnected) return null

  const isOffline = status === 'offline'

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
        className="fixed flex items-center gap-3 px-4 py-2.5 rounded-full text-[var(--text-12)] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.5)] border transition-all duration-300 ease-out"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          background: isOfflineMode ? 'rgba(30, 30, 35, 0.85)' : 'rgba(20, 35, 25, 0.85)',
          borderColor: isOfflineMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: isOfflineMode ? '#fca5a5' : '#86efac',
          zIndex: 99999,
        }}
      >
        {/* Pulse Dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: isOfflineMode ? '#ef4444' : '#22c55e',
            animation: isOfflineMode ? 'offline-glow 2s infinite ease-in-out' : 'online-glow 2s infinite ease-in-out',
          }}
        />

        {isOfflineMode ? (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span>📡</span>
            <span>
              {isOffline ? 'Offline Mode — showing cached data' : 'Server Unreachable — showing cached data'}
            </span>
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


