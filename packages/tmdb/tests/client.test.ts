import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TmdbClient } from '../src/client'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockFail(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Not Found',
  })
}

const client = new TmdbClient({ apiKey: 'test-key' })

describe('TmdbClient.search', () => {
  it('calls /search/multi with query param', async () => {
    mockOk({ results: [] })
    await client.search('matrix')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/multi'),
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('query=matrix'),
    )
  })

  it('filters out non-movie/tv results (e.g. persons)', async () => {
    mockOk({
      results: [
        { id: 1, media_type: 'movie', title: 'A', overview: '', poster_path: null, backdrop_path: null, release_date: '', genre_ids: [], vote_average: 0, vote_count: 0 },
        { id: 2, media_type: 'person', name: 'Actor', profile_path: null },
      ],
    })
    const results = await client.search('matrix')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe(1)
  })

  it('calls /search/movie when mediaType is movie', async () => {
    mockOk({ results: [] })
    await client.search('matrix', 'movie')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/movie'),
    )
  })

  it('calls /search/tv when mediaType is tv', async () => {
    mockOk({ results: [] })
    await client.search('breaking', 'tv')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/tv'),
    )
  })
})

describe('TmdbClient.getMovie', () => {
  it('calls /movie/:id', async () => {
    mockOk({ id: 603, title: 'The Matrix', overview: '', poster_path: null, backdrop_path: null, release_date: '', genres: [], vote_average: 0, vote_count: 0, runtime: 136, status: 'Released' })
    await client.getMovie(603)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/movie/603'))
  })

  it('throws on non-ok response', async () => {
    mockFail(404)
    await expect(client.getMovie(9999)).rejects.toThrow('TMDB /movie/9999 failed: 404')
  })
})

describe('TmdbClient.getTrending', () => {
  it('defaults to week window', async () => {
    mockOk({ results: [] })
    await client.getTrending()
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/trending/all/week'))
  })
})
