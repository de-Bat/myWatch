import { auth } from '@/auth'
import { type NextRequest, type NextMiddleware, NextResponse } from 'next/server'

function redirectTo(path: string, req: NextRequest) {
  const host = req.headers.get('host') || req.nextUrl.host
  const proto = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol).replace(':', '')
  return NextResponse.redirect(new URL(path, `${proto}://${host}`))
}

// Local-first: app routes (/, /search, /discover, /playlists, /media, /profile)
// are usable offline and as a guest — data lives in IndexedDB, sync only runs
// when signed in. Middleware only bounces logged-in users off the auth screens.
// App routes are NOT matched here so they can be statically prerendered and
// served offline by the service worker.
const middleware = auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/auth') && isLoggedIn) {
    return redirectTo('/', req)
  }
})

export default middleware as unknown as NextMiddleware

export const config = {
  matcher: ['/auth/:path*'],
}
