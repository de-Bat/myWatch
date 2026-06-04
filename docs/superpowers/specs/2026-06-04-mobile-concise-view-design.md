# Mobile Concise View — Design Spec

**Date:** 2026-06-04  
**Scope:** `WatchlistItemCard`, `MediaPanel`  
**Approach:** Compact existing layout via `compact` prop / internal mobile detection

---

## Problem

Recent web changes (badge icons, display overrides, always-show-progress-bars, Jellyfin logo, ArrStatus, recap spoiler) added density to cards and the detail panel. On mobile viewports these components are now verbose — poster too large, padding too generous, panel header too tall.

---

## WatchlistItemCard

### Changes

Pass `compact?: boolean` prop from `page.tsx` (which already holds `isMobile` state).

| Element | Desktop | Mobile (compact) |
|---|---|---|
| Poster width | 86px | 64px |
| Poster height | 129px | 96px |
| Card padding | `14px 16px` | `10px 12px` |
| Body gap | `6px` | `4px` |

All meta toggle logic (badges, progress, genres, providers, ArrStatus, display overrides) is unchanged — compact only affects sizing and spacing.

### No changes
- Progress bar height (5px) — functional, must remain
- Font sizes — already small; changing would hurt readability
- Badge icon logic, showBadgesAsIcons, any CardMetaSettings flags

---

## MediaPanel

### Changes

MediaPanel adds its own `isMobile` state (via `useEffect` + `window.matchMedia('(max-width: 768px)')`). No prop needed — panel already covers full viewport on mobile.

| Element | Desktop | Mobile |
|---|---|---|
| Backdrop height | `h-36` (144px) | `h-20` (80px) |
| Content padding | `0 20px 40px` | `0 14px 28px` |
| Poster thumbnail width | 88px | 68px |
| Section gap | `gap-5` | `gap-4` |
| Rating buttons | 28×28px | 24×24px |
| Divider negative margin | `0 -20px` | `0 -14px` |

### No changes
- Panel width (`min(480px, 100vw)`) — already full-width on mobile
- Slide-in animation, z-index, backdrop overlay
- All section content (status, progress bars, download manager, recap, rating, notes, providers)

---

## Architecture

- `page.tsx` passes `compact={isMobile}` to `WatchlistItemCard` (GridItemCard not in scope — grid view on mobile is already compact by nature)
- `MediaPanel` detects its own mobile state internally to avoid prop threading through the panel open/close logic in `page.tsx`
- No new files, no new abstractions

---

## Out of Scope

- GridItemCard mobile changes (grid cards already compact)
- Settings page mobile layout
- Bottom-sheet style rework of MediaPanel
- Any changes to card meta toggle logic or display overrides
