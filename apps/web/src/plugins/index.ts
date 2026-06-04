import type { MyWatchPlugin, PluginListType } from '@mywatch/plugin-sdk'
import { PLUGINS } from './registry'

export function usePlugins(): MyWatchPlugin[] {
  return PLUGINS
}

export function useListTypePlugin(listTypeId: string | undefined): PluginListType | undefined {
  if (!listTypeId) return undefined
  for (const plugin of PLUGINS) {
    const lt = plugin.listTypes?.find((l) => l.id === listTypeId)
    if (lt) return lt
  }
  return undefined
}

export function useUrlMatchPlugin(url: string): PluginListType | undefined {
  for (const plugin of PLUGINS) {
    for (const lt of plugin.listTypes ?? []) {
      if (lt.matchesUrl?.(url)) return lt
    }
  }
  return undefined
}

export function isPluginListType(type: string): boolean {
  return type !== 'manual' && type !== 'smart'
}
