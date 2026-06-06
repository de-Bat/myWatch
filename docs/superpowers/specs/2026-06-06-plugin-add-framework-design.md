# Plugin Add Framework Design

**Date:** 2026-06-06
**Status:** Approved

## Problem

The current plugin add flow has two gaps:

1. The + button only works when a plugin list is already active. There is no way to add a plugin item from a non-plugin view.
2. The share flow auto-switches to the first matching playlist with no user input. When a user has multiple playlists of the same plugin type, there is no way to choose which one receives the shared item.

## Decisions

- **+ button everywhere (Option C):** Pressing + from any view shows a plugin type picker dropdown alongside the existing "Watchlist" option.
- **Auto-create when no playlist exists:** If no playlist of the matched plugin type exists, one is created automatically (name = plugin `displayName`) before opening the add modal.
- **Inline dropdown for destination picker:** When 2+ playlists of the same type exist, an inline dropdown anchored to the + button (or centered on share) lets the user pick.
- **Architecture: global `PluginAddProvider` context (Option A):** All add-flow state lives in one context. Any component calls `usePluginAdd().trigger()`. This replaces the scattered share URL param handling currently in `page.tsx`.

## Architecture

### New files

| File | Purpose |
|------|---------|
| `apps/web/src/plugins/PluginAddProvider.tsx` | Context + state machine + `usePluginAdd()` hook |
| `apps/web/src/components/PluginTypePickerDropdown.tsx` | Inline dropdown listing plugin types (+ Watchlist) |
| `apps/web/src/components/DestinationPickerDropdown.tsx` | Inline dropdown listing playlists of a given plugin type |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/app/layout.tsx` | Add `<PluginAddProvider>` wrapper |
| `apps/web/src/app/share/page.tsx` | Call `trigger()` instead of redirecting to `/?shareUrl=…` |
| `apps/web/src/app/page.tsx` | + button calls `trigger()` or shows `PluginTypePickerDropdown`; remove share URL param handling |
| `packages/plugin-sdk/src/index.ts` | Add `appearsInAllList?: boolean` to `PluginListType` |

## State Machine

`PluginAddProvider` manages these states:

```
idle
  → resolving        trigger() called; async playlist lookup; no UI shown
      → picking_type         no pluginType given (+ from non-plugin view)
      → picking_destination  2+ playlists exist AND !appearsInAllList
      → auto_creating        0 playlists exist; POST /api/playlists
      → adding               exactly 1 playlist, or appearsInAllList=true
  → idle             onAdded / onClose / dismiss
```

### State type

```ts
type PluginAddState =
  | { phase: 'idle' }
  | { phase: 'picking_type'; anchorRef?: RefObject<HTMLElement> }
  | { phase: 'resolving'; pluginType: string; prefillUrl?: string }
  | { phase: 'picking_destination'; pluginType: string; prefillUrl?: string; playlists: Playlist[]; anchorRef?: RefObject<HTMLElement> }
  | { phase: 'auto_creating'; pluginType: string; prefillUrl?: string }
  | { phase: 'adding'; playlistId: string; pluginType: string; prefillUrl?: string }
```

### Context value

```ts
interface PluginAddContextValue {
  trigger: (opts: { pluginType?: string; prefillUrl?: string; anchorRef?: RefObject<HTMLElement> }) => void
  dismiss: () => void
}
```

`anchorRef` is optional. + button passes its own ref for dropdown positioning. Share flow passes nothing — dropdowns render centered/fixed.

## Plugin SDK Change

`PluginListType` gains one optional field:

```ts
export interface PluginListType {
  id: string
  label: string
  appearsInAllList?: boolean  // default: false
  CardComponent: ComponentType<PluginCardProps>
  AddItemModal?: ComponentType<AddItemModalProps>
  matchesUrl?: (url: string) => boolean
  prefillFromUrl?: (url: string) => Promise<Partial<Record<string, unknown>>>
}
```

No breaking change. Existing plugins that omit `appearsInAllList` get `false`, so the destination picker is always shown when 2+ playlists exist.

## Destination Resolution Logic

Executed in the `resolving` → next-state transition:

```
playlists = getPlaylistsByType(pluginType)

if playlists.length === 0:
  phase = auto_creating
  POST /api/playlists { name: plugin.displayName, type: pluginType }
  on success → phase = adding

if playlists.length === 1:
  phase = adding (skip any picker)

if playlists.length > 1 && appearsInAllList === true:
  phase = adding (use currently active playlist if it matches type, else first; item visible in All anyway)

if playlists.length > 1 && appearsInAllList !== true:
  phase = picking_destination
```

## UI Components

### PluginTypePickerDropdown

Shown when + is pressed from a non-plugin view (manual list, smart list, All).

- Anchored to the + button element via `anchorRef`
- Top section: "Watchlist" (navigates to /search as today)
- Divider + "Plugins" section: one row per enabled plugin type, showing TypeBadge + displayName + description
- Selecting a plugin type calls `trigger({ pluginType, anchorRef })`
- Closes on outside click or Escape

### DestinationPickerDropdown

Shown when plugin type is known but 2+ playlists of that type exist and `appearsInAllList` is false.

- Anchored to `anchorRef` if present, otherwise centered (share flow)
- Header: "Add [plugin displayName] to…"
- One row per playlist: name + item count; current active playlist highlighted
- Selecting a playlist transitions to `adding` state
- Closes on outside click or Escape

### PluginAddOrchestrator

Internal component rendered inside `PluginAddProvider`. Reads state and renders the correct UI:

- `picking_type` → `<PluginTypePickerDropdown>`
- `picking_destination` → `<DestinationPickerDropdown>`
- `auto_creating` → nothing (or a subtle loading indicator if slow)
- `adding` → plugin's `AddItemModal` with `playlistId` + `prefillUrl`

## Share Flow (updated)

```ts
// apps/web/src/app/share/page.tsx
const { trigger } = usePluginAdd()

useEffect(() => {
  if (!url && !title) { router.replace('/'); return }
  if (url && matchedPlugin) {
    trigger({ pluginType: matchedPlugin.id, prefillUrl: url })
    // stay on /share — provider handles everything
  } else {
    router.replace(`/share-target?...`)
  }
}, [url, matchedPlugin])
```

The share page no longer redirects to `/?shareUrl=…`. The provider handles the full flow in-place.

## Cleanup in page.tsx

Remove from `apps/web/src/app/page.tsx`:

- `shareUrl`, `sharePluginType` state
- The `useEffect` that reads `?shareUrl=` and `?pluginListType=` search params
- The `useEffect` that auto-switches active list on share
- The `showPluginAddModal` state and its inline `AddModal` render
- The `setActiveListId` call driven by share params

The + button handler simplifies to:

```ts
onClick={() => {
  if (isPluginList) {
    trigger({ pluginType: activeList.type, playlistId: activeList.id, anchorRef: addButtonRef })
  } else {
    // show PluginTypePickerDropdown via trigger with no pluginType
    trigger({ anchorRef: addButtonRef })
  }
}}
```

## Windows / Browser Share

Web Share Target API covers iOS, Android, and Windows PWA via the existing `manifest.ts` configuration. No additional platform-specific changes needed. The `/share` route already handles all three.

## Out of Scope

- Editing plugin item properties after creation
- Reordering destination playlists in the picker
- Per-plugin settings panel (already exists separately)
