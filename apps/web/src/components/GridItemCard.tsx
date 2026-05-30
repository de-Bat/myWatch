'use client'
import { useRouter } from 'next/navigation'
import type { WatchlistItem } from '@mywatch/core'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { useSettings } from '@/hooks/useSettings'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

const STATUS_DOTS: Record<string, string> = {
  planned: 'var(--blue)',
  in_progress: 'var(--amber)',
  watched: 'var(--green)',
  quit: 'var(--red)',
}

function isUpcoming(releaseDate: string | null): boolean {
  if (!releaseDate) return false
  return new Date(releaseDate) > new Date()
}

export function GridItemCard({ item }: { item: WatchlistItem }) {
  const { settings } = useSettings()
  const meta = useMediaMeta(item.tmdbId, item.mediaType, settings.tmdbApiKey, settings.language)
  const router = useRouter()
  const upcoming = isUpcoming(meta?.releaseDate ?? null)
  const genre = meta?.genres?.[0]?.name ?? null

  return (
    <div
      onClick={() => router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
      className="cursor-pointer transition-all duration-[120ms] hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,.4)]"
      style={{ borderRadius: 'var(--r)', overflow: 'hidden' }}
    >
      {/* Poster */}
      <div
        className="relative w-full"
        style={{ aspectRatio: '2/3', background: 'var(--surface2)' }}
      >
        {meta?.posterPath ? (
          <img
            src={`${TMDB_IMG}${meta.posterPath}`}
            alt={meta?.title ?? ''}
            className="w-full h-full object-cover block"
          />
        ) : (
          <div
            className="w-full h-full flex items-end pb-3 px-2"
            style={{ background: `linear-gradient(135deg, var(--accent-bg), var(--bg))` }}
          >
            <span
              className="text-[11px] font-bold leading-[1.2]"
              style={{ color: 'var(--fg2)', letterSpacing: '-0.01em' }}
            >
              {meta?.title ?? `#${item.tmdbId}`}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 50%)' }}
        />

        {/* Upcoming badge */}
        {upcoming && (
          <div className="absolute top-[6px] left-[6px]">
            <span
              className="text-[8.5px] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[2px] rounded-[3px]"
              style={{ background: 'rgba(251,191,36,.9)', color: '#18181b' }}
            >
              Upcoming
            </span>
          </div>
        )}

        {/* Bottom overlay: title + status dot */}
        <div className="absolute bottom-0 left-0 right-0 px-[8px] pb-[7px]">
          <div
            className="text-[11px] font-semibold leading-[1.2] truncate mb-[4px]"
            style={{ color: '#fff', letterSpacing: '-0.01em' }}
          >
            {meta?.title ?? `#${item.tmdbId}`}
          </div>
          <div className="flex items-center gap-[5px]">
            <span
              className="w-[6px] h-[6px] rounded-full flex-shrink-0"
              style={{ background: STATUS_DOTS[item.status] ?? 'var(--muted)' }}
            />
            {genre && (
              <span
                className="text-[9.5px] truncate"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                {genre}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
