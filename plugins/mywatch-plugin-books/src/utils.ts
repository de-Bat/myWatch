// Raw API response shape from Open Library (snake_case as returned by the API)
interface OpenLibraryDoc {
  key: string           // e.g. "/works/OL45883W"
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  isbn?: string[]
  description?: string
}

export interface OpenLibraryResult {
  key: string           // e.g. "/works/OL45883W"
  title: string
  authorName: string[]
  firstPublishYear?: number
  coverId?: number
  isbn?: string[]
  description?: string
}

export interface BookMetadata {
  openLibraryKey: string
  title: string
  author: string
  coverUrl?: string
  year?: number
  isbn?: string
  description?: string
}

const STORE_URL_KEY = 'books-plugin-store-url'

export function getStoreUrl(): string {
  return localStorage.getItem(STORE_URL_KEY) ?? ''
}

export function setStoreUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(STORE_URL_KEY, url.trim())
  } else {
    localStorage.removeItem(STORE_URL_KEY)
  }
}

export function buildStoreSearchUrl(title: string, author: string): string | null {
  const base = getStoreUrl()
  if (!base) return null
  const q = encodeURIComponent(`${title} ${author}`.trim())
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}q=${q}`
}

export function buildCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}

export async function searchBooks(query: string): Promise<BookMetadata[]> {
  if (!query.trim()) return []
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query.trim())}&limit=5&fields=key,title,author_name,first_publish_year,cover_i,isbn,description`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json() as { docs?: OpenLibraryDoc[] }
  return (data.docs ?? []).map((doc) => ({
    openLibraryKey: doc.key,
    title: doc.title,
    author: (doc.author_name ?? [])[0] ?? 'Unknown',
    coverUrl: doc.cover_i ? buildCoverUrl(doc.cover_i) : undefined,
    year: doc.first_publish_year,
    isbn: (doc.isbn ?? [])[0],
    description: typeof doc.description === 'string' ? doc.description : undefined,
  }))
}
