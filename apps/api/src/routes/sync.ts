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

  app.get<{ Querystring: { since?: string } }>(
    '/sync/pull',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { since } = req.query

      if (!since) {
        return reply.status(400).send({ error: 'Missing required query param: since' })
      }

      if (isNaN(Date.parse(since))) {
        return reply.status(400).send({ error: 'Invalid since: must be an ISO 8601 timestamp' })
      }

      const userId = req.user.sub
      const items = await watchlistRepo.findSince(userId, since)
      const pulledAt = new Date().toISOString()

      return reply.send({ items, pulledAt })
    },
  )
}
