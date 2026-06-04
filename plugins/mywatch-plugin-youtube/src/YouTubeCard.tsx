import type { PluginCardProps } from '@mywatch/plugin-sdk'
import { useState } from 'react'

interface YouTubeData {
  videoId: string
  title: string
  thumbnail: string
  channelName: string
  duration?: number
  watched?: boolean
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function YouTubeCard({ item }: PluginCardProps) {
  const data = item.data as YouTubeData
  const [imgError, setImgError] = useState(false)
  const watchUrl = `https://www.youtube.com/watch?v=${data.videoId}`

  return (
    <div
      className="flex gap-3 rounded-[var(--r)] border overflow-hidden"
      style={{
        padding: '12px 14px',
        background: 'var(--surface)',
        borderColor: 'var(--border2)',
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface2)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface)'
        e.currentTarget.style.borderColor = 'var(--border2)'
      }}
    >
      {/* Thumbnail */}
      <a
        href={watchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 relative group"
        style={{ width: 112, height: 63, borderRadius: 6, overflow: 'hidden', background: 'var(--surface2)', display: 'block' }}
      >
        {!imgError && data.thumbnail ? (
          <img
            src={data.thumbnail}
            alt={data.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted2)' }}>
              <path d="M23.5 6.2a3.01 3.01 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.1 2.1C4.5 20.4 12 20.4 12 20.4s7.5 0 9.4-.5a3.01 3.01 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
            </svg>
          </div>
        )}
        {/* Play overlay on hover */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: 'rgba(0,0,0,.45)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff0000">
            <path d="M23.5 6.2a3.01 3.01 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.1 2.1C4.5 20.4 12 20.4 12 20.4s7.5 0 9.4-.5a3.01 3.01 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
          </svg>
        </div>
        {/* Duration badge */}
        {data.duration != null && (
          <span
            className="absolute bottom-[4px] right-[4px] text-[10px] font-bold tabular-nums px-[5px] py-[1px] rounded-[3px]"
            style={{ background: 'rgba(0,0,0,.75)', color: '#fff' }}
          >
            {formatDuration(data.duration)}
          </span>
        )}
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[4px] justify-center">
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <p
            className="text-[var(--text-14)] font-semibold leading-[1.3] tracking-[-0.015em]"
            style={{
              color: 'var(--fg)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {data.title}
          </p>
        </a>

        <div className="flex items-center gap-[6px]">
          {/* YouTube icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff0000">
            <path d="M23.5 6.2a3.01 3.01 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3.01 3.01 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3.01 3.01 0 0 0 2.1 2.1C4.5 20.4 12 20.4 12 20.4s7.5 0 9.4-.5a3.01 3.01 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
          </svg>
          {data.channelName && (
            <span className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
              {data.channelName}
            </span>
          )}
          {data.watched && (
            <>
              <span style={{ opacity: 0.35, color: 'var(--muted2)', fontSize: 'var(--text-11h)' }}>·</span>
              <span
                className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(134,239,172,.12)', color: 'var(--green)' }}
              >
                Watched
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
