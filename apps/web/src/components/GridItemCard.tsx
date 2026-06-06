'use client'
import { useRouter } from 'next/navigation'
import type { WatchlistItem, JellyfinProgress } from '@mywatch/core'
import { useMediaMeta } from '@/hooks/useMediaMeta'
import { useSettings, BADGE_ICON_SIZES } from '@/hooks/useSettings'
import { getTvProgress } from '@/lib/progress'
import { StatusBadge } from './StatusBadge'
import { ArrStatusBadge } from './ArrStatusBadge'
import { CardMenu } from './CardMenu'

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
  const size = BADGE_ICON_SIZES[settings.badgeIconSize] ?? BADGE_ICON_SIZES.md
  const router = useRouter()
  const { gridCardMeta: baseCardMeta } = settings
  const cardMeta = { ...baseCardMeta, ...(item.displayOverrides ?? {}) }
  const upcoming = isUpcoming(meta?.releaseDate ?? null)
  const genres = meta?.genres ?? []
  const providers = (meta?.watchProviders ?? []).slice(0, 3)

  return (
    <div
      onClick={() => onSelect ? onSelect() : router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
      className="cursor-pointer flex flex-col gap-[8px] group min-w-0"
    >
      {/* Poster */}
      <div
        className="relative w-full overflow-hidden transition-all duration-[120ms] group-hover:-translate-y-[2px] group-hover:shadow-[0_4px_16px_rgba(0,0,0,.4)]"
        style={{ aspectRatio: '2/3', background: 'var(--surface2)', borderRadius: 'var(--r)' }}
      >
        {meta?.posterPath ? (
          <img
            src={`${TMDB_IMG}${meta.posterPath}`}
            alt={meta?.title ?? ''}
            className="w-full h-full object-cover block"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-4 text-center"
            style={{ background: `linear-gradient(135deg, var(--accent-bg), var(--bg))` }}
          >
            <span
              className="text-[var(--text-11)] font-bold leading-[1.2] opacity-50"
              style={{ color: 'var(--fg)', letterSpacing: '-0.01em' }}
            >
              No Poster
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,.82) 0%, transparent 55%)' }}
        />
        
        <CardMenu item={item} globalSettings={baseCardMeta} />

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

        {/* User rating top-right (below TMDB rating) */}
        {item.rating != null && (
          <div className="absolute right-[6px]" style={{ top: (cardMeta.showTmdbRating && meta?.voteAverage != null && meta.voteAverage > 0) ? '32px' : '6px' }}>
            <span
              className="text-[var(--text-10)] font-bold px-[6px] py-[2px] rounded-[3px] flex items-center gap-[2px]"
              style={{ background: 'rgba(0,0,0,.65)', color: 'var(--amber)' }}
            >
              ★ {item.rating}
            </span>
          </div>
        )}

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-[8px] pr-[34px] pb-[7px] flex flex-col gap-[4px]">

          {/* TV/Movie badge row */}
          <div className="flex items-center gap-[4px] flex-wrap">
            {!(jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned') && (
              <StatusBadge status={item.status} asIcon={cardMeta.showBadgesAsIcons} />
            )}
            <span
              className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px] flex items-center justify-center"
              style={
                cardMeta.showBadgesAsIcons
                  ? {
                      background: item.mediaType === 'movie' ? 'rgba(251,146,60,.85)' : 'rgba(168,85,247,.85)',
                      color: '#fff',
                      width: size.container,
                      height: size.container,
                      padding: 0
                    }
                  : {
                      background: item.mediaType === 'movie' ? 'rgba(251,146,60,.85)' : 'rgba(168,85,247,.85)',
                      color: '#fff'
                    }
              }
              title={item.mediaType === 'movie' ? 'Movie' : 'TV'}
            >
              {cardMeta.showBadgesAsIcons ? (
                item.mediaType === 'movie' ? (
                  <svg style={{ width: size.icon, height: size.icon, display: 'block' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                ) : (
                  <svg style={{ width: size.icon, height: size.icon, display: 'block' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
                )
              ) : (
                item.mediaType === 'movie' ? 'Movie' : 'TV'
              )}
            </span>

            {cardMeta.showPlatform && jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned' && (
              <span
                className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px] flex items-center justify-center"
                style={
                  cardMeta.showBadgesAsIcons
                    ? { background: 'rgba(168,85,247,.85)', color: '#fff', width: size.container, height: size.container, padding: 0 }
                    : { background: 'rgba(168,85,247,.85)', color: '#fff' }
                }
                title="Jellyfin"
              >
                {cardMeta.showBadgesAsIcons ? (
                  <svg style={{ width: size.icon, height: size.icon, display: 'block' }} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 .002C8.826.002-1.398 18.537.16 21.666c1.56 3.129 22.14 3.094 23.682 0C25.384 18.573 15.177 0 12 0zm7.76 18.949c-1.008 2.028-14.493 2.05-15.514 0C3.224 16.9 9.92 4.755 12.003 4.755c2.081 0 8.77 12.166 7.759 14.196zM12 9.198c-1.054 0-4.446 6.15-3.93 7.189.518 1.04 7.348 1.027 7.86 0 .511-1.027-2.874-7.19-3.93-7.19z"/></svg>
                ) : (
                  'Jellyfin'
                )}
              </span>
            )}

            {cardMeta.showProgress && item.mediaType === 'movie' && jellyfinProgress?.jellyfinStatus === 'watching' && jellyfinProgress.moviePercent != null && (
              <span
                className="text-[var(--text-9)] font-bold rounded-[3px] px-[4px] py-[1px] tracking-[0.02em] tabular-nums"
                style={{ background: 'rgba(251,191,36,0.2)', color: 'var(--amber)' }}
              >
                {jellyfinProgress.moviePercent}%
              </span>
            )}

            {cardMeta.showProgress && item.mediaType === 'tv' && (() => {
              // Prefer Jellyfin progress, fallback to manual item progress
              if (jellyfinProgress && (jellyfinProgress.season != null || jellyfinProgress.watchedEpisodes != null)) {
                const tvProg = getTvProgress(jellyfinProgress, meta)
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
                    {tvProg.totalEpisodes > 0 && (
                      <span
                        className="text-[var(--text-9)] font-bold rounded-[3px] px-[4px] py-[1px] tracking-[0.02em] tabular-nums"
                        style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}
                      >
                        {tvProg.watchedEpisodes}/{tvProg.totalEpisodes}
                      </span>
                    )}
                    {tvProg.hasEpisodeBar && (
                      <span
                        className="text-[var(--text-9)] font-bold rounded-[3px] px-[4px] py-[1px] tracking-[0.02em] tabular-nums"
                        style={{ background: 'rgba(251,191,36,0.2)', color: 'var(--amber)' }}
                      >
                        {tvProg.episodePercent}%
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

          {cardMeta.showAvailability && <ArrStatusBadge tmdbId={item.tmdbId} mediaType={item.mediaType} asIcon={cardMeta.showBadgesAsIcons} />}

          {/* Overview */}
          {cardMeta.showOverview && meta?.overview && (
            <p
              className="text-[8.5px] leading-[1.4]"
              style={{ color: 'rgba(255,255,255,0.7)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {meta.overview}
            </p>
          )}

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
        {(cardMeta.showProgress || settings.alwaysShowProgressBars) && (settings.alwaysShowProgressBars || (jellyfinProgress && jellyfinProgress.jellyfinStatus !== 'planned')) && (() => {
          const watched = (jellyfinProgress?.jellyfinStatus === 'watched') || item.status === 'watched'
          const track = <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, background: 'rgba(0,0,0,.35)' }} />
          if (item.mediaType === 'movie') {
            const pct = watched ? 100 : (jellyfinProgress?.moviePercent ?? 0)
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
          const mockProg = { jellyfinStatus: 'watching', mediaType: 'tv', season: null, episode: null, watchedEpisodes: 0, totalEpisodes: 0, completedTicks: null, totalTicks: null, episodePercent: null, hasEpisodeBar: false } as any
          const tvProg = getTvProgress(jellyfinProgress ?? mockProg, meta)
          const completedPct = tvProg.completedPct
          const episodePct = tvProg.episodePercent
          const hasEpisodeBar = tvProg.hasEpisodeBar
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

      {/* Title Below Card */}
      <div
        className="text-[var(--text-13)] font-semibold leading-[1.2] truncate px-[2px] transition-colors group-hover:text-[var(--accent)]"
        style={{ color: 'var(--fg)', letterSpacing: '-0.01em' }}
        title={meta?.title ?? `#${item.tmdbId}`}
      >
        {meta?.title ?? `#${item.tmdbId}`}
      </div>
    </div>
  )
}
