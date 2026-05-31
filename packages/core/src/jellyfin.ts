import type { JellyfinProgress } from './types'

interface JellyfinUserData {
  Played: boolean
  PlaybackPositionTicks: number
  UnplayedItemCount?: number
}

export interface JellyfinItem {
  Id: string
  ProviderIds?: { Tmdb?: string }
  UserData: JellyfinUserData
  RunTimeTicks?: number
  RecursiveItemCount?: number
}

export interface JellyfinEpisode {
  UserData: JellyfinUserData
  RunTimeTicks?: number
  ParentIndexNumber?: number
  IndexNumber?: number
}

export function mapMovie(item: JellyfinItem): JellyfinProgress | null {
  const tmdbIdStr = item.ProviderIds?.Tmdb
  if (!tmdbIdStr) return null
  const tmdbId = parseInt(tmdbIdStr, 10)
  if (isNaN(tmdbId)) return null

  if (item.UserData.Played) {
    return { tmdbId, mediaType: 'movie', jellyfinStatus: 'watched', moviePercent: 100 }
  }
  if (item.UserData.PlaybackPositionTicks > 0 && item.RunTimeTicks) {
    const moviePercent = Math.min(
      100,
      Math.max(0, Math.round((item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100)),
    )
    return { tmdbId, mediaType: 'movie', jellyfinStatus: 'watching', moviePercent }
  }
  return { tmdbId, mediaType: 'movie', jellyfinStatus: 'planned' }
}

export function mapSeries(
  item: JellyfinItem,
): { progress: JellyfinProgress; jellyfinId: string } | null {
  const tmdbIdStr = item.ProviderIds?.Tmdb
  if (!tmdbIdStr) return null
  const tmdbId = parseInt(tmdbIdStr, 10)
  if (isNaN(tmdbId)) return null

  const { UnplayedItemCount, PlaybackPositionTicks } = item.UserData
  const total = item.RecursiveItemCount ?? 0
  const played = total - (UnplayedItemCount ?? total)

  let jellyfinStatus: 'planned' | 'watching' | 'watched'
  if (item.UserData.Played || (UnplayedItemCount === 0 && total > 0)) {
    jellyfinStatus = 'watched'
  } else if (played > 0 || PlaybackPositionTicks > 0) {
    jellyfinStatus = 'watching'
  } else {
    jellyfinStatus = 'planned'
  }

  return {
    progress: { tmdbId, mediaType: 'tv', jellyfinStatus, watchedEpisodes: played, totalEpisodes: total },
    jellyfinId: item.Id,
  }
}

export function findCurrentEpisode(
  episodes: JellyfinEpisode[],
): { season: number; episode: number; episodePercent: number } | null {
  // Prefer episode actively in progress (has seek position)
  const inProgress = episodes.find((e) => e.UserData.PlaybackPositionTicks > 0)
  if (inProgress) {
    const episodePercent =
      inProgress.RunTimeTicks && inProgress.RunTimeTicks > 0
        ? Math.min(
            100,
            Math.max(0, Math.round((inProgress.UserData.PlaybackPositionTicks / inProgress.RunTimeTicks) * 100)),
          )
        : 0
    return {
      season: inProgress.ParentIndexNumber ?? 1,
      episode: inProgress.IndexNumber ?? 1,
      episodePercent,
    }
  }

  // Fall back to last fully-played episode
  const playedEpisodes = episodes.filter((e) => e.UserData.Played)
  if (playedEpisodes.length > 0) {
    const last = playedEpisodes[playedEpisodes.length - 1]
    return {
      season: last.ParentIndexNumber ?? 1,
      episode: last.IndexNumber ?? 1,
      episodePercent: 100,
    }
  }

  return null
}

export async function fetchJellyfinProgress(
  url: string,
  apiKey: string,
  userId: string,
): Promise<Map<string, JellyfinProgress>> {
  const headers = { 'X-Emby-Token': apiKey }
  const base = url.replace(/\/$/, '')
  const result = new Map<string, JellyfinProgress>()

  // Movies
  const moviesRes = await fetch(
    `${base}/Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=Movie&Recursive=true&Fields=ProviderIds,UserData,RunTimeTicks`,
    { headers },
  )
  if (!moviesRes.ok) throw new Error(`Jellyfin movies fetch failed: ${moviesRes.status}`)
  const moviesData: { Items?: JellyfinItem[] } = await moviesRes.json()
  for (const item of moviesData.Items ?? []) {
    const progress = mapMovie(item)
    if (progress) result.set(`${progress.tmdbId}-movie`, progress)
  }

  // TV series
  const seriesRes = await fetch(
    `${base}/Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=Series&Recursive=true&Fields=ProviderIds,UserData,RecursiveItemCount`,
    { headers },
  )
  if (!seriesRes.ok) throw new Error(`Jellyfin series fetch failed: ${seriesRes.status}`)
  const seriesData: { Items?: JellyfinItem[] } = await seriesRes.json()

  const watchingSeries: Array<{ progress: JellyfinProgress; jellyfinId: string }> = []
  for (const item of seriesData.Items ?? []) {
    const mapped = mapSeries(item)
    if (!mapped) continue
    result.set(`${mapped.progress.tmdbId}-tv`, mapped.progress)
    if (mapped.progress.jellyfinStatus === 'watching') {
      watchingSeries.push(mapped)
    }
  }

  // Episodes for in-progress series only
  await Promise.all(
    watchingSeries.map(async ({ progress, jellyfinId }) => {
      const epRes = await fetch(
        `${base}/Users/${encodeURIComponent(userId)}/Items?ParentId=${encodeURIComponent(jellyfinId)}&IncludeItemTypes=Episode&Recursive=true&Fields=UserData,ParentIndexNumber,IndexNumber,RunTimeTicks&SortBy=ParentIndexNumber,IndexNumber`,
        { headers },
      )
      if (!epRes.ok) return
      const epData: { Items?: JellyfinEpisode[] } = await epRes.json()
      const currentEp = findCurrentEpisode(epData.Items ?? [])
      if (currentEp) {
        const key = `${progress.tmdbId}-tv`
        const existing = result.get(key)
        if (existing) result.set(key, { ...existing, ...currentEp })
      }
    }),
  )

  return result
}
