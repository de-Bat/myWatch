import type { FastifyInstance } from 'fastify'
import type { JellyfinRepo } from '../repos/jellyfin-repo.js'
import { authenticate } from '../middleware/authenticate.js'

interface SettingsBody {
  jellyfinUrl?: string
  jellyfinApiKey?: string
  jellyfinUserId?: string
}

export function registerSettingsRoutes(app: FastifyInstance, jellyfinRepo: JellyfinRepo) {
  app.put<{ Body: SettingsBody }>(
    '/api/user/settings',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { jellyfinUrl = '', jellyfinApiKey = '', jellyfinUserId = '' } = req.body
      const userId = req.user.sub

      await jellyfinRepo.updateUserCredentials(userId, jellyfinUrl, jellyfinApiKey, jellyfinUserId)

      return reply.send({ success: true })
    }
  )
}
