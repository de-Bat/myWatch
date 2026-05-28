import { describe, it, expect, afterAll } from 'vitest'
import { createApp } from '../src/app.js'

describe('GET /health', () => {
  const appPromise = createApp()

  afterAll(async () => {
    const app = await appPromise
    await app.close()
  })

  it('returns 200 ok', async () => {
    const app = await appPromise
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
