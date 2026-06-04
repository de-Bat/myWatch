'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { InstalledPluginMeta } from '@mywatch/core'
import { usePluginRegistryContext } from '@/plugins/PluginRegistryProvider'
import { OFFICIAL_CATALOG } from '@/plugins/official-catalog'

export function PluginsTab() {
  const { data: session } = useSession()
  const { installedMeta, isLoading, error, failedIds, refresh } = usePluginRegistryContext()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const token = (session as unknown as { accessToken?: string })?.accessToken ?? ''

  async function togglePlugin(id: string, currentlyEnabled: boolean) {
    await fetch(`/api/plugins/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !currentlyEnabled }),
    })
    refresh()
  }

  async function removePlugin(id: string, displayName: string) {
    if (!confirm(`Remove plugin "${displayName}"? Playlists using it will stop working.`)) return
    await fetch(`/api/plugins/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    refresh()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/plugins/upload', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Upload failed')
      refresh()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const installedIds = new Set(installedMeta.map((m) => m.id))
  const availableOfficial = OFFICIAL_CATALOG.filter((c) => !installedIds.has(c.id))

  if (isLoading) {
    return <div className="px-4 py-6 text-[var(--text-13)]" style={{ color: 'var(--muted2)' }}>Loading plugins…</div>
  }

  return (
    <div className="space-y-6 pb-8">
      {error && (
        <div className="px-4 py-3 text-sm" style={{ color: 'var(--red)' }}>{error}</div>
      )}

      {/* Installed plugins */}
      <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
            Installed
          </span>
        </div>
        {installedMeta.length === 0 ? (
          <div className="px-4 py-3 text-[var(--text-13)]" style={{ color: 'var(--muted2)' }}>
            No plugins installed.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border2)' }}>
            {installedMeta.map((plugin) => (
              <PluginRow
                key={plugin.id}
                plugin={plugin}
                hasFailed={failedIds.has(plugin.id)}
                onToggle={() => togglePlugin(plugin.id, plugin.enabled)}
                onRemove={plugin.source === 'custom' ? () => removePlugin(plugin.id, plugin.displayName) : undefined}
                onRetry={failedIds.has(plugin.id) ? refresh : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Official plugins not yet installed */}
      <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
            Available
          </span>
        </div>
        {availableOfficial.length === 0 ? (
          <div className="px-4 py-3 text-[var(--text-13)]" style={{ color: 'var(--muted2)' }}>
            No additional plugins available yet.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border2)' }}>
            {availableOfficial.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div>
                  <p className="text-[var(--text-13)]">{entry.displayName}</p>
                  <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>{entry.description}</p>
                </div>
                <span className="text-[var(--text-11)] uppercase tracking-wide" style={{ color: 'var(--muted2)' }}>
                  Built-in
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upload custom plugin */}
      <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
            Install Custom Plugin
          </span>
        </div>
        <div className="px-4 py-3 space-y-3">
          <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>
            Upload a compiled plugin <code>.zip</code> containing{' '}
            <code>manifest.json</code> and <code>bundle.js</code>.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded px-3 py-1.5 text-[var(--text-13)]"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            {uploading ? 'Uploading…' : 'Upload .zip'}
          </button>
          {uploadError && (
            <p className="text-[var(--text-12)]" style={{ color: 'var(--red)' }}>{uploadError}</p>
          )}
        </div>
      </section>
    </div>
  )
}

function PluginRow({
  plugin,
  hasFailed,
  onToggle,
  onRemove,
  onRetry,
}: {
  plugin: InstalledPluginMeta
  hasFailed: boolean
  onToggle: () => void
  onRemove?: () => void
  onRetry?: () => void
}) {
  return (
    <li className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="min-w-0">
        <p className="text-[var(--text-13)] truncate">{plugin.displayName}</p>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-10)] uppercase tracking-wide" style={{ color: 'var(--muted2)' }}>
            {plugin.source}
          </span>
          {hasFailed && (
            <span className="text-[var(--text-10)]" style={{ color: 'var(--red)' }}>
              Load error
              {onRetry && (
                <button onClick={onRetry} className="ml-1 underline" style={{ color: 'var(--accent)' }}>
                  Retry
                </button>
              )}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggle}
          aria-label="toggle plugin"
          className="flex-shrink-0 relative transition-colors duration-150"
          style={{
            width: 40,
            height: 22,
            borderRadius: 'var(--pill)',
            background: plugin.enabled ? 'var(--accent)' : 'var(--border)',
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
              transform: plugin.enabled ? 'translateX(18px)' : 'translateX(0)',
              boxShadow: '0 1px 3px rgba(0,0,0,.3)',
            }}
          />
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-[var(--text-12)]"
            style={{ color: 'var(--red)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            Remove
          </button>
        )}
      </div>
    </li>
  )
}
