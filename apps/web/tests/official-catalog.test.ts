import { describe, it, expect } from 'vitest'
import { OFFICIAL_CATALOG, isInCatalog } from '../src/plugins/official-catalog'

describe('OFFICIAL_CATALOG', () => {
  it('includes youtube entry', () => {
    expect(OFFICIAL_CATALOG.find((p) => p.id === 'youtube')).toBeDefined()
  })
})

describe('isInCatalog', () => {
  it('returns true for youtube', () => {
    expect(isInCatalog('youtube')).toBe(true)
  })

  it('returns false for unknown id', () => {
    expect(isInCatalog('does-not-exist')).toBe(false)
  })
})
