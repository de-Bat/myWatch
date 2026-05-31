'use client'
export const dynamic = 'force-static'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSync } from '@/hooks/useSync'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/Toast'
import type { CardMetaSettings, FontFamily, FontSize } from '@/hooks/useSettings'
import { db } from '@/lib/db'
import { apiClient } from '@/lib/api-client'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-[10px] overflow-hidden"
      style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}
    >
      <div
        className="px-4 py-2"
        style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}
      >
        <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
          {title}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border2)' }}>
        {children}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <span className="text-[var(--text-13)]" style={{ color: 'var(--fg2)' }}>{label}</span>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="toggle"
      className="flex-shrink-0 relative transition-colors duration-150"
      style={{
        width: 40,
        height: 22,
        borderRadius: 'var(--pill)',
        background: on ? 'var(--accent)' : 'var(--border)',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        className="absolute top-[2px] transition-transform duration-150"
        style={{
          left: 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          display: 'block',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }}
      />
    </button>
  )
}

const CARD_META_LABELS: Record<keyof CardMetaSettings, string> = {
  showGenres: 'Genres',
  showTmdbRating: 'TMDB Rating',
  showRuntime: 'Runtime',
  showProviders: 'Streaming Providers',
  showOverview: 'Plot Overview',
}

const FONT_OPTIONS: Array<{ value: FontFamily; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
]

const FONT_SIZE_OPTIONS: Array<{ value: FontSize; label: string }> = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
]

const SYNC_INTERVAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0,  label: 'Never' },
  { value: 1,  label: '1 min' },
  { value: 5,  label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { syncing, lastSyncedAt, error, sync } = useSync()
  const { settings, update, updateCardMeta } = useSettings()
  const { toast } = useToast()
  const [tmdbKeyInput, setTmdbKeyInput] = useState('')
  const [jellyfinUrlInput, setJellyfinUrlInput] = useState('')
  const [jellyfinUserIdInput, setJellyfinUserIdInput] = useState('')
  const [jellyfinApiKeyInput, setJellyfinApiKeyInput] = useState('')
  const [jellyfinTestResult, setJellyfinTestResult] = useState<'ok' | 'error' | null>(null)
  const [jellyfinTesting, setJellyfinTesting] = useState(false)
  const [jellyfinPulling, setJellyfinPulling] = useState(false)
  const [jellyfinPullLog, setJellyfinPullLog] = useState<string[]>([])
  const [jellyfinPolling, setJellyfinPolling] = useState(false)
  const [serverCredsStatus, setServerCredsStatus] = useState<'unknown' | 'set' | 'missing'>('unknown')

  const pendingCount = useLiveQuery(() => db.pendingPushes.count())
  const itemCount = useLiveQuery(() =>
    db.watchlistItems.filter((i) => i.deletedAt === null).count(),
  )
  const jellyfinProgressCount = useLiveQuery(() => db.jellyfinProgress.count())
  const jellyfinProgressItems = useLiveQuery(() => db.jellyfinProgress.toArray())

  // Check if server has credentials saved
  useEffect(() => {
    if (!session?.apiToken) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/user/settings`, {
      headers: { Authorization: `Bearer ${session.apiToken}` }
    })
      .then(r => r.json())
      .then((data: { hasCredentials?: boolean }) => {
        setServerCredsStatus(data.hasCredentials ? 'set' : 'missing')
      })
      .catch(() => setServerCredsStatus('unknown'))
  }, [session?.apiToken])

  useEffect(() => {
    setTmdbKeyInput(settings.tmdbApiKey)
  }, [settings.tmdbApiKey])

  useEffect(() => {
    setJellyfinUrlInput(settings.jellyfinUrl)
    setJellyfinUserIdInput(settings.jellyfinUserId)
    setJellyfinApiKeyInput(settings.jellyfinApiKey)
  }, [settings.jellyfinUrl, settings.jellyfinUserId, settings.jellyfinApiKey])

  function saveTmdbKey() {
    update({ tmdbApiKey: tmdbKeyInput.trim() })
    toast('API key saved', 'success')
  }

  async function saveJellyfin() {
    const url = jellyfinUrlInput.trim()
    const userId = jellyfinUserIdInput.trim()
    const apiKey = jellyfinApiKeyInput.trim()

    update({ jellyfinUrl: url, jellyfinUserId: userId, jellyfinApiKey: apiKey })

    setJellyfinPullLog([`⏳ Saving to server... (url="${url}", userId="${userId}", apiKey="${apiKey ? '****' : 'EMPTY'}")`])

    if (!session?.apiToken) {
      setJellyfinPullLog(prev => [...prev, '❌ Not logged in — cannot save to server'])
      toast('Saved locally only (not logged in)', 'error')
      return
    }

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      setJellyfinPullLog(prev => [...prev, `🌐 API base: ${apiBase}`])
      const res = await fetch(`${apiBase}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.apiToken}` },
        body: JSON.stringify({ jellyfinUrl: url, jellyfinUserId: userId, jellyfinApiKey: apiKey }),
      })
      const text = await res.text()
      if (!res.ok) {
        setJellyfinPullLog(prev => [...prev, `❌ Server responded ${res.status}: ${text}`])
        toast('Failed to save to server — check debug log', 'error')
      } else {
        setJellyfinPullLog(prev => [...prev, `✅ Saved to server (${res.status}): ${text}`, '⏳ Triggering immediate poll...'])
        setServerCredsStatus('set')
        toast('Jellyfin settings saved', 'success')
        // Trigger poll now that creds are saved
        await pollJellyfinNow()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setJellyfinPullLog(prev => [...prev, `❌ Network error: ${msg}`])
      toast('Network error saving Jellyfin settings', 'error')
    }
  }

  async function testJellyfin() {
    const url = jellyfinUrlInput.trim().replace(/\/$/, '')
    const userId = jellyfinUserIdInput.trim()
    const apiKey = jellyfinApiKeyInput.trim()
    if (!url || !userId || !apiKey) return
    setJellyfinTesting(true)
    setJellyfinTestResult(null)
    try {
      const res = await fetch(
        `${url}/Users/${encodeURIComponent(userId)}/Items?Limit=1`,
        { headers: { 'X-Emby-Token': apiKey } },
      )
      setJellyfinTestResult(res.ok ? 'ok' : 'error')
    } catch {
      setJellyfinTestResult('error')
    } finally {
      setJellyfinTesting(false)
    }
  }

  async function handleClearCache() {
    await db.mediaCache.clear()
    toast('Cache cleared', 'success')
  }

  const forcePullJellyfin = useCallback(async (append = false) => {
    if (!session?.apiToken) {
      setJellyfinPullLog(['❌ Not logged in — no API token'])
      return
    }
    setJellyfinPulling(true)
    if (!append) setJellyfinPullLog(['⏳ Pulling from server...'])
    else setJellyfinPullLog(prev => [...prev, '⏳ Pulling updated records from server...'])
    try {
      const result = await apiClient.sync.pull(new Date(0).toISOString(), session.apiToken)
      const jpCount = result.jellyfinProgress?.length ?? 0
      const itemsCount = result.items?.length ?? 0
      setJellyfinPullLog(prev => [...prev, `📦 Server returned: ${itemsCount} items, ${jpCount} jellyfin progress records`])
      
      if (jpCount > 0) {
        await db.jellyfinProgress.bulkPut(result.jellyfinProgress!)
        setJellyfinPullLog(prev => [...prev, `✅ Written ${jpCount} records to local DB — progress should now show on cards`])
        const sample = result.jellyfinProgress!.slice(0, 3).map(p => `tmdb:${p.tmdbId} (${p.mediaType}) → ${p.jellyfinStatus}`).join(', ')
        setJellyfinPullLog(prev => [...prev, `📋 Sample: ${sample}`])
      } else {
        setJellyfinPullLog(prev => [...prev, '⚠️ Server returned 0 jellyfin progress records.'])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setJellyfinPullLog(prev => [...prev, `❌ Error: ${msg}`])
    } finally {
      setJellyfinPulling(false)
    }
  }, [session?.apiToken])

  const pollJellyfinNow = useCallback(async () => {
    if (!session?.apiToken) {
      setJellyfinPullLog(['❌ Not logged in'])
      return
    }
    setJellyfinPolling(true)
    setJellyfinPullLog(prev => [...prev, '⏳ Asking server to poll Jellyfin now...'])
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/user/jellyfin/poll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.apiToken}` }
      })
      const data: { success?: boolean; count?: number; error?: string } = await res.json()
      if (!res.ok || data.error) {
        setJellyfinPullLog(prev => [...prev, `❌ Server error: ${data.error ?? res.statusText}`])
      } else {
        setJellyfinPullLog(prev => [...prev, `✅ Server polled Jellyfin: ${data.count} records saved`])
        setServerCredsStatus('set')
        // Now do a local pull to get the fresh data
        await forcePullJellyfin(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setJellyfinPullLog(prev => [...prev, `❌ ${msg}`])
    } finally {
      setJellyfinPolling(false)
    }
  }, [session?.apiToken, forcePullJellyfin])

  return (
    <div className="page-root">
      {/* Header */}
      <header
        className="flex items-center gap-[10px] page-header page-sticky-shell"
      >
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
        <h1 style={{ fontSize: 'var(--text-17)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Settings
        </h1>
      </header>

      <div className="flex flex-col gap-4 content-area">
        {/* Account */}
        <Section title="Account">
          {session ? (
            <>
              <Row label={session.user?.name ?? 'User'}>
                <span className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>{session.user?.email}</span>
              </Row>
              <div className="px-4 py-3">
                <button
                  onClick={async () => {
                    await signOut({ redirect: false })
                    router.push('/')
                  }}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                  style={{ background: 'rgba(248,113,113,.12)', color: 'var(--red)' }}
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3">
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Sign In to Sync
              </button>
            </div>
          )}
        </Section>

        {/* Sync */}
        <Section title="Sync">
          <Row label="Items in list">
            <span className="text-[var(--text-13)] tabular-nums" style={{ color: 'var(--muted2)' }}>{itemCount ?? '–'}</span>
          </Row>
          <Row label="Pending changes">
            <span className="text-[var(--text-13)] tabular-nums" style={{ color: 'var(--muted2)' }}>{pendingCount ?? '–'}</span>
          </Row>
          {lastSyncedAt && (
            <Row label="Last synced">
              <span className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>
                {new Date(lastSyncedAt).toLocaleString()}
              </span>
            </Row>
          )}
          {error && (
            <div className="px-4 py-2 text-[var(--text-12)]" style={{ color: 'var(--red)' }}>{error}</div>
          )}
          <Row label="Auto Sync">
            <div
              className="flex controls-row"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1, flexShrink: 1, minWidth: 0 }}
            >
              {SYNC_INTERVAL_OPTIONS.map((o) => {
                const active = settings.syncInterval === o.value
                return (
                  <button
                    key={o.value}
                    onClick={() => update({ syncInterval: o.value })}
                    className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none whitespace-nowrap"
                    style={{
                      background: active ? 'var(--surface2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--muted)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </Row>
          <div className="px-4 py-3">
            {session ? (
              <button
                onClick={() => sync()}
                disabled={syncing}
                className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none disabled:opacity-50 transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            ) : (
              <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>Sign in to enable sync.</p>
            )}
          </div>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Language">
            <div
              className="flex"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
            >
              {[
                { value: 'en-US', label: 'English' },
                { value: 'he-IL', label: 'Hebrew' },
              ].map((lang) => {
                const active = settings.language === lang.value
                return (
                  <button
                    key={lang.value}
                    onClick={() => update({ language: lang.value })}
                    className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                    style={{
                      background: active ? 'var(--surface2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--muted)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {lang.label}
                  </button>
                )
              })}
            </div>
          </Row>
          <Row label="Theme">
            <div
              className="flex"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
            >
              {(['dark', 'light'] as const).map((t) => {
                const active = settings.theme === t
                return (
                  <button
                    key={t}
                    onClick={() => update({ theme: t })}
                    className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none capitalize"
                    style={{
                      background: active ? 'var(--surface2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--muted)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </Row>
          <Row label="Font">
            <div
              className="flex"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
            >
              {FONT_OPTIONS.map((f) => {
                const active = settings.font === f.value
                return (
                  <button
                    key={f.value}
                    onClick={() => update({ font: f.value })}
                    className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                    style={{
                      background: active ? 'var(--surface2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--muted)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </Row>
          <Row label="Font Size">
            <div
              className="flex"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
            >
              {FONT_SIZE_OPTIONS.map((f) => {
                const active = settings.fontSize === f.value
                return (
                  <button
                    key={f.value}
                    onClick={() => update({ fontSize: f.value })}
                    className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                    style={{
                      background: active ? 'var(--surface2)' : 'transparent',
                      color: active ? 'var(--fg)' : 'var(--muted)',
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </Row>
        </Section>

        {/* TMDB */}
        <Section title="TMDB API">
          <div className="px-4 py-3 space-y-2">
            <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
              Override the server TMDB key. Stored locally, never sent to the server.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tmdbKeyInput}
                onChange={(e) => setTmdbKeyInput(e.target.value)}
                placeholder="Enter API key…"
                className="flex-1 px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTmdbKey() }}
              />
              <button
                onClick={saveTmdbKey}
                className="px-3 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none flex-shrink-0 transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Save
              </button>
            </div>
          </div>
        </Section>

        {/* Jellyfin */}
        <Section title="Jellyfin">
          <div className="px-4 py-3 space-y-3">
            <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
              Connect to your Jellyfin server to overlay watch progress on cards. Requires CORS enabled in Jellyfin → Networking.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={jellyfinUrlInput}
                onChange={(e) => setJellyfinUrlInput(e.target.value)}
                placeholder="Server URL (e.g. http://jellyfin.local:8096)"
                className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <input
                type="text"
                value={jellyfinUserIdInput}
                onChange={(e) => setJellyfinUserIdInput(e.target.value)}
                placeholder="User ID"
                className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <input
                type="password"
                value={jellyfinApiKeyInput}
                onChange={(e) => setJellyfinApiKeyInput(e.target.value)}
                placeholder="API Key"
                className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={testJellyfin}
                disabled={jellyfinTesting || !jellyfinUrlInput || !jellyfinUserIdInput || !jellyfinApiKeyInput}
                className="px-3 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none flex-shrink-0 transition-all duration-100 disabled:opacity-50"
                style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
              >
                {jellyfinTesting ? 'Testing…' : 'Test'}
              </button>
              <button
                onClick={saveJellyfin}
                className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Save
              </button>
            </div>
            {jellyfinTestResult === 'ok' && (
              <p className="text-[var(--text-12)]" style={{ color: 'var(--green)' }}>✓ Connected successfully</p>
            )}
            {jellyfinTestResult === 'error' && (
              <p className="text-[var(--text-12)]" style={{ color: 'var(--red)' }}>Connection failed — check URL, user ID, API key, and CORS settings</p>
            )}
          </div>
        </Section>

        {/* Jellyfin Debug */}
        <Section title="Jellyfin Debug">
          <Row label="Server credentials">
            <span className="text-[var(--text-12)]" style={{ color: serverCredsStatus === 'set' ? 'var(--green)' : serverCredsStatus === 'missing' ? 'var(--red)' : 'var(--muted2)' }}>
              {serverCredsStatus === 'set' ? '✓ Configured' : serverCredsStatus === 'missing' ? '✗ Not set — go save Jellyfin settings above' : '…'}
            </span>
          </Row>
          <Row label="Local progress records">
            <span className="text-[var(--text-13)] tabular-nums" style={{ color: (jellyfinProgressCount ?? 0) > 0 ? 'var(--green)' : 'var(--red)' }}>
              {jellyfinProgressCount ?? 0}
            </span>
          </Row>
          {(jellyfinProgressItems ?? []).slice(0, 5).map(p => (
            <div key={`${p.tmdbId}-${p.mediaType}`} className="px-4 py-1 text-[var(--text-11)] tabular-nums" style={{ color: 'var(--muted2)', fontFamily: 'monospace' }}>
              tmdb:{p.tmdbId} ({p.mediaType}) → <span style={{ color: p.jellyfinStatus === 'watching' ? 'var(--amber)' : p.jellyfinStatus === 'watched' ? 'var(--green)' : 'var(--muted2)' }}>{p.jellyfinStatus}</span>
              {p.season != null && ` S${p.season}·E${p.episode}`}
              {p.totalEpisodes != null && ` ${p.watchedEpisodes ?? 0}/${p.totalEpisodes}ep`}
              {p.moviePercent != null && ` ${p.moviePercent}%`}
            </div>
          ))}
          {(jellyfinProgressCount ?? 0) > 5 && (
            <div className="px-4 py-1 text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>…and {(jellyfinProgressCount ?? 0) - 5} more</div>
          )}
          <div className="px-4 py-3 flex flex-col gap-2">
            <button
              onClick={pollJellyfinNow}
              disabled={jellyfinPolling || jellyfinPulling}
              className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-semibold cursor-pointer border-none disabled:opacity-50 transition-all"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {jellyfinPolling ? 'Polling…' : '▶ Poll Jellyfin Now (Server → Local)'}
            </button>
            <button
              onClick={forcePullJellyfin}
              disabled={jellyfinPulling || jellyfinPolling}
              className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none disabled:opacity-50 transition-all"
              style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
            >
              {jellyfinPulling ? 'Pulling…' : 'Pull from Backend DB Only'}
            </button>
            {jellyfinPullLog.length > 0 && (
              <div className="flex flex-col gap-1 p-2 rounded-[6px]" style={{ background: 'var(--bg)', border: '1px solid var(--border2)' }}>
                {jellyfinPullLog.map((line, i) => (
                  <span key={i} className="text-[var(--text-11)]" style={{ color: 'var(--fg2)', fontFamily: 'monospace' }}>{line}</span>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Card Display */}
        <Section title="Card Display">
          {(Object.keys(CARD_META_LABELS) as Array<keyof CardMetaSettings>).map((key) => (
            <Row key={key} label={CARD_META_LABELS[key]}>
              <Toggle
                on={settings.cardMeta[key]}
                onToggle={() => {
                  updateCardMeta({ [key]: !settings.cardMeta[key] })
                  toast('Saved', 'success', 1500)
                }}
              />
            </Row>
          ))}
        </Section>

        {/* Data */}
        <Section title="Data">
          <div className="px-4 py-3">
            <button
              onClick={handleClearCache}
              className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
              style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
            >
              Clear Media Cache
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
