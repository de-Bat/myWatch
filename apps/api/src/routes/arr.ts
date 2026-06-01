import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate.js'
import type { createArrService } from '../services/arr-service.js'

export function registerArrRoutes(
  app: FastifyInstance,
  arrService: ReturnType<typeof createArrService>,
) {
  // GET /api/arr/status — Retrieve monitored state and active download queues
  app.get<{ Querystring: { tmdbId: string; mediaType: 'movie' | 'tv' } }>(
    '/api/user/arr/status',
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
    '/api/user/arr/request',
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
          return reply.status(400).send({ error: result.message, message: result.message })
        }
        return reply.send(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[arr-route] Unexpected error in /request:', err)
        return reply.status(500).send({ error: msg, message: msg })
      }
    },
  )

  // POST /api/arr/test — Secure proxy for connection testing
  app.post<{ Body: { type: 'radarr' | 'sonarr'; url: string; apiKey: string } }>(
    '/api/user/arr/test',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['type', 'url', 'apiKey'],
          properties: {
            type: { type: 'string', enum: ['radarr', 'sonarr'] },
            url: { type: 'string' },
            apiKey: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { type, url, apiKey } = req.body
      const userId = req.user.sub

      try {
        const result = await arrService.testConnection(userId, type, url, apiKey)
        if (!result.success) {
          return reply.status(400).send({ error: result.message })
        }
        return reply.send({ success: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: msg })
      }
    },
  )
}
