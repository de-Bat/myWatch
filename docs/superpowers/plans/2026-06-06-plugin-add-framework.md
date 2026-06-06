# Plugin Add Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `PluginAddProvider` context that handles the full "add plugin item" flow (share, + button from any view, destination picking, auto-create) centrally.

**Architecture:** A `PluginAddProvider` wraps the app inside `PluginRegistryProvider`. It owns a 3-phase state machine (`picking_destination`, `auto_creating`, `adding`). Any component calls `usePluginAdd().trigger({ pluginType, prefillUrl?, anchorEl? })`. The `+` button in `page.tsx` gets a local `PluginTypePickerDropdown` for the non-plugin-list case; the provider never manages type picking.

**Tech Stack:** React context, useLiveQuery (Dexie), @testing-library/react, vitest, TypeScript

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/plugins/PluginAddProvider.tsx` | State machine, `usePluginAdd()` hook, `PluginAddOrchestrator` |
| Create | `apps/web/src/components/DestinationPickerDropdown.tsx` | Inline dropdown: pick playlist when 2+ exist |
| Create | `apps/web/src/components/PluginTypePickerDropdown.tsx` | Inline dropdown: pick plugin type from + button |
| Create | `apps/web/tests/plugin-add-provider.test.tsx` | State machine unit tests |
| Create | `apps/web/tests/destination-picker.test.tsx` | Dropdown render + interaction tests |
| Modify | `packages/plugin-sdk/src/index.ts` | Add `appearsInAllList?: boolean` to `PluginListType` |
| Modify | `apps/web/src/app/layout.tsx` | Wrap children with `<PluginAddProvider>` |
| Modify | `apps/web/src/app/share/page.tsx` | Call `trigger()` instead of `router.replace('/?shareUrl=…')` |
| Modify | `apps/web/src/app/page.tsx` | Add ref to + button, local type picker, remove share state |
| Modify | `plugins/mywatch-plugin-youtube/src/index.tsx` | Add `appearsInAllList: false` to listType |

---

### Task 1: Plugin SDK — `appearsInAllList` field

**Files:**
- Modify: `packages/plugin-sdk/src/index.ts`

- [ ] **Step 1: Add field to `PluginListType`**

Open `packages/plugin-sdk/src/index.ts`. Change `PluginListType` to:

```ts
export interface PluginListType {
  id: string
  label: string
  appearsInAllList?: boolean
  CardComponent: ComponentType<PluginCardProps>
  AddItemModal?: ComponentType<AddItemModalProps>
  matchesUrl?: (url: string) => boolean
  prefillFromUrl?: (url: string) => Promise<Partial<Record<string, unknown>>>
}
```

- [ ] **Step 2: Rebuild `@mywatch/core` so `dist/index.d.ts` picks up the change**

```bash
cd packages/core && npm run build
```

Expected: `dist/index.d.ts  10.XX KB`

- [ ] **Step 3: Commit**

```bash
git add packages/plugin-sdk/src/index.ts packages/core/dist/
git commit -m "feat(plugin-sdk): add appearsInAllList to PluginListType"
```

---

### Task 2: `PluginAddProvider` — types, context skeleton, idle state

**Files:**
- Create: `apps/web/src/plugins/PluginAddProvider.tsx`
- Create: `apps/web/tests/plugin-add-provider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/plugin-add-provider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PluginAddProvider, usePluginAdd } from '@/plugins/PluginAddProvider'

vi.mock('@/plugins', () => ({
  usePlugins: () => [],
}))
vi.mock('@/hooks/usePlaylists', () => ({
  usePlaylists: () => [],
  useUpsertPlaylist: () => vi.fn(),
}))
vi.mock('@/hooks/usePluginItems', () => ({
  useUpsertPluginItem: () => vi.fn(),
}))

function Consumer() {
  const { trigger, dismiss } = usePluginAdd()
  return <div data-testid="consumer">{typeof trigger === 'function' && typeof dismiss === 'function' ? 'ok' : 'fail'}</div>
}

describe('PluginAddProvider', () => {
  it('provides trigger and dismiss to children', () => {
    render(
      <PluginAddProvider>
        <Consumer />
      </PluginAddProvider>
    )
    expect(screen.getByTestId('consumer').textContent).toBe('ok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run tests/plugin-add-provider.test.tsx
```

Expected: FAIL with `Cannot find module '@/plugins/PluginAddProvider'`

- [ ] **Step 3: Create `PluginAddProvider.tsx` skeleton**

Create `apps/web/src/plugins/PluginAddProvider.tsx`:

```tsx
'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Playlist } from '@mywatch/core'
import type { PluginItem } from '@mywatch/plugin-sdk'
import { usePlugins } from '@/plugins'
import { usePlaylists, useUpsertPlaylist } from '@/hooks/usePlaylists'
import { useUpsertPluginItem } from '@/hooks/usePluginItems'

// ── State machine ────────────────────────────────────────────────────────────

type PluginAddState =
  | { phase: 'idle' }
  | { phase: 'picking_destination'; pluginType: string; prefillUrl?: string; playlists: Playlist[]; anchorEl: HTMLElement | null }
  | { phase: 'auto_creating'; pluginType: string; prefillUrl?: string }
  | { phase: 'adding'; playlistId: string; pluginType: string; prefillUrl?: string }

// ── Context ──────────────────────────────────────────────────────────────────

interface TriggerOpts {
  pluginType: string
  prefillUrl?: string
  anchorEl?: HTMLElement | null
}

interface PluginAddContextValue {
  trigger: (opts: TriggerOpts) => void
  dismiss: () => void
}

const PluginAddContext = createContext<PluginAddContextValue | null>(null)

export function usePluginAdd(): PluginAddContextValue {
  const ctx = useContext(PluginAddContext)
  if (!ctx) throw new Error('usePluginAdd must be used inside PluginAddProvider')
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function PluginAddProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PluginAddState>({ phase: 'idle' })
  const playlists = usePlaylists()
  const plugins = usePlugins()
  const upsertPlaylist = useUpsertPlaylist()
  const upsertPluginItem = useUpsertPluginItem()

  const dismiss = useCallback(() => setState({ phase: 'idle' }), [])

  const trigger = useCallback((opts: TriggerOpts) => {
    // placeholder — implemented in Task 3
    setState({ phase: 'idle' })
  }, [])

  const value: PluginAddContextValue = { trigger, dismiss }

  return (
    <PluginAddContext.Provider value={value}>
      {children}
    </PluginAddContext.Provider>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run tests/plugin-add-provider.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/plugins/PluginAddProvider.tsx apps/web/tests/plugin-add-provider.test.tsx
git commit -m "feat(plugin-add): PluginAddProvider skeleton with context"
```

---

### Task 3: `PluginAddProvider` — `trigger()` state machine

**Files:**
- Modify: `apps/web/src/plugins/PluginAddProvider.tsx`
- Modify: `apps/web/tests/plugin-add-provider.test.tsx`

- [ ] **Step 1: Write the failing tests for state transitions**

Replace the contents of `apps/web/tests/plugin-add-provider.test.tsx`:

```tsx
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Playlist } from '@mywatch/core'
import { PluginAddProvider, usePluginAdd } from '@/plugins/PluginAddProvider'

const mockUpsertPlaylist = vi.fn()
const mockUpsertPluginItem = vi.fn()

vi.mock('@/plugins', () => ({
  usePlugins: () => [
    {
      id: 'youtube',
      displayName: 'YouTube Links',
      listTypes: [{ id: 'youtube', label: 'YouTube Links', appearsInAllList: false }],
    },
  ],
}))
vi.mock('@/hooks/usePlaylists', () => ({
  usePlaylists: vi.fn(),
  useUpsertPlaylist: () => mockUpsertPlaylist,
}))
vi.mock('@/hooks/usePluginItems', () => ({
  useUpsertPluginItem: () => mockUpsertPluginItem,
}))

import { usePlaylists } from '@/hooks/usePlaylists'

const mockPlaylist = (id: string): Playlist => ({
  id,
  userId: 'u1',
  name: `List ${id}`,
  description: null,
  type: 'youtube',
  smartRules: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  deviceId: 'dev1',
})

let capturedState: ReturnType<typeof usePluginAdd> | null = null

function StateCapture() {
  capturedState = usePluginAdd()
  return null
}

function Harness({ playlistsVal }: { playlistsVal: Playlist[] }) {
  vi.mocked(usePlaylists).mockReturnValue(playlistsVal)
  return (
    <PluginAddProvider>
      <StateCapture />
    </PluginAddProvider>
  )
}

describe('PluginAddProvider trigger()', () => {
  beforeEach(() => {
    capturedState = null
    mockUpsertPlaylist.mockReset()
    mockUpsertPluginItem.mockReset()
  })

  it('transitions to adding when exactly one playlist exists', () => {
    const { rerender } = render(<Harness playlistsVal={[mockPlaylist('p1')]} />)
    act(() => { capturedState!.trigger({ pluginType: 'youtube' }) })
    // Wait for state update
    expect(capturedState!.currentPhase).toBe('adding')
    expect(capturedState!.currentPlaylistId).toBe('p1')
  })

  it('transitions to picking_destination when 2+ playlists and !appearsInAllList', () => {
    render(<Harness playlistsVal={[mockPlaylist('p1'), mockPlaylist('p2')]} />)
    act(() => { capturedState!.trigger({ pluginType: 'youtube' }) })
    expect(capturedState!.currentPhase).toBe('picking_destination')
  })

  it('transitions to auto_creating when no playlists exist', async () => {
    const created = mockPlaylist('pnew')
    mockUpsertPlaylist.mockResolvedValue(created)
    render(<Harness playlistsVal={[]} />)
    act(() => { capturedState!.trigger({ pluginType: 'youtube' }) })
    await waitFor(() => expect(capturedState!.currentPhase).toBe('adding'))
    expect(mockUpsertPlaylist).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'youtube', name: 'YouTube Links' })
    )
    expect(capturedState!.currentPlaylistId).toBe('pnew')
  })

  it('dismiss() returns to idle', () => {
    render(<Harness playlistsVal={[mockPlaylist('p1')]} />)
    act(() => { capturedState!.trigger({ pluginType: 'youtube' }) })
    act(() => { capturedState!.dismiss() })
    expect(capturedState!.currentPhase).toBe('idle')
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
cd apps/web && npx vitest run tests/plugin-add-provider.test.tsx
```

Expected: FAILs — `currentPhase` not defined on context value.

- [ ] **Step 3: Implement `trigger()` and expose `currentPhase`/`currentPlaylistId` for tests**

Replace `PluginAddProvider.tsx` fully with:

```tsx
'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Playlist } from '@mywatch/core'
import type { PluginItem } from '@mywatch/plugin-sdk'
import { usePlugins } from '@/plugins'
import { usePlaylists, useUpsertPlaylist } from '@/hooks/usePlaylists'
import { useUpsertPluginItem } from '@/hooks/usePluginItems'

// ── State machine ────────────────────────────────────────────────────────────

type PluginAddState =
  | { phase: 'idle' }
  | { phase: 'picking_destination'; pluginType: string; prefillUrl?: string; playlists: Playlist[]; anchorEl: HTMLElement | null }
  | { phase: 'auto_creating'; pluginType: string; prefillUrl?: string }
  | { phase: 'adding'; playlistId: string; pluginType: string; prefillUrl?: string }

// ── Context ──────────────────────────────────────────────────────────────────

interface TriggerOpts {
  pluginType: string
  prefillUrl?: string
  anchorEl?: HTMLElement | null
}

interface PluginAddContextValue {
  trigger: (opts: TriggerOpts) => void
  dismiss: () => void
  // internal — used by orchestrator and tests
  _state: PluginAddState
  _selectDestination: (playlistId: string) => void
  _onAdded: (item: PluginItem) => Promise<void>
  // convenience for tests
  currentPhase: PluginAddState['phase']
  currentPlaylistId: string | undefined
}

const PluginAddContext = createContext<PluginAddContextValue | null>(null)

export function usePluginAdd() {
  const ctx = useContext(PluginAddContext)
  if (!ctx) throw new Error('usePluginAdd must be used inside PluginAddProvider')
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function PluginAddProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PluginAddState>({ phase: 'idle' })
  const playlists = usePlaylists()
  const plugins = usePlugins()
  const upsertPlaylist = useUpsertPlaylist()
  const upsertPluginItem = useUpsertPluginItem()

  const dismiss = useCallback(() => setState({ phase: 'idle' }), [])

  const trigger = useCallback((opts: TriggerOpts) => {
    const { pluginType, prefillUrl, anchorEl = null } = opts
    const matching = (playlists ?? []).filter((p) => p.type === pluginType && !p.deletedAt)

    if (matching.length === 0) {
      setState({ phase: 'auto_creating', pluginType, prefillUrl })
      return
    }

    if (matching.length === 1) {
      setState({ phase: 'adding', playlistId: matching[0].id, pluginType, prefillUrl })
      return
    }

    // 2+ playlists — check appearsInAllList
    const listType = plugins
      .flatMap((p) => p.listTypes ?? [])
      .find((lt) => lt.id === pluginType)

    if (listType?.appearsInAllList) {
      setState({ phase: 'adding', playlistId: matching[0].id, pluginType, prefillUrl })
    } else {
      setState({ phase: 'picking_destination', pluginType, prefillUrl, playlists: matching, anchorEl })
    }
  }, [playlists, plugins])

  // Handle auto_creating asynchronously
  useEffect(() => {
    if (state.phase !== 'auto_creating') return
    const { pluginType, prefillUrl } = state
    const listType = plugins.flatMap((p) => p.listTypes ?? []).find((lt) => lt.id === pluginType)
    upsertPlaylist({
      userId: '',
      name: listType?.label ?? pluginType,
      description: null,
      type: pluginType,
      smartRules: null,
      sortOrder: (playlists ?? []).length,
    }).then((created) => {
      setState({ phase: 'adding', playlistId: created.id, pluginType, prefillUrl })
    })
  }, [state.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const _selectDestination = useCallback((playlistId: string) => {
    setState((prev) =>
      prev.phase === 'picking_destination'
        ? { phase: 'adding', playlistId, pluginType: prev.pluginType, prefillUrl: prev.prefillUrl }
        : prev
    )
  }, [])

  const _onAdded = useCallback(async (item: PluginItem) => {
    await upsertPluginItem(item)
    setState({ phase: 'idle' })
  }, [upsertPluginItem])

  const value: PluginAddContextValue = {
    trigger,
    dismiss,
    _state: state,
    _selectDestination,
    _onAdded,
    currentPhase: state.phase,
    currentPlaylistId: state.phase === 'adding' ? state.playlistId : undefined,
  }

  return (
    <PluginAddContext.Provider value={value}>
      {children}
    </PluginAddContext.Provider>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run tests/plugin-add-provider.test.tsx
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/plugins/PluginAddProvider.tsx apps/web/tests/plugin-add-provider.test.tsx
git commit -m "feat(plugin-add): implement trigger() state machine in PluginAddProvider"
```

---

### Task 4: `DestinationPickerDropdown`

**Files:**
- Create: `apps/web/src/components/DestinationPickerDropdown.tsx`
- Create: `apps/web/tests/destination-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/destination-picker.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Playlist } from '@mywatch/core'
import { DestinationPickerDropdown } from '@/components/DestinationPickerDropdown'

const playlists: Playlist[] = [
  { id: 'p1', userId: 'u1', name: 'Watch Later', description: null, type: 'youtube',
    smartRules: null, sortOrder: 0, createdAt: '', updatedAt: '', deletedAt: null, deviceId: 'd1' },
  { id: 'p2', userId: 'u1', name: 'Dev Tutorials', description: null, type: 'youtube',
    smartRules: null, sortOrder: 1, createdAt: '', updatedAt: '', deletedAt: null, deviceId: 'd1' },
]

describe('DestinationPickerDropdown', () => {
  it('renders all playlist names', () => {
    render(
      <DestinationPickerDropdown
        heading="Add YouTube link to…"
        playlists={playlists}
        anchorEl={null}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByText('Watch Later')).toBeInTheDocument()
    expect(screen.getByText('Dev Tutorials')).toBeInTheDocument()
  })

  it('calls onSelect with playlist id when row clicked', () => {
    const onSelect = vi.fn()
    render(
      <DestinationPickerDropdown
        heading="Add YouTube link to…"
        playlists={playlists}
        anchorEl={null}
        onSelect={onSelect}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Dev Tutorials'))
    expect(onSelect).toHaveBeenCalledWith('p2')
  })

  it('calls onDismiss on Escape key', () => {
    const onDismiss = vi.fn()
    render(
      <DestinationPickerDropdown
        heading="Add YouTube link to…"
        playlists={playlists}
        anchorEl={null}
        onSelect={vi.fn()}
        onDismiss={onDismiss}
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/web && npx vitest run tests/destination-picker.test.tsx
```

Expected: FAIL with `Cannot find module '@/components/DestinationPickerDropdown'`

- [ ] **Step 3: Create `DestinationPickerDropdown.tsx`**

Create `apps/web/src/components/DestinationPickerDropdown.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { Playlist } from '@mywatch/core'

interface Props {
  heading: string
  playlists: Playlist[]
  anchorEl: HTMLElement | null
  onSelect: (playlistId: string) => void
  onDismiss: () => void
}

export function DestinationPickerDropdown({ heading, playlists, anchorEl, onSelect, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Position relative to anchor, or centered if no anchor
  const style: React.CSSProperties = anchorEl
    ? (() => {
        const r = anchorEl.getBoundingClientRect()
        return { position: 'fixed', top: r.bottom + 6, right: window.innerWidth - r.right, zIndex: 9999 }
      })()
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onDismiss])

  return (
    <div
      ref={ref}
      style={{
        ...style,
        width: 220,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '7px 12px 5px',
          borderBottom: '1px solid var(--border2)',
          fontSize: 'var(--text-10)',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--muted2)',
        }}
      >
        {heading}
      </div>
      <div style={{ padding: 4 }}>
        {playlists.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--fg)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ fontSize: 'var(--text-13)', fontWeight: 600 }}>{p.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run tests/destination-picker.test.tsx
```

Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DestinationPickerDropdown.tsx apps/web/tests/destination-picker.test.tsx
git commit -m "feat(plugin-add): DestinationPickerDropdown component"
```

---

### Task 5: `PluginTypePickerDropdown`

**Files:**
- Create: `apps/web/src/components/PluginTypePickerDropdown.tsx`
- Create: `apps/web/tests/plugin-type-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/plugin-type-picker.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PluginTypePickerDropdown } from '@/components/PluginTypePickerDropdown'

const pluginTypes = [
  { id: 'youtube', label: 'YouTube Links', typeBadge: 'V' },
  { id: 'books', label: 'Reading List', typeBadge: 'Books' },
]

describe('PluginTypePickerDropdown', () => {
  it('renders Watchlist option and all plugin types', () => {
    render(
      <PluginTypePickerDropdown
        pluginTypes={pluginTypes}
        anchorEl={null}
        onSelectPlugin={vi.fn()}
        onSelectWatchlist={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    expect(screen.getByText('Watchlist')).toBeInTheDocument()
    expect(screen.getByText('YouTube Links')).toBeInTheDocument()
    expect(screen.getByText('Reading List')).toBeInTheDocument()
  })

  it('calls onSelectPlugin with plugin id when plugin row clicked', () => {
    const onSelectPlugin = vi.fn()
    render(
      <PluginTypePickerDropdown
        pluginTypes={pluginTypes}
        anchorEl={null}
        onSelectPlugin={onSelectPlugin}
        onSelectWatchlist={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('YouTube Links'))
    expect(onSelectPlugin).toHaveBeenCalledWith('youtube')
  })

  it('calls onSelectWatchlist when Watchlist row clicked', () => {
    const onSelectWatchlist = vi.fn()
    render(
      <PluginTypePickerDropdown
        pluginTypes={pluginTypes}
        anchorEl={null}
        onSelectPlugin={vi.fn()}
        onSelectWatchlist={onSelectWatchlist}
        onDismiss={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Watchlist'))
    expect(onSelectWatchlist).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/web && npx vitest run tests/plugin-type-picker.test.tsx
```

Expected: FAIL with `Cannot find module '@/components/PluginTypePickerDropdown'`

- [ ] **Step 3: Create `PluginTypePickerDropdown.tsx`**

Create `apps/web/src/components/PluginTypePickerDropdown.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'

interface PluginTypeEntry {
  id: string
  label: string
  typeBadge?: string
}

interface Props {
  pluginTypes: PluginTypeEntry[]
  anchorEl: HTMLElement | null
  onSelectPlugin: (pluginTypeId: string) => void
  onSelectWatchlist: () => void
  onDismiss: () => void
}

export function PluginTypePickerDropdown({ pluginTypes, anchorEl, onSelectPlugin, onSelectWatchlist, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const style: React.CSSProperties = anchorEl
    ? (() => {
        const r = anchorEl.getBoundingClientRect()
        return { position: 'fixed', top: r.bottom + 6, right: window.innerWidth - r.right, zIndex: 9999 }
      })()
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onDismiss])

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--fg)',
  }

  return (
    <div
      ref={ref}
      style={{
        ...style,
        width: 220,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '7px 12px 5px', borderBottom: '1px solid var(--border2)', fontSize: 'var(--text-10)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted2)' }}>
        Add to…
      </div>
      <div style={{ padding: 4 }}>
        {/* Watchlist row */}
        <button
          onClick={onSelectWatchlist}
          style={rowStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: 16 }}>🎬</span>
          <span style={{ fontSize: 'var(--text-13)', fontWeight: 600 }}>Watchlist</span>
        </button>

        {pluginTypes.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--border2)', margin: '3px 0' }} />
            <div style={{ padding: '3px 10px 1px', fontSize: 'var(--text-10)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted2)' }}>
              Plugins
            </div>
            {pluginTypes.map((pt) => (
              <button
                key={pt.id}
                onClick={() => onSelectPlugin(pt.id)}
                style={rowStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {pt.typeBadge && (
                  <span style={{ background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: 4, color: '#a5b4fc', fontWeight: 700, fontSize: 10 }}>
                    {pt.typeBadge}
                  </span>
                )}
                <span style={{ fontSize: 'var(--text-13)', fontWeight: 600 }}>{pt.label}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run tests/plugin-type-picker.test.tsx
```

Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PluginTypePickerDropdown.tsx apps/web/tests/plugin-type-picker.test.tsx
git commit -m "feat(plugin-add): PluginTypePickerDropdown component"
```

---

### Task 6: `PluginAddOrchestrator` — wire states to UI inside provider

**Files:**
- Modify: `apps/web/src/plugins/PluginAddProvider.tsx`

- [ ] **Step 1: Add `PluginAddOrchestrator` to `PluginAddProvider.tsx`**

Add these imports at the top of `apps/web/src/plugins/PluginAddProvider.tsx`:

```tsx
import { DestinationPickerDropdown } from '@/components/DestinationPickerDropdown'
import { useListTypePlugin } from '@/plugins'
```

Then add the `PluginAddOrchestrator` component at the bottom of the file (before the closing of the file — after `PluginAddProvider`):

```tsx
// ── Orchestrator ─────────────────────────────────────────────────────────────

function PluginAddOrchestrator() {
  const { _state, _selectDestination, _onAdded, dismiss } = usePluginAdd()
  const activeListPlugin = useListTypePlugin(
    _state.phase === 'adding' || _state.phase === 'picking_destination' || _state.phase === 'auto_creating'
      ? _state.pluginType
      : undefined
  )

  if (_state.phase === 'picking_destination') {
    const listType = activeListPlugin
    return (
      <DestinationPickerDropdown
        heading={`Add ${listType?.label ?? _state.pluginType} to…`}
        playlists={_state.playlists}
        anchorEl={_state.anchorEl}
        onSelect={_selectDestination}
        onDismiss={dismiss}
      />
    )
  }

  if (_state.phase === 'adding' && activeListPlugin?.AddItemModal) {
    const AddModal = activeListPlugin.AddItemModal
    return (
      <AddModal
        playlistId={_state.playlistId}
        prefillUrl={_state.prefillUrl}
        onClose={dismiss}
        onAdded={_onAdded}
      />
    )
  }

  return null
}
```

Then update the `return` statement inside `PluginAddProvider` to render the orchestrator:

```tsx
  return (
    <PluginAddContext.Provider value={value}>
      {children}
      <PluginAddOrchestrator />
    </PluginAddContext.Provider>
  )
```

- [ ] **Step 2: Fix the circular import** — `PluginAddProvider` is in `@/plugins/` and imports from `@/plugins` (the index). This will create a circular dependency. Instead of `import { useListTypePlugin } from '@/plugins'`, import directly from the source:

```tsx
import { useListTypePlugin } from '@/plugins/index'
```

Verify `apps/web/src/plugins/index.ts` exports `useListTypePlugin`. It does (line 8). This import is fine as long as `index.ts` does not import from `PluginAddProvider`. It doesn't — `index.ts` only imports from `PluginRegistryProvider`.

- [ ] **Step 3: Run all plugin-add tests to confirm nothing broke**

```bash
cd apps/web && npx vitest run tests/plugin-add-provider.test.tsx tests/destination-picker.test.tsx tests/plugin-type-picker.test.tsx
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/plugins/PluginAddProvider.tsx
git commit -m "feat(plugin-add): PluginAddOrchestrator wires states to DestinationPickerDropdown and AddItemModal"
```

---

### Task 7: Wire `PluginAddProvider` into `layout.tsx`

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Add import and wrap**

In `apps/web/src/app/layout.tsx`, add the import after line 5:

```tsx
import { PluginAddProvider } from '@/plugins/PluginAddProvider'
```

Then wrap the existing children. The `PluginAddProvider` must be inside `PluginRegistryProvider` (needs plugin context) but can wrap `SettingsProvider`. Change the body of `RootLayout`:

```tsx
<SessionProvider>
  <PluginRegistryProvider>
    <PluginAddProvider>
      <SettingsProvider>
        <ToastProvider>
          <AutoSync />
          <OfflineIndicator />
          <PwaUpdater />
          {children}
        </ToastProvider>
      </SettingsProvider>
    </PluginAddProvider>
  </PluginRegistryProvider>
</SessionProvider>
```

- [ ] **Step 2: Type-check**

```bash
cd /c/web.projects/myWatch && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -v "manifest.ts\|profile/page\|EditPlaylistModal\|GridItemCard\|WatchlistItemCard\|useAndroidBackButton\|registry.ts"
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(plugin-add): add PluginAddProvider to root layout"
```

---

### Task 8: Update `share/page.tsx` — call `trigger()` instead of redirect

**Files:**
- Modify: `apps/web/src/app/share/page.tsx`

- [ ] **Step 1: Replace `ShareHandlerInner`**

Replace the full contents of `apps/web/src/app/share/page.tsx`:

```tsx
'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUrlMatchPlugin } from '@/plugins'
import { usePluginAdd } from '@/plugins/PluginAddProvider'

function ShareHandlerInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const url = searchParams.get('url') ?? searchParams.get('text') ?? ''
  const title = searchParams.get('title') ?? ''
  const matchedPlugin = useUrlMatchPlugin(url)
  const { trigger } = usePluginAdd()

  useEffect(() => {
    if (!url && !title) {
      router.replace('/')
      return
    }

    if (url && matchedPlugin) {
      trigger({ pluginType: matchedPlugin.id, prefillUrl: url })
      router.replace('/')
    } else {
      const params = new URLSearchParams()
      if (title) params.set('title', title)
      if (url) params.set('text', url)
      router.replace(`/share-target?${params.toString()}`)
    }
  }, [url, matchedPlugin, router, title, trigger])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p style={{ color: 'var(--muted)', fontSize: 'var(--text-13)' }}>Opening…</p>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <ShareHandlerInner />
    </Suspense>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /c/web.projects/myWatch && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "share/page"
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/share/page.tsx
git commit -m "feat(plugin-add): share page calls trigger() instead of redirect with URL params"
```

---

### Task 9: Update `page.tsx` — + button with type picker, remove share state

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Add import and ref**

At the top of `apps/web/src/app/page.tsx`, add these imports alongside existing ones:

```tsx
import { useRef, useState } from 'react'  // already imported — just confirm
import { PluginTypePickerDropdown } from '@/components/PluginTypePickerDropdown'
import { usePluginAdd } from '@/plugins/PluginAddProvider'
```

- [ ] **Step 2: Add `usePluginAdd` hook call and `addButtonRef` inside the component**

Find the existing refs block (around line 74). Add after the existing refs:

```tsx
const addButtonRef = useRef<HTMLButtonElement>(null)
const [showTypePicker, setShowTypePicker] = useState(false)
const { trigger } = usePluginAdd()
```

- [ ] **Step 3: Remove the three share-related state declarations**

Remove these lines (around line 51–53):

```tsx
const [showPluginAddModal, setShowPluginAddModal] = useState(false)
const [shareUrl, setShareUrl] = useState<string | null>(null)
const [sharePluginType, setSharePluginType] = useState<string | null>(null)
```

- [ ] **Step 4: Remove the two share-related `useEffect` blocks**

Remove the `useEffect` block at lines 113–125 (reads `?shareUrl=` and `?pluginListType=` from search params).

Remove the `useEffect` block at lines 127–134 (auto-switches active list and opens modal on share).

- [ ] **Step 5: Remove `upsertPluginItem` and the inline `AddModal` render**

Remove line 206:
```tsx
const upsertPluginItem = useUpsertPluginItem()
```

Remove the `{showPluginAddModal && activeListPlugin?.AddItemModal && activeList && (() => { ... })()}` block (lines 1375–1394).

- [ ] **Step 6: Update the + button**

Replace the existing + button (lines 577–589) with:

```tsx
<button
  ref={addButtonRef}
  onClick={() => {
    if (isPluginList && activeList) {
      trigger({ pluginType: activeList.type, anchorEl: addButtonRef.current })
    } else {
      setShowTypePicker((v) => !v)
    }
  }}
  title="Add"
  className="flex items-center justify-center border-none cursor-pointer transition-all duration-100"
  style={{ width: '2.43rem', height: '2.43rem', color: 'var(--muted)', background: 'transparent', borderRadius: 'var(--rsm)' }}
  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.background = 'var(--surface)' }}
  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' }}
>
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: '1.21rem', height: '1.21rem' }}>
    <line x1="10" y1="3" x2="10" y2="17" />
    <line x1="3" y1="10" x2="17" y2="10" />
  </svg>
</button>
{showTypePicker && (
  <PluginTypePickerDropdown
    pluginTypes={plugins.flatMap((p) =>
      (p.listTypes ?? []).map((lt) => ({
        id: lt.id,
        label: lt.label,
        typeBadge: installedMeta.find((m) => m.id === p.id)?.typeBadge,
      }))
    )}
    anchorEl={addButtonRef.current}
    onSelectPlugin={(pluginTypeId) => {
      setShowTypePicker(false)
      trigger({ pluginType: pluginTypeId, anchorEl: addButtonRef.current })
    }}
    onSelectWatchlist={() => {
      setShowTypePicker(false)
      router.push('/search')
    }}
    onDismiss={() => setShowTypePicker(false)}
  />
)}
```

The `plugins` variable already exists on the page (from `usePlugins()`). The `installedMeta` comes from `usePluginRegistryContext()` — check if it's already imported; if not, add:

```tsx
import { usePluginRegistryContext } from '@/plugins/PluginRegistryProvider'
// and inside component:
const { installedMeta } = usePluginRegistryContext()
```

- [ ] **Step 7: Remove unused imports**

Remove `useUpsertPluginItem` import if it's no longer used anywhere in `page.tsx`.

- [ ] **Step 8: Type-check**

```bash
cd /c/web.projects/myWatch && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "page.tsx"
```

Expected: no output

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(plugin-add): refactor page.tsx + button to use PluginAddProvider, remove share param handling"
```

---

### Task 10: YouTube plugin — declare `appearsInAllList`

**Files:**
- Modify: `plugins/mywatch-plugin-youtube/src/index.tsx`

- [ ] **Step 1: Find the `listTypes` declaration**

```bash
grep -n "appearsInAllList\|listTypes\|matchesUrl" /c/web.projects/myWatch/plugins/mywatch-plugin-youtube/src/index.tsx | head -10
```

- [ ] **Step 2: Add `appearsInAllList: false` to the YouTube listType**

Find the object in `index.tsx` that declares the YouTube `PluginListType`. It will look like:

```tsx
listTypes: [
  {
    id: 'youtube',
    label: 'YouTube Links',
    matchesUrl: (url) => /youtube\.com\/watch|youtu\.be\//.test(url),
    ...
  }
]
```

Add `appearsInAllList: false` to that object:

```tsx
listTypes: [
  {
    id: 'youtube',
    label: 'YouTube Links',
    appearsInAllList: false,
    matchesUrl: (url) => /youtube\.com\/watch|youtu\.be\//.test(url),
    ...
  }
]
```

- [ ] **Step 3: Rebuild the YouTube plugin**

```bash
cd /c/web.projects/myWatch/plugins/mywatch-plugin-youtube && npm run build 2>&1 | tail -5
```

Expected: build success output

- [ ] **Step 4: Run the full test suite**

```bash
cd /c/web.projects/myWatch && npx vitest run --project apps/web 2>&1 | tail -20
```

Expected: all tests pass (or same failures as before this feature)

- [ ] **Step 5: Final type-check**

```bash
cd /c/web.projects/myWatch && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -v "manifest.ts\|profile/page\|EditPlaylistModal\|GridItemCard\|WatchlistItemCard\|useAndroidBackButton\|registry.ts"
```

Expected: no output

- [ ] **Step 6: Commit**

```bash
git add plugins/mywatch-plugin-youtube/src/index.tsx
git commit -m "feat(youtube-plugin): declare appearsInAllList: false on YouTube listType"
```

---

## Self-Review Checklist

- [x] SDK change (Task 1) — `appearsInAllList` added to `PluginListType`
- [x] State machine (Task 3) — all 4 transition cases covered: 0 playlists, 1 playlist, 2+ with appearsInAllList, 2+ without
- [x] DestinationPickerDropdown (Task 4) — renders, selects, dismisses on Escape
- [x] PluginTypePickerDropdown (Task 5) — renders Watchlist + plugins, fires correct callbacks
- [x] Orchestrator (Task 6) — wires picking_destination → dropdown, adding → AddItemModal
- [x] Layout wiring (Task 7) — provider inside PluginRegistryProvider
- [x] Share page (Task 8) — trigger() + router.replace('/') replaces old redirect
- [x] page.tsx cleanup (Task 9) — 3 state vars removed, 2 useEffects removed, AddModal block removed, + button updated
- [x] YouTube plugin (Task 10) — appearsInAllList declared
- [x] Type-check run after Tasks 7, 8, 9
