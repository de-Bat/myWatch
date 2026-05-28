import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'

export interface AppDeps {
  // populated by later tasks
}

export async function createApp(_deps?: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
