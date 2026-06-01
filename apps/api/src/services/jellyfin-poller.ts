import { fetchJellyfinProgress } from '@mywatch/core'
import type { JellyfinRepo } from '../repos/jellyfin-repo.js'
import { sseBus } from '../utils/sse-bus.js'

export function startJellyfinPoller(
  repo: JellyfinRepo,
  triggerBackgroundRecap?: (userId: string, tmdbId: number, mediaType: 'movie' | 'tv') => Promise<void>,
  intervalMs = 15 * 60 * 1000,
) {
  let active = true

  async function poll() {
    if (!active) return

    try {
      const users = await repo.getAllConfiguredUsers()
      
      for (const user of users) {
        try {
          const progressMap = await fetchJellyfinProgress(user.url, user.apiKey, user.jellyfinUserId)
          const items = Array.from(progressMap.values())
          
          if (items.length > 0) {
            await repo.upsertProgress(user.id, items)
            
            // Broadcast sync event to force clients to pull new jellyfin_progress
            sseBus.emit(user.id, 'jellyfin-poller', { pushedAt: new Date().toISOString() })

            // Trigger background recap checks
            if (triggerBackgroundRecap) {
              for (const item of items) {
                if (item.jellyfinStatus === 'watching' || item.jellyfinStatus === 'watched') {
                  triggerBackgroundRecap(user.id, item.tmdbId, item.mediaType).catch((err) =>
                    console.error('[jellyfin-poller] recap trigger error:', err)
                  )
                }
              }
            }
          }
        } catch (err) {
          console.error(`Failed to poll Jellyfin for user ${user.id}:`, err)
        }
      }
    } catch (err) {
      console.error('Jellyfin poller failed:', err)
    }

    if (active) {
      setTimeout(poll, intervalMs)
    }
  }

  // Start initial poll immediately
  setTimeout(poll, 5000)

  return () => {
    active = false
  }
}
