'use client'
import { createContext, useContext, useState, useEffect, createElement } from 'react'
import type { ReactNode } from 'react'

export interface CardMetaSettings {
  showGenres: boolean
  showTmdbRating: boolean
  showRuntime: boolean
  showProviders: boolean
  showOverview: boolean
  showProgress: boolean
  showAvailability: boolean
  showPlatform: boolean
  showBadgesAsIcons: boolean
}

export const CARD_META_LABELS: Record<keyof CardMetaSettings, string> = {
  showGenres: 'Genres',
  showTmdbRating: 'TMDB Rating',
  showRuntime: 'Runtime',
  showProviders: 'Streaming Providers',
  showOverview: 'Plot Overview',
  showProgress: 'Progress Bars',
  showAvailability: 'Availability',
  showPlatform: 'Platform',
  showBadgesAsIcons: 'Badges As Icons',
}

export type FontFamily = 'system' | 'serif' | 'mono'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'
export type GridColumns = 2 | 3 | 4 | 5 | 'auto'

export const BADGE_ICON_SIZES: Record<FontSize, { container: number, icon: number }> = {
  sm: { container: 16, icon: 10 },
  md: { container: 20, icon: 12 },
  lg: { container: 24, icon: 14 },
  xl: { container: 28, icon: 16 },
}

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
  badgeIconSize: FontSize
  syncInterval: number // minutes; 0 = disabled
  gridColumns: GridColumns
  listCardMeta: CardMetaSettings
  gridCardMeta: CardMetaSettings
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
  badgeIconSize: 'md',
  syncInterval: 5,
  gridColumns: 'auto',
  listCardMeta: {
    showGenres: true,
    showTmdbRating: false,
    showRuntime: false,
    showProviders: false,
    showOverview: true,
    showProgress: true,
    showAvailability: false,
    showPlatform: false,
    showBadgesAsIcons: false,
  },
  gridCardMeta: {
    showGenres: true,
    showTmdbRating: false,
    showRuntime: false,
    showProviders: false,
    showOverview: false,
    showProgress: true,
    showAvailability: false,
    showPlatform: false,
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
    
    // Migration from old `cardMeta`
    let listMeta = parsed.listCardMeta || parsed.cardMeta || {}
    let gridMeta = parsed.gridCardMeta || parsed.cardMeta || {}
    
    // Map `showProgressBars` to `showProgress` for backwards compatibility
    if (listMeta.showProgressBars !== undefined && listMeta.showProgress === undefined) {
      listMeta.showProgress = listMeta.showProgressBars
    }
    if (gridMeta.showProgressBars !== undefined && gridMeta.showProgress === undefined) {
      gridMeta.showProgress = gridMeta.showProgressBars
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      listCardMeta: { ...DEFAULT_SETTINGS.listCardMeta, ...listMeta },
      gridCardMeta: { ...DEFAULT_SETTINGS.gridCardMeta, ...gridMeta },
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
  updateListCardMeta: (patch: Partial<CardMetaSettings>) => void
  updateGridCardMeta: (patch: Partial<CardMetaSettings>) => void
}

const Ctx = createContext<SettingsCtx>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  updateListCardMeta: () => {},
  updateGridCardMeta: () => {},
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

  function updateListCardMeta(patch: Partial<CardMetaSettings>) {
    setSettings((prev) => {
      const next = { ...prev, listCardMeta: { ...prev.listCardMeta, ...patch } }
      persistSettings(next)
      return next
    })
  }

  function updateGridCardMeta(patch: Partial<CardMetaSettings>) {
    setSettings((prev) => {
      const next = { ...prev, gridCardMeta: { ...prev.gridCardMeta, ...patch } }
      persistSettings(next)
      return next
    })
  }

  return createElement(Ctx.Provider, { value: { settings, update, updateListCardMeta, updateGridCardMeta } }, children)
}
