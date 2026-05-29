'use client'
import Link from 'next/link'
import type { TmdbSearchResult } from '@mywatch/tmdb'
import type { WatchStatus } from '@mywatch/core'
import { StatusBadge } from './StatusBadge'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w154'

interface Props {
  result: TmdbSearchResult
  existingStatus?: WatchStatus
  onAdd: (result: TmdbSearchResult) => void
}

export function MediaCard({ result, existingStatus, onAdd }: Props) {
  const title = result.media_type === 'movie' ? result.title : result.name
  const year =
    result.media_type === 'movie'
      ? result.release_date?.slice(0, 4)
      : result.first_air_date?.slice(0, 4)

  return (
    <div
      className="flex gap-3 rounded-[var(--r)] border"
      style={{ padding: '11px 12px', background: 'var(--surface)', borderColor: 'var(--border2)' }}
    >
      <Link href={`/media/${result.media_type}/${result.id}`} className="flex-shrink-0">
        <div
          className="w-[52px] h-[78px] rounded-[6px] overflow-hidden"
          style={{ background: 'var(--surface2)' }}
        >
          {result.poster_path && (
            <img
              src={`${TMDB_IMG}${result.poster_path}`}
              alt={title}
              className="w-full h-full object-cover block"
            />
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0 flex flex-col gap-[3px] pt-[1px]">
        <Link href={`/media/${result.media_type}/${result.id}`}>
          <div
            className="text-[14px] font-semibold tracking-[-0.015em] truncate leading-[1.25] hover:opacity-80"
            style={{ color: 'var(--fg)' }}
          >
            {title}
          </div>
        </Link>

        <div
          className="flex items-center gap-[5px] text-[11.5px] leading-none mb-[2px]"
          style={{ color: 'var(--muted2)' }}
        >
          {year && <span>{year}</span>}
          {year && <span style={{ opacity: 0.4 }}>·</span>}
          <span
            className="text-[9.5px] font-extrabold tracking-[0.06em] uppercase leading-[1.3] px-[5px] py-[1.5px] rounded-[3px]"
            style={
              result.media_type === 'movie'
                ? { background: 'rgba(251,146,60,.13)', color: 'var(--orange)' }
                : { background: 'rgba(168,85,247,.13)', color: 'var(--purple)' }
            }
          >
            {result.media_type === 'movie' ? 'Movie' : 'TV'}
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>★ {result.vote_average.toFixed(1)}</span>
        </div>

        <div className="mt-1">
          {existingStatus ? (
            <StatusBadge status={existingStatus} />
          ) : (
            <button
              onClick={() => onAdd(result)}
              className="text-[11px] font-semibold px-[10px] py-[3px] rounded-full border-none cursor-pointer"
              style={{ background: 'var(--accent)', color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#4f46e5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
