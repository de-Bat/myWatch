'use client'

import React, { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { InstalledPluginMeta } from '@mywatch/core'
import { usePluginRegistryContext } from '@/plugins/PluginRegistryProvider'
import { OFFICIAL_CATALOG } from '@/plugins/official-catalog'
import { PLUGINS } from '@/plugins/registry'
import { pluginApiUrl } from '@/plugins/plugin-api'

type PluginInventoryRow = {
  id: string
  displayName: string
  description: string
  enabled: boolean
  source: InstalledPluginMeta['source']
  path?: string
  installed: boolean
  hasFailed: boolean
  appearsInAllList: boolean
  appearsInDedicatedList: boolean
  useCustomMediaCard: boolean
  typeBadge: string
  showInListView: boolean
  showInGridView: boolean
}

export function PluginsTab() {
  const { data: session } = useSession()
  const { installedMeta, isLoading, error, failedIds, refresh } = usePluginRegistryContext()

  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [localPath, setLocalPath] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [installingLocal, setInstallingLocal] = useState(false)
  const [showLoadTools, setShowLoadTools] = useState(false)
  const [expandedPluginId, setExpandedPluginId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const token = (session as unknown as { apiToken?: string })?.apiToken ?? ''

  async function togglePlugin(id: string, currentlyEnabled: boolean) {
    await fetch(pluginApiUrl(`/api/user/plugins/${id}`), {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !currentlyEnabled }),
    })
    refresh()
  }

  async function removePlugin(id: string, displayName: string) {
    if (!confirm(`Remove plugin "${displayName}"? Playlists using it will stop working.`)) return
    await fetch(pluginApiUrl(`/api/user/plugins/${id}`), {
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
      const res = await fetch(pluginApiUrl('/api/user/plugins/upload'), {
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
      const res = await fetch(pluginApiUrl('/api/user/plugins/local'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
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
  const catalogById = new Map(OFFICIAL_CATALOG.map((entry) => [entry.id, entry]))
  const registryById = new Map(PLUGINS.map((plugin) => [plugin.id, plugin]))
  const rows: PluginInventoryRow[] = [
    ...installedMeta.map((plugin) => {
      const catalogEntry = catalogById.get(plugin.id)
      return {
        id: plugin.id,
        displayName: plugin.displayName,
        description: catalogEntry?.description ?? 'Loaded plugin bundle.',
        enabled: plugin.enabled,
        source: plugin.source,
        path: plugin.path,
        installed: true,
        hasFailed: failedIds.has(plugin.id),
        appearsInAllList: plugin.appearsInAllList ?? catalogEntry?.appearsInAllList ?? false,
        appearsInDedicatedList: plugin.appearsInDedicatedList ?? catalogEntry?.appearsInDedicatedList ?? true,
        useCustomMediaCard: plugin.useCustomMediaCard ?? catalogEntry?.useCustomMediaCard ?? false,
        typeBadge: plugin.typeBadge ?? catalogEntry?.typeBadge ?? 'List',
        showInListView: plugin.showInListView ?? catalogEntry?.showInListView ?? true,
        showInGridView: plugin.showInGridView ?? catalogEntry?.showInGridView ?? true,
      }
    }),
    ...OFFICIAL_CATALOG.filter((entry) => !installedIds.has(entry.id)).map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      description: entry.description,
      enabled: false,
      source: 'builtin' as const,
      installed: false,
      hasFailed: false,
      appearsInAllList: entry.appearsInAllList ?? false,
      appearsInDedicatedList: entry.appearsInDedicatedList ?? true,
      useCustomMediaCard: entry.useCustomMediaCard ?? false,
      typeBadge: entry.typeBadge ?? 'List',
      showInListView: entry.showInListView ?? true,
      showInGridView: entry.showInGridView ?? true,
    })),
  ]

  if (isLoading) {
    return <div className="px-4 py-6 text-[var(--text-13)]" style={{ color: 'var(--muted2)' }}>Loading plugins...</div>
  }

  return (
    <div className="space-y-6 pb-8">
      {error && (
        <div className="px-4 py-3 text-sm" style={{ color: 'var(--red)' }}>{error}</div>
      )}

      <section className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}>
        <div className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}>
          <h3 className="text-[var(--text-11)] font-extrabold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
            All Plugins
          </h3>
          <button
            type="button"
            onClick={() => setShowLoadTools((value) => !value)}
            className="rounded-[6px] px-3 py-1.5 text-[var(--text-12)] font-semibold cursor-pointer border transition-colors hover:bg-[var(--surface)]"
            style={{
              borderColor: 'var(--border)',
              background: showLoadTools ? 'var(--surface)' : 'transparent',
              color: 'var(--accent2)',
            }}
          >
            Load Plugin
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-4 text-[var(--text-13)] text-center" style={{ color: 'var(--muted2)' }}>
            No plugins found.
          </div>
        ) : (
          <div>
             <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border2)', background: 'rgba(255,255,255,0.01)' }}>
                  <th className="w-[32%] md:w-[18%] px-2 sm:px-4 py-2 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Name</th>
                  <th className="hidden md:table-cell md:w-[24%] px-2 sm:px-4 py-2 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Description</th>
                  <th className="w-[19%] md:w-[14%] px-2 sm:px-4 py-2 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Status</th>
                  <th className="w-[12%] md:w-[12%] px-2 sm:px-4 py-2 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Type</th>
                  <th className="w-[19%] md:w-[16%] px-2 sm:px-4 py-2 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>Source</th>
                  <th className="w-[18%] md:w-[16%] px-2 sm:px-4 py-2 text-[var(--text-10)] font-bold tracking-[0.08em] uppercase text-right" style={{ color: 'var(--muted2)' }}>Operation</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border2)' }}>
                {rows.map((plugin) => {
                  const isExpanded = expandedPluginId === plugin.id
                  return (
                    <React.Fragment key={plugin.id}>
                      <tr
                        onClick={() => setExpandedPluginId(isExpanded ? null : plugin.id)}
                        className="transition-colors duration-[100ms] hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
                      >
                        <td className="px-2 sm:px-4 py-2">
                          <div className="min-w-0">
                            <p className="text-[var(--text-13h)] font-semibold break-words" style={{ color: 'var(--fg)' }}>
                              {plugin.displayName}
                            </p>
                            <p className="text-[var(--text-10)] text-xs font-mono" style={{ color: 'var(--muted2)', marginTop: '2px' }}>
                              id: {plugin.id}
                            </p>
                            <p className="text-[var(--text-10)] text-xs break-words mt-1 block md:hidden" style={{ color: 'var(--muted2)', lineHeight: 1.3 }}>
                              {plugin.description}
                            </p>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-2 sm:px-4 py-2 align-middle">
                          <p className="text-[var(--text-10)] text-xs break-words line-clamp-2" title={plugin.description} style={{ color: 'var(--muted2)', lineHeight: 1.3 }}>
                            {plugin.description}
                          </p>
                        </td>
                        <td className="px-2 sm:px-4 py-2 align-middle">
                          <PluginStatusBadge enabled={plugin.enabled} installed={plugin.installed} hasFailed={plugin.hasFailed} />
                        </td>
                        <td className="px-2 sm:px-4 py-2 align-middle">
                          <PluginTypeBadge typeBadge={plugin.typeBadge} />
                        </td>
                        <td className="px-2 sm:px-4 py-2 align-middle">
                          <PluginSourceBadge source={plugin.source} />
                        </td>
                        <td className="px-2 sm:px-4 py-2 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
                            {plugin.hasFailed ? (
                              <button
                                onClick={refresh}
                                aria-label={`Retry ${plugin.displayName}`}
                                className="rounded-[6px] px-1.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[12px] font-semibold cursor-pointer border transition-colors hover:bg-[var(--surface2)]"
                                style={{ borderColor: 'var(--border)', background: 'transparent', color: 'var(--accent2)' }}
                              >
                                Retry
                              </button>
                            ) : (
                              <button
                                onClick={() => togglePlugin(plugin.id, plugin.enabled)}
                                aria-label={`${plugin.enabled ? 'Disable' : plugin.installed ? 'Start' : 'Load'} ${plugin.displayName}`}
                                className="rounded-[6px] px-1.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[12px] font-semibold cursor-pointer border transition-colors hover:bg-[var(--surface2)]"
                                style={{
                                  borderColor: 'var(--border)',
                                  background: plugin.enabled ? 'transparent' : 'var(--accent)',
                                  color: plugin.enabled ? 'var(--fg)' : '#fff',
                                }}
                              >
                                {plugin.enabled ? 'Disable' : plugin.installed ? 'Start' : 'Load'}
                              </button>
                            )}
                            {plugin.installed && plugin.source !== 'builtin' && (
                              <button
                                onClick={() => removePlugin(plugin.id, plugin.displayName)}
                                className="text-[10px] sm:text-[12px] font-semibold transition-colors duration-100 p-1 rounded cursor-pointer border-none bg-transparent hover:opacity-80"
                                style={{ color: 'var(--red)' }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
                          <td colSpan={6} className="px-4 py-4" style={{ borderTop: '1px solid var(--border2)' }}>
                            <PluginPropertiesPanel plugin={plugin} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showLoadTools && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  {installingLocal ? 'Loading...' : 'Load Local Folder'}
                </button>
                {localError && (
                  <p className="text-[var(--text-12)] text-center" style={{ color: 'var(--red)' }}>{localError}</p>
                )}
              </div>
            </form>
          </section>

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
                  {uploading ? 'Uploading...' : 'Upload .zip file'}
                </button>
                {uploadError && (
                  <p className="text-[var(--text-12)] text-center" style={{ color: 'var(--red)' }}>{uploadError}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function PluginTypeBadge({ typeBadge }: { typeBadge: string }) {
  return (
    <span
      className="text-[9px] sm:text-[10px] font-bold uppercase tracking-normal sm:tracking-[0.06em] px-1 sm:px-[7px] py-[2px] sm:py-[2.5px] rounded-[4px] inline-block whitespace-nowrap"
      style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--indigo, #818cf8)', border: '1px solid rgba(99,102,241,0.22)' }}
    >
      {typeBadge}
    </span>
  )
}

function PropRow({ label, value }: { label: string; value: boolean | string }) {
  const isBool = typeof value === 'boolean'
  return (
    <div className="flex items-center justify-between gap-4 py-[5px]" style={{ borderBottom: '1px solid var(--border2)' }}>
      <span className="text-[var(--text-11)] font-medium" style={{ color: 'var(--muted)' }}>{label}</span>
      {isBool ? (
        <span
          className="text-[9px] font-bold uppercase tracking-[0.06em] px-[6px] py-[2px] rounded-[4px]"
          style={{
            background: value ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
            color: value ? 'var(--accent2)' : 'var(--muted2)',
            border: `1px solid ${value ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {value ? 'Yes' : 'No'}
        </span>
      ) : (
        <span className="text-[var(--text-12)] font-semibold" style={{ color: 'var(--fg)' }}>{value}</span>
      )}
    </div>
  )
}

function PluginPropertiesPanel({ plugin }: { plugin: PluginInventoryRow }) {
  return (
    <div>
      <p className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--muted2)' }}>
        Plugin Properties
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 max-w-2xl">
        <PropRow label="Type Badge" value={plugin.typeBadge} />
        <PropRow label="Appears in All List" value={plugin.appearsInAllList} />
        <PropRow label="Appears in Dedicated List" value={plugin.appearsInDedicatedList} />
        <PropRow label="Use Custom Media Card" value={plugin.useCustomMediaCard} />
        <PropRow label="Show in List View" value={plugin.showInListView} />
        <PropRow label="Show in Grid View" value={plugin.showInGridView} />
      </div>
    </div>
  )
}

function PluginStatusBadge({ enabled, installed, hasFailed }: { enabled: boolean; installed: boolean; hasFailed: boolean }) {
  let label = 'Not loaded'
  let color = 'var(--muted2)'
  let bg = 'rgba(255, 255, 255, 0.05)'

  if (hasFailed) {
    label = 'Load error'
    color = 'var(--red)'
    bg = 'rgba(239, 68, 68, 0.12)'
  } else if (enabled) {
    label = 'Enabled'
    color = 'var(--accent2)'
    bg = 'rgba(16, 185, 129, 0.15)'
  } else if (installed) {
    label = 'Disabled'
    color = 'var(--orange)'
    bg = 'rgba(251, 146, 60, 0.15)'
  }

  return (
    <span
      className="text-[9px] sm:text-[10px] font-bold uppercase tracking-normal sm:tracking-[0.06em] px-1 sm:px-[7px] py-[2px] sm:py-[2.5px] rounded-[4px] inline-block whitespace-nowrap"
      style={{ background: bg, color, border: `1px solid ${color}22` }}
    >
      {label}
    </span>
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
    label = 'Filesystem'
    color = 'var(--accent2)'
    bg = 'rgba(16, 185, 129, 0.15)'
  }

  return (
    <span
      className="text-[9px] sm:text-[10px] font-bold uppercase tracking-normal sm:tracking-[0.06em] px-1 sm:px-[7px] py-[2px] sm:py-[2.5px] rounded-[4px] inline-block whitespace-nowrap"
      style={{ background: bg, color, border: `1px solid ${color}22` }}
    >
      {label}
    </span>
  )
}
