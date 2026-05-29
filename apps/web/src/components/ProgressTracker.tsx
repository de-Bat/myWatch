'use client'

interface Props {
  season: number | null
  episode: number | null
  onChange: (season: number | null, episode: number | null) => void
}

export function ProgressTracker({ season, episode, onChange }: Props) {
  return (
    <div className="flex gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-400">Season</label>
        <input
          type="number"
          min={1}
          value={season ?? ''}
          onChange={(e) =>
            onChange(e.target.value ? parseInt(e.target.value, 10) : null, episode)
          }
          placeholder="–"
          className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-sm text-center"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-400">Episode</label>
        <input
          type="number"
          min={1}
          value={episode ?? ''}
          onChange={(e) =>
            onChange(season, e.target.value ? parseInt(e.target.value, 10) : null)
          }
          placeholder="–"
          className="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-sm text-center"
        />
      </div>
    </div>
  )
}
