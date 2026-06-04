import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { PluginRegistryProvider, usePluginRegistryContext } from '../src/plugins/PluginRegistryProvider'
import { PLUGINS } from '../src/plugins/registry'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// next-auth/react mock — stable reference to avoid useEffect re-run loop
vi.mock('next-auth/react', () => {
  const session = { accessToken: 'test-token', user: { id: '1' } }
  return { useSession: () => ({ data: session }) }
})

// registry.ts is auto-generated and imports mywatch-plugin-youtube which is not
// installed as a direct dependency. Mock it with a minimal stub so tests can run.
vi.mock('../src/plugins/registry', () => ({
  PLUGINS: [{ id: 'youtube', displayName: 'YouTube Links', listTypes: [] }],
}))

beforeEach(() => {
  mockFetch.mockReset()
  ;(window as Window & { __mywatchPlugins?: unknown[] }).__mywatchPlugins = []
})

describe('PluginRegistryProvider', () => {
  it('returns all built-in plugins when all enabled', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        plugins: PLUGINS.map((p) => ({ id: p.id, source: 'builtin', enabled: true, displayName: p.displayName })),
      }),
    })
    const { result } = renderHook(() => usePluginRegistryContext(), {
      wrapper: PluginRegistryProvider,
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.plugins.length).toBe(PLUGINS.length)
  })

  it('excludes disabled built-in plugin', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        plugins: [{ id: 'youtube', source: 'builtin', enabled: false, displayName: 'YouTube Links' }],
      }),
    })
    const { result } = renderHook(() => usePluginRegistryContext(), {
      wrapper: PluginRegistryProvider,
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.plugins.find((p) => p.id === 'youtube')).toBeUndefined()
  })

  it('includes installedMeta in context', async () => {
    const meta = [{ id: 'youtube', source: 'builtin', enabled: true, displayName: 'YouTube Links' }]
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ plugins: meta }) })
    const { result } = renderHook(() => usePluginRegistryContext(), {
      wrapper: PluginRegistryProvider,
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.installedMeta).toEqual(meta)
  })
})
