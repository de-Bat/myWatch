import { createApp } from './app.js'

const app = await createApp()
const port = parseInt(process.env.PORT ?? '3001', 10)

await app.listen({ port, host: '0.0.0.0' })
console.log(`API listening on http://0.0.0.0:${port}`)
