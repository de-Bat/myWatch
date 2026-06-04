import { useState, useEffect, useRef } from 'react'
import type { AddItemModalProps } from '@mywatch/plugin-sdk'
import { extractVideoId, fetchYouTubeMetadata, buildThumbnailUrl } from './utils'

interface YouTubePreview {
  videoId: string
  title: string
  thumbnail: string
  channelName: string
}

export function AddYouTubeItemModal({ playlistId, prefillUrl, onClose, onAdded }: AddItemModalProps) {
  const [url, setUrl] = useState(prefillUrl ?? '')
  const [preview, setPreview] = useState<YouTubePreview | null>(null)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  // Auto-fetch metadata when prefillUrl is provided
  useEffect(() => {
    if (prefillUrl) void handleFetch(prefillUrl)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFetch(targetUrl = url) {
    const videoId = extractVideoId(targetUrl.trim())
    if (!videoId) {
      setError('Not a valid YouTube URL')
      setPreview(null)
      return
    }
    setError(null)
    setFetching(true)
    const meta = await fetchYouTubeMetadata(targetUrl.trim())
    setFetching(false)
    if (meta) {
      setPreview({ videoId: meta.videoId, title: meta.title, thumbnail: meta.thumbnail, channelName: meta.channelName })
    } else {
      setPreview({
        videoId,
        title: 'YouTube Video',
        thumbnail: buildThumbnailUrl(videoId),
        channelName: '',
      })
    }
  }

  async function handleAdd() {
    if (!preview) return
    setSaving(true)
    const now = new Date().toISOString()
    const item = {
      id: crypto.randomUUID(),
      pluginId: 'youtube',
      listTypeId: 'youtube',
      playlistId,
      data: {
        url: url.trim(),
        videoId: preview.videoId,
        title: preview.title,
        thumbnail: preview.thumbnail,
        channelName: preview.channelName,
        watched: false,
      },
      addedAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    onAdded(item)
    setSaving(false)
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
            Add YouTube Video
          </h2>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full transition-all duration-100 border-none cursor-pointer"
            style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* URL input */}
          <div className="space-y-1">
            <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
              YouTube URL
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setPreview(null); setError(null) }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  setTimeout(() => void handleFetch(pasted), 50)
                }}
                placeholder="https://youtube.com/watch?v=…"
                className="flex-1 px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; void handleFetch() }}
              />
              <button
                onClick={() => void handleFetch()}
                disabled={fetching || !url.trim()}
                className="px-3 py-2 rounded-[6px] text-[var(--text-12)] font-medium border-none cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
              >
                {fetching ? '…' : 'Fetch'}
              </button>
            </div>
            {error && (
              <p className="text-[var(--text-11)]" style={{ color: 'var(--red)' }}>{error}</p>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div
              className="flex gap-3 rounded-[8px] overflow-hidden"
              style={{ background: 'var(--bg)', border: '1px solid var(--border2)', padding: '10px 12px' }}
            >
              <img
                src={preview.thumbnail}
                alt={preview.title}
                style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
              />
              <div className="min-w-0">
                <p
                  className="text-[var(--text-13)] font-medium leading-[1.3]"
                  style={{ color: 'var(--fg)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {preview.title}
                </p>
                {preview.channelName && (
                  <p className="text-[var(--text-11h)] mt-[2px]" style={{ color: 'var(--muted2)' }}>
                    {preview.channelName}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border2)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border"
            style={{ background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!preview || saving}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border-none disabled:opacity-50"
            style={{ background: '#ff0000', color: '#fff' }}
          >
            {saving ? 'Adding…' : 'Add Video'}
          </button>
        </div>
      </div>
    </div>
  )
}
