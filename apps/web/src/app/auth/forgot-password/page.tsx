// apps/web/src/app/auth/forgot-password/page.tsx
'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { resetUrl: url } = await apiClient.auth.forgotPassword(email)
      setResetUrl(url)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!resetUrl) return
    await navigator.clipboard.writeText(window.location.origin + resetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Reset Password</h1>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
            >
              {loading ? 'Generating…' : 'Get Reset Link'}
            </button>
          </form>
        ) : resetUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              Copy this link to reset your password. It expires in 1 hour.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={typeof window !== 'undefined' ? window.location.origin + resetUrl : resetUrl}
                className="flex-1 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded font-medium text-sm flex-shrink-0 transition-colors"
                style={{ background: copied ? 'var(--green)' : 'var(--accent)', color: '#fff' }}
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-zinc-400">
            No account found for that email, or the account uses social login.
          </p>
        )}

        <p className="text-center text-sm text-zinc-400">
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
