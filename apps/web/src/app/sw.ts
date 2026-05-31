import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const FALLBACK_URL = '/offline'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Disable navigationPreload — not well supported on iOS Safari
  navigationPreload: false,
  // Offline fallback for failed navigations
  fallbacks: {
    entries: [
      {
        url: FALLBACK_URL,
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
  runtimeCaching: [
    // ── Navigation (HTML pages) ──────────────────────────────
    // NetworkFirst: try network, fall back to cache, fall back to /offline
    // iOS Safari PWAs need this to work when opened from Home Screen offline
    {
      matcher: ({ request }) => request.destination === 'document',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
        ],
      }),
    },

    // ── Next.js static JS/CSS chunks ─────────────────────────
    // CacheFirst: these are content-hashed, safe to cache indefinitely
    {
      matcher: ({ url }) =>
        url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: 'next-static',
        plugins: [
          new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        ],
      }),
    },

    // ── Next.js image optimization ───────────────────────────
    {
      matcher: ({ url }) => url.pathname.startsWith('/_next/image'),
      handler: new StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },

    // ── TMDB poster/backdrop images ──────────────────────────
    {
      matcher: ({ url }) => url.hostname === 'image.tmdb.org',
      handler: new CacheFirst({
        cacheName: 'tmdb-images',
        plugins: [
          new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },

    // ── API calls ────────────────────────────────────────────
    // NetworkFirst with short timeout — offline returns cached or fails gracefully
    {
      matcher: ({ url }) => {
        const apiBase = self.location.origin
        // Match same-origin API-like paths or the configured API server
        return url.pathname.startsWith('/api/') || url.pathname.startsWith('/sync/')
      },
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 8,
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
        ],
      }),
    },

    // ── Everything else (fonts, icons, etc.) ─────────────────
    ...defaultCache,
  ],
})

serwist.addEventListeners()
