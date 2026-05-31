'use client'
import { useEffect } from 'react'
import { useToast } from './Toast'

export function PwaUpdater() {
  const { toast } = useToast()

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let refreshing = false

    function handleControllerChange() {
      // Avoid infinite reload loops
      if (refreshing) return
      refreshing = true

      // The new service worker has taken over. We can safely reload to use the new assets.
      toast('Update available! Reloading app...', 'info', 3000)
      
      // Delay reload slightly to let the user see the toast
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [toast])

  return null
}
