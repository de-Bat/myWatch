'use client'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Playlist } from '@mywatch/core'
import { db } from '@/lib/db'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92'

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const router = useRouter()

  const previewPosters = useLiveQuery(async () => {
    if (playlist.type === 'manual') {
      const items = await db.playlistItems
        .where('playlistId')
        .equals(playlist.id)
        .limit(3)
        .toArray()
      const posters: (string | null)[] = []
      for (const item of items) {
        const cached = await db.mediaCache.get([item.tmdbId, item.mediaType])
        posters.push(cached?.posterPath ?? null)
      }
      return posters
    }
    // For smart playlists show first 3 watched/in_progress items
    const items = await db.watchlistItems
      .filter((i) => i.deletedAt === null && (i.status === 'watched' || i.status === 'in_progress'))
      .limit(3)
      .toArray()
    const posters: (string | null)[] = []
    for (const item of items) {
      const cached = await db.mediaCache.get([item.tmdbId, item.mediaType])
      posters.push(cached?.posterPath ?? null)
    }
    return posters
  }, [playlist.id, playlist.type])

  const itemCount = useLiveQuery<number | null>(
    async () => {
      if (playlist.type !== 'manual') return null
      return db.playlistItems.where('playlistId').equals(playlist.id).count()
    },
    [playlist.id, playlist.type],
  )

  const posters = previewPosters ?? []

  return (
    <div
      onClick={() => router.push(`/playlists/${playlist.id}`)}
      className="flex gap-3 rounded-[var(--r)] border cursor-pointer transition-all duration-[120ms]
        hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,.25)]"
      style={{ padding: '11px 12px', background: 'var(--surface)', borderColor: 'var(--border2)', alignItems: 'center' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
    >
      {/* Poster stack */}
      <div className="flex-shrink-0 relative" style={{ width: 52, height: 52 }}>
        {posters.length === 0 ? (
          <div
            className="w-full h-full rounded-[6px] flex items-center justify-center"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)' }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--muted2)" strokeWidth="1.6" strokeLinecap="round">
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="13" y2="10" />
              <line x1="3" y1="15" x2="10" y2="15" />
              <circle cx="16" cy="14" r="3" />
            </svg>
          </div>
        ) : (
          posters.slice(0, 3).map((poster, i) => (
            <div
              key={i}
              className="absolute rounded-[4px] overflow-hidden"
              style={{
                width: 36,
                height: 52,
                left: i * 7,
                zIndex: 3 - i,
                background: 'var(--surface2)',
                boxShadow: i > 0 ? '-1px 0 0 rgba(0,0,0,.4)' : undefined,
              }}
            >
              {poster ? (
                <img src={`${TMDB_IMG}${poster}`} alt="" className="w-full h-full object-cover block" />
              ) : (
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, var(--accent-bg), var(--bg))` }} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[1rem] font-semibold tracking-[-0.015em] truncate leading-[1.25] mb-[3px]"
          style={{ color: 'var(--fg)' }}
        >
          {playlist.name}
        </div>
        <div className="flex items-center gap-[5px]">
          <span
            className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
            style={
              playlist.type === 'smart'
                ? { background: 'rgba(96,165,250,.13)', color: 'var(--blue)' }
                : { background: 'rgba(99,102,241,.13)', color: 'var(--accent2)' }
            }
          >
            {playlist.type === 'smart' ? 'Smart' : 'Manual'}
          </span>
          {itemCount != null && (
            <span className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
          {playlist.description && (
            <span className="text-[var(--text-11h)] truncate" style={{ color: 'var(--muted2)' }}>
              · {playlist.description}
            </span>
          )}
        </div>
      </div>

      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--muted2)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 4 10 8 6 12" />
      </svg>
    </div>
  )
}
