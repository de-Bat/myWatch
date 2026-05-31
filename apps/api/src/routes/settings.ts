import type { FastifyInstance } from 'fastify'
import type { JellyfinRepo } from '../repos/jellyfin-repo.js'
import { authenticate } from '../middleware/authenticate.js'
import { fetchJellyfinProgress } from '@mywatch/core'

interface SettingsBody {
  jellyfinUrl?: string
  jellyfinApiKey?: string
  jellyfinUserId?: string
}

export function registerSettingsRoutes(app: FastifyInstance, jellyfinRepo: JellyfinRepo) {
  // GET — return the currently saved Jellyfin credentials for this user
  app.get(
    '/api/user/settings',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const userId = req.user.sub
      const users = await jellyfinRepo.getAllConfiguredUsers()
      const user = users.find(u => u.id === userId)
      return reply.send({
        jellyfinUrl: user?.url ?? '',
        jellyfinApiKey: user?.apiKey ? '••••••••' : '',  // mask key but indicate if set
        jellyfinUserId: user?.jellyfinUserId ?? '',
        hasCredentials: !!user,
      })
    }
  )

  // PUT — save Jellyfin credentials
  app.put<{ Body: SettingsBody }>(
    '/api/user/settings',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { jellyfinUrl = '', jellyfinApiKey = '', jellyfinUserId = '' } = req.body
      const userId = req.user.sub

      await jellyfinRepo.updateUserCredentials(userId, jellyfinUrl, jellyfinApiKey, jellyfinUserId)

      // Trigger an immediate poll for this user right now
      if (jellyfinUrl && jellyfinApiKey && jellyfinUserId) {
        fetchJellyfinProgress(jellyfinUrl, jellyfinApiKey, jellyfinUserId)
          .then(async (progressMap) => {
            const items = Array.from(progressMap.values())
            if (items.length > 0) {
              await jellyfinRepo.upsertProgress(userId, items)
              console.log(`[settings] Immediate Jellyfin poll: ${items.length} records saved for user ${userId}`)
            }
          })
          .catch((err) => console.error('[settings] Immediate Jellyfin poll failed:', err))
      }

      return reply.send({ success: true })
    }
  )

  // POST — trigger an immediate Jellyfin poll for the authenticated user
  app.post(
    '/api/user/jellyfin/poll',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const userId = req.user.sub
      const users = await jellyfinRepo.getAllConfiguredUsers()
      const user = users.find(u => u.id === userId)

      if (!user) {
        return reply.status(400).send({ error: 'Jellyfin not configured. Save credentials first.' })
      }

      try {
        const progressMap = await fetchJellyfinProgress(user.url, user.apiKey, user.jellyfinUserId)
        const items = Array.from(progressMap.values())
        await jellyfinRepo.upsertProgress(userId, items)
        return reply.send({ success: true, count: items.length })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: msg })
      }
    }
  )
}
