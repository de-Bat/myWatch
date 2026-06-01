# Android (Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the myWatch Next.js web app as a native Android APK using Capacitor, replacing NextAuth with a direct JWT auth layer and switching to static export.

**Architecture:** Remove NextAuth entirely; auth pages call `apps/api` directly via `apiClient` and store the returned JWT in `localStorage`. A custom `useAuth()` hook replaces all `useSession` callsites. Next.js switches to `output: 'export'` (static HTML/JS in `out/`), which Capacitor copies into the Android project.

**Tech Stack:** Next.js 14, Capacitor 6, `@capacitor/preferences`, `@capacitor/app`, TypeScript, pnpm monorepo

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/auth-store.ts` | JWT read/write via localStorage |
| Create | `apps/web/src/hooks/useAuth.ts` | Session state hook replacing useSession |
| Create | `apps/web/src/hooks/useAndroidBackButton.ts` | Hardware back button handler |
| Create | `apps/web/src/components/AndroidBackHandler.tsx` | Mounts back button hook in tree |
| Create | `apps/web/capacitor.config.ts` | Capacitor project config |
| Modify | `apps/web/next.config.mjs` | Static export, trailingSlash, disable SW flag |
| Modify | `apps/web/src/app/layout.tsx` | Remove SessionProvider, add AuthProvider + AndroidBackHandler |
| Modify | `apps/web/src/app/auth/login/page.tsx` | Direct apiClient call, remove signIn() |
| Modify | `apps/web/src/app/auth/register/page.tsx` | Remove signIn() after register |
| Modify | `apps/web/src/app/page.tsx` | useSession → useAuth |
| Modify | `apps/web/src/components/MediaPanel.tsx` | useSession → useAuth |
| Modify | `apps/web/src/app/media/[type]/[id]/page.tsx` | useSession → useAuth |
| Modify | `apps/web/src/lib/api-client.ts` | Remove server-side URL branch |
| Delete | `apps/web/src/auth.ts` | NextAuth config — no longer needed |
| Delete | `apps/web/src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| Delete | `apps/web/src/app/api/health/route.ts` | Server-only health route |
| Generate | `apps/web/android/` | Capacitor Android project (via CLI) |
| Modify | `apps/web/android/app/src/main/AndroidManifest.xml` | Cleartext traffic for HTTP servers |

---

## Task 1: Create auth-store

**Files:**
- Create: `apps/web/src/lib/auth-store.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/src/lib/auth-store.ts

const TOKEN_KEY = 'mywatch_token'
const USER_KEY = 'mywatch_user'

export interface StoredUser {
  id: string
  email: string
  name: string | null
}

export const authStore = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  },
  getUser(): StoredUser | null {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as StoredUser } catch { return null }
  },
  set(token: string, user: StoredUser): void {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/auth-store.ts
git commit -m "feat: add auth-store for JWT persistence"
```

---

## Task 2: Create useAuth hook

**Files:**
- Create: `apps/web/src/hooks/useAuth.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/src/hooks/useAuth.ts
'use client'
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { authStore, type StoredUser } from '@/lib/auth-store'
import { apiClient } from '@/lib/api-client'

interface AuthState {
  user: StoredUser | null
  token: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  signIn(email: string, password: string): Promise<void>
  signOut(): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, isLoading: true })

  useEffect(() => {
    setState({
      user: authStore.getUser(),
      token: authStore.getToken(),
      isLoading: false,
    })
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user } = await apiClient.auth.login({ email, password })
    const stored: StoredUser = { id: user.id, email: user.email, name: user.displayName ?? null }
    authStore.set(token, stored)
    setState({ user: stored, token, isLoading: false })
  }, [])

  const signOut = useCallback(() => {
    authStore.clear()
    setState({ user: null, token: null, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useAuth.ts
git commit -m "feat: add useAuth hook and AuthProvider"
```

---

## Task 3: Update layout.tsx

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Replace SessionProvider with AuthProvider**

Replace the entire file content:

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/hooks/useAuth'
import { SettingsProvider } from '@/hooks/useSettings'
import { ToastProvider } from '@/components/Toast'
import { AutoSync } from '@/components/AutoSync'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { PwaUpdater } from '@/components/PwaUpdater'
import { AndroidBackHandler } from '@/components/AndroidBackHandler'
import './globals.css'

export const metadata: Metadata = {
  title: 'myWatch',
  description: 'Your media watchlist',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'myWatch',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <AndroidBackHandler />
              <AutoSync />
              <OfflineIndicator />
              <PwaUpdater />
              {children}
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat: swap SessionProvider → AuthProvider, add AndroidBackHandler"
```

---

## Task 4: Update auth pages

**Files:**
- Modify: `apps/web/src/app/auth/login/page.tsx`
- Modify: `apps/web/src/app/auth/register/page.tsx`

- [ ] **Step 1: Rewrite login page**

```typescript
// apps/web/src/app/auth/login/page.tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signIn } = useAuth()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signIn(email, password)
      const localCount = await db.watchlistItems.filter((i) => i.deletedAt === null).count()
      router.push(localCount > 0 ? `/?importLocal=1&count=${localCount}` : '/')
    } catch {
      setError('Invalid email or password')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign in to myWatch</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-400">
          No account?{' '}
          <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite register page**

```typescript
// apps/web/src/app/auth/register/page.tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/hooks/useAuth'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { signIn } = useAuth()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await apiClient.auth.register({ email, password, displayName })
      await signIn(email, password)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-zinc-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-medium"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/auth/login/page.tsx apps/web/src/app/auth/register/page.tsx
git commit -m "feat: replace NextAuth signIn with direct apiClient in auth pages"
```

---

## Task 5: Replace useSession in all callsites

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/MediaPanel.tsx`
- Modify: `apps/web/src/app/media/[type]/[id]/page.tsx`
- Plus any other files found by grep

In each file apply this substitution:

**Remove:**
```typescript
import { useSession } from 'next-auth/react'
const { data: session } = useSession()
// session?.apiToken  →  token
// session?.user?.name  →  user?.name
// session?.user?.id  →  user?.id
// session && (...)  →  token && (...)
```

**Replace with:**
```typescript
import { useAuth } from '@/hooks/useAuth'
const { user, token } = useAuth()
```

- [ ] **Step 1: Find all remaining files**

```bash
grep -r "useSession\|from 'next-auth/react'" apps/web/src --include="*.tsx" --include="*.ts" -l
```

- [ ] **Step 2: Update `apps/web/src/app/page.tsx`**

Find and replace:
- `import { useSession } from 'next-auth/react'` → `import { useAuth } from '@/hooks/useAuth'`
- `const { data: session } = useSession()` → `const { user, token } = useAuth()`
- `session?.user?.name?.[0]?.toUpperCase() ?? 'U'` → `user?.name?.[0]?.toUpperCase() ?? 'U'`
- `{session && (` → `{token && (`

- [ ] **Step 3: Update `apps/web/src/components/MediaPanel.tsx`**

Find and replace:
- `import { useSession } from 'next-auth/react'` → `import { useAuth } from '@/hooks/useAuth'`
- `const { data: session } = useSession()` → `const { user, token } = useAuth()`
- Every `session?.apiToken` → `token ?? undefined`
- Every `session?.user` → `user`

- [ ] **Step 4: Update `apps/web/src/app/media/[type]/[id]/page.tsx`**

Apply same substitutions as Step 3.

- [ ] **Step 5: Update any other files from Step 1 grep output**

Apply same substitution pattern to each.

- [ ] **Step 6: Verify no next-auth imports remain**

```bash
grep -r "next-auth" apps/web/src --include="*.tsx" --include="*.ts"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat: replace useSession with useAuth across all callsites"
```

---

## Task 6: Remove NextAuth files and dependency

**Files:**
- Delete: `apps/web/src/auth.ts`
- Delete: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Delete: `apps/web/src/app/api/health/route.ts`
- Modify: `apps/web/package.json` (remove `next-auth`)

- [ ] **Step 1: Delete files**

```powershell
Remove-Item apps/web/src/auth.ts
Remove-Item "apps/web/src/app/api/auth/[...nextauth]/route.ts"
Remove-Item apps/web/src/app/api/health/route.ts
Remove-Item apps/web/src/app/api/auth -Recurse -ErrorAction SilentlyContinue
Remove-Item apps/web/src/app/api -Recurse -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Remove next-auth from apps/web/package.json**

Remove this line from `dependencies`:
```json
"next-auth": "^5.0.0-beta.25",
```

- [ ] **Step 3: Reinstall**

```bash
pnpm install
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove NextAuth — replaced by useAuth/auth-store"
```

---

## Task 7: Simplify api-client

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

- [ ] **Step 1: Remove server-side URL branch**

Find lines 7–9:
```typescript
const API_URL =
  typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')
```

Replace with:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "refactor: simplify api-client to client-only URL resolution"
```

---

## Task 8: Switch Next.js to static export

**Files:**
- Modify: `apps/web/next.config.mjs`

- [ ] **Step 1: Rewrite next.config.mjs**

```javascript
// apps/web/next.config.mjs
import path from 'path'
import { fileURLToPath } from 'url'
import withSerwistInit from '@serwist/next'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_SW === 'true',
})

/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync'],
  output: 'export',
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_BUILD_ID: Date.now().toString(),
  },
}

export default withSerwist(config)
```

- [ ] **Step 2: Test build**

```bash
cd apps/web && pnpm build
```

Expected: build completes, `apps/web/out/` directory exists containing `index.html`.

If a page fails with "Page is missing 'generateStaticParams'" for dynamic routes, add `export const dynamic = 'force-static'` at the top of that page file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.mjs
git commit -m "feat: switch Next.js to output: export for Capacitor"
```

---

## Task 9: Install Capacitor and add Android platform

**Files:**
- Create: `apps/web/capacitor.config.ts`
- Generate: `apps/web/android/`

- [ ] **Step 1: Install packages**

```bash
cd apps/web && pnpm add @capacitor/core @capacitor/cli @capacitor/android @capacitor/preferences @capacitor/app
```

- [ ] **Step 2: Create capacitor.config.ts**

```typescript
// apps/web/capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mywatch.app',
  appName: 'myWatch',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Preferences: {},
  },
}

export default config
```

- [ ] **Step 3: Add Android platform**

```bash
cd apps/web && npx cap add android
```

Expected: `apps/web/android/` directory created.

- [ ] **Step 4: Commit**

```bash
git add apps/web/capacitor.config.ts apps/web/package.json apps/web/android/
git commit -m "feat: add Capacitor config and Android platform"
```

---

## Task 10: Android manifest — cleartext traffic

**Files:**
- Modify: `apps/web/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add usesCleartextTraffic**

Open `apps/web/android/app/src/main/AndroidManifest.xml`. Find the `<application` opening tag and add `android:usesCleartextTraffic="true"`:

```xml
<application
    android:usesCleartextTraffic="true"
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/AppTheme">
```

(Preserve all other existing attributes — only add the `usesCleartextTraffic` line.)

- [ ] **Step 2: Commit**

```bash
git add apps/web/android/app/src/main/AndroidManifest.xml
git commit -m "feat: allow cleartext HTTP for self-hosted servers"
```

---

## Task 11: Android back button handler

**Files:**
- Create: `apps/web/src/hooks/useAndroidBackButton.ts`
- Create: `apps/web/src/components/AndroidBackHandler.tsx`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/src/hooks/useAndroidBackButton.ts
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useAndroidBackButton() {
  const router = useRouter()

  useEffect(() => {
    let cleanup: (() => void) | undefined

    async function setup() {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            router.back()
          } else {
            App.exitApp()
          }
        })
        cleanup = () => handle.remove()
      } catch {
        // Not in Capacitor environment — no-op
      }
    }

    setup()
    return () => { cleanup?.() }
  }, [router])
}
```

- [ ] **Step 2: Create the component**

```typescript
// apps/web/src/components/AndroidBackHandler.tsx
'use client'
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton'

export function AndroidBackHandler() {
  useAndroidBackButton()
  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useAndroidBackButton.ts apps/web/src/components/AndroidBackHandler.tsx
git commit -m "feat: Android hardware back button handler"
```

---

## Task 12: Build, sync, and verify on Android

No code changes — manual verification.

- [ ] **Step 1: Full static build**

```bash
cd apps/web && DISABLE_SW=true pnpm build
```

Expected: `out/` directory with `index.html`, `auth/login/index.html`, etc.

- [ ] **Step 2: Sync to Android**

```bash
cd apps/web && npx cap sync android
```

Expected: output ends with "Sync finished in X.XXXs"

- [ ] **Step 3: Open Android Studio**

```bash
cd apps/web && npx cap open android
```

Run on emulator or connected device (Run → Run 'app').

- [ ] **Step 4: Smoke test**

1. App opens → login screen visible
2. Enter email + password → taps "Sign In" → navigates to watchlist
3. Kill app → reopen → still logged in (token persisted)
4. Tap Android back button from watchlist → nothing (stays on page or exits gracefully)

---

## Notes

- **API URL:** `NEXT_PUBLIC_API_URL` is baked at build time. For truly self-hosted (each user has their own server), the profile settings page already stores server URL — wire `apiClient` to read from settings store as a follow-up.
- **Google/Apple Sign-In:** Out of scope v1. Add via `@codetrix-studio/capacitor-google-auth` when needed.
- **Play Store release:** Out of scope. Requires signing config in `android/app/build.gradle`.
