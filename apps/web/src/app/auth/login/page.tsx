'use client'
import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password')
    } else {
      const localCount = await db.watchlistItems.filter((i) => i.deletedAt === null).count()
      router.push(localCount > 0 ? `/?importLocal=1&count=${localCount}` : '/')
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
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 font-medium"
          >
            Continue with Google
          </button>
          <button
            onClick={() => signIn('apple', { callbackUrl: '/' })}
            className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 font-medium"
          >
            Continue with Apple
          </button>
        </div>
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
