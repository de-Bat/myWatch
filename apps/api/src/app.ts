import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import type { UserRepo } from './repos/user-repo.js'
import type { WatchlistRepo } from './repos/watchlist-repo.js'
import type { PlaylistRepo } from './repos/playlist-repo.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerOAuthRoutes } from './routes/oauth.js'
import { registerSyncRoutes } from './routes/sync.js'

export interface AppDeps {
  userRepo?: UserRepo
  watchlistRepo?: WatchlistRepo
  playlistRepo?: PlaylistRepo
}

export async function createApp(deps?: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.get('/health', async () => ({ status: 'ok' }))

  if (deps?.userRepo) {
    registerAuthRoutes(app, deps.userRepo)
    registerOAuthRoutes(app, deps.userRepo)
  }

  if (deps?.watchlistRepo && deps?.playlistRepo) {
    registerSyncRoutes(app, deps.watchlistRepo, deps.playlistRepo)
  }

  return app
}
