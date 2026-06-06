import type { PluginCardProps } from '@mywatch/plugin-sdk'
import { useState } from 'react'
import { buildStoreSearchUrl } from './utils'

interface BookData {
  title: string
  author: string
  coverUrl?: string
  year?: number
  read: boolean
}

function BookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted2)' }}>
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>
  )
}

function StoreLinkButton({ title, author, compact }: { title: string; author: string; compact?: boolean }) {
  const href = buildStoreSearchUrl(title, author)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Find in store"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center rounded-[4px] transition-opacity hover:opacity-70"
      style={{
        background: 'var(--surface2)',
        color: 'var(--muted)',
        padding: compact ? '2px 6px' : '4px 8px',
        fontSize: compact ? 'var(--text-10)' : 'var(--text-11)',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      {compact ? '🔗' : '🔗 Find in store'}
    </a>
  )
}

export function BooksCard({ item, viewMode = 'list' }: PluginCardProps) {
  const data = item.data as unknown as BookData
  const [imgError, setImgError] = useState(false)

  if (viewMode === 'grid') {
    return (
      <div
        className="flex flex-col rounded-[var(--r)] border overflow-hidden group"
        style={{
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
        {/* Cover — 2:3 aspect ratio */}
        <div style={{ position: 'relative', paddingBottom: '150%', background: 'var(--surface2)' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            {!imgError && data.coverUrl ? (
              <img
                src={data.coverUrl}
                alt={data.title}
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookIcon />
              </div>
            )}
          </div>
          {/* Hover overlay */}
          <div
            className="absolute inset-0 flex items-end justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 60%)' }}
          >
            <StoreLinkButton title={data.title} author={data.author} compact />
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p
            className="text-[var(--text-12)] font-semibold leading-[1.3]"
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
          <p
            className="text-[var(--text-11)]"
            style={{ color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {data.author}
          </p>
          {data.read && (
            <span
              className="self-start text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
              style={{ background: 'rgba(134,239,172,.12)', color: 'var(--green)' }}
            >
              Read
            </span>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div
      className="flex gap-3 rounded-[var(--r)] border overflow-hidden"
      style={{
        padding: '10px 14px',
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
      {/* Cover thumbnail */}
      <div
        style={{
          width: 40,
          height: 60,
          flexShrink: 0,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--surface2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!imgError && data.coverUrl ? (
          <img
            src={data.coverUrl}
            alt={data.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <BookIcon />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px] justify-center">
        <p
          className="text-[var(--text-14)] font-semibold leading-[1.3] tracking-[-0.015em]"
          style={{
            color: 'var(--fg)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.title}
        </p>
        <div className="flex items-center gap-[6px]">
          <span className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
            {data.author}
          </span>
          {data.year && (
            <>
              <span style={{ opacity: 0.35, color: 'var(--muted2)', fontSize: 'var(--text-11h)' }}>·</span>
              <span className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
                {data.year}
              </span>
            </>
          )}
          {data.read && (
            <>
              <span style={{ opacity: 0.35, color: 'var(--muted2)', fontSize: 'var(--text-11h)' }}>·</span>
              <span
                className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(134,239,172,.12)', color: 'var(--green)' }}
              >
                Read
              </span>
            </>
          )}
        </div>
      </div>

      {/* Store link */}
      <div className="flex items-center flex-shrink-0">
        <StoreLinkButton title={data.title} author={data.author} compact />
      </div>
    </div>
  )
}
