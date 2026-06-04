export interface OfficialPluginEntry {
  id: string
  displayName: string
  description: string
}

export const OFFICIAL_CATALOG: OfficialPluginEntry[] = [
  {
    id: 'youtube',
    displayName: 'YouTube Links',
    description: 'Add YouTube videos and playlists to your watch lists.',
  },
]

export function isInCatalog(id: string): boolean {
  return OFFICIAL_CATALOG.some((p) => p.id === id)
}
