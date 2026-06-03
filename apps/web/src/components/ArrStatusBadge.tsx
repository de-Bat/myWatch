'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSettings, BADGE_ICON_SIZES } from '@/hooks/useSettings'

export function ArrStatusBadge({
  tmdbId,
  mediaType,
  asIcon = false,
}: {
  tmdbId: number
  mediaType: string
  asIcon?: boolean
}) {
  const { data: session } = useSession()
  const { settings } = useSettings()
  const size = BADGE_ICON_SIZES[settings.badgeIconSize] ?? BADGE_ICON_SIZES.md
  const [arrStatus, setArrStatus] = useState<{
    monitored: boolean
    hasFile: boolean
    isDownloading: boolean
    downloadPercent: number | null
  } | null>(null)
  const [requestingDownload, setRequestingDownload] = useState(false)
  const [requestMsg, setRequestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (!session?.apiToken) return
    let active = true
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    fetch(`${apiBase}/api/user/arr/status?tmdbId=${tmdbId}&mediaType=${mediaType}`, {
      headers: { Authorization: `Bearer ${session.apiToken}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active && data) setArrStatus(data) })
      .catch(() => {})
    return () => { active = false }
  }, [tmdbId, mediaType, session?.apiToken])

  async function handleRequestDownload(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!session?.apiToken || requestingDownload) return
    setRequestingDownload(true)
    setRequestMsg(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/api/user/arr/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.apiToken}` },
        body: JSON.stringify({ tmdbId, mediaType }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRequestMsg({ type: 'ok', text: data.message ?? 'Requested!' })
        setArrStatus(prev => ({ ...prev, monitored: true, hasFile: false, isDownloading: true, downloadPercent: 0 }))
        setTimeout(() => setRequestMsg(null), 4000)
      } else {
        setRequestMsg({ type: 'err', text: data.message ?? data.error ?? 'Request failed' })
        setTimeout(() => setRequestMsg(null), 6000)
      }
    } catch {
      setRequestMsg({ type: 'err', text: 'Network error' })
      setTimeout(() => setRequestMsg(null), 4000)
    } finally {
      setRequestingDownload(false)
    }
  }

  if (!arrStatus && !requestMsg) return null

  return (
    <div className="flex items-center gap-[6px] flex-wrap" onClick={e => e.stopPropagation()}>
      {arrStatus?.hasFile && (
        asIcon ? (
          <span
            className="flex items-center justify-center rounded-[3px]"
            title="Available"
            style={{ background: 'rgba(34,197,94,.15)', color: 'var(--green)', width: size.container, height: size.container }}
          >
            <svg style={{ width: size.icon, height: size.icon, display: 'block' }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 6 5 9 10 3" />
            </svg>
          </span>
        ) : (
          <span
            className="text-[var(--text-10)] font-extrabold tracking-[0.04em] uppercase px-[7px] py-[2px] rounded-[3px] flex items-center gap-1"
            style={{ background: 'rgba(34,197,94,.15)', color: 'var(--green)' }}
          >
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 6 5 9 10 3" />
            </svg>
            Available
          </span>
        )
      )}
      {arrStatus?.isDownloading && !arrStatus.hasFile && (
        asIcon ? (
          <span
            className="flex items-center justify-center rounded-[3px]"
            title={arrStatus.downloadPercent != null ? `Downloading ${arrStatus.downloadPercent}%` : 'Downloading'}
            style={{ background: 'rgba(168,85,247,.15)', color: 'var(--purple)', width: size.container, height: size.container }}
          >
            <span className="rounded-full bg-purple-400 animate-ping flex-shrink-0" style={{ width: Math.max(6, size.icon - 6), height: Math.max(6, size.icon - 6) }} />
          </span>
        ) : (
          <span
            className="text-[var(--text-10)] font-extrabold tracking-[0.04em] uppercase px-[7px] py-[2px] rounded-[3px] flex items-center gap-1.5"
            style={{ background: 'rgba(168,85,247,.15)', color: 'var(--purple)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping flex-shrink-0" />
            {arrStatus.downloadPercent != null ? `${arrStatus.downloadPercent}%` : 'Downloading'}
          </span>
        )
      )}
      {arrStatus && !arrStatus.hasFile && !arrStatus.isDownloading && (
        <button
          onClick={handleRequestDownload}
          disabled={requestingDownload}
          title={`Request ${mediaType === 'movie' ? 'movie' : 'series'} download`}
          className="font-bold rounded-[3px] border-none cursor-pointer transition-all duration-100 flex items-center justify-center gap-1 disabled:opacity-50"
          style={
            asIcon
              ? { background: 'var(--accent)', color: '#fff', width: size.container, height: size.container, padding: 0 }
              : { background: 'var(--accent)', color: '#fff', fontSize: 'var(--text-10)', padding: '2px 8px' }
          }
          onMouseEnter={(e) => { if (!requestingDownload) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          {requestingDownload ? (
            <svg className="animate-spin" style={asIcon ? { width: size.icon, height: size.icon, display: 'block' } : { width: 9, height: 9 }} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" />
            </svg>
          ) : (
            <svg style={asIcon ? { width: size.icon, height: size.icon, display: 'block' } : { width: 9, height: 9 }} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1v7M3 5l3 3 3-3M1 10h10" />
            </svg>
          )}
          {!asIcon && (requestingDownload ? 'Requesting…' : 'Request')}
        </button>
      )}
      {requestMsg && (
        asIcon ? (
          <span
            className="flex items-center justify-center rounded-[3px]"
            title={requestMsg.text}
            style={{
              background: requestMsg.type === 'ok' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
              color: requestMsg.type === 'ok' ? '#4ade80' : '#f87171',
              width: size.container, height: size.container
            }}
          >
            {requestMsg.type === 'ok' ? '✓' : '⚠'}
          </span>
        ) : (
          <span
            className="text-[var(--text-10)] font-medium px-[6px] py-[1px] rounded-[3px]"
            style={{
              background: requestMsg.type === 'ok' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
              color: requestMsg.type === 'ok' ? '#4ade80' : '#f87171',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={requestMsg.text}
          >
            {requestMsg.type === 'ok' ? '✓' : '⚠'} {requestMsg.text}
          </span>
        )
      )}
    </div>
  )
}
