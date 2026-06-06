'use client'
import { useState, useEffect, useRef } from 'react'
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

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

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
      className="flex gap-3 rounded-[var(--r)] border relative"
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
        <div className="flex items-start justify-between gap-2">
          <Link href={`/media/${result.media_type}/${result.id}`} className="min-w-0">
            <div
              className="text-[1rem] font-semibold tracking-[-0.015em] truncate leading-[1.25] hover:opacity-80"
              style={{ color: 'var(--fg)' }}
            >
              {title}
            </div>
          </Link>

          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--surface2)] transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 rounded-[8px] py-1 min-w-[160px] z-50"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {!existingStatus && (
                  <button
                    onClick={() => {
                      onAdd(result)
                      setMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-1.5 text-[var(--text-12)] transition-colors hover:bg-[var(--surface2)] flex items-center gap-2"
                    style={{ color: 'var(--fg)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add to Watchlist
                  </button>
                )}
                <Link
                  href={`/media/${result.media_type}/${result.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-3 py-1.5 text-[var(--text-12)] transition-colors hover:bg-[var(--surface2)] flex items-center gap-2"
                  style={{ color: 'var(--fg)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  View Details
                </Link>
              </div>
            )}
          </div>
        </div>

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

          {/* "+ Add" button is now primarily in the dots menu, but we can keep it here for larger screens or remove it. 
              Since the request was to improve mobile UI, let's keep the menu and optionally show the inline button. 
              Actually, let's keep the inline button but maybe hide it on mobile, or just remove it to clean up the UI. 
              I'll leave it but add hidden sm:block to it. */}
          {!existingStatus && !arrStatus?.hasFile && !arrStatus?.isDownloading && (
            <button
              onClick={() => onAdd(result)}
              className="hidden sm:block text-[var(--text-11)] font-semibold px-[10px] py-[3px] rounded-full border-none cursor-pointer transition-colors duration-100"
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
