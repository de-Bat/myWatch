import { describe, expect, test } from 'vitest'
import { extractVideoId, matchesUrl, buildThumbnailUrl } from '../src/utils'

describe('extractVideoId', () => {
  test('extracts from youtube.com/watch?v=', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  test('extracts from youtu.be/ short link', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  test('extracts from youtube.com/shorts/', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  test('returns null for non-youtube URL', () => {
    expect(extractVideoId('https://vimeo.com/123456')).toBeNull()
  })
  test('returns null for malformed URL', () => {
    expect(extractVideoId('not a url')).toBeNull()
  })
})

describe('matchesUrl', () => {
  test('true for youtube.com/watch', () => {
    expect(matchesUrl('https://www.youtube.com/watch?v=abc')).toBe(true)
  })
  test('true for youtu.be', () => {
    expect(matchesUrl('https://youtu.be/abc')).toBe(true)
  })
  test('true for youtube.com/shorts', () => {
    expect(matchesUrl('https://www.youtube.com/shorts/abc')).toBe(true)
  })
  test('false for vimeo', () => {
    expect(matchesUrl('https://vimeo.com/123')).toBe(false)
  })
})

describe('buildThumbnailUrl', () => {
  test('returns maxresdefault thumbnail', () => {
    expect(buildThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    )
  })
})
