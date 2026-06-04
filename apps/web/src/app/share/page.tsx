'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUrlMatchPlugin } from '@/plugins'

function ShareHandlerInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const url = searchParams.get('url') ?? searchParams.get('text') ?? ''
  const title = searchParams.get('title') ?? ''
  const matchedPlugin = useUrlMatchPlugin(url)

  useEffect(() => {
    if (!url && !title) {
      router.replace('/')
      return
    }

    if (url && matchedPlugin) {
      // Plugin handles this URL — redirect home with share params
      const params = new URLSearchParams({
        shareUrl: url,
        pluginListType: matchedPlugin.id,
      })
      router.replace(`/?${params.toString()}`)
    } else {
      // Fallback: existing TMDB share-target page handles title/text search
      const params = new URLSearchParams()
      if (title) params.set('title', title)
      if (url) params.set('text', url)
      router.replace(`/share-target?${params.toString()}`)
    }
  }, [url, matchedPlugin, router, title])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p style={{ color: 'var(--muted)', fontSize: 'var(--text-13)' }}>Opening…</p>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareHandlerInner />
    </Suspense>
  )
}
