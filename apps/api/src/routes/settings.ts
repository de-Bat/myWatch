import type { FastifyInstance } from 'fastify'
import type { JellyfinRepo } from '../repos/jellyfin-repo.js'
import { authenticate } from '../middleware/authenticate.js'
import { fetchJellyfinProgress } from '@mywatch/core'
import { sseBus } from '../utils/sse-bus.js'

import type { UserRepo } from '../repos/user-repo.js'

interface SettingsBody {
  jellyfinUrl?: string
  jellyfinApiKey?: string
  jellyfinUserId?: string
  llmProvider?: 'gemini' | 'openai'
  llmBaseUrl?: string
  llmApiKey?: string
  llmModel?: string
  recapMinInterval?: number
}

export function registerSettingsRoutes(
  app: FastifyInstance,
  jellyfinRepo: JellyfinRepo,
  userRepo?: UserRepo,
) {
  // GET — return the currently saved settings for this user
  app.get(
    '/api/user/settings',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const userId = req.user.sub
      const users = await jellyfinRepo.getAllConfiguredUsers()
      const user = users.find(u => u.id === userId)

      let llmSettings = null
      if (userRepo) {
        llmSettings = await userRepo.getLlmSettings(userId)
      }

      return reply.send({
        jellyfinUrl: user?.url ?? '',
        jellyfinApiKey: user?.apiKey ? '••••••••' : '',  // mask key but indicate if set
        jellyfinUserId: user?.jellyfinUserId ?? '',
        hasCredentials: !!user,
        llmProvider: llmSettings?.llmProvider ?? 'gemini',
        llmBaseUrl: llmSettings?.llmBaseUrl ?? '',
        llmApiKey: llmSettings?.llmApiKey ? '••••••••' : '',
        llmModel: llmSettings?.llmModel ?? '',
        recapMinInterval: llmSettings?.recapMinInterval ?? 5,
      })
    }
  )

  // PUT — save Jellyfin & LLM credentials
  app.put<{ Body: SettingsBody }>(
    '/api/user/settings',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const {
        jellyfinUrl,
        jellyfinApiKey,
        jellyfinUserId,
        llmProvider,
        llmBaseUrl,
        llmApiKey,
        llmModel,
        recapMinInterval,
      } = req.body
      const userId = req.user.sub

      // 1. Partial update for Jellyfin credentials
      if (jellyfinUrl !== undefined || jellyfinApiKey !== undefined || jellyfinUserId !== undefined) {
        const users = await jellyfinRepo.getAllConfiguredUsers()
        const user = users.find(u => u.id === userId)
        const finalUrl = jellyfinUrl !== undefined ? jellyfinUrl : (user?.url ?? '')
        const finalKey = jellyfinApiKey !== undefined 
          ? (jellyfinApiKey === '••••••••' ? (user?.apiKey ?? '') : jellyfinApiKey) 
          : (user?.apiKey ?? '')
        const finalUid = jellyfinUserId !== undefined ? jellyfinUserId : (user?.jellyfinUserId ?? '')

        await jellyfinRepo.updateUserCredentials(userId, finalUrl, finalKey, finalUid)

        // Trigger immediate poll if all creds are supplied
        if (finalUrl && finalKey && finalUid) {
          fetchJellyfinProgress(finalUrl, finalKey, finalUid)
            .then(async (progressMap) => {
              const items = Array.from(progressMap.values())
              if (items.length > 0) {
                await jellyfinRepo.upsertProgress(userId, items)
                sseBus.emit(userId, '', { pushedAt: new Date().toISOString() })
                console.log(`[settings] Immediate Jellyfin poll: ${items.length} records saved`)
              }
            })
            .catch((err) => console.error('[settings] Immediate Jellyfin poll failed:', err))
        }
      }

      // 2. Partial update for LLM configurations
      if (userRepo && (llmProvider !== undefined || llmBaseUrl !== undefined || llmApiKey !== undefined || llmModel !== undefined || recapMinInterval !== undefined)) {
        const existing = await userRepo.getLlmSettings(userId)
        const finalProvider = llmProvider !== undefined ? llmProvider : (existing?.llmProvider ?? 'gemini')
        const finalBaseUrl = llmBaseUrl !== undefined ? llmBaseUrl : (existing?.llmBaseUrl ?? null)
        const finalApiKey = llmApiKey !== undefined 
          ? (llmApiKey === '••••••••' ? (existing?.llmApiKey ?? null) : llmApiKey) 
          : (existing?.llmApiKey ?? null)
        const finalModel = llmModel !== undefined ? llmModel : (existing?.llmModel ?? null)
        const finalInterval = recapMinInterval !== undefined ? Number(recapMinInterval) : (existing?.recapMinInterval ?? 5)

        await userRepo.updateLlmSettings(userId, {
          llmProvider: finalProvider,
          llmBaseUrl: finalBaseUrl || null,
          llmApiKey: finalApiKey || null,
          llmModel: finalModel || null,
          recapMinInterval: finalInterval || 5,
        })
      }

      return reply.send({ success: true })
    }
  )

  // POST — trigger an immediate Jellyfin poll for the authenticated user
  app.post(
    '/api/user/jellyfin/poll',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const userId = req.user.sub
      const users = await jellyfinRepo.getAllConfiguredUsers()
      const user = users.find(u => u.id === userId)

      if (!user) {
        return reply.status(400).send({ error: 'Jellyfin not configured. Save credentials first.' })
      }

      try {
        const progressMap = await fetchJellyfinProgress(user.url, user.apiKey, user.jellyfinUserId)
        const items = Array.from(progressMap.values())
        await jellyfinRepo.upsertProgress(userId, items)
        sseBus.emit(userId, '', { pushedAt: new Date().toISOString() })
        return reply.send({ success: true, count: items.length })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ error: msg })
      }
    }
  )
}
