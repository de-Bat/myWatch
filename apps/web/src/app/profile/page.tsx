'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSync } from '@/hooks/useSync'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/Toast'
import type { CardMetaSettings, FontFamily, FontSize } from '@/hooks/useSettings'
import { db } from '@/lib/db'

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
        <span className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
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
      <span className="text-[13px]" style={{ color: 'var(--fg2)' }}>{label}</span>
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

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { syncing, lastSyncedAt, error, sync } = useSync()
  const { settings, update, updateCardMeta } = useSettings()
  const { toast } = useToast()
  const [tmdbKeyInput, setTmdbKeyInput] = useState('')

  const pendingCount = useLiveQuery(() => db.pendingPushes.count())
  const itemCount = useLiveQuery(() =>
    db.watchlistItems.filter((i) => i.deletedAt === null).count(),
  )

  useEffect(() => {
    setTmdbKeyInput(settings.tmdbApiKey)
  }, [settings.tmdbApiKey])

  function saveTmdbKey() {
    update({ tmdbApiKey: tmdbKeyInput.trim() })
    toast('API key saved', 'success')
  }

  async function handleClearCache() {
    await db.mediaCache.clear()
    toast('Cache cleared', 'success')
  }

  return (
    <div style={{ maxWidth: 620, width: '100%', padding: '0 0 80px', margin: '0 auto' }}>
      {/* Header */}
      <header
        className="flex items-center gap-[10px]"
        style={{ padding: '18px 20px 14px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 20 }}
      >
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
        <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Settings
        </h1>
      </header>

      <div className="flex flex-col gap-4 px-5">
        {/* Account */}
        <Section title="Account">
          {session ? (
            <>
              <Row label={session.user?.name ?? 'User'}>
                <span className="text-[12px]" style={{ color: 'var(--muted2)' }}>{session.user?.email}</span>
              </Row>
              <div className="px-4 py-3">
                <button
                  onClick={async () => {
                    await signOut({ redirect: false })
                    router.push('/')
                  }}
                  className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none transition-all duration-100"
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
                className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none"
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
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--muted2)' }}>{itemCount ?? '–'}</span>
          </Row>
          <Row label="Pending changes">
            <span className="text-[13px] tabular-nums" style={{ color: 'var(--muted2)' }}>{pendingCount ?? '–'}</span>
          </Row>
          {lastSyncedAt && (
            <Row label="Last synced">
              <span className="text-[12px]" style={{ color: 'var(--muted2)' }}>
                {new Date(lastSyncedAt).toLocaleString()}
              </span>
            </Row>
          )}
          {error && (
            <div className="px-4 py-2 text-[12px]" style={{ color: 'var(--red)' }}>{error}</div>
          )}
          <div className="px-4 py-3">
            {session ? (
              <button
                onClick={() => sync()}
                disabled={syncing}
                className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none disabled:opacity-50 transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--muted2)' }}>Sign in to enable sync.</p>
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
                    className="px-3 py-[4px] text-[12px] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
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
                    className="px-3 py-[4px] text-[12px] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none capitalize"
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
                    className="px-3 py-[4px] text-[12px] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
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
                    className="px-3 py-[4px] text-[12px] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
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
            <p className="text-[12px]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
              Override the server TMDB key. Stored locally, never sent to the server.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tmdbKeyInput}
                onChange={(e) => setTmdbKeyInput(e.target.value)}
                placeholder="Enter API key…"
                className="flex-1 px-3 py-2 rounded-[6px] text-[13px] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTmdbKey() }}
              />
              <button
                onClick={saveTmdbKey}
                className="px-3 py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none flex-shrink-0 transition-all duration-100"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Save
              </button>
            </div>
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
              className="w-full py-2 rounded-[6px] text-[13px] font-medium cursor-pointer border-none transition-all duration-100"
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
