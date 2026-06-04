'use client'
import { useState } from 'react'
import type { SmartRules, WatchStatus, MediaType } from '@mywatch/core'
import { useUpsertPlaylist } from '@/hooks/usePlaylists'
import { usePlugins } from '@/plugins'

interface Props {
  onClose: () => void
  onCreated?: (id: string) => void
}

const WATCH_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'Watching' },
  { value: 'watched', label: 'Watched' },
  { value: 'quit', label: 'Quit' },
]

export function CreatePlaylistModal({ onClose, onCreated }: Props) {
  const upsert = useUpsertPlaylist()

  const plugins = usePlugins()
  const pluginListTypes = plugins.flatMap((p) => p.listTypes ?? [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<string>('manual')
  const [statuses, setStatuses] = useState<WatchStatus[]>([])
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>([])
  const [minRating, setMinRating] = useState<string>('')
  const [saving, setSaving] = useState(false)

  function toggleStatus(s: WatchStatus) {
    setStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  function toggleMediaType(t: MediaType) {
    setMediaTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])
  }

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    const smartRules: SmartRules | null =
      type === 'smart'
        ? {
            statuses: statuses.length ? statuses : undefined,
            mediaTypes: mediaTypes.length ? mediaTypes : undefined,
            minRating: minRating ? parseInt(minRating) : undefined,
          }
        : null

    const playlist = await upsert({
      userId: '',
      name: name.trim(),
      description: description.trim() || null,
      type,
      smartRules,
      sortOrder: Date.now(),
    })
    setSaving(false)
    onCreated?.(playlist.id)
    onClose()
  }

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
          <h2 className="text-[var(--text-15)] font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            New Playlist
          </h2>
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
              placeholder="Weekend movies…"
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

          {/* Type toggle */}
          <div className="space-y-2">
            <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              Type
            </label>
            <div className="flex flex-wrap gap-[5px]">
              {[
                { id: 'manual', label: 'Manual' },
                { id: 'smart', label: 'Smart (auto)' },
                ...pluginListTypes.map((lt) => ({ id: lt.id, label: lt.label })),
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className="px-[9px] py-[4px] rounded-full text-[var(--text-11)] font-medium transition-all duration-100 cursor-pointer border"
                  style={{
                    background: type === t.id ? 'var(--accent-bg)' : 'transparent',
                    color: type === t.id ? 'var(--accent2)' : 'var(--muted)',
                    borderColor: type === t.id ? 'var(--accent)' : 'var(--border2)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>
              {type === 'manual'
                ? 'Add items manually. Drag to reorder.'
                : type === 'smart'
                ? 'Items auto-populate based on rules below.'
                : `Plugin-managed list (${pluginListTypes.find((lt) => lt.id === type)?.label ?? type}).`}
            </p>
          </div>

          {/* Smart rules */}
          {type === 'smart' && (
            <div className="space-y-3">
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
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border-none disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Creating…' : 'Create Playlist'}
          </button>
        </div>
      </div>
    </div>
  )
}
