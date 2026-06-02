const TOKEN_KEY = 'mywatch_token'
const USER_KEY = 'mywatch_user'

export interface StoredUser {
  id: string
  email: string
  name: string | null
}

export const authStore = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  },
  getUser(): StoredUser | null {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as StoredUser } catch { return null }
  },
  set(token: string, user: StoredUser): void {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
