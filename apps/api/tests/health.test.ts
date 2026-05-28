import { describe, it, expect } from 'vitest'
import { createApp } from '../src/app.js'

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const app = await createApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
