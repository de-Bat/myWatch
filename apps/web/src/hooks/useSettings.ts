'use client'
import { createContext, useContext, useState, useEffect, createElement } from 'react'
import type { ReactNode } from 'react'

export interface CardMetaSettings {
  showGenres: boolean
  showTmdbRating: boolean
  showRuntime: boolean
  showProviders: boolean
  showOverview: boolean
}

export interface AppSettings {
  theme: 'dark' | 'light'
  tmdbApiKey: string
  language: string
  cardMeta: CardMetaSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  tmdbApiKey: '',
  language: 'en-US',
  cardMeta: {
    showGenres: true,
    showTmdbRating: false,
    showRuntime: false,
    showProviders: false,
    showOverview: false,
  },
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

    function onStorage(e: StorageEvent) {
      if (e.key === 'mywatch_settings') {
        const fresh = loadSettings()
        setSettings(fresh)
        applyTheme(fresh.theme)
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
