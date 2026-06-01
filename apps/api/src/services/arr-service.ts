import type { UserRepo } from '../repos/user-repo.js'

export function createArrService(userRepo: UserRepo) {
  // Helper to fetch TVDB ID from TMDB TV ID
  async function getTvdbId(tmdbId: number): Promise<number | null> {
    const tmdbKey = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY
    if (!tmdbKey) {
      console.warn('[arr-service] TMDB API key missing, cannot fetch TVDB ID.')
      return null
    }
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${tmdbKey}`)
      if (!res.ok) {
        console.error(`[arr-service] TMDB external IDs failed: ${res.status}`)
        return null
      }
      const data = (await res.json()) as any
      return data.tvdb_id || null
    } catch (err) {
      console.error('[arr-service] Failed to resolve TVDB ID:', err)
      return null
    }
  }

  // Fetch TMDB minimal metadata (title, year, poster) for request payloads
  async function getTmdbMeta(tmdbId: number, mediaType: 'movie' | 'tv') {
    const tmdbKey = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY
    if (!tmdbKey) return null
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}`)
      if (res.ok) {
        const data = (await res.json()) as any
        const title = data.title || data.name || ''
        const year = new Date(data.release_date || data.first_air_date || Date.now()).getFullYear()
        const posterPath = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : ''
        return { title, year, posterPath }
      }
    } catch (e) {
      console.error('[arr-service] Failed to fetch TMDB metadata:', e)
    }
    return null
  }

  async function getMediaStatus(
    userId: string,
    tmdbId: number,
    mediaType: 'movie' | 'tv',
  ) {
    const settings = await userRepo.getArrSettings(userId)
    if (!settings) {
      return { monitored: false, hasFile: false, isDownloading: false, downloadPercent: null }
    }

    try {
      if (mediaType === 'movie') {
        const { radarrUrl, radarrApiKey } = settings
        if (!radarrUrl || !radarrApiKey) {
          return { monitored: false, hasFile: false, isDownloading: false, downloadPercent: null }
        }

        const cleanUrl = radarrUrl.replace(/\/$/, '')
        
        // 1. Check if movie is tracked in Radarr library
        const movieUrl = `${cleanUrl}/api/v3/movie?tmdbId=${tmdbId}&apikey=${radarrApiKey}`
        const movieRes = await fetch(movieUrl)
        if (!movieRes.ok) {
          throw new Error(`Radarr API returned status ${movieRes.status}`)
        }

        const movies = (await movieRes.json()) as any[]
        const movie = movies[0]

        if (!movie) {
          return { monitored: false, hasFile: false, isDownloading: false, downloadPercent: null }
        }

        const monitored = !!movie.monitored
        const hasFile = !!movie.hasFile

        // 2. Check if movie is downloading in Radarr queue
        const queueUrl = `${cleanUrl}/api/v3/queue?apikey=${radarrApiKey}`
        const queueRes = await fetch(queueUrl)
        let isDownloading = false
        let downloadPercent: number | null = null

        if (queueRes.ok) {
          const queueData = (await queueRes.json()) as any
          const records = queueData.records || []
          const record = records.find((r: any) => r.movieId === movie.id)

          if (record) {
            isDownloading = true
            const size = record.size || 0
            const sizeLeft = record.sizeleft || 0
            if (size > 0) {
              downloadPercent = Math.round(((size - sizeLeft) / size) * 100)
            } else {
              downloadPercent = 0
            }
          }
        }

        return { monitored, hasFile, isDownloading, downloadPercent }
      } else {
        // TV Show
        const { sonarrUrl, sonarrApiKey } = settings
        if (!sonarrUrl || !sonarrApiKey) {
          return { monitored: false, hasFile: false, isDownloading: false, downloadPercent: null }
        }

        // Sonarr tracks using TVDB IDs
        const tvdbId = await getTvdbId(tmdbId)
        if (!tvdbId) {
          return { monitored: false, hasFile: false, isDownloading: false, downloadPercent: null }
        }

        const cleanUrl = sonarrUrl.replace(/\/$/, '')

        // 1. Get all tracked series to find the series by TVDB ID
        const seriesUrl = `${cleanUrl}/api/v3/series?apikey=${sonarrApiKey}`
        const seriesRes = await fetch(seriesUrl)
        if (!seriesRes.ok) {
          throw new Error(`Sonarr API returned status ${seriesRes.status}`)
        }

        const seriesList = (await seriesRes.json()) as any[]
        const series = seriesList.find((s: any) => s.tvdbId === tvdbId)

        if (!series) {
          return { monitored: false, hasFile: false, isDownloading: false, downloadPercent: null }
        }

        const monitored = !!series.monitored
        const hasFile = series.statistics?.percentOfEpisodes === 100 || !!series.hasFile

        // 2. Check if TV show is downloading in Sonarr queue
        const queueUrl = `${cleanUrl}/api/v3/queue?apikey=${sonarrApiKey}`
        const queueRes = await fetch(queueUrl)
        let isDownloading = false
        let downloadPercent: number | null = null

        if (queueRes.ok) {
          const queueData = (await queueRes.json()) as any
          const records = queueData.records || []
          const record = records.find((r: any) => r.seriesId === series.id)

          if (record) {
            isDownloading = true
            const size = record.size || 0
            const sizeLeft = record.sizeleft || 0
            if (size > 0) {
              downloadPercent = Math.round(((size - sizeLeft) / size) * 100)
            } else {
              downloadPercent = 0
            }
          }
        }

        return { monitored, hasFile, isDownloading, downloadPercent }
      }
    } catch (err) {
      console.error(`[arr-service] Failed to query Arr status for tmdbId=${tmdbId}:`, err)
      return { monitored: false, hasFile: false, isDownloading: false, downloadPercent: null }
    }
  }

  async function requestDownload(
    userId: string,
    tmdbId: number,
    mediaType: 'movie' | 'tv',
  ): Promise<{ success: boolean; message?: string }> {
    const settings = await userRepo.getArrSettings(userId)
    if (!settings) {
      throw new Error('Radarr/Sonarr credentials are not configured on the server.')
    }

    const meta = await getTmdbMeta(tmdbId, mediaType)
    if (!meta) {
      throw new Error('Failed to load media details from TMDB.')
    }

    try {
      if (mediaType === 'movie') {
        const { radarrUrl, radarrApiKey, radarrQualityProfileId = 1, radarrRootFolderPath } = settings
        if (!radarrUrl || !radarrApiKey || !radarrRootFolderPath) {
          throw new Error('Radarr URL, API key, and root folder path must be configured.')
        }

        const cleanUrl = radarrUrl.replace(/\/$/, '')

        // Check if movie already exists
        const movieUrl = `${cleanUrl}/api/v3/movie?tmdbId=${tmdbId}&apikey=${radarrApiKey}`
        const movieRes = await fetch(movieUrl)
        if (movieRes.ok) {
          const movies = (await movieRes.json()) as any[]
          if (movies[0]) {
            // Already tracked, update to monitored
            const movie = movies[0]
            if (!movie.monitored) {
              movie.monitored = true
              await fetch(`${cleanUrl}/api/v3/movie/${movie.id}?apikey=${radarrApiKey}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movie),
              })
            }
            return { success: true, message: 'Movie is already tracked and monitored.' }
          }
        }

        // Add new movie
        const addMovieRes = await fetch(`${cleanUrl}/api/v3/movie?apikey=${radarrApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: meta.title,
            qualityProfileId: radarrQualityProfileId,
            titleSlug: meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            images: meta.posterPath ? [{ coverType: 'poster', url: meta.posterPath }] : [],
            tmdbId: tmdbId,
            year: meta.year,
            rootFolderPath: radarrRootFolderPath,
            monitored: true,
            addOptions: {
              searchForMovie: true,
            },
          }),
        })

        if (!addMovieRes.ok) {
          throw new Error(`Radarr returned status ${addMovieRes.status}: ${await addMovieRes.text()}`)
        }

        return { success: true, message: 'Successfully requested movie download on Radarr.' }
      } else {
        // TV Show
        const { sonarrUrl, sonarrApiKey, sonarrQualityProfileId = 1, sonarrRootFolderPath } = settings
        if (!sonarrUrl || !sonarrApiKey || !sonarrRootFolderPath) {
          throw new Error('Sonarr URL, API key, and root folder path must be configured.')
        }

        const tvdbId = await getTvdbId(tmdbId)
        if (!tvdbId) {
          throw new Error('Sonarr requires a TVDB ID, but TMDB could not resolve one for this show.')
        }

        const cleanUrl = sonarrUrl.replace(/\/$/, '')

        // Check if series already exists
        const seriesUrl = `${cleanUrl}/api/v3/series?apikey=${sonarrApiKey}`
        const seriesRes = await fetch(seriesUrl)
        if (seriesRes.ok) {
          const seriesList = (await seriesRes.json()) as any[]
          const series = seriesList.find((s: any) => s.tvdbId === tvdbId)
          if (series) {
            if (!series.monitored) {
              series.monitored = true
              await fetch(`${cleanUrl}/api/v3/series/${series.id}?apikey=${sonarrApiKey}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(series),
              })
            }
            return { success: true, message: 'TV series is already tracked and monitored.' }
          }
        }

        // Add new series
        const addSeriesRes = await fetch(`${cleanUrl}/api/v3/series?apikey=${sonarrApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: meta.title,
            qualityProfileId: sonarrQualityProfileId,
            titleSlug: meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            images: meta.posterPath ? [{ coverType: 'poster', url: meta.posterPath }] : [],
            tvdbId: tvdbId,
            year: meta.year,
            rootFolderPath: sonarrRootFolderPath,
            monitored: true,
            addOptions: {
              searchForMissingEpisodes: true,
            },
          }),
        })

        if (!addSeriesRes.ok) {
          throw new Error(`Sonarr returned status ${addSeriesRes.status}: ${await addSeriesRes.text()}`)
        }

        return { success: true, message: 'Successfully requested series download on Sonarr.' }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[arr-service] Failed to request download for tmdbId=${tmdbId}:`, err)
      return { success: false, message: msg }
    }
  }

  async function testConnection(
    userId: string,
    type: 'radarr' | 'sonarr',
    url: string,
    apiKey: string,
  ): Promise<{ success: boolean; message?: string }> {
    let finalKey = apiKey
    if (apiKey === '••••••••') {
      const arrSettings = await userRepo.getArrSettings(userId)
      const savedKey = type === 'radarr' ? arrSettings?.radarrApiKey : arrSettings?.sonarrApiKey
      if (!savedKey) {
        return { success: false, message: 'No saved API key found to test.' }
      }
      finalKey = savedKey
    }

    const cleanUrl = url.replace(/\/$/, '')
    try {
      const testUrl = `${cleanUrl}/api/v3/system/status?apikey=${finalKey}`
      const res = await fetch(testUrl)
      if (res.ok) {
        return { success: true }
      } else {
        const text = await res.text()
        return { success: false, message: `Status ${res.status}: ${text}` }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, message: msg }
    }
  }

  return {
    getMediaStatus,
    requestDownload,
    testConnection,
  }
}
