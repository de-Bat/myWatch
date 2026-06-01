import type { WatchStatus } from '@mywatch/core'

const labels: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'Watching',
  watched: 'Watched',
  quit: 'Quit',
}

const styles: Record<WatchStatus, { bg: string; color: string }> = {
  planned: { bg: 'rgba(96,165,250,.13)', color: 'var(--blue)' },
  in_progress: { bg: 'rgba(251,191,36,.13)', color: 'var(--amber)' },
  watched: { bg: 'rgba(74,222,128,.13)', color: 'var(--green)' },
  quit: { bg: 'rgba(248,113,113,.13)', color: 'var(--red)' },
}

export function StatusBadge({ status }: { status: WatchStatus }) {
  const { bg, color } = styles[status]
  return (
    <span
      style={{ background: bg, color }}
      className="inline-flex items-center gap-1 text-[var(--text-11)] font-semibold px-[7px] py-[2px] rounded-full leading-[1.4]"
    >
      <span
        className="w-[5px] h-[5px] rounded-full flex-shrink-0"
        style={{ background: 'currentColor' }}
      />
      {labels[status]}
    </span>
  )
}
