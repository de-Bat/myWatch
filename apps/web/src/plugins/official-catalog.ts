export interface OfficialPluginEntry {
  id: string
  displayName: string
  description: string
  appearsInAllList?: boolean
  appearsInDedicatedList?: boolean
  useCustomMediaCard?: boolean
  typeBadge?: string
  showInListView?: boolean
  showInGridView?: boolean
}

export const OFFICIAL_CATALOG: OfficialPluginEntry[] = [
  {
    id: 'youtube',
    displayName: 'YouTube Links',
    description: 'Add YouTube videos and playlists to your watch lists.',
    appearsInAllList: false,
    appearsInDedicatedList: true,
    useCustomMediaCard: false,
    typeBadge: 'V',
    showInListView: true,
    showInGridView: true,
  },
  {
    id: 'books',
    displayName: 'Books',
    description: 'Track books you want to read in dedicated reading lists.',
    appearsInAllList: false,
    appearsInDedicatedList: true,
    useCustomMediaCard: false,
    typeBadge: 'B',
    showInListView: true,
    showInGridView: true,
  },
]

export function isInCatalog(id: string): boolean {
  return OFFICIAL_CATALOG.some((p) => p.id === id)
}
