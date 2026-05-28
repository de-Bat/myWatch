import { describe, it, expect, vi } from 'vitest'
import { createApp } from '../src/app.js'
import type { UserRepo, UserRecord } from '../src/repos/user-repo.js'

vi.mock('../src/utils/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('$hashed$'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}))

const mockUser: UserRecord = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  isGuest: false,
  passwordHash: '$hashed$',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

function makeMockUserRepo(overrides?: Partial<UserRepo>): UserRepo {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(mockUser),
    create: vi.fn().mockResolvedValue(mockUser),
    findOrCreateOAuth: vi.fn().mockResolvedValue(mockUser),
    ...overrides,
  }
}

describe('POST /auth/register', () => {
  it('creates user and returns token + user', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123', displayName: 'Test User' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ token: string; user: { id: string; email: string } }>()
    expect(body.token).toBeDefined()
    expect(body.user.email).toBe('test@example.com')
  })

  it('returns 409 when email already registered', async () => {
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123', displayName: 'Test User' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 for missing fields', async () => {
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /auth/login', () => {
  it('returns token for valid credentials', async () => {
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ token: string; user: { id: string } }>()
    expect(body.token).toBeDefined()
  })

  it('returns 401 for unknown email', async () => {
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(null) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for wrong password', async () => {
    const { verifyPassword } = await import('../src/utils/password.js')
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    const userRepo = makeMockUserRepo({ findByEmail: vi.fn().mockResolvedValue(mockUser) })
    const app = await createApp({ userRepo })
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'wrongpassword' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /auth/me', () => {
  it('returns user for valid JWT', async () => {
    const userRepo = makeMockUserRepo()
    const app = await createApp({ userRepo })
    const token = app.jwt.sign({ sub: mockUser.id, email: mockUser.email, isGuest: false })
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ id: string }>().id).toBe(mockUser.id)
  })

  it('returns 401 without token', async () => {
    const app = await createApp({ userRepo: makeMockUserRepo() })
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})
