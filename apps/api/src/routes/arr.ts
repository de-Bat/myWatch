import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import type { createArrService } from '../services/arr-service.js'

export function registerArrRoutes(
  app: FastifyInstance,
  arrService: ReturnType<typeof createArrService>,
) {
  // GET /api/arr/status — Retrieve monitored state and active download queues
  app.get<{ Querystring: { tmdbId: string; mediaType: 'movie' | 'tv' } }>(
    '/api/arr/status',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { tmdbId, mediaType } = req.query
      const userId = req.user.sub

      if (!tmdbId || !mediaType) {
        return reply.status(400).send({ error: 'Missing required query parameters: tmdbId, mediaType' })
      }

      const id = parseInt(tmdbId, 10)
      if (isNaN(id)) {
        return reply.status(400).send({ error: 'Invalid tmdbId parameter' })
      }

      const status = await arrService.getMediaStatus(userId, id, mediaType)
      return reply.send(status)
    },
  )

  // POST /api/arr/request — Post download requests to Radarr or Sonarr
  app.post<{ Body: { tmdbId: number; mediaType: 'movie' | 'tv' } }>(
    '/api/arr/request',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['tmdbId', 'mediaType'],
          properties: {
            tmdbId: { type: 'integer' },
            mediaType: { type: 'string', enum: ['movie', 'tv'] },
          },
        },
      },
    },
    async (req, reply) => {
      const { tmdbId, mediaType } = req.body
      const userId = req.user.sub

      try {
        const result = await arrService.requestDownload(userId, tmdbId, mediaType)
        if (!result.success) {
          return reply.status(400).send({ error: result.message })
        }
        return reply.send(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: msg })
      }
    },
  )
}
