'use client'
import type { WatchStatus } from '@mywatch/core'

const STATUSES: WatchStatus[] = ['planned', 'in_progress', 'watched', 'quit']
const LABELS: Record<WatchStatus, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  watched: 'Watched',
  quit: 'Quit',
}

interface Props {
  onSelect: (status: WatchStatus) => void
  onCancel: () => void
}

export function StatusPicker({ onSelect, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-zinc-800 rounded-xl w-full max-w-sm p-4 space-y-2">
        <p className="text-sm text-zinc-400 text-center mb-3">Add to list as…</p>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="w-full py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm font-medium"
          >
            {LABELS[s]}
          </button>
        ))}
        <button
          onClick={onCancel}
          className="w-full py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
