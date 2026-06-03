'use client'
import { createContext, useContext, useState, useEffect, createElement } from 'react'
import type { ReactNode } from 'react'

export interface CardMetaSettings {
  showGenres: boolean
  showTmdbRating: boolean
  showRuntime: boolean
  showProviders: boolean
  showOverview: boolean
  showProgressBars: boolean
  showBadgesAsIcons: boolean
}

export type FontFamily = 'system' | 'serif' | 'mono'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'
export type GridColumns = 2 | 3 | 4 | 5 | 'auto'

export interface AppSettings {
  theme: 'dark' | 'light'
  tmdbApiKey: string
  geminiApiKey: string
  llmProvider: 'gemini' | 'openai'
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  recapMinInterval: number
  language: string
  font: FontFamily
  fontSize: FontSize
  syncInterval: number // minutes; 0 = disabled
  gridColumns: GridColumns
  cardMeta: CardMetaSettings
  jellyfinUrl: string
  jellyfinApiKey: string
  jellyfinUserId: string
  radarrUrl: string
  radarrApiKey: string
  radarrQualityProfileId: number
  radarrRootFolderPath: string
  sonarrUrl: string
  sonarrApiKey: string
  sonarrQualityProfileId: number
  sonarrRootFolderPath: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  tmdbApiKey: '',
  geminiApiKey: '',
  llmProvider: 'gemini',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: '',
  llmModel: 'gpt-4o-mini',
  recapMinInterval: 5,
  language: 'en-US',
  font: 'system',
  fontSize: 'md',
  syncInterval: 5,
  gridColumns: 'auto',
  cardMeta: {
    showGenres: true,
    showTmdbRating: false,
    showRuntime: false,
    showProviders: false,
    showOverview: false,
    showProgressBars: true,
    showBadgesAsIcons: false,
  },
  jellyfinUrl: '',
  jellyfinApiKey: '',
  jellyfinUserId: '',
  radarrUrl: '',
  radarrApiKey: '',
  radarrQualityProfileId: 1,
  radarrRootFolderPath: '',
  sonarrUrl: '',
  sonarrApiKey: '',
  sonarrQualityProfileId: 1,
  sonarrRootFolderPath: '',
}

const FONT_SIZES: Record<FontSize, string> = {
  sm: '13px',
  md: '14px',
  lg: '15px',
  xl: '16px',
}

const STORAGE_KEY = 'mywatch_settings'

export function loadSettings(): AppSettings {
  try {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      cardMeta: { ...DEFAULT_SETTINGS.cardMeta, ...parsed.cardMeta },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function getTmdbApiKey(): string {
  try {
    if (typeof window === 'undefined') return ''
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return ''
    return JSON.parse(raw).tmdbApiKey ?? ''
  } catch {
    return ''
  }
}

function persistSettings(s: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

function applyTheme(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('light', theme === 'light')
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function applyFont(font: FontFamily, fontSize: FontSize) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (font === 'system') el.removeAttribute('data-font')
  else el.setAttribute('data-font', font)
  el.style.fontSize = FONT_SIZES[fontSize]
}

type SettingsCtx = {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => void
  updateCardMeta: (patch: Partial<CardMetaSettings>) => void
}

const Ctx = createContext<SettingsCtx>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  updateCardMeta: () => {},
})

export function useSettings(): SettingsCtx {
  return useContext(Ctx)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    applyTheme(loaded.theme)
    applyFont(loaded.font, loaded.fontSize)

    function onStorage(e: StorageEvent) {
      if (e.key === 'mywatch_settings') {
        const fresh = loadSettings()
        setSettings(fresh)
        applyTheme(fresh.theme)
        applyFont(fresh.font, fresh.fontSize)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch: Partial<AppSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      persistSettings(next)
      if (patch.theme) applyTheme(patch.theme)
      if (patch.font !== undefined || patch.fontSize !== undefined) {
        applyFont(next.font, next.fontSize)
      }
      return next
    })
  }

  function updateCardMeta(patch: Partial<CardMetaSettings>) {
    setSettings((prev) => {
      const next = { ...prev, cardMeta: { ...prev.cardMeta, ...patch } }
      persistSettings(next)
      return next
    })
  }

  return createElement(Ctx.Provider, { value: { settings, update, updateCardMeta } }, children)
}
