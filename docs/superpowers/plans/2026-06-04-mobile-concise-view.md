# Mobile Concise View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten WatchlistItemCard and MediaPanel on mobile viewports by reducing poster size, padding, and section spacing.

**Architecture:** `page.tsx` passes `compact={isMobile}` down to `WatchlistItemCard`. `MediaPanel` detects mobile internally via `matchMedia`. No new files, no new components — compact is purely a sizing/spacing concern.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS (utility classes), inline styles

---

## File Map

| File | Change |
|---|---|
| `apps/web/src/components/WatchlistItemCard.tsx` | Add `compact?: boolean` prop; conditionally apply smaller poster dims + padding |
| `apps/web/src/components/MediaPanel.tsx` | Add internal `isMobile` state; apply tighter backdrop/padding/poster/buttons on mobile |
| `apps/web/src/app/page.tsx` | Pass `compact={isMobile}` to `WatchlistItemCard` |

---

### Task 1: Add `compact` prop to WatchlistItemCard

**Files:**
- Modify: `apps/web/src/components/WatchlistItemCard.tsx`

No automated tests exist for this UI component. Verify visually after each task by running the dev server.

- [ ] **Step 1: Add `compact` to the props interface**

In `WatchlistItemCard.tsx`, update the function signature at line 58:

```tsx
export function WatchlistItemCard({
  item,
  onSelect,
  jellyfinProgress,
  compact,
}: {
  item: WatchlistItem
  onSelect?: () => void
  jellyfinProgress?: JellyfinProgress
  compact?: boolean
}) {
```

- [ ] **Step 2: Apply compact poster dimensions**

Find the poster `<div>` at line 160–176. Replace the hardcoded `w-[86px] h-[129px]` with compact-aware values:

```tsx
      {/* Poster */}
      <div
        className="flex-shrink-0 overflow-hidden rounded-[8px]"
        style={{
          width: compact ? 64 : 86,
          height: compact ? 96 : 129,
          background: 'var(--surface2)',
        }}
      >
```

- [ ] **Step 3: Apply compact card padding and body gap**

Find the main card `<div>` at line 140–157 (the one with `padding: '14px 16px'`). Replace:

```tsx
    <div
      onClick={() => onSelect ? onSelect() : router.push(`/media/${item.mediaType}/${item.tmdbId}`)}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
      className="relative overflow-hidden flex gap-3 rounded-[var(--r)] border cursor-pointer transition-all duration-[120ms]
        hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,.25)]"
      style={{
        padding: compact ? '10px 12px' : '14px 16px',
        background: 'var(--surface)',
        borderColor: 'var(--border2)',
        alignItems: 'flex-start',
      }}
```

Find the body `<div>` at line 181 (the one with `gap-[6px]`). Replace:

```tsx
      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col overflow-visible" style={{ gap: compact ? 4 : 6, paddingTop: 1 }}>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/WatchlistItemCard.tsx
git commit -m "feat: add compact prop to WatchlistItemCard for mobile"
```

---

### Task 2: Pass `compact={isMobile}` from page.tsx

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Pass compact prop at the WatchlistItemCard render site**

Find the `WatchlistItemCard` usage at approximately line 1261–1266:

```tsx
            {displayed.map((item) => (
              <WatchlistItemCard
                key={item.id}
                item={item}
                jellyfinProgress={progressMap?.get(`${item.tmdbId}-${item.mediaType}`) ?? undefined}
                onSelect={() => setPanel({ tmdbId: item.tmdbId, mediaType: item.mediaType as MediaType })}
                compact={isMobile}
              />
            ))}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat: pass compact=isMobile to WatchlistItemCard"
```

---

### Task 3: Add mobile detection and compact layout to MediaPanel

**Files:**
- Modify: `apps/web/src/components/MediaPanel.tsx`

- [ ] **Step 1: Add `isMobile` state with matchMedia**

At the top of the `MediaPanel` function body, after the existing `useState` declarations (around line 58), add:

```tsx
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
```

- [ ] **Step 2: Compact the backdrop height**

Find the backdrop image block at line 317–319 (`className="relative h-36 overflow-hidden"`). Replace:

```tsx
              <div className="relative overflow-hidden" style={{ height: isMobile ? 80 : 144 }}>
```

- [ ] **Step 3: Compact the scrollable content padding**

Find the scrollable content `<div>` at line 389 (`style={{ padding: '0 20px 40px' }}`). Replace:

```tsx
        <div style={{ padding: isMobile ? '0 14px 28px' : '0 20px 40px' }} className="flex flex-col gap-5">
```

- [ ] **Step 4: Compact the section gap**

The `flex flex-col gap-5` on the scrollable container (same div as step 3) should also reduce on mobile. Inline style wins over Tailwind so use style only:

```tsx
        <div style={{ padding: isMobile ? '0 14px 28px' : '0 20px 40px', display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 20 }}>
```

Remove the `className="flex flex-col gap-5"` from that same div (the style attribute replaces it).

- [ ] **Step 5: Compact the poster thumbnail width**

Find the poster `<img>` at line 393–399 (`style={{ width: 88, ... }}`). Replace:

```tsx
              <img
                src={`${TMDB_POSTER}${meta.posterPath}`}
                alt=""
                className="flex-shrink-0 rounded-[8px]"
                style={{ width: isMobile ? 68 : 88, boxShadow: '0 4px 20px rgba(0,0,0,.5)', border: '2px solid var(--border)' }}
              />
```

- [ ] **Step 6: Compact the rating buttons**

Find the rating button loop at line 849 (`className="w-[28px] h-[28px] ..."`). Replace:

```tsx
                <button
                  key={n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className="rounded-[5px] text-[var(--text-12)] font-semibold transition-all duration-100 cursor-pointer border-none"
                  style={{
                    width: isMobile ? 24 : 28,
                    height: isMobile ? 24 : 28,
                    background: rating != null && n <= rating ? 'var(--amber)' : 'var(--surface)',
                    color: rating != null && n <= rating ? '#18181b' : 'var(--muted)',
                    border: `1px solid ${rating != null && n <= rating ? 'transparent' : 'var(--border2)'}`,
                  }}
                  onMouseEnter={(e) => { if (!(rating != null && n <= rating)) e.currentTarget.style.color = 'var(--fg)' }}
                  onMouseLeave={(e) => { if (!(rating != null && n <= rating)) e.currentTarget.style.color = 'var(--muted)' }}
                >
```

- [ ] **Step 7: Compact the Divider negative margin**

Find the `Divider` component at the bottom of the file (line 1011–1013):

```tsx
function Divider({ compact }: { compact?: boolean }) {
  return <div style={{ height: 1, background: 'var(--border2)', margin: compact ? '0 -14px' : '0 -20px' }} />
}
```

Pass `compact` at each `<Divider />` usage (there are 3). Update each call site:

```tsx
          <Divider compact={isMobile} />
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/MediaPanel.tsx
git commit -m "feat: compact MediaPanel layout on mobile viewports"
```

---

### Task 4: Smoke-test on mobile viewport

**No code changes in this task — verification only.**

- [ ] **Step 1: Start dev server**

```bash
cd apps/web && pnpm dev
```

- [ ] **Step 2: Open browser DevTools → device toolbar → iPhone SE (375px wide)**

Navigate to `http://localhost:3000`.

- [ ] **Step 3: Verify WatchlistItemCard in list view**

Expected:
- Poster is 64×96px (visually smaller than before)
- Card padding is tighter (items closer to edges)
- All badge icons, progress bars, and meta info still render correctly

- [ ] **Step 4: Tap a card to open MediaPanel**

Expected:
- Backdrop image height ~80px (shorter than desktop's 144px)
- Content starts higher on screen
- Poster thumbnail 68px wide
- Rating row buttons fit comfortably in one row (10 × 24px = 240px < 375px)
- Dividers span full width

- [ ] **Step 5: Switch to desktop viewport (1280px)**

Expected: all original sizing restored — 86×129px poster on list cards, 88px poster in panel, 28px rating buttons, full padding.

- [ ] **Step 6: Commit if any fixes were needed, otherwise done**

```bash
git add -p
git commit -m "fix: mobile compact view adjustments from smoke test"
```
