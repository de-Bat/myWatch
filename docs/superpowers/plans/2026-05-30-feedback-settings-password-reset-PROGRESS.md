# Implementation Progress

**Plan:** [2026-05-30-feedback-settings-password-reset.md](./2026-05-30-feedback-settings-password-reset.md)
**Spec:** [../specs/2026-05-30-feedback-settings-password-reset-design.md](../specs/2026-05-30-feedback-settings-password-reset-design.md)
**Base SHA:** `4948b1486d4f3008e0c6b65205b59cb56385bdea`

---

## Task Status

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create Toast component | ✅ DONE | `b7d1162` |
| 2 | Wire ToastProvider into layout | ✅ DONE | `d61da77` |
| 3 | Wire toast to sync hook | ✅ DONE | `d61da77` |
| 4 | Wire toast to profile page | ✅ DONE | `fdbf982` |
| 5 | Fix useMediaMeta reactivity + genres wrap | ✅ DONE | `b956b72` |
| 6 | DB migration — password_reset_tokens | ✅ DONE | `ec1b2c9` |
| 7 | UserRepo password reset methods | ✅ DONE | `09fc5f2` |
| 8 | API routes — forgot/reset password | ✅ DONE | `261736f` |
| 9 | API client — forgotPassword/resetPassword | ✅ DONE | `d9474d4` |
| 10 | Frontend — forgot-password page | ✅ DONE | `31ff657` |
| 11 | Frontend — reset-password page | ✅ DONE | `ad83639` |
| 12 | Login page — forgot password link | ✅ DONE | `f1f3d6e` |

---

## Files Created/Modified So Far

- `apps/web/src/components/Toast.tsx` — ToastProvider, useToast, ToastBubble (new)

## Files Still To Touch

- `apps/web/src/app/layout.tsx`
- `apps/web/src/hooks/useSync.ts`
- `apps/web/src/hooks/useMediaMeta.ts`
- `apps/web/src/components/WatchlistItemCard.tsx`
- `apps/web/src/components/GridItemCard.tsx`
- `apps/web/src/app/media/[type]/[id]/page.tsx`
- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/app/auth/login/page.tsx`
- `apps/web/src/lib/api-client.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/repos/user-repo.ts`
- `apps/api/src/db/migrations/004_password_reset.sql` (new)
- `apps/web/src/app/auth/forgot-password/page.tsx` (new)
- `apps/web/src/app/auth/reset-password/page.tsx` (new)

---

## Resume Instructions

To continue execution, read the plan file and this progress file, then dispatch subagents for tasks 2–12 in order. Use `haiku` model for mechanical tasks, `sonnet` for multi-file integration tasks.

Quality review gate: spec compliance review → code quality review → mark complete → next task.
