import { sql } from './db/client.js'
import { createUserRepo } from './repos/user-repo.js'
import { createWatchlistRepo } from './repos/watchlist-repo.js'
import { createApp } from './app.js'

const app = await createApp({
  userRepo: createUserRepo(sql),
  watchlistRepo: createWatchlistRepo(sql),
})

const port = parseInt(process.env.PORT ?? '3001', 10)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API listening on http://0.0.0.0:${port}`)
