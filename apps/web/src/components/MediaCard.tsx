'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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
  const { data: session } = useSession()
  const [arrStatus, setArrStatus] = useState<{
    monitored: boolean
    hasFile: boolean
    isDownloading: boolean
    downloadPercent: number | null
  } | null>(null)

  useEffect(() => {
    if (!session?.apiToken) return
    const tmdbId = result.id
    const mediaType = result.media_type
    
    let active = true
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    
    fetch(`${apiBase}/api/user/arr/status?tmdbId=${tmdbId}&mediaType=${mediaType}`, {
      headers: { Authorization: `Bearer ${session.apiToken}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (active && data) {
          setArrStatus(data)
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [result.id, result.media_type, session?.apiToken])

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
            className="text-[1rem] font-semibold tracking-[-0.015em] truncate leading-[1.25] hover:opacity-80"
            style={{ color: 'var(--fg)' }}
          >
            {title}
          </div>
        </Link>

        <div
          className="flex items-center gap-[5px] text-[var(--text-11h)] leading-none mb-[2px]"
          style={{ color: 'var(--muted2)' }}
        >
          {year && <span>{year}</span>}
          {year && <span style={{ opacity: 0.4 }}>·</span>}
          <span
            className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase leading-[1.3] px-[5px] py-[1.5px] rounded-[3px]"
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

        <div className="mt-1 flex flex-wrap gap-2 items-center">
          {existingStatus && (
            <StatusBadge status={existingStatus} />
          )}

          {arrStatus?.hasFile && (
            <span
              className="text-[10px] font-extrabold tracking-[0.04em] uppercase px-[7px] py-[2.5px] rounded-full flex items-center gap-1"
              style={{ background: 'rgba(34,197,94,.15)', color: 'var(--green)' }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-0.5">
                <polyline points="20 6 9 17 4 12" style={{ transform: 'scale(0.8) translate(1px, 1px)' }} />
              </svg>
              Available
            </span>
          )}

          {arrStatus?.isDownloading && (
            <span
              className="text-[10px] font-extrabold tracking-[0.04em] uppercase px-[7px] py-[2.5px] rounded-full flex items-center gap-1.5 animate-pulse"
              style={{ background: 'rgba(168,85,247,.15)', color: 'var(--purple)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
              Downloading {arrStatus.downloadPercent != null ? `(${arrStatus.downloadPercent}%)` : ''}
            </span>
          )}

          {!existingStatus && !arrStatus?.hasFile && !arrStatus?.isDownloading && (
            <button
              onClick={() => onAdd(result)}
              className="text-[var(--text-11)] font-semibold px-[10px] py-[3px] rounded-full border-none cursor-pointer transition-colors duration-100"
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
