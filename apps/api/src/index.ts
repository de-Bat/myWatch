import { sql } from './db/client.js'
import { createUserRepo } from './repos/user-repo.js'
import { createWatchlistRepo } from './repos/watchlist-repo.js'
import { createPlaylistRepo } from './repos/playlist-repo.js'
import { createJellyfinRepo } from './repos/jellyfin-repo.js'
import { createApp } from './app.js'
import { startJellyfinPoller } from './services/jellyfin-poller.js'

const jellyfinRepo = createJellyfinRepo(sql)

const app = await createApp({
  userRepo: createUserRepo(sql),
  watchlistRepo: createWatchlistRepo(sql),
  playlistRepo: createPlaylistRepo(sql),
  jellyfinRepo,
})

const port = parseInt(process.env.PORT ?? '3001', 10)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API listening on http://0.0.0.0:${port}`)

// Start background poller
startJellyfinPoller(jellyfinRepo)
