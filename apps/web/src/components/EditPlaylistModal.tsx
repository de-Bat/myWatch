'use client'
import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Playlist, SmartRules, WatchStatus, MediaType, WatchlistItem, MediaCache } from '@mywatch/core'
import { useUpdatePlaylist, usePlaylistContentsEditor, useDeletePlaylist, ALL_LIST_UUID, MAIN_LIST_UUID } from '@/hooks/usePlaylists'
import { usePlugins } from '@/plugins'
import { db } from '@/lib/db'

interface Props {
  playlist: Playlist
  onClose: () => void
}

const WATCH_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'Watching' },
  { value: 'watched', label: 'Watched' },
  { value: 'quit', label: 'Quit' },
]

export function EditPlaylistModal({ playlist, onClose }: Props) {
  const updatePlaylist = useUpdatePlaylist()
  const editContents = usePlaylistContentsEditor(playlist.id)
  const deletePlaylist = useDeletePlaylist()

  const isSystemList = playlist.id === ALL_LIST_UUID || playlist.id === MAIN_LIST_UUID

  // Standard states
  const [name, setName] = useState(playlist.name)
  const [description, setDescription] = useState(playlist.description ?? '')
  const [isDefault, setIsDefault] = useState(!!playlist.isDefault)
  const [type, setType] = useState<string>(playlist.type)
  const [visibility, setVisibility] = useState<'public' | 'private'>(playlist.visibility ?? 'public')

  // Smart rules states
  const [statuses, setStatuses] = useState<WatchStatus[]>(playlist.smartRules?.statuses ?? [])
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(playlist.smartRules?.mediaTypes ?? [])
  const [minRating, setMinRating] = useState<string>(playlist.smartRules?.minRating?.toString() ?? '')

  // Manual contents states
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [contentsSearch, setContentsSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const plugins = usePlugins()
  const pluginListTypes = plugins.flatMap((p) => p.listTypes ?? [])
  const isPluginType = !['manual', 'smart'].includes(type)
  const pluginTypeLabel = pluginListTypes.find((lt) => lt.id === type)?.label ?? type

  // Fetch all watchlist items + media cache for checklist
  const allWatchlistItems = useLiveQuery(() => db.watchlistItems.filter(i => i.deletedAt === null).toArray()) ?? []
  
  // Fetch media caches for titles
  const mediaCaches = useLiveQuery(async () => {
    if (allWatchlistItems.length === 0) return new Map<string, MediaCache>()
    const keys = allWatchlistItems.map(i => [i.tmdbId, i.mediaType] as [number, string])
    const entries = await db.mediaCache.bulkGet(keys)
    const map = new Map<string, MediaCache>()
    allWatchlistItems.forEach((item, idx) => {
      const entry = entries[idx]
      if (entry) map.set(`${item.tmdbId}-${item.mediaType}`, entry)
    })
    return map
  }, [allWatchlistItems]) ?? new Map<string, MediaCache>()

  // Load existing manual playlist items
  useEffect(() => {
    if (playlist.type === 'manual' && !isSystemList) {
      db.playlistItems.where('playlistId').equals(playlist.id).toArray().then(items => {
        setSelectedItems(new Set(items.map(i => `${i.tmdbId}-${i.mediaType}`)))
      })
    }
  }, [playlist.id, playlist.type, isSystemList])

  function toggleStatus(s: WatchStatus) {
    setStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function toggleMediaType(t: MediaType) {
    setMediaTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  }

  function toggleItemSelection(tmdbId: number, mediaType: MediaType) {
    const key = `${tmdbId}-${mediaType}`
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)

    try {
      const smartRules: SmartRules | null =
        !isSystemList && type === 'smart'
          ? {
              statuses: statuses.length ? statuses : undefined,
              mediaTypes: mediaTypes.length ? mediaTypes : undefined,
              minRating: minRating ? parseInt(minRating) : undefined,
            }
          : playlist.smartRules

      // Save playlist updates
      await updatePlaylist(playlist.id, {
        name: name.trim(),
        description: description.trim() || null,
        isDefault,
        type: isSystemList ? playlist.type : type,
        smartRules,
        visibility: isSystemList ? 'public' : visibility,
      })

      // Save manual contents updates if applicable
      if (type === 'manual' && !isSystemList) {
        await editContents(selectedItems)
      }

      onClose()
    } catch (err) {
      console.error('Failed to save list', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deletePlaylist(playlist.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete list', err)
      setSaving(false)
    }
  }

  // Filter checklist items by search query
  const filteredChecklistItems = allWatchlistItems.filter(item => {
    const cached = mediaCaches.get(`${item.tmdbId}-${item.mediaType}`)
    const title = cached?.title ?? `#${item.tmdbId}`
    return title.toLowerCase().includes(contentsSearch.toLowerCase())
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-t-[16px] sm:rounded-[12px] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border2)' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[var(--text-15)] font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              Edit List: {playlist.name}
            </h2>
            {playlist.id === MAIN_LIST_UUID && (
              <span
                className="text-[var(--text-9)] font-bold uppercase tracking-[0.05em] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--green)' }}
              >
                Main
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full transition-all duration-100"
            style={{ background: 'var(--surface2)', color: 'var(--muted)', border: 'none', cursor: 'pointer' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name…"
              className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Description (optional)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>

          {/* Is Default Checkbox */}
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="isDefaultCheckbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            <label htmlFor="isDefaultCheckbox" className="text-[var(--text-13)] font-medium cursor-pointer" style={{ color: 'var(--fg2)' }}>
              Set as startup default list
            </label>
          </div>

          {!isSystemList && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border2)', margin: '16px 0' }} />

              {/* Visibility */}
              <div className="space-y-2">
                <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                  Visibility
                </label>
                <div
                  className="flex"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
                >
                  {(['public', 'private'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      className="flex-1 py-[6px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                      style={{
                        background: visibility === v ? 'var(--surface)' : 'transparent',
                        color: visibility === v ? 'var(--fg)' : 'var(--muted)',
                        fontWeight: visibility === v ? 600 : 500,
                      }}
                    >
                      {v === 'public' ? 'Shared' : 'Private'}
                    </button>
                  ))}
                </div>
                <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>
                  {visibility === 'public' ? 'Synced across all your devices.' : 'Stays on this device only.'}
                </p>
              </div>

              {/* Type toggle */}
              <div className="space-y-2">
                <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                  Type
                </label>
                {isPluginType ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="px-[9px] py-[4px] rounded-full text-[var(--text-11)] font-medium border"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent2)', borderColor: 'var(--accent)' }}
                    >
                      {pluginTypeLabel}
                    </span>
                    <span className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>Plugin-managed list</span>
                  </div>
                ) : (
                <div
                  className="flex"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--rsm)',
                    padding: 2,
                    gap: 1,
                  }}
                >
                  {(['manual', 'smart'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className="flex-1 py-[6px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                      style={{
                        background: type === t ? 'var(--surface)' : 'transparent',
                        color: type === t ? 'var(--fg)' : 'var(--muted)',
                        fontWeight: type === t ? 600 : 500,
                      }}
                    >
                      {t === 'manual' ? 'Manual' : 'Smart (auto)'}
                    </button>
                  ))}
                </div>
                )}
              </div>

              {/* Smart rules */}
              {type === 'smart' && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-2">
                    <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                      Status (any of)
                    </label>
                    <div className="flex flex-wrap gap-[5px]">
                      {WATCH_STATUSES.map(({ value, label }) => {
                        const active = statuses.includes(value)
                        return (
                          <button
                            key={value}
                            onClick={() => toggleStatus(value)}
                            className="px-[9px] py-[4px] rounded-full text-[var(--text-11)] font-medium transition-all duration-100 cursor-pointer border"
                            style={{
                              background: active ? 'var(--accent-bg)' : 'transparent',
                              color: active ? 'var(--accent2)' : 'var(--muted)',
                              borderColor: active ? 'var(--accent)' : 'var(--border2)',
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                      Type (any of)
                    </label>
                    <div className="flex gap-[5px]">
                      {(['movie', 'tv'] as const).map((t) => {
                        const active = mediaTypes.includes(t)
                        return (
                          <button
                            key={t}
                            onClick={() => toggleMediaType(t)}
                            className="px-[9px] py-[4px] rounded-full text-[var(--text-11)] font-medium transition-all duration-100 cursor-pointer border"
                            style={{
                              background: active ? 'var(--accent-bg)' : 'transparent',
                              color: active ? 'var(--accent2)' : 'var(--muted)',
                              borderColor: active ? 'var(--accent)' : 'var(--border2)',
                            }}
                          >
                            {t === 'movie' ? 'Movies' : 'TV Shows'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                      Min. rating (1–10)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={minRating}
                      onChange={(e) => setMinRating(e.target.value)}
                      placeholder="Any"
                      className="w-20 px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    />
                  </div>
                </div>
              )}

              {/* Manual checklist contents editor */}
              {type === 'manual' && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                      Edit Contents ({selectedItems.size} selected)
                    </label>
                  </div>
                  
                  {/* Search input for contents */}
                  <input
                    type="text"
                    value={contentsSearch}
                    onChange={(e) => setContentsSearch(e.target.value)}
                    placeholder="Search watchlist items…"
                    className="w-full px-3 py-1.5 rounded-[6px] text-[var(--text-12)] focus:outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  />

                  {/* Checklist items container */}
                  <div 
                    className="border rounded-[8px] overflow-y-auto max-h-[220px]" 
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                  >
                    {filteredChecklistItems.length === 0 ? (
                      <div className="p-4 text-center text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>
                        {allWatchlistItems.length === 0 ? 'Your watchlist is empty' : 'No items match your search'}
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: 'var(--border2)' }}>
                        {filteredChecklistItems.map((item) => {
                          const cached = mediaCaches.get(`${item.tmdbId}-${item.mediaType}`)
                          const title = cached?.title ?? `#${item.tmdbId}`
                          const year = cached?.releaseDate ? ` (${cached.releaseDate.slice(0, 4)})` : ''
                          const key = `${item.tmdbId}-${item.mediaType}`
                          const checked = selectedItems.has(key)

                          return (
                            <label
                              key={key}
                              className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors"
                              style={{ background: checked ? 'var(--accent-bg)' : 'transparent' }}
                              onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = 'var(--surface2)' }}
                              onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleItemSelection(item.tmdbId, item.mediaType)}
                                style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[var(--text-13)] font-medium truncate" style={{ color: 'var(--fg)' }}>
                                  {title}
                                </p>
                                <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>
                                  {item.mediaType.toUpperCase()}{year} · {item.status.replace('_', ' ')}
                                </p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Delete List Button */}
          {!isSystemList && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border2)', margin: '24px 0 16px 0' }} />
              <button
                onClick={() => {
                  if (showConfirmDelete) {
                    void handleDelete()
                  } else {
                    setShowConfirmDelete(true)
                  }
                }}
                disabled={saving}
                className="w-full py-2.5 rounded-[6px] text-[var(--text-13)] font-semibold transition-all duration-100 cursor-pointer border-none disabled:opacity-50"
                style={{ 
                  background: showConfirmDelete ? 'var(--red)' : 'rgba(239, 68, 68, 0.1)', 
                  color: showConfirmDelete ? '#fff' : 'var(--red)' 
                }}
              >
                {showConfirmDelete ? 'Are you sure? Click again to delete' : 'Delete List'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex gap-2"
          style={{ borderTop: '1px solid var(--border2)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border"
            style={{ background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border-none disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
