import { describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app.js'
import type { UserRepo, UserRecord } from '../src/repos/user-repo.js'

const mockUser: UserRecord = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'oauth@example.com',
  displayName: 'OAuth User',
  avatarUrl: 'https://example.com/photo.jpg',
  isGuest: false,
  passwordHash: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-uid-123',
        email: 'oauth@example.com',
        name: 'OAuth User',
        picture: 'https://example.com/photo.jpg',
      }),
    }),
  })),
}))

vi.mock('apple-signin-auth', () => ({
  default: {
    verifyIdToken: vi.fn().mockResolvedValue({
      sub: 'apple-uid-456',
      email: 'oauth@example.com',
    }),
  },
}))

function makeMockUserRepo(): UserRepo {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(mockUser),
    create: vi.fn().mockResolvedValue(mockUser),
    findOrCreateOAuth: vi.fn().mockResolvedValue(mockUser),
  }
}

describe('POST /auth/oauth/google', () => {
  it('verifies Google token and returns JWT', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/google',
      payload: { idToken: 'google-id-token-value' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ token: string; user: { id: string } }>()
    expect(body.token).toBeDefined()
    expect(body.user.id).toBe(mockUser.id)
  })

  it('returns 400 when idToken is missing', async () => {
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/google',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 when Google token is invalid', async () => {
    const { OAuth2Client } = await import('google-auth-library')
    vi.mocked(OAuth2Client).mockImplementationOnce(
      () => ({
        verifyIdToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
      }) as unknown as InstanceType<typeof OAuth2Client>,
    )
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/google',
      payload: { idToken: 'bad-token' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /auth/oauth/apple', () => {
  it('verifies Apple token and returns JWT', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/apple',
      payload: { identityToken: 'apple-id-token-value' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ token: string; user: { id: string } }>()
    expect(body.token).toBeDefined()
  })

  it('returns 401 when Apple token is invalid', async () => {
    const appleSignin = await import('apple-signin-auth')
    vi.mocked(appleSignin.default.verifyIdToken).mockRejectedValueOnce(
      new Error('Invalid token'),
    )
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/apple',
      payload: { identityToken: 'bad-token' },
    })
    expect(res.statusCode).toBe(401)
  })
})
