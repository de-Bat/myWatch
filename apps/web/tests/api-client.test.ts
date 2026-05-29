import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { apiClient } from '../src/lib/api-client'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  isGuest: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

beforeEach(() => mockFetch.mockReset())

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) })
}

function mockError(status: number, body = 'Error') {
  mockFetch.mockResolvedValueOnce({ ok: false, status, text: () => Promise.resolve(body) })
}

describe('apiClient.auth', () => {
  it('login returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.login({ email: 'test@example.com', password: 'pass' })
    expect(result.token).toBe('tok')
    expect(result.user.id).toBe('user-1')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/login',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('login throws on 401', async () => {
    mockError(401, 'Invalid credentials')
    await expect(apiClient.auth.login({ email: 'x@x.com', password: 'wrong' })).rejects.toThrow('401')
  })

  it('register returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.register({
      email: 'new@example.com',
      password: 'pass',
      displayName: 'New',
    })
    expect(result.token).toBe('tok')
  })

  it('me returns user with bearer token', async () => {
    mockOk({ user: mockUser })
    const result = await apiClient.auth.me('tok')
    expect(result.user.id).toBe('user-1')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })

  it('oauthGoogle returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.oauthGoogle('google-id-token')
    expect(result.token).toBe('tok')
  })

  it('oauthApple returns token and user', async () => {
    mockOk({ token: 'tok', user: mockUser })
    const result = await apiClient.auth.oauthApple('apple-identity-token')
    expect(result.token).toBe('tok')
  })
})

describe('apiClient.sync', () => {
  it('push sends items with bearer token', async () => {
    mockOk({ pushedAt: '2024-01-01T01:00:00Z' })
    await apiClient.sync.push([] as any, 'tok')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/sync/push',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })

  it('pull fetches items since timestamp', async () => {
    mockOk({ items: [], pulledAt: '2024-01-01T01:00:00Z' })
    const result = await apiClient.sync.pull('2024-01-01T00:00:00Z', 'tok')
    expect(result.items).toEqual([])
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync/pull?since='),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })
})
