'use client'
export const dynamic = 'force-static'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSync } from '@/hooks/useSync'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/Toast'
import type { CardMetaSettings, FontFamily, FontSize } from '@/hooks/useSettings'
import { db } from '@/lib/db'
import { apiClient } from '@/lib/api-client'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-[10px] overflow-hidden"
      style={{ border: '1px solid var(--border2)', background: 'var(--surface)' }}
    >
      <div
        className="px-4 py-2"
        style={{ borderBottom: '1px solid var(--border2)', background: 'var(--surface2)' }}
      >
        <span className="text-[var(--text-10)] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--muted2)' }}>
          {title}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border2)' }}>
        {children}
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <span className="text-[var(--text-13)]" style={{ color: 'var(--fg2)' }}>{label}</span>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="toggle"
      className="flex-shrink-0 relative transition-colors duration-150"
      style={{
        width: 40,
        height: 22,
        borderRadius: 'var(--pill)',
        background: on ? 'var(--accent)' : 'var(--border)',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        className="absolute top-[2px] transition-transform duration-150"
        style={{
          left: 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          display: 'block',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }}
      />
    </button>
  )
}

const CARD_META_LABELS: Record<keyof CardMetaSettings, string> = {
  showGenres: 'Genres',
  showTmdbRating: 'TMDB Rating',
  showRuntime: 'Runtime',
  showProviders: 'Streaming Providers',
  showOverview: 'Plot Overview',
  showProgress: 'Progress Bars',
  showAvailability: 'Availability',
  showPlatform: 'Platform',
  showBadgesAsIcons: 'Badges as Icons',
}

const FONT_OPTIONS: Array<{ value: FontFamily; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
]

const FONT_SIZE_OPTIONS: Array<{ value: FontSize; label: string }> = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
]

const SYNC_INTERVAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0,  label: 'Never' },
  { value: 1,  label: '1 min' },
  { value: 5,  label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

type ServerFormSnapshot = {
  jellyfinUrl: string; jellyfinUserId: string; jellyfinApiKey: string
  tmdbApiKey: string; syncInterval: number
  llmProvider: 'gemini' | 'openai'; llmApiKey: string; llmBaseUrl: string
  llmModel: string; recapMinInterval: number
  radarrUrl: string; radarrApiKey: string; radarrQualityProfileId: number; radarrRootFolderPath: string
  sonarrUrl: string; sonarrApiKey: string; sonarrQualityProfileId: number; sonarrRootFolderPath: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { syncing, lastSyncedAt, error, sync } = useSync()
  const { settings, update, updateListCardMeta, updateGridCardMeta } = useSettings()
  const { toast } = useToast()
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'openai'>('gemini')
  const [llmBaseUrlInput, setLlmBaseUrlInput] = useState('')
  const [llmApiKeyInput, setLlmApiKeyInput] = useState('')
  const [llmModelInput, setLlmModelInput] = useState('')
  const [recapMinIntervalInput, setRecapMinIntervalInput] = useState<number>(5)
  const [jellyfinUrlInput, setJellyfinUrlInput] = useState('')
  const [jellyfinUserIdInput, setJellyfinUserIdInput] = useState('')
  const [jellyfinApiKeyInput, setJellyfinApiKeyInput] = useState('')
  const [jellyfinTestResult, setJellyfinTestResult] = useState<'ok' | 'error' | null>(null)
  const [jellyfinTesting, setJellyfinTesting] = useState(false)
  const [jellyfinPulling, setJellyfinPulling] = useState(false)
  const [jellyfinPullLog, setJellyfinPullLog] = useState<string[]>([])
  const [jellyfinPolling, setJellyfinPolling] = useState(false)
  const [serverCredsStatus, setServerCredsStatus] = useState<'unknown' | 'set' | 'missing'>('unknown')

  const [radarrUrlInput, setRadarrUrlInput] = useState('')
  const [radarrApiKeyInput, setRadarrApiKeyInput] = useState('')
  const [radarrQualityProfileIdInput, setRadarrQualityProfileIdInput] = useState(1)
  const [radarrRootFolderPathInput, setRadarrRootFolderPathInput] = useState('')

  const [sonarrUrlInput, setSonarrUrlInput] = useState('')
  const [sonarrApiKeyInput, setSonarrApiKeyInput] = useState('')
  const [sonarrQualityProfileIdInput, setSonarrQualityProfileIdInput] = useState(1)
  const [sonarrRootFolderPathInput, setSonarrRootFolderPathInput] = useState('')

  const [radarrTesting, setRadarrTesting] = useState(false)
  const [radarrTestResult, setRadarrTestResult] = useState<'ok' | 'error' | null>(null)
  const [radarrTestError, setRadarrTestError] = useState<string | null>(null)

  const [sonarrTesting, setSonarrTesting] = useState(false)
  const [sonarrTestResult, setSonarrTestResult] = useState<'ok' | 'error' | null>(null)
  const [sonarrTestError, setSonarrTestError] = useState<string | null>(null)

  // ── Tab + server settings dirty state ────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'server' | 'client' | 'logs'>('server')
  const [serverSnapshot, setServerSnapshot] = useState<ServerFormSnapshot | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingSync, setPendingSync] = useState(false)
  const [syncIntervalInput, setSyncIntervalInput] = useState<number>(5)
  const [tmdbApiKeyInput, setTmdbApiKeyInput] = useState('')

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

  // ── PWA debug state ──────────────────────────────────────────────────────────
  const [pwaLogs, setPwaLogs] = useState<{ text: string; kind: 'ok' | 'warn' | 'info' }[]>([])

  const addPwaLog = useCallback(
    (text: string, kind: 'ok' | 'warn' | 'info' = 'info') => {
      const ts = new Date().toLocaleTimeString()
      setPwaLogs((prev) => [...prev, { text: `[${ts}] ${text}`, kind }])
      console.log(`[PWA-Debug] ${text}`)
    },
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Display mode — are we running in standalone / fullscreen?
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true
    addPwaLog(
      isStandalone
        ? '✅ display-mode: standalone — running as installed PWA'
        : '⚠️ display-mode: browser — NOT running as installed PWA (yet)',
      isStandalone ? 'ok' : 'warn',
    )

    // Also log the raw matchMedia value for every mode
    for (const mode of ['standalone', 'fullscreen', 'minimal-ui', 'browser']) {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) {
        addPwaLog(`ℹ️ matchMedia(display-mode: ${mode}) → true`, 'info')
      }
    }

    // 2. navigator.standalone (iOS Safari)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const navStandalone = (navigator as any).standalone
    if (navStandalone !== undefined) {
      addPwaLog(
        navStandalone
          ? '✅ navigator.standalone = true (iOS home-screen launch)'
          : '⚠️ navigator.standalone = false (iOS browser tab)',
        navStandalone ? 'ok' : 'warn',
      )
    } else {
      addPwaLog('ℹ️ navigator.standalone = undefined (non-iOS)', 'info')
    }

    // 3. Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) {
          addPwaLog('⚠️ No SW registration found', 'warn')
          return
        }
        addPwaLog(`✅ SW registered — scope: ${reg.scope}`, 'ok')

        const swStates: Record<string, string> = {}
        if (reg.installing) swStates['installing'] = reg.installing.state
        if (reg.waiting)    swStates['waiting']    = reg.waiting.state
        if (reg.active)     swStates['active']     = reg.active.state
        for (const [slot, state] of Object.entries(swStates)) {
          addPwaLog(`ℹ️ SW ${slot}: state="${state}"`, 'info')
        }

        if (navigator.serviceWorker.controller) {
          addPwaLog(`✅ SW controller active — scriptURL: ${navigator.serviceWorker.controller.scriptURL}`, 'ok')
        } else {
          addPwaLog('⚠️ No SW controller yet (page may need a reload)', 'warn')
        }
      }).catch((err) => {
        addPwaLog(`❌ SW getRegistration error: ${err}`, 'warn')
      })
    } else {
      addPwaLog('❌ serviceWorker API not available in this browser', 'warn')
    }

    // 4. beforeinstallprompt — fires when browser decides PWA is installable
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      addPwaLog('🎉 beforeinstallprompt fired — browser considers this app installable!', 'ok')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // 5. appinstalled — fires after user installs the PWA
    const onInstalled = () => {
      addPwaLog('🎉 appinstalled event fired — PWA was just installed!', 'ok')
    }
    window.addEventListener('appinstalled', onInstalled)

    // 6. Manifest link present?
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (manifestLink) {
      addPwaLog(`✅ <link rel="manifest"> found: ${manifestLink.href}`, 'ok')
    } else {
      addPwaLog('⚠️ No <link rel="manifest"> found in <head>', 'warn')
    }

    // 7. HTTPS / localhost (required for PWA)
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    addPwaLog(
      isSecure
        ? `✅ Origin is secure (${location.protocol}//${location.host})`
        : `❌ Origin NOT secure — PWA requires HTTPS (current: ${location.protocol}//${location.host})`,
      isSecure ? 'ok' : 'warn',
    )

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendingCount = useLiveQuery(() => db.pendingPushes.count())
  const itemCount = useLiveQuery(() =>
    db.watchlistItems.filter((i) => i.deletedAt === null).count(),
  )
  const jellyfinProgressCount = useLiveQuery(() => db.jellyfinProgress.count())
  const jellyfinProgressItems = useLiveQuery(() => db.jellyfinProgress.toArray())

  // Check if server has credentials and LLM settings saved
  useEffect(() => {
    if (!session?.apiToken) return
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    fetch(`${apiBase}/api/user/settings`, {
      headers: { Authorization: `Bearer ${session.apiToken}` }
    })
      .then(r => r.json())
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

        update({
          llmProvider: prov, llmBaseUrl: baseUrl, llmApiKey: apiKey,
          llmModel: model, recapMinInterval: interval,
          tmdbApiKey: tmdb, syncInterval: sync,
          jellyfinUrl: jUrl, jellyfinUserId: jUid, jellyfinApiKey: jKey,
          radarrUrl: rUrl, radarrApiKey: rKey, radarrQualityProfileId: rProf, radarrRootFolderPath: rPath,
          sonarrUrl: sUrl, sonarrApiKey: sKey, sonarrQualityProfileId: sProf, sonarrRootFolderPath: sPath,
        })

        // Auto-sync any pending offline saves
        const pending = localStorage.getItem('mywatch_pending_server_settings')
        if (pending) {
          try {
            const pendingData = JSON.parse(pending)
            setPendingSync(true)
            fetch(`${apiBase}/api/user/settings`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.apiToken}` },
              body: JSON.stringify(pendingData),
            }).then(r => {
              if (r.ok) {
                localStorage.removeItem('mywatch_pending_server_settings')
                toast('Offline changes synced to server', 'success')
              }
            }).catch(() => {/* silently retry next load */}).finally(() => setPendingSync(false))
          } catch {
            localStorage.removeItem('mywatch_pending_server_settings')
          }
        }
      })
      .catch(() => setServerCredsStatus('unknown'))
  }, [session?.apiToken]) // eslint-disable-line react-hooks/exhaustive-deps


  async function saveServerSettings() {
    setSaving(true)
    if (pendingSync) { setSaving(false); return }
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
        const newSnapshot = {
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

  async function testRadarr() {
    const url = radarrUrlInput.trim()
    const apiKey = radarrApiKeyInput.trim()
    if (!url || !apiKey) return

    setRadarrTesting(true)
    setRadarrTestResult(null)
    setRadarrTestError(null)

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/api/user/arr/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.apiToken}`,
        },
        body: JSON.stringify({ type: 'radarr', url, apiKey }),
      })

      const text = await res.text()
      let data: any = null
      try {
        if (text) {
          data = JSON.parse(text)
        }
      } catch {
        // Not JSON
      }

      if (res.ok && data?.success) {
        setRadarrTestResult('ok')
      } else {
        setRadarrTestResult('error')
        const errMsg = data?.error || data?.message || (text && text.trim().startsWith('<') ? `Invalid HTML response (Status ${res.status})` : text ? text.slice(0, 80) : `Status ${res.status}`)
        setRadarrTestError(errMsg)
      }
    } catch (err) {
      setRadarrTestResult('error')
      setRadarrTestError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setRadarrTesting(false)
    }
  }

  async function testSonarr() {
    const url = sonarrUrlInput.trim()
    const apiKey = sonarrApiKeyInput.trim()
    if (!url || !apiKey) return

    setSonarrTesting(true)
    setSonarrTestResult(null)
    setSonarrTestError(null)

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/api/user/arr/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.apiToken}`,
        },
        body: JSON.stringify({ type: 'sonarr', url, apiKey }),
      })

      const text = await res.text()
      let data: any = null
      try {
        if (text) {
          data = JSON.parse(text)
        }
      } catch {
        // Not JSON
      }

      if (res.ok && data?.success) {
        setSonarrTestResult('ok')
      } else {
        setSonarrTestResult('error')
        const errMsg = data?.error || data?.message || (text && text.trim().startsWith('<') ? `Invalid HTML response (Status ${res.status})` : text ? text.slice(0, 80) : `Status ${res.status}`)
        setSonarrTestError(errMsg)
      }
    } catch (err) {
      setSonarrTestResult('error')
      setSonarrTestError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSonarrTesting(false)
    }
  }

  async function testJellyfin() {
    const url = jellyfinUrlInput.trim().replace(/\/$/, '')
    const userId = jellyfinUserIdInput.trim()
    const apiKey = jellyfinApiKeyInput.trim()
    if (!url || !userId || !apiKey) return
    setJellyfinTesting(true)
    setJellyfinTestResult(null)
    try {
      const res = await fetch(
        `${url}/Users/${encodeURIComponent(userId)}/Items?Limit=1`,
        { headers: { 'X-Emby-Token': apiKey } },
      )
      setJellyfinTestResult(res.ok ? 'ok' : 'error')
    } catch {
      setJellyfinTestResult('error')
    } finally {
      setJellyfinTesting(false)
    }
  }

  async function handleClearCache() {
    await db.mediaCache.clear()
    toast('Cache cleared', 'success')
  }

  const forcePullJellyfin = useCallback(async (append = false) => {
    if (!session?.apiToken) {
      setJellyfinPullLog(['❌ Not logged in — no API token'])
      return
    }
    setJellyfinPulling(true)
    if (!append) setJellyfinPullLog(['⏳ Pulling from server...'])
    else setJellyfinPullLog(prev => [...prev, '⏳ Pulling updated records from server...'])
    try {
      const result = await apiClient.sync.pull(new Date(0).toISOString(), session.apiToken)
      const jpCount = result.jellyfinProgress?.length ?? 0
      const itemsCount = result.items?.length ?? 0
      setJellyfinPullLog(prev => [...prev, `📦 Server returned: ${itemsCount} items, ${jpCount} jellyfin progress records`])
      
      if (jpCount > 0) {
        await db.jellyfinProgress.bulkPut(result.jellyfinProgress!)
        setJellyfinPullLog(prev => [...prev, `✅ Written ${jpCount} records to local DB — progress should now show on cards`])
        const sample = result.jellyfinProgress!.slice(0, 3).map(p => `tmdb:${p.tmdbId} (${p.mediaType}) → ${p.jellyfinStatus}`).join(', ')
        setJellyfinPullLog(prev => [...prev, `📋 Sample: ${sample}`])
      } else {
        setJellyfinPullLog(prev => [...prev, '⚠️ Server returned 0 jellyfin progress records.'])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setJellyfinPullLog(prev => [...prev, `❌ Error: ${msg}`])
    } finally {
      setJellyfinPulling(false)
    }
  }, [session?.apiToken])

  const pollJellyfinNow = useCallback(async () => {
    if (!session?.apiToken) {
      setJellyfinPullLog(['❌ Not logged in'])
      return
    }
    setJellyfinPolling(true)
    setJellyfinPullLog(prev => [...prev, '⏳ Asking server to poll Jellyfin now...'])
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/user/jellyfin/poll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.apiToken}` }
      })
      const text = await res.text()
      let data: { success?: boolean; count?: number; error?: string } = {}
      try {
        if (text) {
          data = JSON.parse(text)
        }
      } catch {
        // Not JSON
      }
      if (!res.ok || data.error || !data.success) {
        const errorDetail = data.error ?? (text && text.trim().startsWith('<') ? `Invalid HTML response (Status ${res.status})` : text ? text.slice(0, 80) : res.statusText)
        setJellyfinPullLog(prev => [...prev, `❌ Server error: ${errorDetail}`])
      } else {
        setJellyfinPullLog(prev => [...prev, `✅ Server polled Jellyfin: ${data.count ?? 0} records saved`])
        setServerCredsStatus('set')
        // Now do a local pull to get the fresh data
        await forcePullJellyfin(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setJellyfinPullLog(prev => [...prev, `❌ ${msg}`])
    } finally {
      setJellyfinPolling(false)
    }
  }, [session?.apiToken, forcePullJellyfin])

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
        {/* Account — always above tabs */}
        <Section title="Account">
          {session ? (
            <>
              <Row label={session.user?.name ?? 'User'}>
                <span className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>{session.user?.email}</span>
              </Row>
              <div className="px-4 py-3">
                <button
                  onClick={async () => {
                    await signOut({ redirect: false })
                    router.push('/')
                  }}
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
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-[var(--text-13)] font-medium capitalize border-none cursor-pointer transition-colors duration-100"
              style={{
                background: 'transparent',
                color: activeTab === tab ? 'var(--fg)' : 'var(--muted)',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: activeTab === tab ? 600 : 500,
              }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Server tab ── */}
        {activeTab === 'server' && (
          <div className="flex flex-col gap-4">
            {/* Jellyfin */}
            <Section title="Jellyfin">
              <div className="px-4 py-3 space-y-3">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  Connect to your Jellyfin server to overlay watch progress on cards. Requires CORS enabled in Jellyfin → Networking.
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={jellyfinUrlInput}
                    onChange={(e) => setJellyfinUrlInput(e.target.value)}
                    placeholder="Server URL (e.g. http://jellyfin.local:8096)"
                    className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  />
                  <input
                    type="text"
                    value={jellyfinUserIdInput}
                    onChange={(e) => setJellyfinUserIdInput(e.target.value)}
                    placeholder="User ID"
                    className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  />
                  <input
                    type="password"
                    value={jellyfinApiKeyInput}
                    onChange={(e) => setJellyfinApiKeyInput(e.target.value)}
                    placeholder="API Key"
                    className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={testJellyfin}
                    disabled={jellyfinTesting || !jellyfinUrlInput || !jellyfinUserIdInput || !jellyfinApiKeyInput}
                    className="px-3 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none flex-shrink-0 transition-all duration-100 disabled:opacity-50"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                  >
                    {jellyfinTesting ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
                {jellyfinTestResult === 'ok' && (
                  <p className="text-[var(--text-12)]" style={{ color: 'var(--green)' }}>✓ Connected successfully</p>
                )}
                {jellyfinTestResult === 'error' && (
                  <p className="text-[var(--text-12)]" style={{ color: 'var(--red)' }}>Connection failed — check URL, user ID, API key, and CORS settings</p>
                )}
              </div>
            </Section>

            {/* TMDB API */}
            <Section title="TMDB API">
              <div className="px-4 py-3 space-y-2">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  TMDB API key for fetching metadata. Saved to server and shared across all your clients.
                </p>
                <input type="password" value={tmdbApiKeyInput} onChange={e => setTmdbApiKeyInput(e.target.value)}
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
              {error && (
                <div className="px-4 py-2 text-[var(--text-12)]" style={{ color: 'var(--red)' }}>{error}</div>
              )}
              <Row label="Auto Sync">
                <div
                  className="flex controls-row"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1, flexShrink: 1, minWidth: 0 }}
                >
                  {SYNC_INTERVAL_OPTIONS.map((o) => {
                    const active = syncIntervalInput === o.value
                    return (
                      <button
                        key={o.value}
                        onClick={() => setSyncIntervalInput(o.value)}
                        className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none whitespace-nowrap"
                        style={{
                          background: active ? 'var(--surface2)' : 'transparent',
                          color: active ? 'var(--fg)' : 'var(--muted)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <div className="px-4 py-3">
                {session ? (
                  <button
                    onClick={() => sync()}
                    disabled={syncing}
                    className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none disabled:opacity-50 transition-all duration-100"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                ) : (
                  <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)' }}>Sign in to enable sync.</p>
                )}
              </div>
            </Section>

            {/* AI & Recap Settings */}
            <Section title="AI & Recap Settings">
              <div className="px-4 py-3 space-y-3">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  Configure your AI provider to generate progress-based spoiler-free recaps of movies and TV shows.
                </p>

                <div className="flex flex-col gap-3">
                  {/* Provider Selection */}
                  <div className="flex items-center justify-between py-1.5 gap-3" style={{ borderBottom: '1px solid var(--border2)' }}>
                    <span className="text-[var(--text-13)] font-medium" style={{ color: 'var(--fg2)' }}>AI Provider</span>
                    <div
                      className="flex"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
                    >
                      {[
                        { value: 'gemini', label: 'Gemini' },
                        { value: 'openai', label: 'OpenAI-Compatible' },
                      ].map((p) => {
                        const active = llmProvider === p.value
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setLlmProvider(p.value as 'gemini' | 'openai')}
                            className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                            style={{
                              background: active ? 'var(--surface2)' : 'transparent',
                              color: active ? 'var(--fg)' : 'var(--muted)',
                              fontWeight: active ? 600 : 500,
                            }}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Conditional inputs */}
                  {llmProvider === 'gemini' ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>Gemini API Key</span>
                      <input
                        type="password"
                        value={llmApiKeyInput}
                        onChange={(e) => setLlmApiKeyInput(e.target.value)}
                        placeholder="Enter Google AI Studio API key…"
                        className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      />
                      <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>Stored safely on your device. Generates recaps using gemini-1.5-flash.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>Base URL</span>
                        <input
                          type="text"
                          value={llmBaseUrlInput}
                          onChange={(e) => setLlmBaseUrlInput(e.target.value)}
                          placeholder="e.g. https://api.openai.com/v1 or http://localhost:11434/v1"
                          className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        />
                        <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>Use your own OpenAI endpoint, Ollama, LM Studio, Groq, or OpenRouter.</span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>API Key</span>
                        <input
                          type="password"
                          value={llmApiKeyInput}
                          onChange={(e) => setLlmApiKeyInput(e.target.value)}
                          placeholder="Enter API key…"
                          className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>Model Name</span>
                        <input
                          type="text"
                          value={llmModelInput}
                          onChange={(e) => setLlmModelInput(e.target.value)}
                          placeholder="e.g. gpt-4o-mini, llama3, mistral"
                          className="w-full px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Recap interval slider */}
                  <div className="flex flex-col gap-1.5 py-1.5" style={{ borderTop: '1px solid var(--border2)' }}>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-13)] font-medium" style={{ color: 'var(--fg2)' }}>Recap Minimal Progress Interval</span>
                      <span className="text-[var(--text-13)] font-bold text-center w-8" style={{ color: 'var(--accent2)' }}>{recapMinIntervalInput}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="1"
                      value={recapMinIntervalInput}
                      onChange={(e) => setRecapMinIntervalInput(Number(e.target.value))}
                      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>
                      Minimum movie progress watched percentage delta required to request a fresh recap (saving API costs).
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            {/* Radarr */}
            <Section title="Radarr">
              <div className="px-4 py-3 space-y-3">
                <div style={{ borderBottom: '1px solid var(--border2)' }} className="pb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Radarr (Movies)</span>
                  <button
                    type="button"
                    onClick={testRadarr}
                    disabled={radarrTesting || !radarrUrlInput || !radarrApiKeyInput}
                    className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold cursor-pointer border-none disabled:opacity-50 transition-all duration-100 flex items-center gap-1"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                  >
                    {radarrTesting ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
                {radarrTestResult === 'ok' && (
                  <p className="text-[11px]" style={{ color: 'var(--green)' }}>✓ Connected to Radarr successfully</p>
                )}
                {radarrTestResult === 'error' && (
                  <p className="text-[11px]" style={{ color: 'var(--red)', lineHeight: 1.4 }}>Connection failed: {radarrTestError}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Radarr Server URL</span>
                    <input
                      type="text"
                      value={radarrUrlInput}
                      onChange={(e) => setRadarrUrlInput(e.target.value)}
                      placeholder="e.g. http://localhost:7878"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>API Key</span>
                    <input
                      type="password"
                      value={radarrApiKeyInput}
                      onChange={(e) => setRadarrApiKeyInput(e.target.value)}
                      placeholder="Enter API key…"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Quality Profile ID</span>
                    <input
                      type="number"
                      value={radarrQualityProfileIdInput}
                      onChange={(e) => setRadarrQualityProfileIdInput(Number(e.target.value))}
                      placeholder="e.g. 1"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Root Folder Path</span>
                    <input
                      type="text"
                      value={radarrRootFolderPathInput}
                      onChange={(e) => setRadarrRootFolderPathInput(e.target.value)}
                      placeholder="e.g. /data/media/movies"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Sonarr */}
            <Section title="Sonarr">
              <div className="px-4 py-3 space-y-3">
                <div style={{ borderBottom: '1px solid var(--border2)' }} className="pb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Sonarr (TV Shows)</span>
                  <button
                    type="button"
                    onClick={testSonarr}
                    disabled={sonarrTesting || !sonarrUrlInput || !sonarrApiKeyInput}
                    className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold cursor-pointer border-none disabled:opacity-50 transition-all duration-100 flex items-center gap-1"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                  >
                    {sonarrTesting ? 'Testing…' : 'Test Connection'}
                  </button>
                </div>
                {sonarrTestResult === 'ok' && (
                  <p className="text-[11px]" style={{ color: 'var(--green)' }}>✓ Connected to Sonarr successfully</p>
                )}
                {sonarrTestResult === 'error' && (
                  <p className="text-[11px]" style={{ color: 'var(--red)', lineHeight: 1.4 }}>Connection failed: {sonarrTestError}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Sonarr Server URL</span>
                    <input
                      type="text"
                      value={sonarrUrlInput}
                      onChange={(e) => setSonarrUrlInput(e.target.value)}
                      placeholder="e.g. http://localhost:8989"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>API Key</span>
                    <input
                      type="password"
                      value={sonarrApiKeyInput}
                      onChange={(e) => setSonarrApiKeyInput(e.target.value)}
                      placeholder="Enter API key…"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Quality Profile ID</span>
                    <input
                      type="number"
                      value={sonarrQualityProfileIdInput}
                      onChange={(e) => setSonarrQualityProfileIdInput(Number(e.target.value))}
                      placeholder="e.g. 1"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--fg2)' }}>Root Folder Path</span>
                    <input
                      type="text"
                      value={sonarrRootFolderPathInput}
                      onChange={(e) => setSonarrRootFolderPathInput(e.target.value)}
                      placeholder="e.g. /data/media/tv"
                      className="px-3 py-2 rounded-[6px] text-[var(--text-13)] focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Unified Save button */}
            <button
              onClick={saveServerSettings}
              disabled={!isDirty || saving || pendingSync}
              className="w-full py-2.5 rounded-[8px] text-[var(--text-13)] font-semibold cursor-pointer border-none transition-all duration-150 disabled:opacity-40"
              style={{ background: isDirty ? 'var(--accent)' : 'var(--surface2)', color: isDirty ? '#fff' : 'var(--muted)' }}
            >
              {saving ? 'Saving…' : pendingSync ? 'Syncing offline changes…' : isDirty ? 'Save Server Settings' : 'No Changes'}
            </button>
          </div>
        )}

        {/* ── Client tab ── */}
        {activeTab === 'client' && (
          <div className="flex flex-col gap-4">
            {/* Appearance */}
            <Section title="Appearance">
              <Row label="Theme">
                <div
                  className="flex"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
                >
                  {(['dark', 'light'] as const).map((t) => {
                    const active = settings.theme === t
                    return (
                      <button
                        key={t}
                        onClick={() => update({ theme: t })}
                        className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none capitalize"
                        style={{
                          background: active ? 'var(--surface2)' : 'transparent',
                          color: active ? 'var(--fg)' : 'var(--muted)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Language">
                <div
                  className="flex"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
                >
                  {[
                    { value: 'en-US', label: 'English' },
                    { value: 'he-IL', label: 'Hebrew' },
                  ].map((lang) => {
                    const active = settings.language === lang.value
                    return (
                      <button
                        key={lang.value}
                        onClick={() => update({ language: lang.value })}
                        className="px-3 py-[4px] text-[var(--text-12)] font-medium rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                        style={{
                          background: active ? 'var(--surface2)' : 'transparent',
                          color: active ? 'var(--fg)' : 'var(--muted)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {lang.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Font">
                <div
                  className="flex"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
                >
                  {FONT_OPTIONS.map((f) => {
                    const active = settings.font === f.value
                    return (
                      <button
                        key={f.value}
                        onClick={() => update({ font: f.value })}
                        className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                        style={{
                          background: active ? 'var(--surface2)' : 'transparent',
                          color: active ? 'var(--fg)' : 'var(--muted)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Font Size">
                <div
                  className="flex"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
                >
                  {FONT_SIZE_OPTIONS.map((f) => {
                    const active = settings.fontSize === f.value
                    return (
                      <button
                        key={f.value}
                        onClick={() => update({ fontSize: f.value })}
                        className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                        style={{
                          background: active ? 'var(--surface2)' : 'transparent',
                          color: active ? 'var(--fg)' : 'var(--muted)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Badge Icon Size">
                <div
                  className="flex"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: 2, gap: 1 }}
                >
                  {FONT_SIZE_OPTIONS.map((f) => {
                    const active = settings.badgeIconSize === f.value
                    return (
                      <button
                        key={f.value}
                        onClick={() => update({ badgeIconSize: f.value })}
                        className="px-3 py-[4px] text-[var(--text-12)] rounded-[4px] transition-all duration-100 cursor-pointer border-none"
                        style={{
                          background: active ? 'var(--surface2)' : 'transparent',
                          color: active ? 'var(--fg)' : 'var(--muted)',
                          fontWeight: active ? 600 : 500,
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </Row>
            </Section>

            {/* Card Display */}
            <Section title="Card Display">
              <div className="flex divide-x" style={{ borderColor: 'var(--border2)' }}>
                <div className="flex-1">
                  <div className="px-4 py-2 text-[var(--text-12)] font-bold tracking-wider uppercase" style={{ color: 'var(--muted)', background: 'var(--bg)' }}>
                    List View
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border2)' }}>
                    {(Object.keys(CARD_META_LABELS) as Array<keyof CardMetaSettings>).map((key) => (
                      <Row key={key} label={CARD_META_LABELS[key]}>
                        <Toggle
                          on={settings.listCardMeta[key]}
                          onToggle={() => {
                            updateListCardMeta({ [key]: !settings.listCardMeta[key] })
                            toast('Saved', 'success', 1500)
                          }}
                        />
                      </Row>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="px-4 py-2 text-[var(--text-12)] font-bold tracking-wider uppercase" style={{ color: 'var(--muted)', background: 'var(--bg)' }}>
                    Grid View
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border2)' }}>
                    {(Object.keys(CARD_META_LABELS) as Array<keyof CardMetaSettings>).map((key) => (
                      <Row key={key} label={CARD_META_LABELS[key]}>
                        <Toggle
                          on={settings.gridCardMeta[key]}
                          onToggle={() => {
                            updateGridCardMeta({ [key]: !settings.gridCardMeta[key] })
                            toast('Saved', 'success', 1500)
                          }}
                        />
                      </Row>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Data */}
            <Section title="Data">
              <div className="px-4 py-3">
                <button
                  onClick={handleClearCache}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                >
                  Clear Media Cache
                </button>
              </div>
            </Section>
          </div>
        )}

        {/* ── Logs tab ── */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-4">
            {/* Jellyfin Debug */}
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
                <button
                  onClick={pollJellyfinNow}
                  disabled={jellyfinPolling || jellyfinPulling}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-semibold cursor-pointer border-none disabled:opacity-50 transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {jellyfinPolling ? 'Polling…' : '▶ Poll Jellyfin Now (Server → Local)'}
                </button>
                <button
                  onClick={() => forcePullJellyfin()}
                  disabled={jellyfinPulling || jellyfinPolling}
                  className="w-full py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none disabled:opacity-50 transition-all"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                >
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

            {/* PWA Debug */}
            <Section title="PWA Debug">
              <div className="px-4 py-3 flex flex-col gap-2">
                <p className="text-[var(--text-12)]" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                  Checks whether this app is running as an installed PWA. Open this page from your home screen to see standalone mode confirmed.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPwaLogs([])
                      addPwaLog('🔄 Manual refresh — re-running PWA checks…', 'info')

                      const isStandalone =
                        window.matchMedia('(display-mode: standalone)').matches ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (navigator as any).standalone === true
                      addPwaLog(
                        isStandalone
                          ? '✅ display-mode: standalone — running as installed PWA'
                          : '⚠️ display-mode: browser — NOT running as installed PWA',
                        isStandalone ? 'ok' : 'warn',
                      )
                      for (const mode of ['standalone', 'fullscreen', 'minimal-ui', 'browser']) {
                        if (window.matchMedia(`(display-mode: ${mode})`).matches)
                          addPwaLog(`ℹ️ matchMedia(display-mode: ${mode}) → true`, 'info')
                      }

                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const navStandalone = (navigator as any).standalone
                      if (navStandalone !== undefined) {
                        addPwaLog(
                          navStandalone
                            ? '✅ navigator.standalone = true (iOS)'
                            : '⚠️ navigator.standalone = false (iOS browser)',
                          navStandalone ? 'ok' : 'warn',
                        )
                      } else {
                        addPwaLog('ℹ️ navigator.standalone = undefined (non-iOS)', 'info')
                      }

                      if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.getRegistration().then((reg) => {
                          if (!reg) { addPwaLog('⚠️ No SW registration', 'warn'); return }
                          addPwaLog(`✅ SW registered — scope: ${reg.scope}`, 'ok')
                          if (reg.active)     addPwaLog(`ℹ️ SW active: state="${reg.active.state}"`, 'info')
                          if (reg.waiting)    addPwaLog(`ℹ️ SW waiting: state="${reg.waiting.state}"`, 'info')
                          if (reg.installing) addPwaLog(`ℹ️ SW installing: state="${reg.installing.state}"`, 'info')
                          if (navigator.serviceWorker.controller)
                            addPwaLog(`✅ SW controller: ${navigator.serviceWorker.controller.scriptURL}`, 'ok')
                          else
                            addPwaLog('⚠️ No SW controller (reload may be needed)', 'warn')
                        }).catch((e) => addPwaLog(`❌ SW error: ${e}`, 'warn'))
                      } else {
                        addPwaLog('❌ serviceWorker API not available', 'warn')
                      }

                      const ml = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
                      addPwaLog(ml ? `✅ manifest: ${ml.href}` : '⚠️ No manifest link found', ml ? 'ok' : 'warn')

                      const sec = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname)
                      addPwaLog(
                        sec ? `✅ Secure origin: ${location.protocol}//${location.host}` : `❌ NOT secure: ${location.protocol}//${location.host}`,
                        sec ? 'ok' : 'warn',
                      )
                    }}
                    className="flex-1 py-2 rounded-[6px] text-[var(--text-13)] font-medium cursor-pointer border-none transition-all duration-100"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border2)' }}
                  >
                    🔄 Refresh
                  </button>
                  <button
                    onClick={() => {
                      const logText = pwaLogs.map((l) => l.text).join('\n')
                      navigator.clipboard.writeText(logText)
                      toast('Logs copied to clipboard', 'success', 2000)
                    }}
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
                      <span
                        key={i}
                        className="text-[var(--text-11)]"
                        style={{
                          fontFamily: 'monospace',
                          color: log.kind === 'ok' ? 'var(--green)' : log.kind === 'warn' ? 'var(--amber)' : 'var(--fg2)',
                        }}
                      >
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
}
