import type { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import appleSignin from 'apple-signin-auth'
import type { UserRepo } from '../repos/user-repo.js'

function userResponse(user: {
  id: string; email: string | null; displayName: string; avatarUrl: string | null; isGuest: boolean; createdAt: string; updatedAt: string
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isGuest: user.isGuest,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export function registerOAuthRoutes(app: FastifyInstance, userRepo: UserRepo) {
  app.post<{ Body: { idToken: string } }>(
    '/auth/oauth/google',
    {
      schema: {
        body: {
          type: 'object',
          required: ['idToken'],
          properties: { idToken: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const { idToken } = req.body
      try {
        const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
        const client = new OAuth2Client(clientId)
        const ticket = await client.verifyIdToken({ idToken, audience: clientId })
        const payload = ticket.getPayload()
        if (!payload) throw new Error('Empty payload')

        const user = await userRepo.findOrCreateOAuth({
          provider: 'google',
          providerAccountId: payload.sub!,
          email: payload.email ?? null,
          displayName: payload.name ?? payload.email ?? 'Google User',
          avatarUrl: payload.picture ?? null,
        })

        const token = app.jwt.sign({ sub: user.id, email: user.email, isGuest: false })
        return reply.send({ token, user: userResponse(user) })
      } catch {
        return reply.status(401).send({ error: 'Invalid Google token' })
      }
    },
  )

  app.post<{ Body: { identityToken: string; fullName?: { firstName?: string; lastName?: string } } }>(
    '/auth/oauth/apple',
    {
      schema: {
        body: {
          type: 'object',
          required: ['identityToken'],
          properties: {
            identityToken: { type: 'string' },
            fullName: {
              type: 'object',
              properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { identityToken, fullName } = req.body
      try {
        const decodedToken = await appleSignin.verifyIdToken(identityToken, {
          audience: process.env.APPLE_BUNDLE_ID ?? '',
          ignoreExpiration: false,
        })

        const displayName = fullName
          ? [fullName.firstName, fullName.lastName].filter(Boolean).join(' ') || 'Apple User'
          : 'Apple User'

        const user = await userRepo.findOrCreateOAuth({
          provider: 'apple',
          providerAccountId: decodedToken.sub,
          email: decodedToken.email ?? null,
          displayName,
          avatarUrl: null,
        })

        const token = app.jwt.sign({ sub: user.id, email: user.email, isGuest: false })
        return reply.send({ token, user: userResponse(user) })
      } catch {
        return reply.status(401).send({ error: 'Invalid Apple token' })
      }
    },
  )
}
