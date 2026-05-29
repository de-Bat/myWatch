import type { FastifyInstance } from 'fastify'
import type { WatchlistItem } from '@mywatch/core'
import type { WatchlistRepo } from '../repos/watchlist-repo.js'
import { authenticate } from '../middleware/authenticate.js'

export function registerSyncRoutes(app: FastifyInstance, watchlistRepo: WatchlistRepo) {
  app.post<{ Body: { items: WatchlistItem[] } }>(
    '/sync/push',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: { type: 'array' },
          },
        },
      },
    },
    async (req, reply) => {
      const { items } = req.body
      const userId = req.user.sub

      const foreign = items.find((item) => item.userId !== userId)
      if (foreign) {
        return reply.status(403).send({ error: 'Cannot push items for another user' })
      }

      await watchlistRepo.upsertItems(userId, items)
      return reply.send({ pushedAt: new Date().toISOString() })
    },
  )
}
