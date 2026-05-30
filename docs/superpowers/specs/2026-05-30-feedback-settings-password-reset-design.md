# Design: Feedback, Settings Reactivity, Genres Wrap & Password Reset

**Date:** 2026-05-30  
**Status:** Approved

---

## 1. Toast Notification System

### Architecture

New `ToastProvider` context wraps the app inside `SettingsProvider` in `apps/web/src/app/layout.tsx`.

**Types (`src/components/Toast.tsx`):**
```ts
type ToastVariant = 'success' | 'error' | 'info'
interface Toast { id: string; message: string; variant: ToastVariant; duration?: number }
```

**Context API (`src/hooks/useToast.ts`):**
```ts
useToast() → { toast(message: string, variant?: ToastVariant, duration?: number): void }
```

**Rendering:**
- Fixed position, bottom-center, `z-50`
- Max 3 toasts visible (oldest auto-removed)
- Success/info: auto-dismiss after 3s (card meta saves: 1.5s)
- Error: stays until user taps dismiss (×)
- Slide-up enter, fade-out exit animation via CSS transition

### Where Toasts Fire

| Operation | Location | Variant | Duration |
|---|---|---|---|
| Sync success | `useSync.sync()` — after `pullItems` resolves | success | 3s |
| Sync fail | `useSync.sync()` — catch block | error | sticky |
| Clear cache | `profile/page.tsx handleClearCache` | success | 3s |
| Card meta toggle | `useSettings.updateCardMeta` — after persist | success | 1.5s |
| TMDB key save | `profile/page.tsx saveTmdbKey` — replaces green-flash state | success | 3s |

Theme toggle: no toast — visual feedback is immediate and obvious.

---

## 2. Card Metadata Reactivity Fix

### Root Cause

`useMediaMeta` (`src/hooks/useMediaMeta.ts`) calls `getTmdbApiKey()` (reads localStorage directly) at effect invocation time. The `useEffect` dependency array is `[tmdbId, mediaType]`, so changing the TMDB API key in settings has no effect on mounted cards.

### Fix

- Remove the `getTmdbApiKey()` call inside `useMediaMeta`
- Accept `tmdbApiKey` as a parameter: `useMediaMeta(tmdbId, mediaType, tmdbApiKey)`
- Call sites (`WatchlistItemCard`, `GridItemCard`, media detail page) read `settings.tmdbApiKey` from `useSettings()` and pass it in
- Add `tmdbApiKey` to the `useEffect` dependency array → key change triggers re-fetch

---

## 3. Genres Wrap

### Change

`WatchlistItemCard.tsx` line 53:
```ts
// Before
const genres = meta?.genres?.slice(0, 2) ?? []
// After
const genres = meta?.genres ?? []
```

Container already uses `flex-wrap` — no layout changes needed. All genres render, wrap naturally to next row.

---

## 4. Password Reset (Token-Only, No Email)

### Rationale

No SMTP infrastructure. API returns reset URL directly in response body — user copies the link. Suitable for self-hosted / dev use.

### Backend

**Migration `apps/api/src/db/migrations/004_password_reset.sql`:**
```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
```

**New API routes in `apps/api/src/routes/auth.ts`:**

`POST /auth/forgot-password`
- Body: `{ email: string }`
- Finds user by email. If not found: returns `200` with generic message (no enumeration).
- Creates token row with `expires_at = NOW() + interval '1 hour'`
- Returns: `{ resetUrl: "/auth/reset-password?token=<uuid>" }`

`POST /auth/reset-password`
- Body: `{ token: string; newPassword: string }`
- Validates: token exists, `used_at IS NULL`, `expires_at > NOW()`
- Hashes new password, calls `userRepo.updatePassword(userId, hash)`
- Marks token `used_at = NOW()`
- Returns: `{ ok: true }`
- Error cases: 400 for invalid/expired/used token

**`UserRepo` addition:**
```ts
updatePassword(userId: string, passwordHash: string): Promise<void>
```

**`apiClient` additions (`src/lib/api-client.ts`):**
```ts
forgotPassword(email: string): Promise<{ resetUrl: string }>
resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }>
```

### Frontend

**`/auth/forgot-password` page:**
- Single email input + submit button
- On success: shows the `resetUrl` from response in a copyable text box with a copy button
- Shows instruction: "Copy this link and open it in your browser to reset your password."
- Error: shows API error inline

**`/auth/reset-password` page:**
- Reads `token` from query param (`useSearchParams`)
- New password + confirm password inputs
- Validates passwords match client-side before submit
- On success: shows "Password updated. Sign in." with link to `/auth/login`
- On error: shows inline message (invalid/expired token)

**Login page addition:**
- "Forgot password?" link below the password input field, links to `/auth/forgot-password`
- Styled as subtle text link matching existing "No account? Register" pattern

---

## Files Touched

### New
- `apps/web/src/components/Toast.tsx` — Toast component + ToastProvider
- `apps/web/src/hooks/useToast.ts` — useToast hook
- `apps/web/src/app/auth/forgot-password/page.tsx`
- `apps/web/src/app/auth/reset-password/page.tsx`
- `apps/api/src/db/migrations/004_password_reset.sql`

### Modified
- `apps/web/src/app/layout.tsx` — add ToastProvider
- `apps/web/src/hooks/useSync.ts` — fire toast on success/fail
- `apps/web/src/hooks/useSettings.ts` — fire toast in updateCardMeta
- `apps/web/src/hooks/useMediaMeta.ts` — accept tmdbApiKey param, add to deps
- `apps/web/src/components/WatchlistItemCard.tsx` — pass tmdbApiKey, remove genres slice
- `apps/web/src/components/GridItemCard.tsx` — pass tmdbApiKey (if uses useMediaMeta)
- `apps/web/src/app/media/[type]/[id]/page.tsx` — pass tmdbApiKey
- `apps/web/src/app/profile/page.tsx` — fire toasts, remove tmdbKeySaved state
- `apps/web/src/app/auth/login/page.tsx` — add forgot password link
- `apps/web/src/lib/api-client.ts` — add forgotPassword + resetPassword
- `apps/api/src/routes/auth.ts` — add forgot/reset routes
- `apps/api/src/repos/user-repo.ts` — add updatePassword method
