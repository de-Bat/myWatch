import type { JellyfinProgress, MediaCache } from '@mywatch/core'

export interface TvProgressResult {
  watchedEpisodes: number
  totalEpisodes: number
  completedPct: number
  episodePercent: number
  hasEpisodeBar: boolean
}

export function getTvProgress(
  jellyfinProgress: JellyfinProgress,
  meta: MediaCache | null
): TvProgressResult {
  let watchedEpisodes = jellyfinProgress.watchedEpisodes ?? 0
  let totalEpisodes = jellyfinProgress.totalEpisodes ?? 0

  if (meta && meta.seasons && jellyfinProgress.season != null && jellyfinProgress.season > 0) {
    let priorEpisodesCount = 0
    for (const s of meta.seasons) {
      if (s.seasonNumber > 0 && s.seasonNumber < jellyfinProgress.season) {
        priorEpisodesCount += s.episodeCount
      }
    }
    const currentSeasonEpisodesWatched = jellyfinProgress.episode != null ? Math.max(0, jellyfinProgress.episode - 1) : 0
    const computedWatched = priorEpisodesCount + currentSeasonEpisodesWatched
    
    let computedTotal = 0
    for (const s of meta.seasons) {
      if (s.seasonNumber > 0) {
        computedTotal += s.episodeCount
      }
    }

    if (computedTotal > 0) {
      watchedEpisodes = Math.max(watchedEpisodes, computedWatched)
      totalEpisodes = computedTotal
    }
  }

  const completedPct = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0
  const episodePercent = jellyfinProgress.episodePercent ?? 0
  const hasEpisodeBar = episodePercent > 0 && episodePercent < 100

  return {
    watchedEpisodes,
    totalEpisodes,
    completedPct,
    episodePercent,
    hasEpisodeBar
  }
}
