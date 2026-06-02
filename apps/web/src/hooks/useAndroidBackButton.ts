'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAndroidBackButton() {
  const router = useRouter()

  useEffect(() => {
    let cleanup: (() => void) | undefined

    async function setup() {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            router.back()
          } else {
            App.exitApp()
          }
        })
        cleanup = () => handle.remove()
      } catch {
        // Not in Capacitor environment — no-op
      }
    }

    setup()
    return () => { cleanup?.() }
  }, [router])
}
