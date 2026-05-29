# myWatch — Design & Functionality Specification

> Reference implementation: `index.html`  
> Target: native iOS app, Android TV app, web app (same feature parity, platform-appropriate UX)

---

## 1. Design System

### 1.1 Color tokens

| Token | Value | Role |
|---|---|---|
| `--bg` | `#18181b` | Page/screen background |
| `--surface` | `#27272a` | Card background, panels |
| `--surface2` | `#2f2f33` | Hover state, segmented control active |
| `--border` | `#3f3f46` | Strong borders |
| `--border2` | `#2d2d31` | Subtle borders (card default) |
| `--fg` | `#f4f4f5` | Primary text |
| `--fg2` | `#d4d4d8` | Secondary text |
| `--muted` | `#a1a1aa` | Tertiary text, inactive icons |
| `--muted2` | `#71717a` | Labels, captions |
| `--accent` | `#6366f1` | Primary actions, focus rings, active tabs |
| `--accent2` | `#818cf8` | Accent on dark surfaces (wordmark) |
| `--accent-bg` | `rgba(99,102,241,.14)` | Accent tinted backgrounds |
| `--amber` | `#fbbf24` | Rating, in-progress badge |
| `--green` | `#4ade80` | Watched badge, sync dot |
| `--blue` | `#60a5fa` | Planned badge |
| `--red` | `#f87171` | Quit badge, danger action |
| `--purple` | `#c084fc` | TV type badge |
| `--orange` | `#fb923c` | Movie type badge |

### 1.2 Typography

- **Font family:** System font stack — `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif`
- **Font smoothing:** `-webkit-font-smoothing: antialiased`
- **Base size:** 14px, line-height 1.5

| Element | Size | Weight | Notes |
|---|---|---|---|
| Page title | 17px | 700 | letter-spacing -0.03em |
| Card title | 14px | 600 | letter-spacing -0.015em, truncate with ellipsis |
| Card meta | 11.5px | 400 | color: `--muted2` |
| Badge / pill | 11px | 600 | pill border-radius |
| Type badge | 9.5px | 800 | letter-spacing 0.06em, all-caps |
| Section label | 10px | 700 | letter-spacing 0.08em, all-caps, color `--muted2` |
| Detail title | 22px (web/iOS) / 36px (ATV) | 800 | letter-spacing -0.04em |
| Detail body | 14px (16px ATV) | 400 | line-height 1.6 |
| Wordmark | 13px (18px ATV) | 700 | letter-spacing -0.02em |
| Monospaced numerics | — | — | `font-variant-numeric: tabular-nums` |

### 1.3 Spacing & radii

| Token | Value |
|---|---|
| `--r` | 10px — default card radius |
| `--rsm` | 6px — button, input radius |
| `--rxs` | 4px — small badge radius |
| `--pill` | 9999px — pill radius |

Standard card padding: `11px 12px`. Detail body padding: `0 20px 32px`.

### 1.4 Elevation

Two levels only:
- **Flat (default):** no shadow
- **Card hover:** `translateY(-1px)` + `box-shadow: 0 2px 10px rgba(0,0,0,.25)`
- **Detail panel:** `border-left: 1px solid var(--border)` — no shadow
- **Platform bar:** `box-shadow: 0 4px 20px rgba(0,0,0,.5)` + `backdrop-filter: blur(12px)`

### 1.5 Motion

| Interaction | Duration | Easing |
|---|---|---|
| Card hover lift | 120ms | ease |
| Web side panel slide | 280ms | `cubic-bezier(.4,0,.2,1)` |
| iOS bottom sheet slide | 320ms | `cubic-bezier(.4,0,.2,1)` |
| ATV overlay fade | 200ms | ease |
| Scrim fade | 200ms | ease |
| Progress bar fill | 400ms | ease |
| Filter/sort state | 100–150ms | ease |

---

## 2. Data Model

Each watchlist item carries:

```ts
interface WatchItem {
  id: number
  title: string
  type: 'movie' | 'tv'
  year: number
  status: 'planned' | 'in_progress' | 'watched' | 'quit'
  rating?: number           // 1–10 user rating, optional
  updatedAt: string         // ISO date string YYYY-MM-DD
  
  // Poster generation
  c1: string                // gradient start hex (unique per title)
  c2: string                // gradient end hex (dark, near black)
  motif: PosterMotif        // see §4

  // Rich info (detail view)
  director: string
  cast: Array<{ n: string; r: string; a: string }> // name, role, avatar color
  genres: string[]
  synopsis: string
  runtime: string           // e.g. "166 min" or "~50 min"
  platform: string          // streaming platform name
  imdb: number              // IMDb rating

  // TV only
  season?: number
  episode?: number
  episodes?: number         // total episodes in current season
}

type PosterMotif = 'waves' | 'spores' | 'radial' | 'grid' | 'bokeh' | 'diamond' | 'rain' | 'swirl'
```

Status display:

| status | label | badge color |
|---|---|---|
| `planned` | Planned | `--blue` |
| `in_progress` | In Progress | `--amber` |
| `watched` | Watched | `--green` |
| `quit` | Quit | `--red` |

---

## 3. Screen Architecture

### 3.1 List screen (all platforms)

**Header** (sticky, sits on `--bg`):
- Left: `myWatch` wordmark badge + `My List` title + visible-count pill
- Right: Search icon button + Discover icon button + Avatar circle (user initial, accent border)
- Height: ~58px

**Filter bar** (sticky below header):
- Row 1 — Status tabs (scrollable horizontal): All / Planned / In Progress / Watched / Quit. Each shows a live count badge. Active tab fills with `--accent`.
- Row 2 — Controls row:
  - Segmented type control: All / Movies / TV
  - Sort button (cycles: Recently Updated → Top Rated → A–Z)
  - Sync indicator (green dot + timestamp)
- Divider line at bottom: `1px solid --border2`

**List body:**
- Vertical stack of cards, `gap: 5px`
- Empty state when no items match filters

**Empty state:**
- Centered icon box (52×52, rounded 13px, surface bg)
- Title + subtitle text
- CTA button: "Search something to watch"

### 3.2 Card component

Layout: `flex row, gap 12px, padding 11×12px`

```
[Poster 52×78] [Body: flex-col]           [Rating col]
               Title (truncate)           ★ 9
               Year · TYPE-BADGE
               [Status badge] [Progress pill]
```

- **Poster:** SVG procedural art, 52×78px, `border-radius: 6px`
- **Type badge:** MOVIE (orange tint) / TV (purple tint), 9.5px all-caps, 3px radius
- **Status badge:** colored dot + label, pill shape
- **Progress pill** (TV in-progress only): `S1·E6` format, outlined pill
- **Rating:** amber `★N`, floated right column, hidden when no rating set
- **Hover:** `translateY(-1px)` lift, surface2 bg, stronger border

### 3.3 Detail view — platform variants

The same content is shown in three different containers depending on platform.

#### Web — Side panel (440px fixed right)
- Slides in from right, `translateX(100%) → translateX(0)`, 280ms
- Full viewport height, independently scrollable
- Scrim covers list (dark, `blur(2px)`) — clicking scrim closes panel
- Close button inside panel (top-right of hero image)

#### iOS — Bottom sheet
- Fixed to bottom of screen (positioned over phone frame)
- Width: 393px (matches phone frame)
- Max height: 88vh
- Slides up from `translateY(100%)`, 320ms
- Drag handle pill at top (sticky header)
- Scrim covers content above sheet

#### Android TV — Fullscreen overlay
- `position: fixed; inset: 0` on `#0a0a0c` background
- Fades in (opacity 0→1), 200ms
- Two-column layout: large poster left (280×420) + info right
- Back button at top-left (`← Back`)
- No scrim (overlay is full-screen)
- Escape / Backspace key closes

### 3.4 Detail content structure

```
[Hero image / poster — full width]
  [gradient fade bottom edge]
  [× close button — top right]

[Detail body]
  Title
  Year · runtime · platform badge

  [if rated] ★★★★☆  N/10  [IMDb badge]

  Synopsis paragraph

  GENRES
  [chip] [chip] [chip]

  DIRECTOR
  Name

  CAST
  [avatar] Name / Role    ← all cast on web/iOS, top 3 on ATV
  ...

  [if TV in_progress]
  PROGRESS — Season N, Episode N
  [====progress bar====]
  XX% complete

  [Primary action button]  ← "Start Watching" / "Continue S1 E6" / "Watch Again"
  [Edit Status]  [Remove]
```

ATV detail uses a horizontal layout:
- Left column: 280×420 poster card
- Right column: all fields above except hero (hero is the poster card)
- Action: primary button (flex 2) + Close button (flex 1) in a row

---

## 4. Poster Generation

Each item gets a procedural SVG poster using two colors and a motif. The SVG is inline (no external images).

### Structure

```svg
<svg viewBox="0 0 W H">
  <defs>
    <!-- Main gradient: c1 (top-left) → c2 (bottom-right) -->
    <!-- Overlay gradient: transparent (50%) → rgba(0,0,0,.7) (bottom) -->
  </defs>
  <rect fill="main-gradient" />
  [motif layer — see below]
  <rect fill="overlay-gradient" />
  <!-- Title text: first word large, remaining words smaller -->
  <!-- FILM / TV SERIES label at bottom strip -->
</svg>
```

### Motifs

| Motif | Visual | Used for |
|---|---|---|
| `waves` | Sinusoidal paths + subtle ellipse glow | Dune |
| `spores` | Scattered filled dots + ring halos | The Last of Us |
| `radial` | Central circle + 12 radiating lines | Oppenheimer |
| `grid` | 5 vertical + 8 horizontal hairlines | Severance |
| `bokeh` | 6 soft translucent circles, varied size | Past Lives |
| `diamond` | Tessellated diamond grid, 5 cols | Shōgun |
| `rain` | 20 diagonal rain streaks | Killers of the Flower Moon |
| `swirl` | Spiraling cubic bezier path | Poor Things |

### Text overlay rules
- Main word (first word of title): white 92% opacity, weight 900
  - Font size: `min(W × 0.14, 24px)` — scales with poster width
- Sub text (remaining words, max 14 chars): white 60% opacity, weight 600
  - Font size: `min(W × 0.065, 11px)`
- Title positioned at 78% height
- Bottom strip `rgba(0,0,0,.4)`, 7% height — contains FILM/TV SERIES label

### Dimensions
| Context | Width | Height |
|---|---|---|
| List card | 52 | 78 |
| Web detail hero | 440 | 280 |
| iOS detail hero | 393 | 280 |
| ATV detail card | 280 | 420 |

---

## 5. Filtering & Sorting

### Filter state
Three independent filters, ANDed together:
1. `statusFilter`: `'all' | 'planned' | 'in_progress' | 'watched' | 'quit'`
2. `typeFilter`: `'all' | 'movie' | 'tv'`
3. `sortIndex`: cycles through `['updated', 'rating', 'title']`

### Sort logic
| Sort | Key |
|---|---|
| Recently Updated | `updatedAt` descending (ISO string compare) |
| Top Rated | `rating` descending, unrated items treated as 0 |
| A – Z | `title` ascending, `localeCompare` |

### Count badges
- Status tab counts reflect the **full dataset** (no cross-filter), counted per status value
- Title count badge reflects the **currently filtered** result set

---

## 6. Platform-Specific Behavior

### Web

- App content max-width: 620px, left-aligned
- Detail panel: 440px fixed right, leaves list visible behind scrim
- Header sticky at top:0, filter bar sticky at top:58px
- Scrim + click-outside closes detail

### iOS

- Rendered inside a 393×852 device frame with:
  - Dynamic Island notch (126×34, rounded bottom 22px)
  - Status bar (54px): time left, notch center, signal/wifi/battery icons right
  - Home indicator pill (134×5, 34px bar) at bottom
- Content in scrollable region between status bar and home bar
- Bottom sheet: 393px wide, up to 88vh, drag handle at top
- Both scrim and sheet position are `fixed` — inside the browser they overlay outside the phone frame; native implementation should use a sheet modal

### Android TV

- Full viewport width
- Content padding: `0 60px` horizontal, `0 0 60px` vertical
- Grid layout: `repeat(auto-fill, minmax(200px, 1fr))`, gap 16px
- Cards are vertical (poster on top, info below), not horizontal rows
- D-pad focus ring: `3px solid --accent`, `outline-offset: 2px`, `box-shadow: 0 0 0 6px rgba(99,102,241,.25)`, `scale(1.03)`
- Focus movement:
  - `ArrowRight/Left` — ±1 item
  - `ArrowDown/Up` — ±(columns count) items — column count = `floor((viewportWidth - 120) / 216)`
  - `Enter` — open detail
  - `Escape / Back` — close detail
- Hover states disabled on ATV (no mouse)
- Detail: fullscreen overlay, two-column layout, no scrim

---

## 7. Component States

### Card
| State | Visual change |
|---|---|
| Default | `--surface` bg, `--border2` border |
| Hover (web/iOS) | `--surface2` bg, `--border` border, translateY(-1px), shadow |
| Active/press | translateY(0) — spring back |
| ATV focused | accent outline 3px, outer glow 6px, scale 1.03 |

### Status tab
| State | Visual |
|---|---|
| Inactive | `--surface` bg, `--muted` text |
| Hover | `--fg2` text, `--border` border |
| Active | `--accent` fill, white text, font-weight 600 |

### Type segmented control
| State | Visual |
|---|---|
| Inactive | transparent bg, `--muted` text |
| Active | `--surface2` bg, `--fg` text, font-weight 600 |

### Primary action button
| State | Visual |
|---|---|
| Default | `--accent` bg, white text |
| Hover | `#4f46e5` bg |

### Sync button
- Default: ghost (transparent bg)
- Click: shows "Syncing…" text for 1200ms, then "Synced just now" with green dot

---

## 8. Detail Actions

| Button | Context | Behavior |
|---|---|---|
| "▶ Start Watching" | status = planned | [mark in-progress] |
| "▶ Continue S{N} E{N}" | status = in_progress | [open player / increment episode] |
| "▶ Watch Again" | status = watched | [mark in-progress, reset progress] |
| "Edit Status" | all | [open status picker sheet] |
| "Remove" | all | [confirm then delete from list] |
| "← Back" | ATV only | closes detail overlay |
| "✕" (close) | web/iOS | closes panel/sheet |

These actions are stubs in the prototype — implement with real state mutations in production.

---

## 9. Progress Calculation (TV)

For in-progress TV shows:

```
progress% = clamp(
  round( ((season - 1) × episodes + episode) / (episodes × 2) × 100 ),
  0, 95
)
```

The `× 2` denominator assumes the current season is roughly halfway through all seasons. Cap at 95% — 100% should only be set when status = `watched`.

---

## 10. Accessibility Notes

- All interactive elements: `cursor: pointer`
- Card elements have `tabindex="0"` for keyboard access
- ATV: keyboard-only navigation required; no mouse dependency
- Status badges and type badges carry both color and text label — never color alone
- Sync dot (green) is decorative; text "Synced" carries the meaning
- Avoid `letter-spacing` on non-Latin text if app is localized
- Min touch target for iOS: 44×44px (nav buttons are 34px — consider expanding tap area)

---

## 11. File Structure (suggested native implementation)

```
mywatch/
├── screens/
│   ├── ListScreen           — main watchlist with filters
│   └── DetailScreen         — item detail (modal on iOS/web, full-screen on ATV)
├── components/
│   ├── WatchCard            — list row card
│   ├── PosterArt            — procedural poster generator
│   ├── StatusBadge          — colored dot + label pill
│   ├── TypeBadge            — MOVIE / TV badge
│   ├── ProgressBar          — TV episode progress indicator
│   ├── FilterBar            — status tabs + type toggle + sort
│   └── DetailPanel          — web side panel / iOS sheet / ATV fullscreen
├── data/
│   └── watchlist.ts         — WatchItem type + sample data
└── theme/
    └── tokens.ts            — color tokens, radius, spacing
```

---

*This spec was generated from the working prototype in `index.html`. All CSS values, layout measurements, and interaction timings are extracted verbatim from that file.*
