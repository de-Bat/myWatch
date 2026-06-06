# Books Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `mywatch-plugin-books` plugin that lets users track books to read in dedicated lists, with Open Library metadata search, book cover display in grid/list views, and configurable local bookstore search links.

**Architecture:** Mirrors `mywatch-plugin-youtube` exactly — a standalone package under `plugins/` with its own `package.json`, auto-discovered by `scan-plugins.mjs`. Adds an optional `viewMode` prop to `PluginCardProps` in the SDK so the books card can render differently in grid vs list. The `official-catalog.ts` and API `BUILTIN_PLUGINS` each get a new entry.

**Tech Stack:** React 18, TypeScript, Open Library REST API (`openlibrary.org/search.json`), localStorage for store URL, Vitest for tests, CSS variables from existing design system.

---

### Task 1: Plugin scaffold

**Files:**
- Create: `plugins/mywatch-plugin-books/package.json`
- Create: `plugins/mywatch-plugin-books/tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mywatch-plugin-books",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.tsx",
  "types": "./src/index.tsx",
  "mywatch": {
    "id": "books",
    "displayName": "Books"
  },
  "scripts": {
    "test": "vitest run"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "vitest": "^2.1.9"
  },
  "dependencies": {
    "@mywatch/plugin-sdk": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Install workspace deps**

Run from repo root:
```bash
pnpm install
```
Expected: `mywatch-plugin-books` appears in workspace packages, no errors.

- [ ] **Step 4: Commit**

```bash
git add plugins/mywatch-plugin-books/package.json plugins/mywatch-plugin-books/tsconfig.json
git commit -m "feat(books): scaffold books plugin package"
```

---

### Task 2: Open Library utils

**Files:**
- Create: `plugins/mywatch-plugin-books/src/utils.ts`

- [ ] **Step 1: Write the failing test first (see Task 3) — skip ahead to Task 3, then return here**

_(Task 3 must be written before this implementation so tests drive the shape of the API.)_

- [ ] **Step 2: Create utils.ts**

```typescript
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
  const data = await res.json() as { docs?: OpenLibraryResult[] }
  return (data.docs ?? []).map((doc) => ({
    openLibraryKey: doc.key,
    title: doc.title,
    author: (doc.authorName ?? [])[0] ?? 'Unknown',
    coverUrl: doc.coverId ? buildCoverUrl(doc.coverId) : undefined,
    year: doc.firstPublishYear,
    isbn: (doc.isbn ?? [])[0],
    description: typeof doc.description === 'string' ? doc.description : undefined,
  }))
}
```

- [ ] **Step 3: Run tests (written in Task 3)**

```bash
cd plugins/mywatch-plugin-books && pnpm test
```
Expected: all utils tests PASS.

- [ ] **Step 4: Commit**

```bash
git add plugins/mywatch-plugin-books/src/utils.ts
git commit -m "feat(books): add Open Library search utils"
```

---

### Task 3: Utils tests

**Files:**
- Create: `plugins/mywatch-plugin-books/tests/utils.test.ts`

- [ ] **Step 1: Create test file**

```typescript
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
```

- [ ] **Step 2: Run tests (they will fail — utils.ts not created yet)**

```bash
cd plugins/mywatch-plugin-books && pnpm test
```
Expected: FAIL with import errors (utils.ts doesn't exist).

- [ ] **Step 3: Now implement utils.ts (Task 2, Step 2) and re-run**

```bash
cd plugins/mywatch-plugin-books && pnpm test
```
Expected: all 7 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add plugins/mywatch-plugin-books/tests/utils.test.ts
git commit -m "test(books): add utils unit tests"
```

---

### Task 4: Settings panel

**Files:**
- Create: `plugins/mywatch-plugin-books/src/BooksSettingsPanel.tsx`

- [ ] **Step 1: Create BooksSettingsPanel.tsx**

```tsx
import { useState } from 'react'
import type { PluginSettingsProps } from '@mywatch/plugin-sdk'
import { getStoreUrl, setStoreUrl } from './utils'

export function BooksSettingsPanel(_props: PluginSettingsProps) {
  const [url, setUrl] = useState(() => getStoreUrl())
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (url.trim()) {
      try {
        new URL(url.trim())
      } catch {
        setError('Enter a valid URL (include https://)')
        return
      }
    }
    setError(null)
    setStoreUrl(url.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label
          className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase"
          style={{ color: 'var(--muted2)' }}
        >
          Local Bookstore Search URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSaved(false); setError(null) }}
          placeholder="https://myfavoritebookstore.com/search"
          className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
        <p className="text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>
          Plugin appends <code>?q=title+author</code> to this URL. Leave empty to hide store links.
        </p>
        {error && (
          <p className="text-[var(--text-11)]" style={{ color: 'var(--red)' }}>{error}</p>
        )}
      </div>
      <button
        onClick={handleSave}
        className="self-start px-4 py-2 rounded-[6px] text-[var(--text-13)] font-medium border-none cursor-pointer"
        style={{ background: 'var(--accent)', color: '#fff', opacity: saved ? 0.7 : 1 }}
      >
        {saved ? 'Saved!' : 'Save'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/mywatch-plugin-books/src/BooksSettingsPanel.tsx
git commit -m "feat(books): add bookstore URL settings panel"
```

---

### Task 5: Add viewMode to plugin SDK

**Files:**
- Modify: `packages/plugin-sdk/src/index.ts`

The books card needs to render differently in grid vs list mode. Add an optional `viewMode` prop so the app can pass it through.

- [ ] **Step 1: Edit PluginCardProps in `packages/plugin-sdk/src/index.ts`**

Change:
```typescript
export interface PluginCardProps {
  item: PluginItem
  onSelect?: () => void
}
```
To:
```typescript
export interface PluginCardProps {
  item: PluginItem
  onSelect?: () => void
  viewMode?: 'grid' | 'list'
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugin-sdk/src/index.ts
git commit -m "feat(sdk): add optional viewMode prop to PluginCardProps"
```

---

### Task 6: Pass viewMode to plugin cards in the app

**Files:**
- Modify: `apps/web/src/app/page.tsx` (lines ~1289–1314)

Currently the plugin card container is always `flex flex-col`. Update to use a grid layout when `viewMode === 'grid'`, and pass `viewMode` to each card.

- [ ] **Step 1: Update the plugin items rendering block in `apps/web/src/app/page.tsx`**

Find this block (around line 1289):
```tsx
activeListPlugin ? (
  <div className="flex flex-col" style={{ gap: 8 }}>
    {pluginItems.length === 0 ? (
      // ... empty state
    ) : (
      pluginItems.map((pi: PluginItem) => {
        const Card = activeListPlugin.CardComponent
        return <Card key={pi.id} item={pi} />
      })
    )}
  </div>
```

Replace with:
```tsx
activeListPlugin ? (
  <div
    className={viewMode === 'grid' ? 'grid' : 'flex flex-col'}
    style={
      viewMode === 'grid'
        ? { gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }
        : { gap: 8 }
    }
  >
    {pluginItems.length === 0 ? (
      // ... empty state unchanged
    ) : (
      pluginItems.map((pi: PluginItem) => {
        const Card = activeListPlugin.CardComponent
        return <Card key={pi.id} item={pi} viewMode={viewMode} />
      })
    )}
  </div>
```

- [ ] **Step 2: Verify the app still compiles**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(app): pass viewMode to plugin cards and support grid layout"
```

---

### Task 7: Books card component

**Files:**
- Create: `plugins/mywatch-plugin-books/src/BooksCard.tsx`

- [ ] **Step 1: Create BooksCard.tsx**

```tsx
import type { PluginCardProps } from '@mywatch/plugin-sdk'
import { useState } from 'react'
import { buildStoreSearchUrl } from './utils'

interface BookData {
  title: string
  author: string
  coverUrl?: string
  year?: number
  read: boolean
}

function BookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted2)' }}>
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>
  )
}

function StoreLinkButton({ title, author, compact }: { title: string; author: string; compact?: boolean }) {
  const href = buildStoreSearchUrl(title, author)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Find in store"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center rounded-[4px] transition-opacity hover:opacity-70"
      style={{
        background: 'var(--surface2)',
        color: 'var(--muted)',
        padding: compact ? '2px 6px' : '4px 8px',
        fontSize: compact ? 'var(--text-10)' : 'var(--text-11)',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      {compact ? '🔗' : '🔗 Find in store'}
    </a>
  )
}

export function BooksCard({ item, viewMode = 'list' }: PluginCardProps) {
  const data = item.data as BookData
  const [imgError, setImgError] = useState(false)

  if (viewMode === 'grid') {
    return (
      <div
        className="flex flex-col rounded-[var(--r)] border overflow-hidden group"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border2)',
          transition: 'background 120ms, border-color 120ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface)'
          e.currentTarget.style.borderColor = 'var(--border2)'
        }}
      >
        {/* Cover — 2:3 aspect ratio */}
        <div style={{ position: 'relative', paddingBottom: '150%', background: 'var(--surface2)' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            {!imgError && data.coverUrl ? (
              <img
                src={data.coverUrl}
                alt={data.title}
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookIcon />
              </div>
            )}
          </div>
          {/* Hover overlay */}
          <div
            className="absolute inset-0 flex items-end justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 60%)' }}
          >
            <StoreLinkButton title={data.title} author={data.author} compact />
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p
            className="text-[var(--text-12)] font-semibold leading-[1.3]"
            style={{
              color: 'var(--fg)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {data.title}
          </p>
          <p
            className="text-[var(--text-11)]"
            style={{ color: 'var(--muted2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {data.author}
          </p>
          {data.read && (
            <span
              className="self-start text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
              style={{ background: 'rgba(134,239,172,.12)', color: 'var(--green)' }}
            >
              Read
            </span>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div
      className="flex gap-3 rounded-[var(--r)] border overflow-hidden"
      style={{
        padding: '10px 14px',
        background: 'var(--surface)',
        borderColor: 'var(--border2)',
        transition: 'background 120ms, border-color 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface2)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--surface)'
        e.currentTarget.style.borderColor = 'var(--border2)'
      }}
    >
      {/* Cover thumbnail */}
      <div
        style={{
          width: 40,
          height: 60,
          flexShrink: 0,
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--surface2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!imgError && data.coverUrl ? (
          <img
            src={data.coverUrl}
            alt={data.title}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <BookIcon />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px] justify-center">
        <p
          className="text-[var(--text-14)] font-semibold leading-[1.3] tracking-[-0.015em]"
          style={{
            color: 'var(--fg)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.title}
        </p>
        <div className="flex items-center gap-[6px]">
          <span className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
            {data.author}
          </span>
          {data.year && (
            <>
              <span style={{ opacity: 0.35, color: 'var(--muted2)', fontSize: 'var(--text-11h)' }}>·</span>
              <span className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
                {data.year}
              </span>
            </>
          )}
          {data.read && (
            <>
              <span style={{ opacity: 0.35, color: 'var(--muted2)', fontSize: 'var(--text-11h)' }}>·</span>
              <span
                className="text-[var(--text-9h)] font-extrabold tracking-[0.06em] uppercase px-[5px] py-[1.5px] rounded-[3px]"
                style={{ background: 'rgba(134,239,172,.12)', color: 'var(--green)' }}
              >
                Read
              </span>
            </>
          )}
        </div>
      </div>

      {/* Store link */}
      <div className="flex items-center flex-shrink-0">
        <StoreLinkButton title={data.title} author={data.author} compact />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/mywatch-plugin-books/src/BooksCard.tsx
git commit -m "feat(books): add BooksCard with grid and list layouts"
```

---

### Task 8: Add books item modal

**Files:**
- Create: `plugins/mywatch-plugin-books/src/AddBooksItemModal.tsx`

- [ ] **Step 1: Create AddBooksItemModal.tsx**

```tsx
import { useState, useEffect, useRef } from 'react'
import type { AddItemModalProps } from '@mywatch/plugin-sdk'
import { searchBooks } from './utils'

interface BookMetadata {
  openLibraryKey: string
  title: string
  author: string
  coverUrl?: string
  year?: number
  isbn?: string
  description?: string
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--muted2)' }}>
      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>
  )
}

export function AddBooksItemModal({ playlistId, onClose, onAdded }: AddItemModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookMetadata[]>([])
  const [selected, setSelected] = useState<BookMetadata | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualAuthor, setManualAuthor] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus()
  }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setError(null)
    setSearching(true)
    setResults([])
    setSelected(null)
    try {
      const hits = await searchBooks(query)
      if (hits.length === 0) {
        setError('No results found. Add manually below.')
        setManualMode(true)
      } else {
        setResults(hits)
      }
    } catch {
      setError('Search failed. Check connection or add manually.')
      setManualMode(true)
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd() {
    if (manualMode) {
      if (!manualTitle.trim() || !manualAuthor.trim()) {
        setError('Title and author required')
        return
      }
      setSaving(true)
      const now = new Date().toISOString()
      onAdded({
        id: crypto.randomUUID(),
        pluginId: 'books',
        listTypeId: 'books',
        playlistId,
        data: { title: manualTitle.trim(), author: manualAuthor.trim(), read: false },
        addedAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      setSaving(false)
      onClose()
      return
    }
    if (!selected) return
    setSaving(true)
    const now = new Date().toISOString()
    onAdded({
      id: crypto.randomUUID(),
      pluginId: 'books',
      listTypeId: 'books',
      playlistId,
      data: {
        title: selected.title,
        author: selected.author,
        coverUrl: selected.coverUrl,
        year: selected.year,
        isbn: selected.isbn,
        description: selected.description,
        openLibraryKey: selected.openLibraryKey,
        read: false,
      },
      addedAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    setSaving(false)
    onClose()
  }

  const canAdd = manualMode ? (manualTitle.trim().length > 0 && manualAuthor.trim().length > 0) : selected !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-t-[16px] sm:rounded-[12px] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '85vh', overflow: 'hidden' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border2)', flexShrink: 0 }}
        >
          <h2 className="text-[var(--text-15)] font-semibold" style={{ color: 'var(--fg)', letterSpacing: '-0.02em' }}>
            Add Book
          </h2>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] flex items-center justify-center rounded-full transition-all duration-100 border-none cursor-pointer"
            style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          {!manualMode && (
            <div className="flex flex-col gap-2">
              <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                Search by title, author, or ISBN
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
                  placeholder="e.g. Dune, Frank Herbert, 978…"
                  className="flex-1 px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button
                  onClick={() => void handleSearch()}
                  disabled={searching || !query.trim()}
                  className="px-3 py-2 rounded-[6px] text-[var(--text-12)] font-medium border-none cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
                >
                  {searching ? '…' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-[var(--text-11)]" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          {/* Search results */}
          {results.length > 0 && !manualMode && (
            <div className="flex flex-col gap-1">
              <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                Results
              </label>
              {results.map((book) => (
                <button
                  key={book.openLibraryKey}
                  onClick={() => setSelected(book)}
                  className="flex gap-3 rounded-[8px] text-left border-none cursor-pointer transition-all duration-100"
                  style={{
                    background: selected?.openLibraryKey === book.openLibraryKey ? 'var(--surface2)' : 'transparent',
                    border: `1px solid ${selected?.openLibraryKey === book.openLibraryKey ? 'var(--accent)' : 'var(--border2)'}`,
                    padding: '8px 10px',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 52,
                      flexShrink: 0,
                      borderRadius: 3,
                      overflow: 'hidden',
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <BookIcon />
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col gap-[2px] justify-center">
                    <p
                      className="text-[var(--text-13)] font-medium leading-[1.3]"
                      style={{ color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {book.title}
                    </p>
                    <p className="text-[var(--text-11h)]" style={{ color: 'var(--muted2)' }}>
                      {book.author}{book.year ? ` · ${book.year}` : ''}
                    </p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setManualMode(true); setResults([]) }}
                className="text-[var(--text-11)] text-left border-none bg-transparent cursor-pointer mt-1"
                style={{ color: 'var(--muted)', textDecoration: 'underline' }}
              >
                Not what you're looking for? Add manually
              </button>
            </div>
          )}

          {/* Manual entry */}
          {manualMode && (
            <div className="flex flex-col gap-3">
              <label className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
                Add manually
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => { setManualTitle(e.target.value); setError(null) }}
                placeholder="Title *"
                className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              <input
                type="text"
                value={manualAuthor}
                onChange={(e) => { setManualAuthor(e.target.value); setError(null) }}
                placeholder="Author *"
                className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
              {!error && (
                <button
                  onClick={() => { setManualMode(false); setError(null) }}
                  className="text-[var(--text-11)] text-left border-none bg-transparent cursor-pointer"
                  style={{ color: 'var(--muted)', textDecoration: 'underline' }}
                >
                  Back to search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border2)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border"
            style={{ background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleAdd()}
            disabled={!canAdd || saving}
            className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium transition-all duration-100 cursor-pointer border-none disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {saving ? 'Adding…' : 'Add Book'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/mywatch-plugin-books/src/AddBooksItemModal.tsx
git commit -m "feat(books): add book search and add modal"
```

---

### Task 9: Plugin entry point

**Files:**
- Create: `plugins/mywatch-plugin-books/src/index.tsx`

- [ ] **Step 1: Create index.tsx**

```tsx
import type { MyWatchPlugin } from '@mywatch/plugin-sdk'
import { BooksCard } from './BooksCard'
import { AddBooksItemModal } from './AddBooksItemModal'
import { BooksSettingsPanel } from './BooksSettingsPanel'

const booksPlugin: MyWatchPlugin = {
  id: 'books',
  displayName: 'Books',
  listTypes: [
    {
      id: 'books',
      label: 'Books',
      CardComponent: BooksCard,
      AddItemModal: AddBooksItemModal,
    },
  ],
  settingsPanel: BooksSettingsPanel,
}

export default booksPlugin
```

- [ ] **Step 2: Commit**

```bash
git add plugins/mywatch-plugin-books/src/index.tsx
git commit -m "feat(books): add plugin entry point"
```

---

### Task 10: Register in official catalog

**Files:**
- Modify: `apps/web/src/plugins/official-catalog.ts`

- [ ] **Step 1: Add books entry to OFFICIAL_CATALOG array in `apps/web/src/plugins/official-catalog.ts`**

Add after the youtube entry:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/plugins/official-catalog.ts
git commit -m "feat(books): register books plugin in official catalog"
```

---

### Task 11: Register in API BUILTIN_PLUGINS

**Files:**
- Modify: `apps/api/src/routes/plugins.ts`

- [ ] **Step 1: Add books to BUILTIN_PLUGINS in `apps/api/src/routes/plugins.ts`**

Change:
```typescript
const BUILTIN_PLUGINS = [
  { id: 'youtube', displayName: 'YouTube Links' },
] as const
```
To:
```typescript
const BUILTIN_PLUGINS = [
  { id: 'youtube', displayName: 'YouTube Links' },
  { id: 'books', displayName: 'Books' },
] as const
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/plugins.ts
git commit -m "feat(books): register books as builtin plugin in API"
```

---

### Task 12: Run scan-plugins and verify full build

- [ ] **Step 1: Run scan-plugins to regenerate registry**

```bash
cd apps/web && node scripts/scan-plugins.mjs
```
Expected output:
```
[scan-plugins] Found 2 plugin(s): mywatch-plugin-youtube, mywatch-plugin-books
```

- [ ] **Step 2: Verify registry.ts includes books plugin**

Check `apps/web/src/plugins/registry.ts` — should contain:
```typescript
import plugin1 from 'mywatch-plugin-books'
export const PLUGINS: MyWatchPlugin[] = [plugin0, plugin1]
```

- [ ] **Step 3: Full build**

```bash
cd apps/web && pnpm build
```
Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Run all tests**

```bash
cd plugins/mywatch-plugin-books && pnpm test
```
Expected: all tests PASS.

- [ ] **Step 5: Final commit**

```bash
git add apps/web/src/plugins/registry.ts apps/web/src/plugins/.plugins-manifest.json
git commit -m "feat(books): regenerate plugin registry with books plugin"
```
