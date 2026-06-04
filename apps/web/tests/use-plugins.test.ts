import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePlugins, isPluginListType } from '../src/plugins/index'
import { PluginRegistryProvider } from '../src/plugins/PluginRegistryProvider'

vi.mock('../src/plugins/PluginRegistryProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/plugins/PluginRegistryProvider')>()
  return {
    ...actual,
    usePluginRegistryContext: () => ({
      plugins: [{ id: 'youtube', displayName: 'YouTube Links', listTypes: [{ id: 'youtube', label: 'YouTube' }] }],
      installedMeta: [],
      isLoading: false,
      error: null,
      failedIds: new Set(),
      refresh: vi.fn(),
    }),
  }
})

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null }),
}))

// registry.ts is auto-generated and imports mywatch-plugin-youtube which is not
// installed as a direct dependency. Mock it with a minimal stub so tests can run.
vi.mock('../src/plugins/registry', () => ({
  PLUGINS: [],
}))

describe('usePlugins', () => {
  it('returns plugins from context', () => {
    const { result } = renderHook(() => usePlugins(), { wrapper: PluginRegistryProvider })
    expect(result.current.find((p) => p.id === 'youtube')).toBeDefined()
  })
})

describe('isPluginListType', () => {
  it('returns false for manual', () => expect(isPluginListType('manual')).toBe(false))
  it('returns false for smart', () => expect(isPluginListType('smart')).toBe(false))
  it('returns true for youtube', () => expect(isPluginListType('youtube')).toBe(true))
})
