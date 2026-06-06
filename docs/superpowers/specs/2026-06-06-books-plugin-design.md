# Books Plugin Design

**Date:** 2026-06-06  
**Status:** Approved

## Overview

New `mywatch-plugin-books` plugin for tracking books to read. Follows the YouTube plugin pattern exactly. Not displayed in ALL view — only in dedicated books-type playlists. Supports grid and list view. Book metadata fetched from Open Library (free, no API key). Store links generated per-book using a user-configured base URL.

## Architecture

Mirrors `mywatch-plugin-youtube` structure:

```
plugins/mywatch-plugin-books/
├── package.json
├── src/
│   ├── index.tsx              # MyWatchPlugin export
│   ├── BooksCard.tsx          # Grid + list card component
│   ├── AddBooksItemModal.tsx  # Search + add form
│   ├── BooksSettingsPanel.tsx # Store URL config
│   └── utils.ts               # Open Library API, helpers
├── tests/
│   └── utils.test.ts
└── tsconfig.json
```

## Data Model

Stored in `PluginItem.data`:

```typescript
{
  title: string
  author: string
  coverUrl?: string        // https://covers.openlibrary.org/b/id/{coverId}-M.jpg
  isbn?: string
  year?: number
  description?: string
  read: boolean            // reading status, togglable from card
  openLibraryKey?: string  // e.g. "/works/OL45883W"
}
```

## Plugin Registration

**`package.json` mywatch config:**
```json
{
  "mywatch": {
    "id": "books",
    "displayName": "Books"
  }
}
```

**Official catalog entry (`official-catalog.ts`):**
```typescript
{
  id: 'books',
  displayName: 'Books',
  description: 'Track books you want to read.',
  appearsInAllList: false,
  appearsInDedicatedList: true,
  typeBadge: 'B',
  showInGridView: true,
  showInListView: true,
}
```

**Backend builtin plugins (`apps/api/src/routes/plugins.ts`):**
```typescript
{ id: 'books', displayName: 'Books' }
```

## Add Form (`AddBooksItemModal`)

Triggered by existing "+" button when active list type is `books`.

**Flow:**
1. User types title, author, or ISBN into search input
2. Click "Search" → `GET https://openlibrary.org/search.json?q={query}&limit=5`
3. Show top 5 results: cover thumbnail + title + author + year
4. User clicks result → preview populates (cover, title, author, year, description)
5. Click "Add" → saves `PluginItem` to IndexedDB via `useUpsertPluginItem`
6. `onAdded(item)` callback fires, modal closes

**Manual fallback:** if search returns nothing, show manual entry form (title + author required).

**Cover URL:**
```
https://covers.openlibrary.org/b/id/{cover_i}-M.jpg
```
Fallback: inline SVG book icon placeholder.

## Card Component (`BooksCard`)

Single component handles both grid and list view via `viewMode` prop (same pattern as existing cards).

**Grid layout:**
```
┌─────────────┐
│  [cover]    │  ← 2:3 aspect ratio image
│             │
├─────────────┤
│ Title       │  ← 2-line truncation
│ Author      │  ← muted text, 1 line
│ ✓ Read      │  ← badge, visible when read=true
└─────────────┘
```
Hover overlay: "Find in store" button → opens `{storeUrl}?q={title}+{author}` in new tab. Hidden if no store URL configured.

**List layout (single row):**
```
[cover 40×60] | Title — Author | year | [✓ Read badge] | [🔗 store icon]
```
Store icon always visible inline (no hover required). Hidden if no store URL configured.

**Read toggle:** clicking the "Read" badge flips `data.read` and calls `useUpsertPluginItem`.

## Settings Panel (`BooksSettingsPanel`)

Rendered in the plugin settings tab via `settingsPanel` on `MyWatchPlugin`.

**Single field:**
- Label: "Local Bookstore Search URL"
- Placeholder: `https://myfavoritebookstore.com/search`
- Hint: "Plugin appends `?q=title+author` to this URL"

**Storage:** `localStorage` key `books-plugin-store-url`.

**Validation:** basic URL format check on save. Empty value = store links hidden from all cards (no broken links shown).

## What is NOT in scope

- No embedded reader or media player
- No reading progress tracking (just read/unread)
- No multiple bookstore links per book
- No sync of store URL to backend
