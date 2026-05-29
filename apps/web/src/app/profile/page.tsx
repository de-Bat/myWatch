'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSync } from '@/hooks/useSync'
import { db } from '@/lib/db'

export default function ProfilePage() {
  const { data: session } = useSession()
  const { syncing, lastSyncedAt, error, sync } = useSync()
  const [darkMode, setDarkMode] = useState(true)

  const pendingCount = useLiveQuery(() => db.pendingPushes.count())
  const itemCount = useLiveQuery(() =>
    db.watchlistItems.filter((i) => i.deletedAt === null).count(),
  )

  useEffect(() => {
    const stored = localStorage.getItem('mywatch-dark-mode')
    if (stored !== null) setDarkMode(stored !== 'false')
  }, [])

  function toggleDarkMode() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('mywatch-dark-mode', String(next))
    document.documentElement.classList.toggle('dark', next)
  }

  async function handleClearCache() {
    await db.mediaCache.clear()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">Profile</h1>
      </header>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Account</h2>
        {session ? (
          <>
            <div>
              <p className="font-medium">{session.user?.name}</p>
              <p className="text-sm text-zinc-400">{session.user?.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-sm text-red-400"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="block w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm text-center font-medium"
          >
            Sign In to Sync
          </Link>
        )}
      </section>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Sync</h2>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Items in list</span>
          <span>{itemCount ?? '–'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Pending changes</span>
          <span>{pendingCount ?? '–'}</span>
        </div>
        {lastSyncedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Last synced</span>
            <span>{new Date(lastSyncedAt).toLocaleString()}</span>
          </div>
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {session ? (
          <button
            onClick={() => sync()}
            disabled={syncing}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium"
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        ) : (
          <p className="text-xs text-zinc-500">Sign in to enable sync.</p>
        )}
      </section>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Dark Mode</span>
          <button
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
            className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-zinc-600'}`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${
                darkMode ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      <section className="bg-zinc-800 rounded-xl p-4 space-y-3">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data</h2>
        <button
          onClick={handleClearCache}
          className="w-full py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-sm text-zinc-300"
        >
          Clear Media Cache
        </button>
      </section>
    </div>
  )
}
