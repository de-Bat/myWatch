import { sql } from './db/client.js'
import { createUserRepo } from './repos/user-repo.js'
import { createWatchlistRepo } from './repos/watchlist-repo.js'
import { createPlaylistRepo } from './repos/playlist-repo.js'
import { createJellyfinRepo } from './repos/jellyfin-repo.js'
import { createRecapRepo } from './repos/recap-repo.js'
import { createApp } from './app.js'
import { startJellyfinPoller } from './services/jellyfin-poller.js'
import { createArrService } from './services/arr-service.js'
import { createRecapGenerator } from './services/recap-generator.js'

const userRepo = createUserRepo(sql)
const watchlistRepo = createWatchlistRepo(sql)
const playlistRepo = createPlaylistRepo(sql)
const jellyfinRepo = createJellyfinRepo(sql)
const recapRepo = createRecapRepo(sql)

const recapGenerator = createRecapGenerator(sql, userRepo, recapRepo)
const arrService = createArrService(userRepo)

const app = await createApp({
  userRepo,
  watchlistRepo,
  playlistRepo,
  jellyfinRepo,
  recapRepo,
  triggerBackgroundRecap: recapGenerator.triggerBackgroundRecap,
  arrService,
})

const port = parseInt(process.env.PORT ?? '3001', 10)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API listening on http://0.0.0.0:${port}`)

// Start background poller
startJellyfinPoller(jellyfinRepo, recapGenerator.triggerBackgroundRecap)
