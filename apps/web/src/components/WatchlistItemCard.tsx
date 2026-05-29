'use client'
import { useRouter } from 'next/navigation'
import type { WatchlistItem } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'
import { useMediaMeta } from '@/hooks/useMediaMeta'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w92'

export function WatchlistItemCard({ item }: { item: WatchlistItem }) {
  const meta = useMediaMeta(item.tmdbId, item.mediaType)
  const router = useRouter()

  const year = meta?.releaseDate?.slice(0, 4) ?? null

  return (
    <div
      onClick={() => router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
      className="flex gap-3 rounded-[var(--r)] border cursor-pointer transition-all duration-[120ms]
        hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,.25)]"
      style={{
        padding: '11px 12px',
        background: 'var(--surface)',
        borderColor: 'var(--border2)',
        alignItems: 'flex-start',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.background = 'var(--surface2)'
        el.style.borderColor = 'var(--border)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.background = 'var(--surface)'
        el.style.borderColor = 'var(--border2)'
      }}
    >
      {/* Poster */}
      <div
        className="flex-shrink-0 w-[52px] h-[78px] rounded-[6px] overflow-hidden"
        style={{ background: 'var(--surface2)' }}
      >
        {meta?.posterPath ? (
          <img
            src={`${TMDB_IMG}${meta.posterPath}`}
            alt={meta.title}
            className="w-full h-full object-cover block"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, var(--surface2), var(--bg))`,
            }}
          />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px] pt-[1px]">
        <div
          className="text-[14px] font-semibold tracking-[-0.015em] truncate leading-[1.25]"
          style={{ color: 'var(--fg)' }}
        >
          {meta?.title ?? `#${item.tmdbId}`}
        </div>

        <div
          className="flex items-center gap-[5px] text-[11.5px] leading-none mb-[2px]"
          style={{ color: 'var(--muted2)' }}
        >
          {year && <span>{year}</span>}
          {year && <span style={{ opacity: 0.4 }}>·</span>}
          <span
            className="text-[9.5px] font-extrabold tracking-[0.06em] uppercase leading-[1.3] px-[5px] py-[1.5px] rounded-[3px]"
            style={
              item.mediaType === 'movie'
                ? { background: 'rgba(251,146,60,.13)', color: 'var(--orange)' }
                : { background: 'rgba(168,85,247,.13)', color: 'var(--purple)' }
            }
          >
            {item.mediaType === 'movie' ? 'Movie' : 'TV'}
          </span>
        </div>

        <div className="flex items-center gap-[5px] flex-wrap mt-[1px]">
          <StatusBadge status={item.status} />
          {item.mediaType === 'tv' && item.progressSeason != null && (
            <span
              className="text-[11px] font-medium rounded-full px-[7px] py-[1.5px] border leading-[1.4] tabular-nums"
              style={{
                color: 'var(--muted2)',
                background: 'var(--bg)',
                borderColor: 'var(--border2)',
              }}
            >
              S{item.progressSeason}·E{item.progressEpisode ?? '?'}
            </span>
          )}
        </div>
      </div>

      {/* Rating column */}
      {item.rating != null && (
        <div className="flex-shrink-0 flex flex-col items-end pt-[2px]">
          <div
            className="text-[13px] font-bold flex items-center gap-[2px] tracking-[-0.01em]"
            style={{ color: 'var(--amber)' }}
          >
            ★{item.rating}
          </div>
        </div>
      )}
    </div>
  )
}
