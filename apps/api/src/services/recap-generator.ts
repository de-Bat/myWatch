import type { Sql } from 'postgres'
import type { UserRepo } from '../repos/user-repo.js'
import type { RecapRepo } from '../repos/recap-repo.js'
import { sseBus } from '../utils/sse-bus.js'

export function createRecapGenerator(sql: Sql, userRepo: UserRepo, recapRepo: RecapRepo) {
  async function triggerBackgroundRecap(
    userId: string,
    tmdbId: number,
    mediaType: 'movie' | 'tv',
  ): Promise<void> {
    // Run everything in a safe try-catch so it never crashes the main server process
    try {
      console.log(`[recap-generator] Starting recap check for user=${userId}, tmdbId=${tmdbId}, type=${mediaType}`)

      // 1. Fetch current progress from both jellyfin_progress and manual watchlist_items
      const jellyfinProgress = await sql<{
        movie_percent: number | null
        season: number | null
        episode: number | null
      }[]>`
        SELECT movie_percent, season, episode FROM jellyfin_progress
        WHERE user_id = ${userId} AND tmdb_id = ${tmdbId} AND media_type = ${mediaType}
        LIMIT 1
      `

      const watchlistProgress = await sql<{
        progress_season: number | null
        progress_episode: number | null
        status: string
      }[]>`
        SELECT progress_season, progress_episode, status FROM watchlist_items
        WHERE user_id = ${userId} AND tmdb_id = ${tmdbId} AND media_type = ${mediaType}
        LIMIT 1
      `

      let currentPercent: number | null = null
      let currentSeason: number | null = null
      let currentEpisode: number | null = null

      if (mediaType === 'movie') {
        const jfPercent = jellyfinProgress[0]?.movie_percent
        if (jfPercent !== undefined && jfPercent !== null) {
          currentPercent = jfPercent
        } else if (watchlistProgress[0]?.status === 'watched') {
          currentPercent = 100
        } else if (watchlistProgress[0]?.status === 'in_progress') {
          currentPercent = 50 // arbitrary default if in progress manually
        } else {
          currentPercent = 0
        }
      } else {
        // TV Show
        const jfSeason = jellyfinProgress[0]?.season
        const jfEpisode = jellyfinProgress[0]?.episode
        const wlSeason = watchlistProgress[0]?.progress_season
        const wlEpisode = watchlistProgress[0]?.progress_episode

        // Prefer whatever progress is more advanced or not null
        currentSeason = jfSeason ?? wlSeason ?? 1
        currentEpisode = jfEpisode ?? wlEpisode ?? 0
      }

      // If no active progress has been made, don't generate a recap
      if (mediaType === 'movie' && (currentPercent === null || currentPercent <= 0)) {
        console.log(`[recap-generator] Movie has no progress (${currentPercent}%), skipping recap.`)
        return
      }
      if (mediaType === 'tv' && (currentSeason === null || currentEpisode === null || (currentSeason === 1 && currentEpisode === 0))) {
        console.log(`[recap-generator] TV Show has no progress (S${currentSeason}E${currentEpisode}), skipping recap.`)
        return
      }

      // 2. Fetch user settings and determine the minimal interval
      const settings = await userRepo.getLlmSettings(userId)
      const minInterval = settings?.recapMinInterval ?? 5

      // 3. Load the last generated recap and compare progress delta
      const lastRecap = await recapRepo.getRecap(userId, tmdbId, mediaType)
      if (lastRecap) {
        if (mediaType === 'movie') {
          const lastPercent = lastRecap.progressPercent ?? 0
          const delta = Math.abs((currentPercent ?? 0) - lastPercent)
          if (delta < minInterval) {
            console.log(`[recap-generator] Movie progress delta (${delta}%) is below threshold (${minInterval}%), skipping.`)
            return
          }
        } else {
          const lastSeason = lastRecap.progressSeason ?? 1
          const lastEpisode = lastRecap.progressEpisode ?? 0
          if (currentSeason === lastSeason && currentEpisode === lastEpisode) {
            console.log(`[recap-generator] TV progress is unchanged (S${currentSeason}E${currentEpisode}), skipping.`)
            return
          }
        }
      }

      // 4. Fetch media metadata (TMDB context) with cache fallback
      const tmdbKey = process.env.TMDB_API_KEY ?? process.env.NEXT_PUBLIC_TMDB_API_KEY
      let title = ''
      let overview = ''

      if (tmdbKey) {
        try {
          const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}&language=en-US`
          const res = await fetch(url)
          if (res.ok) {
            const data = (await res.json()) as any
            title = data.title || data.name || ''
            overview = data.overview || ''
          }
        } catch (e) {
          console.error('[recap-generator] Failed TMDB fetch:', e)
        }
      }

      // Fallback to DB media_cache if TMDB API is offline or key missing
      if (!title) {
        const cached = await sql<{ title: string; overview: string }[]>`
          SELECT title, overview FROM media_cache
          WHERE tmdb_id = ${tmdbId} AND media_type = ${mediaType}
          LIMIT 1
        `
        if (cached[0]) {
          title = cached[0].title
          overview = cached[0].overview
        } else {
          title = mediaType === 'movie' ? 'Movie' : 'TV Show'
        }
      }

      // 5. Select API configuration (Custom/User vs Premium/Environment Fallback)
      const apiKey = settings?.llmApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
      if (!apiKey) {
        console.warn(`[recap-generator] Missing AI API Key. Save keys in Settings or set GEMINI_API_KEY/OPENAI_API_KEY env variables.`)
        return
      }

      const provider = settings?.llmProvider || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')
      const baseUrl = settings?.llmBaseUrl || (provider === 'openai' ? 'https://api.openai.com/v1' : '')
      const model = settings?.llmModel || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini')

      // 6. Generate the prompt
      let prompt = ''
      if (mediaType === 'movie') {
        prompt = `You are a helper giving spoiler-free recaps to help me resume watching a movie.
The movie is "${title}".
Overview: "${overview}"
I am currently at ${currentPercent}% of the way through this movie.
Provide a spoiler-free recap of what has occurred in the first ${currentPercent}% of the movie. Do NOT include ANY spoilers for anything that happens AFTER the ${currentPercent}% mark of the movie. Keep the recap to under 3 sentences, extremely concise, engaging, and in English.`
      } else {
        prompt = `You are a helper giving spoiler-free recaps to help me resume watching a TV show.
The TV show is "${title}".
Overview: "${overview}"
I have watched up to Season ${currentSeason}, Episode ${currentEpisode}.
Provide a spoiler-free recap of the storyline and events up to Season ${currentSeason}, Episode ${currentEpisode}. Do NOT include ANY spoilers for anything that happens in episodes AFTER Season ${currentSeason}, Episode ${currentEpisode}. Keep the recap to under 3 sentences, extremely concise, engaging, and in English.`
      }

      console.log(`[recap-generator] Querying LLM (${provider}/${model}) for user=${userId}...`)
      let recapText = ''

      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'text/plain' },
          }),
        })

        if (!res.ok) {
          throw new Error(`Gemini API returned status ${res.status}: ${await res.text()}`)
        }

        const data = (await res.json()) as any
        recapText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } else {
        // OpenAI protocol
        const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: 'You are a helpful, spoiler-free recap generator.' },
              { role: 'user', content: prompt },
            ],
          }),
        })

        if (!res.ok) {
          throw new Error(`OpenAI-compatible API returned status ${res.status}: ${await res.text()}`)
        }

        const data = (await res.json()) as any
        recapText = data.choices?.[0]?.message?.content || ''
      }

      recapText = recapText.trim()
      if (!recapText) {
        throw new Error('LLM generated an empty recap.')
      }

      // 7. Save to the database
      await recapRepo.upsertRecap(userId, {
        tmdbId,
        mediaType,
        progressPercent: currentPercent,
        progressSeason: currentSeason,
        progressEpisode: currentEpisode,
        recapText,
      })

      console.log(`[recap-generator] Successfully saved new recap for user=${userId}, tmdbId=${tmdbId}`)

      // 8. Broadcast a synchronization event
      sseBus.emit(userId, 'recap-generator', { pushedAt: new Date().toISOString() })
    } catch (err) {
      console.error('[recap-generator] Background recap generation failed:', err)
    }
  }

  return {
    triggerBackgroundRecap,
  }
}
