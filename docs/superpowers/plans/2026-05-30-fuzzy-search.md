# Fuzzy Search + Nav Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local fuzzy search to the main watchlist page (offline, IndexedDB-only) and swap nav icons so the magnifier toggles an inline search bar, while `/search` gets a `+` add icon.

**Architecture:** Extract pure `fuzzyFilterItems()` function to `src/lib/fuzzySearch.ts` (testable). Modify `page.tsx` to add `searchOpen`/`searchQuery` state, a title map via `useLiveQuery`, and render the search bar + updated nav icons. Fuse.js does the matching.

**Tech Stack:** Fuse.js, Dexie (`db.mediaCache.bulkGet`), React `useState`/`useEffect`/`useRef`, existing vitest setup.

---

## File Map

| File | Action |
|------|--------|
| `apps/web/package.json` | Add `fuse.js` dep |
| `apps/web/src/lib/fuzzySearch.ts` | Create — pure filter function |
| `apps/web/tests/fuzzySearch.test.ts` | Create — unit tests |
| `apps/web/src/app/page.tsx` | Modify — state, title map, search bar JSX, nav icons |

---

### Task 1: Install fuse.js

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add dependency**

In `apps/web/`, run:
```bash
pnpm add fuse.js
```

- [ ] **Step 2: Verify install**

```bash
pnpm ls fuse.js
```
Expected: line showing `fuse.js` with a version number (e.g. `7.x.x`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add fuse.js for local watchlist fuzzy search"
```

---

### Task 2: Pure fuzzy filter utility + tests

**Files:**
- Create: `apps/web/src/lib/fuzzySearch.ts`
- Create: `apps/web/tests/fuzzySearch.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/tests/fuzzySearch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { WatchlistItem } from '@mywatch/core'
import { fuzzyFilterItems } from '../src/lib/fuzzySearch'

const base: WatchlistItem = {
  id: 'a',
  userId: 'u1',
  tmdbId: 1,
  mediaType: 'movie',
  status: 'planned',
  progressEpisode: null,
  progressSeason: null,
  rating: null,
  notes: null,
  addedAt: '2024-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  quitAt: null,
  updatedAt: '2024-01-01T00:00:00Z',
  deviceId: 'dev-1',
  deletedAt: null,
  customPlatforms: [],
}

const items: WatchlistItem[] = [
  { ...base, id: '1', tmdbId: 1, mediaType: 'movie' },
  { ...base, id: '2', tmdbId: 2, mediaType: 'tv' },
  { ...base, id: '3', tmdbId: 3, mediaType: 'movie' },
]

const titleMap = new Map<string, string>([
  ['1-movie', 'The Dark Knight'],
  ['2-tv',    'Breaking Bad'],
  ['3-movie', 'Inception'],
])

describe('fuzzyFilterItems', () => {
  it('returns all items when query is empty', () => {
    expect(fuzzyFilterItems(items, titleMap, '')).toEqual(items)
  })

  it('returns all items when query is only whitespace', () => {
    expect(fuzzyFilterItems(items, titleMap, '   ')).toEqual(items)
  })

  it('exact match returns correct item', () => {
    const result = fuzzyFilterItems(items, titleMap, 'Inception')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('partial match works (substring)', () => {
    const result = fuzzyFilterItems(items, titleMap, 'Dark')
    expect(result.some((i) => i.id === '1')).toBe(true)
  })

  it('fuzzy typo match works', () => {
    // 'incepion' missing a 't'
    const result = fuzzyFilterItems(items, titleMap, 'incepion')
    expect(result.some((i) => i.id === '3')).toBe(true)
  })

  it('no match returns empty array', () => {
    const result = fuzzyFilterItems(items, titleMap, 'zzzzzzzzz')
    expect(result).toHaveLength(0)
  })

  it('items with no title in map are excluded when query is non-empty', () => {
    const noTitle = new Map<string, string>() // empty map
    const result = fuzzyFilterItems(items, noTitle, 'Dark')
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/web && pnpm test -- fuzzySearch
```
Expected: `Cannot find module '../src/lib/fuzzySearch'`

- [ ] **Step 3: Create fuzzySearch.ts**

Create `apps/web/src/lib/fuzzySearch.ts`:

```ts
import Fuse from 'fuse.js'
import type { WatchlistItem } from '@mywatch/core'

export function fuzzyFilterItems(
  items: WatchlistItem[],
  titleMap: Map<string, string>,
  query: string,
): WatchlistItem[] {
  if (!query.trim()) return items

  const indexed = items.map((item) => ({
    item,
    title: titleMap.get(`${item.tmdbId}-${item.mediaType}`) ?? '',
  }))

  const fuse = new Fuse(indexed, {
    keys: ['title'],
    threshold: 0.35,
    ignoreLocation: true,
  })

  return fuse.search(query).map((r) => r.item.item)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/web && pnpm test -- fuzzySearch
```
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/fuzzySearch.ts apps/web/tests/fuzzySearch.test.ts
git commit -m "feat: fuzzyFilterItems utility with fuse.js"
```

---

### Task 3: Nav icon changes in page.tsx

**Files:**
- Modify: `apps/web/src/app/page.tsx`

The nav currently has a magnifier button that `router.push('/search')`. We:
1. Replace its SVG with a `+` icon (still navigates to `/search`).
2. Add a new magnifier button that toggles `searchOpen` state.

- [ ] **Step 1: Add searchOpen + searchQuery state**

In `page.tsx`, find the block of `useState` declarations near the top of `HomePage` (around line 40). Add after the existing state declarations:

```ts
const [searchOpen, setSearchOpen] = useState(false)
const [searchQuery, setSearchQuery] = useState('')
```

- [ ] **Step 2: Swap the existing Search button to an Add button**

Find this exact block in the nav (around line 248):

```tsx
          {/* Search */}
          <button
            onClick={() => router.push('/search')}
            title="Search"
            className="flex items-center justify-center w-[34px] h-[34px] border-none cursor-pointer transition-all duration-100"
            style={{ color: 'var(--muted)', background: 'transparent', borderRadius: 'var(--rsm)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <line x1="13" y1="13" x2="17.5" y2="17.5" />
            </svg>
          </button>
```

Replace with:

```tsx
          {/* Add (navigate to /search to add new content) */}
          <button
            onClick={() => router.push('/search')}
            title="Add"
            className="flex items-center justify-center w-[34px] h-[34px] border-none cursor-pointer transition-all duration-100"
            style={{ color: 'var(--muted)', background: 'transparent', borderRadius: 'var(--rsm)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="10" y1="3" x2="10" y2="17" />
              <line x1="3" y1="10" x2="17" y2="10" />
            </svg>
          </button>
          {/* Search — toggles inline search bar */}
          <button
            onClick={() => { setSearchOpen((o) => !o); setSearchQuery('') }}
            title="Search"
            className="flex items-center justify-center w-[34px] h-[34px] border-none cursor-pointer transition-all duration-100"
            style={{
              color: searchOpen ? 'var(--fg)' : 'var(--muted)',
              background: searchOpen ? 'var(--surface)' : 'transparent',
              borderRadius: 'var(--rsm)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = searchOpen ? 'var(--fg)' : 'var(--muted)'
              e.currentTarget.style.background = searchOpen ? 'var(--surface)' : 'transparent'
            }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <line x1="13" y1="13" x2="17.5" y2="17.5" />
            </svg>
          </button>
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm type-check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: swap nav search→add icon, add search toggle button"
```

---

### Task 4: Search bar UI

**Files:**
- Modify: `apps/web/src/app/page.tsx`

Add the search input that appears when `searchOpen` is true. It sits between the header and the filter bar (inside `page-sticky-shell`).

- [ ] **Step 1: Add searchInputRef**

In `page.tsx`, find the existing `useRef` calls near the top of `HomePage`. Add:

```ts
const searchInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 2: Auto-focus + Escape handler**

Add a `useEffect` after the existing effects:

```ts
useEffect(() => {
  if (searchOpen) {
    searchInputRef.current?.focus()
  }
}, [searchOpen])

useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && searchOpen) {
      setSearchOpen(false)
      setSearchQuery('')
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [searchOpen])
```

- [ ] **Step 3: Render search bar JSX**

In `page.tsx`, find the comment `{/* Import local data banner */}` (around line 303). Insert the search bar **before** that block, still inside `page-sticky-shell`:

```tsx
      {/* Inline search bar */}
      {searchOpen && (
        <div style={{ padding: '0 0 10px' }}>
          <div
            className="flex items-center gap-2"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--rsm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, color: 'var(--muted)' }}>
              <circle cx="8.5" cy="8.5" r="5.5" />
              <line x1="13" y1="13" x2="17.5" y2="17.5" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search your list…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 focus:outline-none"
              style={{ background: 'transparent', border: 'none', color: 'var(--fg)', fontSize: 14 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, lineHeight: 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="3" x2="13" y2="13" />
                  <line x1="13" y1="3" x2="3" y2="13" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && pnpm type-check
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: inline search bar — expands from search toggle"
```

---

### Task 5: Wire fuzzy filtering into displayed list

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Import fuzzyFilterItems**

At the top of `page.tsx`, add to the existing imports:

```ts
import { fuzzyFilterItems } from '@/lib/fuzzySearch'
```

- [ ] **Step 2: Build title map via useLiveQuery**

In `page.tsx`, find the `genreOptions` `useLiveQuery` block (around line 113). Add a new query **after** it:

```ts
  const titleMap = useLiveQuery(async () => {
    const keys = (allItems ?? []).map((i) => [i.tmdbId, i.mediaType] as [number, string])
    if (!keys.length) return new Map<string, string>()
    const entries = await db.mediaCache.bulkGet(keys)
    const map = new Map<string, string>()
    ;(allItems ?? []).forEach((item, idx) => {
      const entry = entries[idx]
      if (entry?.title) map.set(`${item.tmdbId}-${item.mediaType}`, entry.title)
    })
    return map
  }, [allItems?.length]) ?? new Map<string, string>()
```

- [ ] **Step 3: Apply fuzzy filter to displayed list**

Find this block (around line 173):

```ts
  const displayed = genreFilter.size > 0 && genreFilteredIds
    ? sorted.filter((i) => genreFilteredIds.has(i.id))
    : sorted
```

Replace with:

```ts
  const genreFiltered = genreFilter.size > 0 && genreFilteredIds
    ? sorted.filter((i) => genreFilteredIds.has(i.id))
    : sorted

  const displayed = searchOpen && searchQuery.trim()
    ? fuzzyFilterItems(genreFiltered, titleMap, searchQuery)
    : genreFiltered
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && pnpm type-check
```
Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
cd apps/web && pnpm test
```
Expected: all tests pass (including the 7 fuzzySearch tests from Task 2).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: wire fuzzy search into watchlist displayed list"
```

---

### Task 6: Smoke test in browser

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
cd apps/web && pnpm dev
```

- [ ] **Step 2: Verify nav icons**

Open `http://localhost:3000`. Confirm:
- Magnifier icon now appears as a `+` icon (navigates to `/search` on click).
- A new magnifier icon is to the left of `+` — clicking it makes a search bar appear/disappear inline.

- [ ] **Step 3: Verify search bar expands on mobile**

Resize browser to 390px wide. Tap magnifier → search bar appears inline below header. Typing filters the list. Typing gibberish → empty list. Clearing input → full list returns.

- [ ] **Step 4: Verify offline behavior**

In DevTools → Network → set to "Offline". Reload page. Search bar still works — list filters from local IndexedDB. No network errors in console.

- [ ] **Step 5: Verify Escape closes bar**

Click magnifier, type something, press Escape → bar collapses, query clears.

- [ ] **Step 6: Final commit if any tweaks made**

```bash
git add -p
git commit -m "fix: search bar polish after smoke test"
```
(Only if changes were made in Step 2–5.)
