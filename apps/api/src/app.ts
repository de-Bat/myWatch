import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'
import type { UserRepo } from './repos/user-repo.js'
import type { WatchlistRepo } from './repos/watchlist-repo.js'
import type { PlaylistRepo } from './repos/playlist-repo.js'
import type { JellyfinRepo } from './repos/jellyfin-repo.js'
import type { RecapRepo } from './repos/recap-repo.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerOAuthRoutes } from './routes/oauth.js'
import { registerSyncRoutes } from './routes/sync.js'
import { registerSettingsRoutes } from './routes/settings.js'

export interface AppDeps {
  userRepo?: UserRepo
  watchlistRepo?: WatchlistRepo
  playlistRepo?: PlaylistRepo
  jellyfinRepo?: JellyfinRepo
  recapRepo?: RecapRepo
  triggerBackgroundRecap?: (userId: string, tmdbId: number, mediaType: 'movie' | 'tv') => Promise<void>
}

export async function createApp(deps?: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.get('/health', async () => ({ status: 'ok' }))

  if (deps?.userRepo) {
    registerAuthRoutes(app, deps.userRepo)
    registerOAuthRoutes(app, deps.userRepo)
  }

  if (deps?.watchlistRepo && deps?.playlistRepo && deps?.jellyfinRepo) {
    registerSyncRoutes(
      app,
      deps.watchlistRepo,
      deps.playlistRepo,
      deps.jellyfinRepo,
      deps.recapRepo,
      deps.triggerBackgroundRecap,
    )
    registerSettingsRoutes(app, deps.jellyfinRepo, deps.userRepo)
  }

  return app
}
