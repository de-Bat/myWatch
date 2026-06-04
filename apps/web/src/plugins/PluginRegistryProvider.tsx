'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import type { MyWatchPlugin } from '@mywatch/plugin-sdk'
import type { InstalledPluginMeta } from '@mywatch/core'
import { PLUGINS } from './registry'

interface RegistryState {
  plugins: MyWatchPlugin[]
  installedMeta: InstalledPluginMeta[]
  isLoading: boolean
  error: string | null
  failedIds: Set<string>
  refresh: () => void
}

const PluginRegistryCtx = createContext<RegistryState>({
  plugins: PLUGINS,
  installedMeta: [],
  isLoading: false,
  error: null,
  failedIds: new Set(),
  refresh: () => {},
})

export function usePluginRegistryContext(): RegistryState {
  return useContext(PluginRegistryCtx)
}

const loadedScripts = new Set<string>()

function injectScript(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loadedScripts.has(id)) { resolve(); return }
    const script = document.createElement('script')
    script.src = `/api/plugins/${id}/bundle.js`
    script.onload = () => { loadedScripts.add(id); resolve() }
    script.onerror = () => reject(new Error(`Failed to load plugin: ${id}`))
    document.head.appendChild(script)
  })
}

export function PluginRegistryProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [installedMeta, setInstalledMeta] = useState<InstalledPluginMeta[]>([])
  const [plugins, setPlugins] = useState<MyWatchPlugin[]>(PLUGINS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set())
  const [refreshCount, setRefreshCount] = useState(0)

  function refresh() { setRefreshCount((c) => c + 1) }

  useEffect(() => {
    if (!session?.user) { setIsLoading(false); return }
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const token = (session as unknown as { accessToken?: string })?.accessToken ?? ''
        const res = await fetch('/api/plugins', {
          headers: { authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to fetch plugins')
        const { plugins: meta }: { plugins: InstalledPluginMeta[] } = await res.json()
        if (cancelled) return

        setInstalledMeta(meta)

        // Built-ins: include unless explicitly disabled in meta
        const disabledBuiltins = new Set(
          meta.filter((m) => m.source === 'builtin' && !m.enabled).map((m) => m.id)
        )
        const filteredBuiltins = PLUGINS.filter((p) => !disabledBuiltins.has(p.id))

        // Custom: load enabled ones via script tag
        const enabledCustom = meta.filter((m) => m.source === 'custom' && m.enabled)
        const newFailed = new Set<string>()
        await Promise.all(
          enabledCustom.map((m) =>
            injectScript(m.id).catch(() => { newFailed.add(m.id) })
          )
        )
        if (cancelled) return

        const runtimePlugins: MyWatchPlugin[] = (
          (window as unknown as { __mywatchPlugins?: MyWatchPlugin[] }).__mywatchPlugins ?? []
        ).filter((p) => !newFailed.has(p.id))

        setFailedIds(newFailed)
        setPlugins([...filteredBuiltins, ...runtimePlugins])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [session, refreshCount])

  return (
    <PluginRegistryCtx.Provider value={{ plugins, installedMeta, isLoading, error, failedIds, refresh }}>
      {children}
    </PluginRegistryCtx.Provider>
  )
}
