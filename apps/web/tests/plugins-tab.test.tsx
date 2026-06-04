import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PluginsTab } from '../src/components/settings/PluginsTab'

const refresh = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'test-token', user: { id: '1' } } }),
}))

vi.mock('../src/plugins/PluginRegistryProvider', () => ({
  usePluginRegistryContext: () => ({
    installedMeta: [
      { id: 'youtube', displayName: 'YouTube Links', source: 'builtin', enabled: true },
      { id: 'local-dev', displayName: 'Local Dev', source: 'filesystem', enabled: false, path: 'C:\\plugins\\local-dev' },
      { id: 'broken-upload', displayName: 'Broken Upload', source: 'custom', enabled: true },
    ],
    isLoading: false,
    error: null,
    failedIds: new Set(['broken-upload']),
    refresh,
  }),
}))

vi.mock('../src/plugins/official-catalog', () => ({
  OFFICIAL_CATALOG: [
    { id: 'youtube', displayName: 'YouTube Links', description: 'Add YouTube videos and playlists to your watch lists.' },
    { id: 'rss', displayName: 'RSS Feeds', description: 'Subscribe to feed entries.' },
  ],
}))

vi.mock('@/plugins/registry', () => ({
  PLUGINS: [
    { id: 'youtube', displayName: 'YouTube Links', listTypes: [{ id: 'youtube', label: 'YouTube' }] },
  ],
}))

describe('PluginsTab', () => {
  beforeEach(() => {
    refresh.mockReset()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test'
  })

  it('shows known plugins in one unified table with status, type, source, operation, and load action', () => {
    render(<PluginsTab />)

    expect(screen.getByRole('heading', { name: /all plugins/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /name/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /description/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /type/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /source/i })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /operation/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /load plugin/i })).toBeTruthy()

    const youtubeRow = screen.getByRole('row', { name: /youtube links/i })
    expect(within(youtubeRow).getByText(/enabled/i)).toBeTruthy()
    expect(within(youtubeRow).getByText('List: YouTube')).toBeTruthy()
    expect(within(youtubeRow).getByText('Built-in')).toBeTruthy()
    expect(within(youtubeRow).getByRole('button', { name: /disable youtube links/i })).toBeTruthy()

    const localRow = screen.getByRole('row', { name: /local dev/i })
    expect(within(localRow).getByText(/disabled/i)).toBeTruthy()
    expect(within(localRow).getByText(/filesystem/i)).toBeTruthy()
    expect(within(localRow).getByRole('button', { name: /start local dev/i })).toBeTruthy()

    const brokenRow = screen.getByRole('row', { name: /broken upload/i })
    expect(within(brokenRow).getByText(/load error/i)).toBeTruthy()
    fireEvent.click(within(brokenRow).getByRole('button', { name: /retry broken upload/i }))
    expect(refresh).toHaveBeenCalled()

    const rssRow = screen.getByRole('row', { name: /rss feeds/i })
    expect(within(rssRow).getByText(/not loaded/i)).toBeTruthy()
    expect(within(rssRow).getByRole('button', { name: /load rss feeds/i })).toBeTruthy()
  })

  it('sends plugin operations to the configured API URL', async () => {
    render(<PluginsTab />)

    fireEvent.click(within(screen.getByRole('row', { name: /rss feeds/i })).getByRole('button', { name: /load rss feeds/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.test/api/plugins/rss',
      expect.objectContaining({ method: 'PATCH' }),
    ))
  })

  it('does not force the plugins table into a horizontal scrollbar', () => {
    render(<PluginsTab />)

    const table = screen.getByRole('table')
    expect(table.parentElement?.className).not.toContain('overflow-x-auto')
    expect(table.getAttribute('style') ?? '').not.toContain('min-width')
  })
})
