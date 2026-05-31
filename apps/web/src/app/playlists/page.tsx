'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlaylists } from '@/hooks/usePlaylists'
import { PlaylistCard } from '@/components/PlaylistCard'
import { CreatePlaylistModal } from '@/components/CreatePlaylistModal'

export default function PlaylistsPage() {
  const playlists = usePlaylists()
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="page-root">
      {/* Header */}
      <header
        className="flex items-center justify-between gap-3 page-header page-sticky-shell"
      >
        <div className="flex items-center gap-[10px] min-w-0">
          <button
            onClick={() => router.push('/')}
            className="flex-shrink-0"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10 4 6 8 10 12" />
            </svg>
          </button>
        <h1
          className="flex items-center gap-[7px]"
          style={{ fontSize: 'var(--text-17)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}
        >
          Playlists
          {playlists && playlists.length > 0 && (
            <span
              className="text-[var(--text-11)] font-semibold tabular-nums"
              style={{
                color: 'var(--muted2)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--pill)',
                padding: '1px 7px',
              }}
            >
              {playlists.length}
            </span>
          )}
        </h1>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-[5px] text-[var(--text-12)] font-semibold cursor-pointer transition-all duration-100"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--rsm)',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
          New Playlist
        </button>
      </header>

      <div className="content-area">
        {playlists === undefined ? (
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-13)' }}>Loading…</p>
        ) : playlists.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-center" style={{ padding: '64px 16px 48px' }}>
            <div
              className="flex items-center justify-center"
              style={{ width: 52, height: 52, borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted2)' }}
            >
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="13" y2="10" />
                <line x1="3" y1="15" x2="10" y2="15" />
                <circle cx="16" cy="14" r="3" />
              </svg>
            </div>
            <p className="font-semibold" style={{ fontSize: 'var(--text-15)', color: 'var(--fg2)', letterSpacing: '-0.02em' }}>
              No playlists yet
            </p>
            <p style={{ fontSize: 'var(--text-13)', color: 'var(--muted2)', maxWidth: 220, lineHeight: 1.5, marginTop: -4 }}>
              Create a manual playlist or a smart playlist that auto-fills based on rules
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-[var(--text-13)] font-medium cursor-pointer transition-all duration-100 mt-1"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--rsm)',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
              }}
            >
              Create first playlist
            </button>
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 5 }}>
            {playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePlaylistModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
