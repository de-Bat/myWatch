'use client'
import { useRouter } from 'next/navigation'
import type { WatchlistItem, JellyfinProgress } from '@mywatch/core'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { useSettings } from '@/hooks/useSettings'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'
const PROVIDER_IMG = 'https://image.tmdb.org/t/p/w45'

function isUpcoming(releaseDate: string | null): boolean {
  if (!releaseDate) return false
  return new Date(releaseDate) > new Date()
}

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function GridItemCard({ item, onSelect, jellyfinProgress }: { item: WatchlistItem; onSelect?: () => void; jellyfinProgress?: JellyfinProgress }) {
  const { settings } = useSettings()
  const meta = useMediaMeta(item.tmdbId, item.mediaType, settings.tmdbApiKey, settings.language)
  const router = useRouter()
  const { cardMeta } = settings
  const upcoming = isUpcoming(meta?.releaseDate ?? null)
  const genres = meta?.genres ?? []
  const providers = (meta?.watchProviders ?? []).slice(0, 3)

  return (
    <div
      onClick={() => onSelect ? onSelect() : router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
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
              className="text-[var(--text-11)] font-bold leading-[1.2]"
              style={{ color: 'var(--fg2)', letterSpacing: '-0.01em' }}
            >
              {meta?.title ?? `#${item.tmdbId}`}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,.82) 0%, transparent 55%)' }}
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

        {/* TMDB rating top-right */}
        {cardMeta.showTmdbRating && meta?.voteAverage != null && meta.voteAverage > 0 && (
          <div className="absolute top-[6px] right-[6px]">
            <span
              className="text-[var(--text-10)] font-bold px-[6px] py-[2px] rounded-[3px]"
              style={{ background: 'rgba(0,0,0,.65)', color: 'var(--amber)' }}
            >
              ★ {meta.voteAverage.toFixed(1)}
            </span>
          </div>
        )}

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-[8px] pb-[7px] flex flex-col gap-[4px]">
          <div
            className="text-[var(--text-13)] font-semibold leading-[1.2] truncate"
            style={{ color: '#fff', letterSpacing: '-0.01em' }}
          >
            {meta?.title ?? `#${item.tmdbId}`}
          </div>

          {/* TV/Movie badge row */}
          <div className="flex items-center gap-[4px] flex-wrap">
            <span
              className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
              style={
                item.mediaType === 'movie'
                  ? { background: 'rgba(251,146,60,.85)', color: '#fff' }
                  : { background: 'rgba(168,85,247,.85)', color: '#fff' }
              }
            >
              {item.mediaType === 'movie' ? 'Movie' : 'TV'}
            </span>

            {item.mediaType === 'tv' && (() => {
              // Prefer Jellyfin progress, fallback to manual item progress
              if (jellyfinProgress && (jellyfinProgress.season != null || jellyfinProgress.watchedEpisodes != null)) {
                return (
                  <div className="flex gap-[4px]">
                    {jellyfinProgress.season != null && (
                      <span
                        className="text-[var(--text-9)] font-bold rounded-[3px] px-[4px] py-[1px] tracking-[0.02em] tabular-nums"
                        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                      >
                        S{jellyfinProgress.season}·E{jellyfinProgress.episode ?? '?'}
                      </span>
                    )}
                    {jellyfinProgress.totalEpisodes != null && jellyfinProgress.totalEpisodes > 0 && (
                      <span
                        className="text-[var(--text-9)] font-bold rounded-[3px] px-[4px] py-[1px] tracking-[0.02em] tabular-nums"
                        style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
                      >
                        {jellyfinProgress.watchedEpisodes ?? 0}/{jellyfinProgress.totalEpisodes}
                      </span>
                    )}
                    {jellyfinProgress.episodePercent != null && jellyfinProgress.episodePercent > 0 && jellyfinProgress.episodePercent < 100 && (
                      <span
                        className="text-[var(--text-9)] font-bold rounded-[3px] px-[4px] py-[1px] tracking-[0.02em] tabular-nums"
                        style={{ background: 'rgba(251,191,36,0.2)', color: 'var(--amber)' }}
                      >
                        {jellyfinProgress.episodePercent}%
                      </span>
                    )}
                  </div>
                )
              }
              
              if (item.progressSeason != null) {
                return (
                  <span
                    className="text-[var(--text-9)] font-bold rounded-[3px] px-[4px] py-[1px] tracking-[0.02em] tabular-nums"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                  >
                    S{item.progressSeason}·E{item.progressEpisode ?? '?'}
                  </span>
                )
              }
              return null
            })()}

            {cardMeta.showRuntime && meta?.runtime != null && meta.runtime > 0 && (
              <span className="text-[var(--text-9)]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {formatRuntime(meta.runtime)}
              </span>
            )}
          </div>

          {/* Genres */}
          {cardMeta.showGenres && genres.length > 0 && (
            <div className="flex gap-[3px] flex-wrap">
              {genres.slice(0, 2).map((g) => (
                <span
                  key={g.id}
                  className="text-[8.5px] truncate"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {/* Streaming providers */}
          {cardMeta.showProviders && providers.length > 0 && (
            <div className="flex items-center gap-[3px]">
              {providers.map((p) =>
                p.logoPath ? (
                  <img
                    key={p.providerId}
                    src={`${PROVIDER_IMG}${p.logoPath}`}
                    alt={p.providerName}
                    title={p.providerName}
                    className="rounded-[3px]"
                    style={{ width: 14, height: 14, objectFit: 'cover' }}
                  />
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Jellyfin progress bar */}
        {jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned' && (() => {
          const watched = jellyfinProgress.jellyfinStatus === 'watched'
          const track = <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: 'rgba(0,0,0,.35)' }} />
          if (jellyfinProgress.mediaType === 'movie') {
            const pct = watched ? 100 : (jellyfinProgress.moviePercent ?? 0)
            return (
              <>
                {track}
                <div className="absolute bottom-0 left-0" style={{ width: `${pct}%`, height: 3, background: watched ? 'rgba(134,239,172,.9)' : 'rgba(251,191,36,.95)' }} />
              </>
            )
          }
          if (watched) {
            return <>{track}<div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: 'rgba(134,239,172,.9)' }} /></>
          }
          const total = jellyfinProgress.totalEpisodes ?? 0
          const completedPct = total > 0 ? Math.round(((jellyfinProgress.watchedEpisodes ?? 0) / total) * 100) : 0
          const episodePct = jellyfinProgress.episodePercent ?? 0
          const hasEpisodeBar = episodePct > 0 && episodePct < 100
          const hasBothBars = hasEpisodeBar && completedPct > 0
          const mainBottom = hasBothBars ? 3 : 0
          return (
            <>
              {(!hasEpisodeBar || completedPct > 0) && (
                <div className="absolute left-0 right-0" style={{ bottom: mainBottom, height: 3, background: 'rgba(0,0,0,.35)' }} />
              )}
              {completedPct > 0 && (
                <div className="absolute left-0" style={{ bottom: mainBottom, width: `${completedPct}%`, height: 3, background: 'rgba(251,191,36,.95)' }} />
              )}
              {hasEpisodeBar && (
                <>
                  <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: 'rgba(0,0,0,.35)' }} />
                  <div className="absolute bottom-0 left-0" style={{ width: `${episodePct}%`, height: 3, background: 'rgba(96,165,250,.9)' }} />
                </>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
