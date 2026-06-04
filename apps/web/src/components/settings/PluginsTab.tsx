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
  const [localPath, setLocalPath] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [installingLocal, setInstallingLocal] = useState(false)
  
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

  async function handleInstallLocal(e: React.FormEvent) {
    e.preventDefault()
    if (!localPath.trim()) return
    setLocalError(null)
    setInstallingLocal(true)
    try {
      const res = await fetch('/api/plugins/local', {
        method: 'POST',
        headers: { 
          authorization: `Bearer ${token}`, 
          'content-type': 'application/json' 
        },
        body: JSON.stringify({ path: localPath.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Installation failed')
      setLocalPath('')
      refresh()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Installation failed')
    } finally {
      setInstallingLocal(false)
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

      {/* Installed plugins table */}
      <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
        <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <h3 className="text-[var(--text-11)] font-extrabold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
            Installed Plugins
          </h3>
        </div>

        {installedMeta.length === 0 ? (
          <div className="px-4 py-4 text-[var(--text-13)] text-center" style={{ color: 'var(--muted2)' }}>
            No plugins installed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: '600px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border2)', background: 'rgba(255,255,255,0.01)' }}>
                  <th className="px-4 py-3 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Plugin</th>
                  <th className="px-4 py-3 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Type</th>
                  <th className="px-4 py-3 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Path / Location</th>
                  <th className="px-4 py-3 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase text-center" style={{ color: 'var(--muted2)', width: '90px' }}>Active</th>
                  <th className="px-4 py-3 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase text-right" style={{ color: 'var(--muted2)', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border2)' }}>
                {installedMeta.map((plugin) => {
                  const hasFailed = failedIds.has(plugin.id)
                  return (
                    <tr 
                      key={plugin.id} 
                      className="transition-colors duration-[100ms] hover:bg-[rgba(255,255,255,0.02)]"
                    >
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="text-[var(--text-13h)] font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                            {plugin.displayName}
                          </p>
                          <p className="text-[var(--text-10)] text-xs font-mono" style={{ color: 'var(--muted2)', marginTop: '2px' }}>
                            id: {plugin.id}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <PluginSourceBadge source={plugin.source} />
                      </td>
                      <td className="px-4 py-3.5 align-middle text-[var(--text-12)]" style={{ color: 'var(--fg2)' }}>
                        {plugin.source === 'filesystem' && plugin.path ? (
                          <span className="font-mono text-xs break-all" title={plugin.path}>
                            {plugin.path}
                          </span>
                        ) : plugin.source === 'custom' ? (
                          <span style={{ color: 'var(--muted2)' }}>Uploaded Bundle</span>
                        ) : (
                          <span style={{ color: 'var(--muted2)' }}>Built-in Package</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-middle text-center">
                        <div className="inline-flex flex-col items-center">
                          <button
                            onClick={() => togglePlugin(plugin.id, plugin.enabled)}
                            aria-label="toggle plugin"
                            className="relative transition-colors duration-150"
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
                          {hasFailed && (
                            <span className="text-[var(--text-9)] font-semibold" style={{ color: 'var(--red)', marginTop: '4px' }}>
                              Load error
                              <button onClick={refresh} className="ml-1 underline border-none bg-transparent p-0 cursor-pointer" style={{ color: 'var(--accent)' }}>
                                Retry
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-right">
                        {plugin.source !== 'builtin' ? (
                          <button
                            onClick={() => removePlugin(plugin.id, plugin.displayName)}
                            className="text-[var(--text-12)] font-semibold transition-colors duration-100 p-1 rounded cursor-pointer border-none bg-transparent hover:opacity-80"
                            style={{ color: 'var(--red)' }}
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Official plugins not yet installed */}
      <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
        <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <h3 className="text-[var(--text-11)] font-extrabold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
            Available Built-ins
          </h3>
        </div>
        {availableOfficial.length === 0 ? (
          <div className="px-4 py-4 text-[var(--text-13)] text-center" style={{ color: 'var(--muted2)' }}>
            No additional built-in plugins available.
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border2)' }}>
            {availableOfficial.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-4 py-3.5 gap-3 transition-colors hover:bg-[rgba(255,255,255,0.01)]">
                <div>
                  <p className="text-[var(--text-13h)] font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.01em' }}>{entry.displayName}</p>
                  <p className="text-[var(--text-12)]" style={{ color: 'var(--muted)', marginTop: '2px' }}>{entry.description}</p>
                </div>
                <button
                  onClick={() => togglePlugin(entry.id, false)}
                  className="rounded px-3 py-1.5 text-[var(--text-12)] font-semibold cursor-pointer border transition-colors hover:bg-[var(--surface2)]"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'transparent',
                    color: 'var(--accent2)',
                  }}
                >
                  Enable
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Installation tools (Custom Upload & Filesystem Local) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Install from Local Filesystem */}
        <section className="rounded-[10px] overflow-hidden flex flex-col" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
            <h3 className="text-[var(--text-11)] font-extrabold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Load from Local Filesystem
            </h3>
          </div>
          <form onSubmit={handleInstallLocal} className="px-4 py-4 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[var(--text-12)]" style={{ color: 'var(--muted)', lineHeight: '1.4' }}>
                Load a local development plugin directly from a folder. The directory must contain a valid <code>manifest.json</code> and a compiled <code>bundle.js</code>.
              </p>
              <div className="space-y-1">
                <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase block" style={{ color: 'var(--muted2)' }}>
                  Folder Directory Path
                </label>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => { setLocalPath(e.target.value); setLocalError(null) }}
                  placeholder="e.g. C:\web.projects\my-plugin"
                  className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="submit"
                disabled={installingLocal || !localPath.trim()}
                className="w-full rounded-[6px] py-2 text-[var(--text-13)] font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  opacity: (installingLocal || !localPath.trim()) ? 0.5 : 1,
                  cursor: (installingLocal || !localPath.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                {installingLocal ? 'Loading…' : 'Load Local Folder'}
              </button>
              {localError && (
                <p className="text-[var(--text-12)] text-center" style={{ color: 'var(--red)' }}>{localError}</p>
              )}
            </div>
          </form>
        </section>

        {/* Upload custom plugin */}
        <section className="rounded-[10px] overflow-hidden flex flex-col" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
          <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
            <h3 className="text-[var(--text-11)] font-extrabold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Upload Custom Plugin Bundle
            </h3>
          </div>
          <div className="px-4 py-4 flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[var(--text-12)]" style={{ color: 'var(--muted)', lineHeight: '1.4' }}>
                Upload a pre-packaged plugin as a <code>.zip</code> file. It must contain a <code>manifest.json</code> and a <code>bundle.js</code> file at its root.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-[6px] py-2 text-[var(--text-13)] font-semibold transition-all cursor-pointer border flex items-center justify-center gap-1.5"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface2)',
                  color: 'var(--fg)',
                  opacity: uploading ? 0.5 : 1,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}
              >
                {uploading ? 'Uploading…' : 'Upload .zip file'}
              </button>
              {uploadError && (
                <p className="text-[var(--text-12)] text-center" style={{ color: 'var(--red)' }}>{uploadError}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function PluginSourceBadge({ source }: { source: InstalledPluginMeta['source'] }) {
  let label = 'Unknown'
  let color = 'var(--muted)'
  let bg = 'rgba(255, 255, 255, 0.05)'

  if (source === 'builtin') {
    label = 'Built-in'
    color = 'var(--purple)'
    bg = 'rgba(168, 85, 247, 0.15)'
  } else if (source === 'custom') {
    label = 'Uploaded'
    color = 'var(--orange)'
    bg = 'rgba(251, 146, 60, 0.15)'
  } else if (source === 'filesystem') {
    label = 'Local Filesystem'
    color = 'var(--accent2)'
    bg = 'rgba(16, 185, 129, 0.15)'
  }

  return (
    <span
      className="text-[var(--text-10)] font-bold uppercase tracking-[0.06em] px-[7px] py-[2.5px] rounded-[4px] inline-block whitespace-nowrap"
      style={{
        background: bg,
        color: color,
        border: `1px solid ${color}22`
      }}
    >
      {label}
    </span>
  )
}
