import type { PluginListType } from '@mywatch/plugin-sdk'
import { usePluginRegistryContext } from './PluginRegistryProvider'

export function usePlugins() {
  return usePluginRegistryContext().plugins
}

export function useListTypePlugin(listTypeId: string | undefined): PluginListType | undefined {
  const plugins = usePlugins()
  if (!listTypeId) return undefined
  for (const plugin of plugins) {
    const lt = plugin.listTypes?.find((l) => l.id === listTypeId)
    if (lt) return lt
  }
  return undefined
}

export function useUrlMatchPlugin(url: string): PluginListType | undefined {
  const plugins = usePlugins()
  for (const plugin of plugins) {
    for (const lt of plugin.listTypes ?? []) {
      if (lt.matchesUrl?.(url)) return lt
    }
  }
  return undefined
}

export function isPluginListType(type: string): boolean {
  return type !== 'manual' && type !== 'smart'
}
