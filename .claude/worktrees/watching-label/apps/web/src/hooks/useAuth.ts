// apps/web/src/hooks/useAuth.ts
'use client'
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { authStore, type StoredUser } from '@/lib/auth-store'
import { apiClient } from '@/lib/api-client'

interface AuthState {
  user: StoredUser | null
  token: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  signIn(email: string, password: string): Promise<void>
  signOut(): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, isLoading: true })

  useEffect(() => {
    setState({
      user: authStore.getUser(),
      token: authStore.getToken(),
      isLoading: false,
    })
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user } = await apiClient.auth.login({ email, password })
    const stored: StoredUser = { id: user.id, email: user.email, name: user.displayName ?? null }
    authStore.set(token, stored)
    setState({ user: stored, token, isLoading: false })
  }, [])

  const signOut = useCallback(() => {
    authStore.clear()
    setState({ user: null, token: null, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
