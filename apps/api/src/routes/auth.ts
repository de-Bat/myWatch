import type { FastifyInstance } from 'fastify'
import type { UserRepo } from '../repos/user-repo.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { authenticate } from '../middleware/authenticate.js'

interface RegisterBody {
  email: string
  password: string
  displayName: string
}

interface LoginBody {
  email: string
  password: string
}

function signToken(app: FastifyInstance, user: { id: string; email: string | null; isGuest: boolean }) {
  return app.jwt.sign({ sub: user.id, email: user.email, isGuest: user.isGuest })
}

function userResponse(user: { id: string; email: string | null; displayName: string; avatarUrl: string | null; isGuest: boolean; createdAt: string; updatedAt: string }) {
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

export function registerAuthRoutes(app: FastifyInstance, userRepo: UserRepo) {
  app.post<{ Body: RegisterBody }>(
    '/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'displayName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            displayName: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password, displayName } = req.body

      const existing = await userRepo.findByEmail(email)
      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' })
      }

      const passwordHash = await hashPassword(password)
      const user = await userRepo.create({ email, displayName, passwordHash })
      const token = signToken(app, user)

      return reply.status(201).send({ token, user: userResponse(user) })
    },
  )

  app.post<{ Body: LoginBody }>(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body

      const user = await userRepo.findByEmail(email)
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const valid = await verifyPassword(password, user.passwordHash)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' })
      }

      const token = signToken(app, user)
      return reply.send({ token, user: userResponse(user) })
    },
  )

  app.get(
    '/auth/me',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const user = await userRepo.findById(req.user.sub)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }
      return reply.send({ user: userResponse(user) })
    },
  )
}
