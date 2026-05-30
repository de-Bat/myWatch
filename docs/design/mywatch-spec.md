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

> The actual production data model uses TMDB for rich media data; poster art is fetched from TMDB image CDN. The prototype's procedural SVG posters and static cast/director fields are replaced by live TMDB data.

### `watchlist_items`

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | → users |
| tmdb_id | integer | TMDB item ID |
| media_type | 'movie' \| 'tv' | |
| status | 'planned' \| 'in_progress' \| 'watched' \| 'quit' | |
| progress_episode | integer nullable | TV: last watched episode |
| progress_season | integer nullable | TV: last watched season |
| rating | integer nullable | 1–10 user rating |
| notes | text nullable | |
| custom_platforms | text[] | user-added streaming platforms (Jellyfin, Cellcom, FreTV, etc.) |
| added_at / started_at / finished_at / quit_at | timestamptz | lifecycle timestamps |
| updated_at | timestamptz | sync key (last-write-wins) |
| device_id | text | last write origin |
| deleted_at | timestamptz nullable | soft delete |

### `media_cache`

Rich TMDB data cached locally; stale if >7 days.

| Field | Type | Notes |
|---|---|---|
| tmdb_id + media_type | composite PK | |
| title / overview / poster_path / backdrop_path | text | |
| release_date | date nullable | used for UPCOMING badge |
| genres | jsonb | [{id, name}] |
| vote_average / vote_count | numeric | |
| runtime | integer nullable | minutes |
| seasons_count | integer nullable | TV only |
| status | text nullable | 'Ended', 'Returning Series', etc. |
| cached_at | timestamptz | |
| watch_providers | jsonb nullable | [{providerId, providerName, logoPath, displayPriority}] flatrate |
| watch_providers_region | text nullable | ISO 3166-1 alpha-2 |
| watch_providers_cached_at | timestamptz nullable | stale if >7 days |

### `playlists`

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | text | |
| description | text nullable | |
| type | 'manual' \| 'smart' | |
| smart_rules | jsonb nullable | {statuses, mediaTypes, genres, minRating, maxRating} |
| sort_order | int | display order |
| created_at / updated_at | timestamptz | |
| device_id | text | sync key |
| deleted_at | timestamptz nullable | soft delete |

### `playlist_items`

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| playlist_id | uuid | → playlists ON DELETE CASCADE |
| tmdb_id / media_type | | |
| position | int | ordering within manual playlist |
| added_at | timestamptz | |

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
- Right: Search icon button + Discover icon button + Playlists icon button + Avatar circle (user initial, accent border)
- Height: ~58px

**Filter bar** (sticky below header):
- Row 1 — Status tabs (scrollable horizontal): All / Planned / In Progress / Watched / Quit. Each shows a live count badge. Active tab fills with `--accent`.
- Row 2 — Controls row:
  - Segmented type control: All / Movies / TV
  - Sort button (cycles: Recently Updated → Top Rated → A–Z)
  - View toggle: List / Grid icon buttons (preference persisted in localStorage)
  - Sync indicator (green dot + timestamp)
- Row 3 — Genre chips (scrollable horizontal, derived from cached media): "All" + one chip per unique genre. Active chip fills with `--accent`.
- Divider line at bottom: `1px solid --border2`

**List body:**
- **List view:** vertical stack of cards, `gap: 5px`
- **Grid view:** `grid-template-columns: repeat(auto-fill, minmax(110px, 1fr))`, `gap: 10px`, poster cards
- Empty state when no items match filters

**Empty state:**
- Centered icon box (52×52, rounded 13px, surface bg)
- Title + subtitle text
- CTA button: "Search something to watch"

### 3.2 Card components

#### List card (`WatchlistItemCard`)

Layout: `flex row, gap 12px, padding 11×12px`

```
[Poster 52×78] [Body: flex-col]           [Rating col]
               Title (truncate)           ★ 9
               Year · TYPE-BADGE · UPCOMING
               [release date if upcoming]
               [Status badge] [Progress pill]
               [Genre chip] [Genre chip]
```

- **Poster:** TMDB image (w92), 52×78px, `border-radius: 6px`; placeholder gradient if no poster
- **Type badge:** MOVIE (orange tint) / TV (purple tint), 9.5px all-caps, 3px radius
- **UPCOMING badge:** amber tint, shown when `releaseDate > today`
- **Release date:** full formatted date shown below year row when upcoming
- **Status badge:** colored dot + label, pill shape
- **Progress pill** (TV in-progress only): `S1·E6` format, outlined pill
- **Genre chips:** first 2 genres from MediaCache, small outlined chips
- **Rating:** amber `★N`, floated right column, hidden when no rating set
- **Hover:** `translateY(-1px)` lift, surface2 bg, stronger border
- **Right-click context menu:** "Add to Playlist" → submenu of manual playlists

#### Grid card (`GridItemCard`)

- 2:3 aspect ratio poster (TMDB w185)
- Gradient overlay at bottom: title (1-line truncated) + status dot + first genre
- UPCOMING badge at top-left if future release date
- Click → navigate to detail

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
  Type · Year range · Seasons (TV) · Runtime
  TMDB score badge
  [Genre chip] [Genre chip] ...
  Release date + UPCOMING badge (if future)

  Overview paragraph

  WHERE TO WATCH
  [Provider logo + name pill] ...   ← TMDB flatrate providers (auto, region-detected)
  [Custom platform pill] ...         ← user-added (Jellyfin, Cellcom, FreTV, etc.)
  [Preset buttons: Jellyfin | Cellcom | FreTV | Plex | Emby]
  [+ Add custom platform text input]

  STATUS
  [Planned] [In Progress] [Watched] [Quit]  ← always visible selector

  [if TV in_progress]
  PROGRESS
  Season selector + Episode selector

  User rating (1–10)
  Notes field
  Timestamps: added / started / finished or quit
```

ATV detail uses a horizontal layout:
- Left column: 280×420 poster card
- Right column: all fields above except hero (hero is the poster card)
- Action: primary button (flex 2) + Close button (flex 1) in a row

### 3.5 Playlists

**`/playlists` — Playlist list:**
- Header: "Playlists" + "New Playlist" button
- `PlaylistCard` per playlist: stacked poster preview (3 posters, offset 7px), name, type badge (Manual / Smart), item count, description
- Empty state with CTA
- Click → `/playlists/[id]`

**`/playlists/[id]` — Playlist detail:**
- Back button, playlist name + type badge + count
- Smart playlists: active rules shown as chips (statuses, types, min rating)
- Same list/grid view toggle as home screen
- Manual playlists: drag-to-reorder (HTML5 drag, position persisted on drop), remove button on hover
- Delete playlist button

**`CreatePlaylistModal`:**
- Name + description inputs
- Type toggle: Manual / Smart
- Smart mode rule builder: status multi-select, media type toggles, min rating number input

---

## 4. Poster Art

> **Production:** Posters are fetched from the TMDB image CDN (`https://image.tmdb.org/t/p/{size}{posterPath}`). The procedural SVG system below was used in the initial prototype and is retained as a fallback when no TMDB poster is available.

### Fallback: Procedural SVG Poster

Each item without a TMDB poster gets a procedural SVG using two colors and a motif. The SVG is inline (no external images).

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
Four independent filters, ANDed together:
1. `statusFilter`: `'all' | 'planned' | 'in_progress' | 'watched' | 'quit'`
2. `typeFilter`: `'all' | 'movie' | 'tv'`
3. `genreFilter`: genre name string or `null` (all) — derived from MediaCache genres
4. `sortIndex`: cycles through `['updated', 'rating', 'title']`

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
