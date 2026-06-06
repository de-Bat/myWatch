import type { User, WatchlistItem, JellyfinProgress, ProgressRecap, Playlist, PlaylistItem } from '@mywatch/core'

// Server-side (Auth.js callbacks, API routes): use INTERNAL_API_URL so the
// Next.js container reaches the API container via Docker's internal network.
// Client-side (browser fetch): NEXT_PUBLIC_API_URL points to the host port.
const API_URL =
  typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const { token, headers: extraHeaders, ...rest } = options ?? {}
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders as Record<string, string> | undefined),
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const apiClient = {
  auth: {
    register(body: { email: string; password: string; displayName: string }) {
      return apiFetch<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    login(body: { email: string; password: string }) {
      return apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    me(token: string) {
      return apiFetch<{ user: User }>('/auth/me', { token })
    },
    oauthGoogle(idToken: string) {
      return apiFetch<{ token: string; user: User }>('/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      })
    },
    oauthApple(identityToken: string, fullName?: { firstName?: string; lastName?: string }) {
      return apiFetch<{ token: string; user: User }>('/auth/oauth/apple', {
        method: 'POST',
        body: JSON.stringify({ identityToken, ...(fullName ? { fullName } : {}) }),
      })
    },
    forgotPassword(email: string) {
      return apiFetch<{ resetUrl: string | null }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    },
    resetPassword(token: string, newPassword: string) {
      return apiFetch<{ ok: boolean }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
    },
  },
  sync: {
    push(items: WatchlistItem[], playlists: Playlist[], playlistItems: PlaylistItem[], token: string, connId?: string) {
      return apiFetch<{ pushedAt: string }>('/sync/push', {
        method: 'POST',
        body: JSON.stringify({ items, playlists, playlistItems }),
        token,
        headers: connId ? { 'X-Conn-Id': connId } : undefined,
      })
    },
    pull(since: string, token: string) {
      return apiFetch<{
        items: WatchlistItem[]
        playlists: Playlist[]
        playlistItems: PlaylistItem[]
        jellyfinProgress?: JellyfinProgress[]
        progressRecaps?: ProgressRecap[]
        pulledAt: string
      }>(
        `/sync/pull?since=${encodeURIComponent(since)}`,
        { token },
      )
    },
  },
}
