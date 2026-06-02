'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signIn } = useAuth()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signIn(email, password)
      const localCount = await db.watchlistItems.filter((i) => i.deletedAt === null).count()
      router.push(localCount > 0 ? `/?importLocal=1&count=${localCount}` : '/')
    } catch {
      setError('Invalid email or password')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign in to myWatch</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-400">
          No account?{' '}
          <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
