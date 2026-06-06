import type { ComponentType } from 'react'

export interface PluginItem {
  id: string
  pluginId: string
  listTypeId: string
  playlistId: string
  data: Record<string, unknown>
  addedAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PluginCardProps {
  item: PluginItem
  onSelect?: () => void
  viewMode?: 'grid' | 'list'
}

export interface AddItemModalProps {
  playlistId: string
  prefillUrl?: string
  onClose: () => void
  onAdded: (item: PluginItem) => void
}

export interface PluginSettingsProps {
  settings: Record<string, unknown>
  onUpdate: (patch: Record<string, unknown>) => void
}

export interface PluginListType {
  id: string
  label: string
  CardComponent: ComponentType<PluginCardProps>
  AddItemModal?: ComponentType<AddItemModalProps>
  matchesUrl?: (url: string) => boolean
  prefillFromUrl?: (url: string) => Promise<Partial<Record<string, unknown>>>
}

export interface MyWatchPlugin {
  id: string
  displayName: string
  listTypes?: PluginListType[]
  settingsPanel?: ComponentType<PluginSettingsProps>
}
