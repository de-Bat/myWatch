import type { WatchStatus } from '@mywatch/core'
import { useSettings } from '@/hooks/useSettings'
import type { ReactNode } from 'react'

const labels: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'Watching',
  watched: 'Watched',
  quit: 'Quit',
}

const icons: Record<WatchStatus, ReactNode> = {
  planned: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  in_progress: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  watched: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  quit: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>,
}

const styles: Record<WatchStatus, { bg: string; color: string }> = {
  planned: { bg: 'rgba(96,165,250,.13)', color: 'var(--blue)' },
  in_progress: { bg: 'rgba(251,191,36,.13)', color: 'var(--amber)' },
  watched: { bg: 'rgba(74,222,128,.13)', color: 'var(--green)' },
  quit: { bg: 'rgba(248,113,113,.13)', color: 'var(--red)' },
}

export function StatusBadge({ status }: { status: WatchStatus }) {
  const { settings } = useSettings()
  const asIcon = settings.cardMeta.showBadgesAsIcons
  const { bg, color } = styles[status]

  if (asIcon) {
    return (
      <span
        title={labels[status]}
        className="inline-flex items-center justify-center rounded-[3px]"
        style={{ background: bg, color, width: 20, height: 20 }}
      >
        {icons[status]}
      </span>
    )
  }

  return (
    <span
      style={{ background: bg, color }}
      className="inline-flex items-center gap-1 text-[var(--text-11)] font-semibold px-[7px] py-[2px] rounded-[3px] leading-[1.4]"
    >
      <span
        className="w-[5px] h-[5px] rounded-full flex-shrink-0"
        style={{ background: 'currentColor' }}
      />
      {labels[status]}
    </span>
  )
}
