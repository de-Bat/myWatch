import type { WatchStatus } from '@mywatch/core'

const labels: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

const colors: Record<WatchStatus, string> = {
  planned: 'bg-blue-500/20 text-blue-300',
  in_progress: 'bg-yellow-500/20 text-yellow-300',
  watched: 'bg-green-500/20 text-green-300',
  quit: 'bg-red-500/20 text-red-300',
}

export function StatusBadge({ status }: { status: WatchStatus }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  )
}
