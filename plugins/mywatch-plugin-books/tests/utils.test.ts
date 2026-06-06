import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildCoverUrl,
  buildStoreSearchUrl,
  getStoreUrl,
  setStoreUrl,
} from '../src/utils'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => localStorageMock.clear())

describe('buildCoverUrl', () => {
  it('builds medium cover URL', () => {
    expect(buildCoverUrl(12345)).toBe('https://covers.openlibrary.org/b/id/12345-M.jpg')
  })
  it('builds large cover URL', () => {
    expect(buildCoverUrl(12345, 'L')).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg')
  })
})

describe('setStoreUrl / getStoreUrl', () => {
  it('persists and retrieves store URL', () => {
    setStoreUrl('https://mystore.com/search')
    expect(getStoreUrl()).toBe('https://mystore.com/search')
  })
  it('returns empty string when not set', () => {
    expect(getStoreUrl()).toBe('')
  })
  it('removes key when set to empty string', () => {
    setStoreUrl('https://mystore.com/search')
    setStoreUrl('')
    expect(getStoreUrl()).toBe('')
  })
})

describe('buildStoreSearchUrl', () => {
  it('returns null when no store URL configured', () => {
    expect(buildStoreSearchUrl('Dune', 'Frank Herbert')).toBeNull()
  })
  it('appends query to store URL without existing query string', () => {
    setStoreUrl('https://mystore.com/search')
    const url = buildStoreSearchUrl('Dune', 'Frank Herbert')
    expect(url).toBe('https://mystore.com/search?q=Dune%20Frank%20Herbert')
  })
  it('appends query to store URL with existing query string', () => {
    setStoreUrl('https://mystore.com/search?lang=en')
    const url = buildStoreSearchUrl('Dune', 'Frank Herbert')
    expect(url).toBe('https://mystore.com/search?lang=en&q=Dune%20Frank%20Herbert')
  })
})
