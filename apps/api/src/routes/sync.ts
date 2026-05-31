import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { WatchlistItem, Playlist, PlaylistItem, JellyfinProgress } from '@mywatch/core'
import type { WatchlistRepo } from '../repos/watchlist-repo.js'
import type { PlaylistRepo } from '../repos/playlist-repo.js'
import type { JellyfinRepo } from '../repos/jellyfin-repo.js'
import { authenticate } from '../middleware/authenticate.js'
import { sseBus } from '../utils/sse-bus.js'

async function authenticateQuery(req: FastifyRequest, reply: FastifyReply) {
  const { token } = req.query as { token?: string }
  if (!token) return reply.status(401).send({ error: 'Unauthorized' })
  try {
    const decoded = await req.server.jwt.verify<{ sub: string; email: string; isGuest: boolean }>(token)
    req.user = decoded
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

interface PushBody {
  items: WatchlistItem[]
  playlists?: Playlist[]
  playlistItems?: PlaylistItem[]
  jellyfinProgress?: JellyfinProgress[]
}

interface PullResponse {
  items: WatchlistItem[]
  playlists: Playlist[]
  playlistItems: PlaylistItem[]
  jellyfinProgress?: JellyfinProgress[]
  pulledAt: string
}

export function registerSyncRoutes(
  app: FastifyInstance,
  watchlistRepo: WatchlistRepo,
  playlistRepo: PlaylistRepo,
  jellyfinRepo: JellyfinRepo,
) {
  app.post<{ Body: PushBody }>(
    '/sync/push',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: { type: 'array' },
            playlists: { type: 'array' },
            playlistItems: { type: 'array' },
          },
        },
      },
    },
    async (req, reply) => {
      const { items, playlists = [], playlistItems = [], jellyfinProgress = [] } = req.body
      const userId = req.user.sub

      const foreign = items.find((item) => item.userId !== userId)
      if (foreign) {
        return reply.status(403).send({ error: 'Cannot push items for another user' })
      }

      const foreignPlaylist = playlists.find((p) => p.userId !== userId)
      if (foreignPlaylist) {
        return reply.status(403).send({ error: 'Cannot push playlists for another user' })
      }

      await watchlistRepo.upsertItems(userId, items)
      await playlistRepo.upsertPlaylists(userId, playlists)
      await playlistRepo.upsertPlaylistItems(playlistItems)
      await jellyfinRepo.upsertProgress(userId, jellyfinProgress)

      const connId = (req.headers['x-conn-id'] as string | undefined) ?? ''
      const pushedAt = new Date().toISOString()
      sseBus.emit(userId, connId, { pushedAt })
      return reply.send({ pushedAt })
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
      const [items, playlists, playlistItems, jellyfinProgress] = await Promise.all([
        watchlistRepo.findSince(userId, since),
        playlistRepo.findPlaylistsSince(userId, since),
        playlistRepo.findPlaylistItemsSince(userId, since),
        jellyfinRepo.findSince(userId, since),
      ])
      const pulledAt = new Date().toISOString()

      return reply.send({ items, playlists, playlistItems, jellyfinProgress, pulledAt } satisfies PullResponse)
    },
  )

  app.get(
    '/sync/events',
    { preHandler: [authenticateQuery] },
    async (req, reply) => {
      const userId = req.user.sub
      const connId = crypto.randomUUID()

      // reply.hijack() bypasses Fastify's CORS plugin — set headers manually
      const origin = req.headers.origin
      if (origin) {
        reply.raw.setHeader('Access-Control-Allow-Origin', origin)
        reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
      }
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.flushHeaders()

      reply.hijack()

      const send = (data: string) => reply.raw.write(data)

      send(`event: connected\ndata: ${JSON.stringify({ connId })}\n\n`)

      let keepalive: ReturnType<typeof setInterval>

      const cleanup = () => {
        clearInterval(keepalive)
        sseBus.unsubscribe(userId, connId)
      }

      req.raw.on('close', cleanup)
      reply.raw.on('error', cleanup)

      sseBus.subscribe(userId, connId, send)

      keepalive = setInterval(() => {
        reply.raw.write(': keepalive\n\n')
      }, 30_000)

      // In inject/test mode the socket is synchronously readable — detect and close immediately.
      // In production (real TCP socket) the response stays open until the client disconnects.
      if (!req.socket || !req.socket.writable) {
        reply.raw.end()
      }
    },
  )
}
