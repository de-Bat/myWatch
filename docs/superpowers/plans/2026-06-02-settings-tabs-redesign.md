# Settings Tabs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the settings page into three tabs (Server | Client | Logs), add TMDB key and sync interval to server DB, and replace per-section save buttons with a single dirty-state Save button.

**Architecture:** TMDB key and sync interval are added as columns to the `users` table. The settings API GET/PUT is extended to include them. The profile page is refactored to a tabbed layout where all server settings share a snapshot-based dirty state and a single Save button; client settings (theme, font, card flags) remain instant-save.

**Tech Stack:** PostgreSQL (postgres.js migrations), Fastify (TypeScript), Next.js 14 App Router, React hooks, Vitest

---

## Files

| Action | Path |
|--------|------|
| Create | `apps/api/src/db/migrations/008_tmdb_sync.sql` |
| Modify | `apps/api/src/repos/user-repo.ts` |
| Modify | `apps/api/src/routes/settings.ts` |
| Modify | `apps/web/src/app/profile/page.tsx` |

No changes to `useSettings.ts` — `tmdbApiKey` and `syncInterval` already exist in `AppSettings` and will continue to be populated from the server fetch in profile page.

---

## Task 1: DB Migration — add tmdb_api_key and sync_interval

**Files:**
- Create: `apps/api/src/db/migrations/008_tmdb_sync.sql`

- [ ] **Step 1: Create migration file**

```sql
-- apps/api/src/db/migrations/008_tmdb_sync.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS tmdb_api_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_interval INTEGER NOT NULL DEFAULT 5;
```

- [ ] **Step 2: Apply migration**

```bash
cd apps/api && pnpm migrate
```

Expected output contains: `apply 008_tmdb_sync`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/migrations/008_tmdb_sync.sql
git commit -m "feat: add tmdb_api_key and sync_interval columns to users table"
```

---

## Task 2: user-repo — extend LLM settings to include tmdbApiKey and syncInterval

**Files:**
- Modify: `apps/api/src/repos/user-repo.ts`

- [ ] **Step 1: Update `UserRepo` interface — extend `updateLlmSettings` and `getLlmSettings` signatures**

In `apps/api/src/repos/user-repo.ts`, replace the `updateLlmSettings` and `getLlmSettings` signatures in the `UserRepo` interface:

```typescript
  updateLlmSettings(
    userId: string,
    settings: {
      llmProvider: 'gemini' | 'openai'
      llmBaseUrl: string | null
      llmApiKey: string | null
      llmModel: string | null
      recapMinInterval: number
      tmdbApiKey: string | null
      syncInterval: number
    },
  ): Promise<void>
  getLlmSettings(userId: string): Promise<{
    llmProvider: 'gemini' | 'openai'
    llmBaseUrl: string | null
    llmApiKey: string | null
    llmModel: string | null
    recapMinInterval: number
    tmdbApiKey: string | null
    syncInterval: number
  } | null>
```

- [ ] **Step 2: Update `updateLlmSettings` SQL implementation**

Replace the `updateLlmSettings` implementation body:

```typescript
    async updateLlmSettings(userId, settings) {
      await sql`
        UPDATE users
        SET llm_provider = ${settings.llmProvider},
            llm_base_url = ${settings.llmBaseUrl},
            llm_api_key = ${settings.llmApiKey},
            llm_model = ${settings.llmModel},
            recap_min_interval = ${settings.recapMinInterval},
            tmdb_api_key = ${settings.tmdbApiKey},
            sync_interval = ${settings.syncInterval}
        WHERE id = ${userId}
      `
    },
```

- [ ] **Step 3: Update `getLlmSettings` SQL implementation**

Replace the `getLlmSettings` implementation body:

```typescript
    async getLlmSettings(userId) {
      const rows = await sql<{
        llm_provider: 'gemini' | 'openai'
        llm_base_url: string | null
        llm_api_key: string | null
        llm_model: string | null
        recap_min_interval: number
        tmdb_api_key: string | null
        sync_interval: number
      }[]>`
        SELECT llm_provider, llm_base_url, llm_api_key, llm_model, recap_min_interval,
               tmdb_api_key, sync_interval
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `
      if (!rows[0]) return null
      return {
        llmProvider: rows[0].llm_provider || 'gemini',
        llmBaseUrl: rows[0].llm_base_url,
        llmApiKey: rows[0].llm_api_key,
        llmModel: rows[0].llm_model,
        recapMinInterval: rows[0].recap_min_interval || 5,
        tmdbApiKey: rows[0].tmdb_api_key,
        syncInterval: rows[0].sync_interval ?? 5,
      }
    },
```

- [ ] **Step 4: Build to verify TypeScript compiles**

```bash
cd apps/api && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repos/user-repo.ts
git commit -m "feat: extend user-repo LLM settings to include tmdbApiKey and syncInterval"
```

---

## Task 3: Settings route — GET/PUT include tmdbApiKey and syncInterval

**Files:**
- Modify: `apps/api/src/routes/settings.ts`

- [ ] **Step 1: Add fields to `SettingsBody` interface**

In `apps/api/src/routes/settings.ts`, add to the `SettingsBody` interface:

```typescript
interface SettingsBody {
  jellyfinUrl?: string
  jellyfinApiKey?: string
  jellyfinUserId?: string
  llmProvider?: 'gemini' | 'openai'
  llmBaseUrl?: string
  llmApiKey?: string
  llmModel?: string
  recapMinInterval?: number
  tmdbApiKey?: string      // ← add
  syncInterval?: number    // ← add
  radarrUrl?: string
  radarrApiKey?: string
  radarrQualityProfileId?: number
  radarrRootFolderPath?: string
  sonarrUrl?: string
  sonarrApiKey?: string
  sonarrQualityProfileId?: number
  sonarrRootFolderPath?: string
}
```

- [ ] **Step 2: Update GET handler to return new fields**

In the GET handler, add to the `return reply.send({...})` call. Add after the `recapMinInterval` line:

```typescript
        tmdbApiKey: llmSettings?.tmdbApiKey ? '••••••••' : '',
        syncInterval: llmSettings?.syncInterval ?? 5,
```

- [ ] **Step 3: Update PUT handler to accept and persist new fields**

In the PUT handler, add destructuring of new fields:

```typescript
      const {
        jellyfinUrl,
        jellyfinApiKey,
        jellyfinUserId,
        llmProvider,
        llmBaseUrl,
        llmApiKey,
        llmModel,
        recapMinInterval,
        tmdbApiKey,       // ← add
        syncInterval,     // ← add
        radarrUrl,
        radarrApiKey,
        radarrQualityProfileId,
        radarrRootFolderPath,
        sonarrUrl,
        sonarrApiKey,
        sonarrQualityProfileId,
        sonarrRootFolderPath,
      } = req.body
```

In the LLM settings partial update condition, add the new fields to the condition check:

```typescript
      if (userRepo && (llmProvider !== undefined || llmBaseUrl !== undefined || llmApiKey !== undefined || llmModel !== undefined || recapMinInterval !== undefined || tmdbApiKey !== undefined || syncInterval !== undefined)) {
```

In the `updateLlmSettings` call, add the new fields:

```typescript
        await userRepo.updateLlmSettings(userId, {
          llmProvider: finalProvider,
          llmBaseUrl: finalBaseUrl || null,
          llmApiKey: finalApiKey || null,
          llmModel: finalModel || null,
          recapMinInterval: finalInterval || 5,
          tmdbApiKey: tmdbApiKey !== undefined
            ? (tmdbApiKey === '••••••••' ? (existing?.tmdbApiKey ?? null) : tmdbApiKey || null)
            : (existing?.tmdbApiKey ?? null),
          syncInterval: syncInterval !== undefined ? Number(syncInterval) : (existing?.syncInterval ?? 5),
        })
```

- [ ] **Step 4: Build to verify TypeScript compiles**

```bash
cd apps/api && pnpm build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Run API tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass. Note: API tests mock `UserRepo`, so they won't exercise the new fields — that's fine for now.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/settings.ts
git commit -m "feat: settings API includes tmdbApiKey and syncInterval"
```

---

## Task 4: Profile page — state refactor (new states, rename, snapshot type)

**Files:**
- Modify: `apps/web/src/app/profile/page.tsx`

This task adds new state variables and a `ServerFormSnapshot` type, and renames `tmdbKeyInput` → `tmdbApiKeyInput`. It also removes the now-unused `geminiKeyInput` state (API key for gemini now uses `llmApiKeyInput`).

- [ ] **Step 1: Add `ServerFormSnapshot` type and new state variables**

After the component function declaration `export default function SettingsPage() {`, after the existing `useSettings` / `useToast` / `useSession` hooks, add:

```typescript
  type ServerFormSnapshot = {
    jellyfinUrl: string; jellyfinUserId: string; jellyfinApiKey: string
    tmdbApiKey: string; syncInterval: number
    llmProvider: 'gemini' | 'openai'; llmApiKey: string; llmBaseUrl: string
    llmModel: string; recapMinInterval: number
    radarrUrl: string; radarrApiKey: string; radarrQualityProfileId: number; radarrRootFolderPath: string
    sonarrUrl: string; sonarrApiKey: string; sonarrQualityProfileId: number; sonarrRootFolderPath: string
  }

  const [activeTab, setActiveTab] = useState<'server' | 'client' | 'logs'>('server')
  const [serverSnapshot, setServerSnapshot] = useState<ServerFormSnapshot | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncIntervalInput, setSyncIntervalInput] = useState<number>(settings.syncInterval ?? 5)
  const [tmdbApiKeyInput, setTmdbApiKeyInput] = useState('')
```

- [ ] **Step 2: Remove old `tmdbKeyInput` state and `geminiKeyInput` state**

Remove these two lines:

```typescript
  const [tmdbKeyInput, setTmdbKeyInput] = useState('')
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
```

- [ ] **Step 3: Add `isDirty` computed value using `useMemo`**

Add `useMemo` to imports if not present (it already is in the existing imports: `import { useEffect, useState, useCallback } from 'react'` — add `useMemo`).

After the `saving` state declaration, add:

```typescript
  const isDirty = useMemo(() => {
    if (!serverSnapshot) return false
    const current: ServerFormSnapshot = {
      jellyfinUrl: jellyfinUrlInput,
      jellyfinUserId: jellyfinUserIdInput,
      jellyfinApiKey: jellyfinApiKeyInput,
      tmdbApiKey: tmdbApiKeyInput,
      syncInterval: syncIntervalInput,
      llmProvider,
      llmApiKey: llmApiKeyInput,
      llmBaseUrl: llmBaseUrlInput,
      llmModel: llmModelInput,
      recapMinInterval: recapMinIntervalInput,
      radarrUrl: radarrUrlInput,
      radarrApiKey: radarrApiKeyInput,
      radarrQualityProfileId: radarrQualityProfileIdInput,
      radarrRootFolderPath: radarrRootFolderPathInput,
      sonarrUrl: sonarrUrlInput,
      sonarrApiKey: sonarrApiKeyInput,
      sonarrQualityProfileId: sonarrQualityProfileIdInput,
      sonarrRootFolderPath: sonarrRootFolderPathInput,
    }
    return JSON.stringify(current) !== JSON.stringify(serverSnapshot)
  }, [serverSnapshot, jellyfinUrlInput, jellyfinUserIdInput, jellyfinApiKeyInput, tmdbApiKeyInput,
      syncIntervalInput, llmProvider, llmApiKeyInput, llmBaseUrlInput, llmModelInput,
      recapMinIntervalInput, radarrUrlInput, radarrApiKeyInput, radarrQualityProfileIdInput,
      radarrRootFolderPathInput, sonarrUrlInput, sonarrApiKeyInput, sonarrQualityProfileIdInput,
      sonarrRootFolderPathInput])
```

- [ ] **Step 4: Update server settings `useEffect` — populate new fields and set snapshot**

Find the `useEffect` that fetches `/api/user/settings` (starts at approx line 271). Replace the `.then(data => {...})` block with the following extended version:

```typescript
      .then((data: {
        hasCredentials?: boolean
        jellyfinUrl?: string
        jellyfinUserId?: string
        jellyfinApiKey?: string
        llmProvider?: 'gemini' | 'openai'
        llmBaseUrl?: string
        llmApiKey?: string
        llmModel?: string
        recapMinInterval?: number
        tmdbApiKey?: string
        syncInterval?: number
        radarrUrl?: string
        radarrApiKey?: string
        radarrQualityProfileId?: number
        radarrRootFolderPath?: string
        sonarrUrl?: string
        sonarrApiKey?: string
        sonarrQualityProfileId?: number
        sonarrRootFolderPath?: string
      }) => {
        setServerCredsStatus(data.hasCredentials ? 'set' : 'missing')

        const prov = data.llmProvider ?? 'gemini'
        const baseUrl = data.llmBaseUrl ?? ''
        const apiKey = data.llmApiKey ?? ''
        const model = data.llmModel ?? ''
        const interval = data.recapMinInterval ?? 5
        const tmdb = data.tmdbApiKey ?? ''
        const sync = data.syncInterval ?? 5
        const jUrl = data.jellyfinUrl ?? ''
        const jUid = data.jellyfinUserId ?? ''
        const jKey = data.jellyfinApiKey ?? ''
        const rUrl = data.radarrUrl ?? ''
        const rKey = data.radarrApiKey ?? ''
        const rProf = data.radarrQualityProfileId ?? 1
        const rPath = data.radarrRootFolderPath ?? ''
        const sUrl = data.sonarrUrl ?? ''
        const sKey = data.sonarrApiKey ?? ''
        const sProf = data.sonarrQualityProfileId ?? 1
        const sPath = data.sonarrRootFolderPath ?? ''

        setLlmProvider(prov)
        setLlmBaseUrlInput(baseUrl)
        setLlmApiKeyInput(apiKey)
        setLlmModelInput(model)
        setRecapMinIntervalInput(interval)
        setTmdbApiKeyInput(tmdb)
        setSyncIntervalInput(sync)
        setJellyfinUrlInput(jUrl)
        setJellyfinUserIdInput(jUid)
        setJellyfinApiKeyInput(jKey)
        setRadarrUrlInput(rUrl)
        setRadarrApiKeyInput(rKey)
        setRadarrQualityProfileIdInput(rProf)
        setRadarrRootFolderPathInput(rPath)
        setSonarrUrlInput(sUrl)
        setSonarrApiKeyInput(sKey)
        setSonarrQualityProfileIdInput(sProf)
        setSonarrRootFolderPathInput(sPath)

        const snapshot: ServerFormSnapshot = {
          jellyfinUrl: jUrl, jellyfinUserId: jUid, jellyfinApiKey: jKey,
          tmdbApiKey: tmdb, syncInterval: sync,
          llmProvider: prov, llmApiKey: apiKey, llmBaseUrl: baseUrl,
          llmModel: model, recapMinInterval: interval,
          radarrUrl: rUrl, radarrApiKey: rKey, radarrQualityProfileId: rProf, radarrRootFolderPath: rPath,
          sonarrUrl: sUrl, sonarrApiKey: sKey, sonarrQualityProfileId: sProf, sonarrRootFolderPath: sPath,
        }
        setServerSnapshot(snapshot)

        // Sync to local settings hook for offline use + AutoSync + media components
        update({
          llmProvider: prov, llmBaseUrl: baseUrl, llmApiKey: apiKey,
          llmModel: model, recapMinInterval: interval,
          tmdbApiKey: tmdb, syncInterval: sync,
          jellyfinUrl: jUrl, jellyfinUserId: jUid, jellyfinApiKey: jKey,
          radarrUrl: rUrl, radarrApiKey: rKey, radarrQualityProfileId: rProf, radarrRootFolderPath: rPath,
          sonarrUrl: sUrl, sonarrApiKey: sKey, sonarrQualityProfileId: sProf, sonarrRootFolderPath: sPath,
        })

        // Auto-sync any pending offline saves
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
        const pending = localStorage.getItem('mywatch_pending_server_settings')
        if (pending) {
          try {
            const pendingData = JSON.parse(pending)
            fetch(`${apiBase}/api/user/settings`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.apiToken}` },
              body: JSON.stringify(pendingData),
            }).then(r => {
              if (r.ok) {
                localStorage.removeItem('mywatch_pending_server_settings')
                toast('Offline changes synced to server', 'success')
              }
            }).catch(() => {/* silently ignore — will retry next load */})
          } catch { /* bad JSON in storage — clear it */ localStorage.removeItem('mywatch_pending_server_settings') }
        }
      })
```

- [ ] **Step 5: Remove the stale `useEffect` blocks that re-sync from local settings**

Remove these three `useEffect` blocks (they conflict with server-authoritative loading and are no longer needed):

The block starting with `useEffect(() => { setTmdbKeyInput(settings.tmdbApiKey)` (approx line 330–332).

The block starting with `useEffect(() => { setGeminiKeyInput(settings.geminiApiKey ?? '')` (approx line 334–348).

The block starting with `useEffect(() => { setJellyfinUrlInput(settings.jellyfinUrl)` (approx line 350–354).

The block starting with `useEffect(() => { setRadarrUrlInput(settings.radarrUrl ?? '')` (approx line 356–375).

- [ ] **Step 6: Build to verify no TypeScript errors**

```bash
cd apps/web && pnpm build 2>&1 | head -40
```

Expected: TypeScript errors only for now-missing references to removed states (`geminiKeyInput`, `tmdbKeyInput`) — these will be resolved in Task 5 when the old save functions are replaced.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/profile/page.tsx
git commit -m "refactor: profile page state — add tab/snapshot/dirty state, rename tmdb/llm inputs"
```

---

## Task 5: Profile page — unified saveServerSettings + remove old save functions

**Files:**
- Modify: `apps/web/src/app/profile/page.tsx`

- [ ] **Step 1: Remove old individual save functions**

Delete these functions entirely:
- `function saveTmdbKey() { ... }`
- `function saveGeminiKey() { ... }`
- `async function saveLlmSettings() { ... }`
- `async function saveJellyfin() { ... }`
- `async function saveArrSettings() { ... }`

- [ ] **Step 2: Add unified `saveServerSettings` function**

Add after the `useEffect` blocks, before `testRadarr`:

```typescript
  async function saveServerSettings() {
    setSaving(true)
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

    const payload = {
      jellyfinUrl: jellyfinUrlInput.trim(),
      jellyfinUserId: jellyfinUserIdInput.trim(),
      jellyfinApiKey: jellyfinApiKeyInput.trim(),
      tmdbApiKey: tmdbApiKeyInput.trim(),
      syncInterval: syncIntervalInput,
      llmProvider,
      llmBaseUrl: llmBaseUrlInput.trim(),
      llmApiKey: llmApiKeyInput.trim(),
      llmModel: llmProvider === 'gemini' ? 'gemini-1.5-flash' : llmModelInput.trim(),
      recapMinInterval: recapMinIntervalInput,
      radarrUrl: radarrUrlInput.trim(),
      radarrApiKey: radarrApiKeyInput.trim(),
      radarrQualityProfileId: Number(radarrQualityProfileIdInput) || 1,
      radarrRootFolderPath: radarrRootFolderPathInput.trim(),
      sonarrUrl: sonarrUrlInput.trim(),
      sonarrApiKey: sonarrApiKeyInput.trim(),
      sonarrQualityProfileId: Number(sonarrQualityProfileIdInput) || 1,
      sonarrRootFolderPath: sonarrRootFolderPathInput.trim(),
    }

    // Mirror to local settings for offline use by AutoSync + media components
    update({
      tmdbApiKey: payload.tmdbApiKey,
      syncInterval: payload.syncInterval,
      llmProvider: payload.llmProvider,
      llmBaseUrl: payload.llmBaseUrl,
      llmApiKey: payload.llmApiKey,
      llmModel: payload.llmModel,
      recapMinInterval: payload.recapMinInterval,
      jellyfinUrl: payload.jellyfinUrl,
      jellyfinUserId: payload.jellyfinUserId,
      jellyfinApiKey: payload.jellyfinApiKey,
      radarrUrl: payload.radarrUrl,
      radarrApiKey: payload.radarrApiKey,
      radarrQualityProfileId: payload.radarrQualityProfileId,
      radarrRootFolderPath: payload.radarrRootFolderPath,
      sonarrUrl: payload.sonarrUrl,
      sonarrApiKey: payload.sonarrApiKey,
      sonarrQualityProfileId: payload.sonarrQualityProfileId,
      sonarrRootFolderPath: payload.sonarrRootFolderPath,
    })

    if (!session?.apiToken) {
      localStorage.setItem('mywatch_pending_server_settings', JSON.stringify(payload))
      toast('Saved locally — will sync when online', 'success')
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`${apiBase}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.apiToken}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        localStorage.setItem('mywatch_pending_server_settings', JSON.stringify(payload))
        toast('Failed to save — stored locally', 'error')
      } else {
        localStorage.removeItem('mywatch_pending_server_settings')
        // Snapshot uses actual form values (not server-masked) so isDirty stays false after save
        const newSnapshot: ServerFormSnapshot = {
          jellyfinUrl: payload.jellyfinUrl, jellyfinUserId: payload.jellyfinUserId,
          jellyfinApiKey: payload.jellyfinApiKey,
          tmdbApiKey: payload.tmdbApiKey,
          syncInterval: payload.syncInterval,
          llmProvider: payload.llmProvider, llmApiKey: payload.llmApiKey,
          llmBaseUrl: payload.llmBaseUrl, llmModel: payload.llmModel,
          recapMinInterval: payload.recapMinInterval,
          radarrUrl: payload.radarrUrl, radarrApiKey: payload.radarrApiKey,
          radarrQualityProfileId: payload.radarrQualityProfileId, radarrRootFolderPath: payload.radarrRootFolderPath,
          sonarrUrl: payload.sonarrUrl, sonarrApiKey: payload.sonarrApiKey,
          sonarrQualityProfileId: payload.sonarrQualityProfileId, sonarrRootFolderPath: payload.sonarrRootFolderPath,
        }
        setServerSnapshot(newSnapshot)
        setServerCredsStatus('set')
        toast('Settings saved', 'success')
        // Trigger Jellyfin poll if creds are present
        if (payload.jellyfinUrl && payload.jellyfinUserId && payload.jellyfinApiKey) {
          await pollJellyfinNow()
        }
      }
    } catch {
      localStorage.setItem('mywatch_pending_server_settings', JSON.stringify(payload))
      toast('Network error — saved locally', 'error')
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd apps/web && pnpm build 2>&1 | head -60
```

Expected: build succeeds or only minor remaining JSX reference errors (fixed in Task 6).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/profile/page.tsx
git commit -m "refactor: replace per-section save functions with unified saveServerSettings"
```

---

## Task 6: Profile page — JSX tabs structure and Server tab content

**Files:**
- Modify: `apps/web/src/app/profile/page.tsx`

Replace the entire `return (...)` JSX block with the tabbed layout below. The header and Account section remain above the tabs. Server, Client, and Logs content replaces the existing flat section list.

- [ ] **Step 1: Replace the JSX return block**

Replace everything from `return (` to the closing `)` with:

```tsx
  return (
    <div className="page-root">
      {/* Header */}
      <header className="flex items-center gap-[10px] page-header page-sticky-shell">
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
        <h1 style={{ fontSize: 'var(--text-17)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          Settings
        </h1>
      </header>

      <div className="flex flex-col gap-4 content-area">

        {/* Account — always visible above tabs */}
        <Section title="Account">
          {session ? (
            <>
              <Row label={session.user?.name ?? 'User'}>
                <span className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>{session.user?.email}</span>
              </Row>
              <div className="px-4 py-3">
                <button
                  onClick={async () => { await signOut({ redirect: false }); router.push('/') }}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                  style={{ background: 'rgba(248,113,113,.12)', color: 'var(--red)' }}
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3">
              <button
                onClick={() => router.push('/auth/login')}
                className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Sign In to Sync
              </button>
            </div>
          )}
        </Section>

        {/* Tab bar */}
        <div className="flex" style={{ borderBottom: '1px solid var(--border2)', gap: 0 }}>
          {(['server', 'client', 'logs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-[var(--text-13)] font-medium capitalize border-none cursor-pointer transition-colors duration-100"
              style={{
                background: 'transparent',
                color: activeTab === tab ? 'var(--fg)' : 'var(--muted)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: activeTab === tab ? 600 : 500,
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── SERVER TAB ───────────────────────────────────────────── */}
        {activeTab === 'server' && (
          <div className="flex flex-col gap-4">

            {/* Jellyfin */}
            <Section title="Jellyfin">
              <div className="px-4 py-3 space-y-3">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  Connect to your Jellyfin server to overlay watch progress on cards. Requires CORS enabled in Jellyfin → Networking.
                </p>
                <div className="flex flex-col gap-2">
                  <input type="text" value={jellyfinUrlInput} onChange={e => setJellyfinUrlInput(e.target.value)}
                    placeholder="Server URL (e.g. http://jellyfin.local:8096)"
                    className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  />
                  <input type="text" value={jellyfinUserIdInput} onChange={e => setJellyfinUserIdInput(e.target.value)}
                    placeholder="User ID"
                    className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  />
                  <input type="password" value={jellyfinApiKeyInput} onChange={e => setJellyfinApiKeyInput(e.target.value)}
                    placeholder="API Key"
                    className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  />
                </div>
                <button
                  onClick={testJellyfin}
                  disabled={jellyfinTesting || !jellyfinUrlInput || !jellyfinUserIdInput || !jellyfinApiKeyInput}
                  className="px-3 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none flex-shrink-0 transition-all duration-100 disabled:opacity-50"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                >
                  {jellyfinTesting ? 'Testing…' : 'Test Connection'}
                </button>
                {jellyfinTestResult === 'ok' && <p className="text-[var(--text-12)]" style={{ color: 'var(--green)' }}>✓ Connected successfully</p>}
                {jellyfinTestResult === 'error' && <p className="text-[var(--text-12)]" style={{ color: 'var(--red)' }}>Connection failed — check URL, user ID, API key, and CORS settings</p>}
              </div>
            </Section>

            {/* TMDB */}
            <Section title="TMDB API">
              <div className="px-4 py-3 space-y-2">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  TMDB API key for fetching metadata. Saved to server and shared across all your clients.
                </p>
                <input
                  type="password"
                  value={tmdbApiKeyInput}
                  onChange={e => setTmdbApiKeyInput(e.target.value)}
                  placeholder="Enter TMDB API key…"
                  className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
              </div>
            </Section>

            {/* Sync */}
            <Section title="Sync">
              <Row label="Items in list">
                <span className="text-[var(--text-13)] tabular-nums" style={{ color: 'var(--muted2)' }}>{itemCount ?? '–'}</span>
              </Row>
              <Row label="Pending changes">
                <span className="text-[var(--text-13)] tabular-nums" style={{ color: 'var(--muted2)' }}>{pendingCount ?? '–'}</span>
              </Row>
              {lastSyncedAt && (
                <Row label="Last synced">
                  <span className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>
                    {new Date(lastSyncedAt).toLocaleString()}
                  </span>
                </Row>
              )}
              {error && <div className="px-4 py-2 text-[var(--text-12)]" style={{ color: 'var(--red)' }}>{error}</div>}
              <Row label="Auto Sync">
                <div className="flex controls-row"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1, flexShrink: 1, minWidth: 0 }}>
                  {SYNC_INTERVAL_OPTIONS.map(o => {
                    const active = syncIntervalInput === o.value
                    return (
                      <button key={o.value} onClick={() => setSyncIntervalInput(o.value)}
                        className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none whitespace-nowrap"
                        style={{ background: active ? 'var(--surface2)' : 'transparent', color: active ? 'var(--fg)' : 'var(--muted)', fontWeight: active ? 600 : 500 }}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <div className="px-4 py-3">
                {session ? (
                  <button onClick={() => sync()} disabled={syncing}
                    className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none disabled:opacity-50 transition-all duration-100"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                ) : (
                  <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>Sign in to enable sync.</p>
                )}
              </div>
            </Section>

            {/* AI & Recap */}
            <Section title="AI & Recap">
              <div className="px-4 py-3 space-y-3">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  Configure your AI provider to generate progress-based spoiler-free recaps.
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between py-1.5 gap-3" style={{ borderBottom: '1px solid var(--border2)' }}>
                    <span className="text-[var(--text-13)] font-medium" style={{ color: 'var(--fg2)' }}>AI Provider</span>
                    <div className="flex" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}>
                      {([{ value: 'gemini', label: 'Gemini' }, { value: 'openai', label: 'OpenAI-Compatible' }] as const).map(p => {
                        const active = llmProvider === p.value
                        return (
                          <button key={p.value} type="button" onClick={() => setLlmProvider(p.value)}
                            className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                            style={{ background: active ? 'var(--surface2)' : 'transparent', color: active ? 'var(--fg)' : 'var(--muted)', fontWeight: active ? 600 : 500 }}>
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {llmProvider === 'gemini' ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>Gemini API Key</span>
                      <input type="password" value={llmApiKeyInput} onChange={e => setLlmApiKeyInput(e.target.value)}
                        placeholder="Enter Google AI Studio API key…"
                        className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      />
                      <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>Uses gemini-1.5-flash model.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>Base URL</span>
                        <input type="text" value={llmBaseUrlInput} onChange={e => setLlmBaseUrlInput(e.target.value)}
                          placeholder="e.g. https://api.openai.com/v1 or http://localhost:11434/v1"
                          className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>API Key</span>
                        <input type="password" value={llmApiKeyInput} onChange={e => setLlmApiKeyInput(e.target.value)}
                          placeholder="Enter API key…"
                          className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>Model Name</span>
                        <input type="text" value={llmModelInput} onChange={e => setLlmModelInput(e.target.value)}
                          placeholder="e.g. gpt-4o-mini, llama3, mistral"
                          className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 py-1.5" style={{ borderTop: '1px solid var(--border2)' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-13)] font-medium" style={{ color: 'var(--fg2)' }}>Recap Minimal Progress Interval</span>
                      <span className="text-[var(--text-13)] font-bold text-center w-8" style={{ color: 'var(--accent2)' }}>{recapMinIntervalInput}%</span>
                    </div>
                    <input type="range" min="1" max="20" step="1" value={recapMinIntervalInput}
                      onChange={e => setRecapMinIntervalInput(Number(e.target.value))}
                      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>
                      Minimum progress % delta to request a fresh recap (saves API costs).
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            {/* Radarr */}
            <Section title="Radarr (Movies)">
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Radarr</span>
                  <button type="button" onClick={testRadarr}
                    disabled={radarrTesting || !radarrUrlInput || !radarrApiKeyInput}
                    className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold cursor-pointer border-none disabled:opacity-50 transition-all duration-100"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                    {radarrTesting ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
                {radarrTestResult === 'ok' && <p className="text-[11px]" style={{ color: 'var(--green)' }}>✓ Connected to Radarr successfully</p>}
                {radarrTestResult === 'error' && <p className="text-[11px]" style={{ color: 'var(--red)', lineHeight: 1.4 }}>Connection failed: {radarrTestError}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Server URL</span>
                    <input type="text" value={radarrUrlInput} onChange={e => setRadarrUrlInput(e.target.value)}
                      placeholder="e.g. http://localhost:7878"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>API Key</span>
                    <input type="password" value={radarrApiKeyInput} onChange={e => setRadarrApiKeyInput(e.target.value)}
                      placeholder="Enter API key…"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Quality Profile ID</span>
                    <input type="number" value={radarrQualityProfileIdInput} onChange={e => setRadarrQualityProfileIdInput(Number(e.target.value))}
                      placeholder="e.g. 1"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Root Folder Path</span>
                    <input type="text" value={radarrRootFolderPathInput} onChange={e => setRadarrRootFolderPathInput(e.target.value)}
                      placeholder="e.g. /data/media/movies"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                </div>
              </div>
            </Section>

            {/* Sonarr */}
            <Section title="Sonarr (TV Shows)">
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Sonarr</span>
                  <button type="button" onClick={testSonarr}
                    disabled={sonarrTesting || !sonarrUrlInput || !sonarrApiKeyInput}
                    className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold cursor-pointer border-none disabled:opacity-50 transition-all duration-100"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                    {sonarrTesting ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
                {sonarrTestResult === 'ok' && <p className="text-[11px]" style={{ color: 'var(--green)' }}>✓ Connected to Sonarr successfully</p>}
                {sonarrTestResult === 'error' && <p className="text-[11px]" style={{ color: 'var(--red)', lineHeight: 1.4 }}>Connection failed: {sonarrTestError}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Server URL</span>
                    <input type="text" value={sonarrUrlInput} onChange={e => setSonarrUrlInput(e.target.value)}
                      placeholder="e.g. http://localhost:8989"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>API Key</span>
                    <input type="password" value={sonarrApiKeyInput} onChange={e => setSonarrApiKeyInput(e.target.value)}
                      placeholder="Enter API key…"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Quality Profile ID</span>
                    <input type="number" value={sonarrQualityProfileIdInput} onChange={e => setSonarrQualityProfileIdInput(Number(e.target.value))}
                      placeholder="e.g. 1"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Root Folder Path</span>
                    <input type="text" value={sonarrRootFolderPathInput} onChange={e => setSonarrRootFolderPathInput(e.target.value)}
                      placeholder="e.g. /data/media/tv"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }} />
                  </div>
                </div>
              </div>
            </Section>

            {/* Unified Save button */}
            <button
              onClick={saveServerSettings}
              disabled={!isDirty || saving}
              className="w-full py-2.5 rounded-[8px] text-[var(--text-13)] font-semibold cursor-pointer border-none transition-all duration-150 disabled:opacity-40"
              style={{ background: isDirty ? 'var(--accent)' : 'var(--surface2)', color: isDirty ? '#fff' : 'var(--muted)' }}
            >
              {saving ? 'Saving…' : isDirty ? 'Save Server Settings' : 'No Changes'}
            </button>

          </div>
        )}

        {/* ── CLIENT TAB ──────────────────────────────────────────────── */}
        {activeTab === 'client' && (
          <div className="flex flex-col gap-4">

            <Section title="Appearance">
              <Row label="Theme">
                <div className="flex" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}>
                  {(['dark', 'light'] as const).map(t => {
                    const active = settings.theme === t
                    return (
                      <button key={t} onClick={() => update({ theme: t })}
                        className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none capitalize"
                        style={{ background: active ? 'var(--surface2)' : 'transparent', color: active ? 'var(--fg)' : 'var(--muted)', fontWeight: active ? 600 : 500 }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Language">
                <div className="flex" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}>
                  {[{ value: 'en-US', label: 'English' }, { value: 'he-IL', label: 'Hebrew' }].map(lang => {
                    const active = settings.language === lang.value
                    return (
                      <button key={lang.value} onClick={() => update({ language: lang.value })}
                        className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                        style={{ background: active ? 'var(--surface2)' : 'transparent', color: active ? 'var(--fg)' : 'var(--muted)', fontWeight: active ? 600 : 500 }}>
                        {lang.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Font">
                <div className="flex" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}>
                  {FONT_OPTIONS.map(f => {
                    const active = settings.font === f.value
                    return (
                      <button key={f.value} onClick={() => update({ font: f.value })}
                        className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                        style={{ background: active ? 'var(--surface2)' : 'transparent', color: active ? 'var(--fg)' : 'var(--muted)', fontWeight: active ? 600 : 500 }}>
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Font Size">
                <div className="flex" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}>
                  {FONT_SIZE_OPTIONS.map(f => {
                    const active = settings.fontSize === f.value
                    return (
                      <button key={f.value} onClick={() => update({ fontSize: f.value })}
                        className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                        style={{ background: active ? 'var(--surface2)' : 'transparent', color: active ? 'var(--fg)' : 'var(--muted)', fontWeight: active ? 600 : 500 }}>
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
            </Section>

            <Section title="Card Display">
              {(Object.keys(CARD_META_LABELS) as Array<keyof CardMetaSettings>).map(key => (
                <Row key={key} label={CARD_META_LABELS[key]}>
                  <Toggle
                    on={settings.cardMeta[key]}
                    onToggle={() => { updateCardMeta({ [key]: !settings.cardMeta[key] }); toast('Saved', 'success', 1500) }}
                  />
                </Row>
              ))}
            </Section>

            <Section title="Data">
              <div className="px-4 py-3">
                <button onClick={handleClearCache}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                  Clear Media Cache
                </button>
              </div>
            </Section>

          </div>
        )}

        {/* ── LOGS TAB ────────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-4">

            <Section title="Jellyfin Debug">
              <Row label="Server credentials">
                <span className="text-[var(--text-12)]" style={{ color: serverCredsStatus === 'set' ? 'var(--green)' : serverCredsStatus === 'missing' ? 'var(--red)' : 'var(--muted2)' }}>
                  {serverCredsStatus === 'set' ? '✓ Configured' : serverCredsStatus === 'missing' ? '✗ Not set — configure in Server tab' : '…'}
                </span>
              </Row>
              <Row label="Local progress records">
                <span className="text-[var(--text-13)] tabular-nums" style={{ color: (jellyfinProgressCount ?? 0) > 0 ? 'var(--green)' : 'var(--red)' }}>
                  {jellyfinProgressCount ?? 0}
                </span>
              </Row>
              {(jellyfinProgressItems ?? []).slice(0, 5).map(p => (
                <div key={`${p.tmdbId}-${p.mediaType}`} className="px-4 py-1 text-[var(--text-11)] tabular-nums" style={{ color: 'var(--muted2)', fontFamily: 'monospace' }}>
                  tmdb:{p.tmdbId} ({p.mediaType}) → <span style={{ color: p.jellyfinStatus === 'watching' ? 'var(--amber)' : p.jellyfinStatus === 'watched' ? 'var(--green)' : 'var(--muted2)' }}>{p.jellyfinStatus}</span>
                  {p.season != null && ` S${p.season}·E${p.episode}`}
                  {p.totalEpisodes != null && ` ${p.watchedEpisodes ?? 0}/${p.totalEpisodes}ep`}
                  {p.moviePercent != null && ` ${p.moviePercent}%`}
                </div>
              ))}
              {(jellyfinProgressCount ?? 0) > 5 && (
                <div className="px-4 py-1 text-[var(--text-11)]" style={{ color: 'var(--muted2)' }}>…and {(jellyfinProgressCount ?? 0) - 5} more</div>
              )}
              <div className="px-4 py-3 flex flex-col gap-2">
                <button onClick={pollJellyfinNow} disabled={jellyfinPolling || jellyfinPulling}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-semibold cursor-pointer border-none disabled:opacity-50 transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {jellyfinPolling ? 'Polling…' : '▶ Poll Jellyfin Now (Server → Local)'}
                </button>
                <button onClick={() => forcePullJellyfin()} disabled={jellyfinPulling || jellyfinPolling}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none disabled:opacity-50 transition-all"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}>
                  {jellyfinPulling ? 'Pulling…' : 'Pull from Backend DB Only'}
                </button>
                {jellyfinPullLog.length > 0 && (
                  <div className="flex flex-col gap-1 p-2 rounded-[6px]" style={{ background: 'var(--bg)', border: '1px solid var(--border2)' }}>
                    {jellyfinPullLog.map((line, i) => (
                      <span key={i} className="text-[var(--text-11)]" style={{ color: 'var(--fg2)', fontFamily: 'monospace' }}>{line}</span>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            <Section title="PWA Debug">
              <div className="px-4 py-3 flex flex-col gap-2">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  Checks whether this app is running as an installed PWA.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPwaLogs([])
                      addPwaLog('🔄 Manual refresh — re-running PWA checks…', 'info')
                      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
                      addPwaLog(isStandalone ? '✅ display-mode: standalone — running as installed PWA' : '⚠️ display-mode: browser — NOT running as installed PWA', isStandalone ? 'ok' : 'warn')
                      for (const mode of ['standalone', 'fullscreen', 'minimal-ui', 'browser']) {
                        if (window.matchMedia(`(display-mode: ${mode})`).matches)
                          addPwaLog(`ℹ️ matchMedia(display-mode: ${mode}) → true`, 'info')
                      }
                      const navStandalone = (navigator as any).standalone
                      if (navStandalone !== undefined) {
                        addPwaLog(navStandalone ? '✅ navigator.standalone = true (iOS)' : '⚠️ navigator.standalone = false (iOS browser)', navStandalone ? 'ok' : 'warn')
                      } else {
                        addPwaLog('ℹ️ navigator.standalone = undefined (non-iOS)', 'info')
                      }
                      if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistration().then(reg => {
                          if (!reg) { addPwaLog('⚠️ No SW registration', 'warn'); return }
                          addPwaLog(`✅ SW registered — scope: ${reg.scope}`, 'ok')
                          if (reg.active) addPwaLog(`ℹ️ SW active: state="${reg.active.state}"`, 'info')
                          if (reg.waiting) addPwaLog(`ℹ️ SW waiting: state="${reg.waiting.state}"`, 'info')
                          if (reg.installing) addPwaLog(`ℹ️ SW installing: state="${reg.installing.state}"`, 'info')
                          if (navigator.serviceWorker.controller)
                            addPwaLog(`✅ SW controller: ${navigator.serviceWorker.controller.scriptURL}`, 'ok')
                          else addPwaLog('⚠️ No SW controller (reload may be needed)', 'warn')
                        }).catch(e => addPwaLog(`❌ SW error: ${e}`, 'warn'))
                      } else {
                        addPwaLog('❌ serviceWorker API not available', 'warn')
                      }
                      const ml = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
                      addPwaLog(ml ? `✅ manifest: ${ml.href}` : '⚠️ No manifest link found', ml ? 'ok' : 'warn')
                      const sec = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname)
                      addPwaLog(sec ? `✅ Secure origin: ${location.protocol}//${location.host}` : `❌ NOT secure: ${location.protocol}//${location.host}`, sec ? 'ok' : 'warn')
                    }}
                    className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(pwaLogs.map(l => l.text).join('\n')); toast('Logs copied to clipboard', 'success', 2000) }}
                    disabled={pwaLogs.length === 0}
                    className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100 disabled:opacity-50"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                  >
                    📋 Copy Logs
                  </button>
                </div>
                {pwaLogs.length > 0 && (
                  <div className="flex flex-col gap-[3px] p-2 rounded-[6px]" style={{ background: 'var(--bg)', border: '1px solid var(--border2)' }}>
                    {pwaLogs.map((log, i) => (
                      <span key={i} className="text-[var(--text-11)]"
                        style={{ fontFamily: 'monospace', color: log.kind === 'ok' ? 'var(--green)' : log.kind === 'warn' ? 'var(--amber)' : 'var(--fg2)' }}>
                        {log.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Section>

          </div>
        )}

      </div>
    </div>
  )
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd apps/web && pnpm build 2>&1 | head -60
```

Expected: clean build.

- [ ] **Step 3: Run web tests**

```bash
cd apps/web && pnpm test
```

Expected: all tests pass (no tests touch the profile page directly).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/profile/page.tsx
git commit -m "feat: settings page — tabbed layout (Server/Client/Logs), unified save button"
```

---

## Task 7: Verify end-to-end in browser

- [ ] **Step 1: Start dev servers**

```bash
# Terminal 1 — API
cd apps/api && pnpm dev

# Terminal 2 — Web
cd apps/web && pnpm dev
```

- [ ] **Step 2: Manual verification checklist**

Navigate to `http://localhost:3000/profile` and verify:

1. **Tab bar** renders with Server / Client / Logs tabs
2. **Account section** is above the tab bar
3. **Server tab**: Jellyfin, TMDB, Sync, AI & Recap, Radarr, Sonarr sections visible
4. **Save button** starts disabled ("No Changes")
5. Change any server field → Save button becomes active ("Save Server Settings")
6. Click Save → toast "Settings saved", button goes back to disabled
7. Reload page → same values appear in form (loaded from server)
8. **Client tab**: Theme, Language, Font, Card Display sections; changes take effect immediately, no Save button
9. **Logs tab**: Jellyfin Debug and PWA Debug sections visible
10. **TMDB key**: enter a key in Server tab → Save → reload → key shows as `••••••••`
11. **Sync interval**: change to 15 min → Save → reload → 15 min selected
