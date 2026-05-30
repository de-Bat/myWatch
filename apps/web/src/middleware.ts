import { auth } from '@/auth'
import { type NextRequest, type NextMiddleware, NextResponse } from 'next/server'

function redirectTo(path: string, req: NextRequest) {
  const host = req.headers.get('host') || req.nextUrl.host
  const proto = (req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol).replace(':', '')
  return NextResponse.redirect(new URL(path, `${proto}://${host}`))
}

const PROTECTED = ['/', '/search', '/discover', '/playlists', '/media']

const middleware = auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/auth') && isLoggedIn) {
    return redirectTo('/', req)
  }

  const isProtected = PROTECTED.some((p) =>
    p === '/' ? pathname === '/' : pathname.startsWith(p),
  )

  if (isProtected && !isLoggedIn) {
    return redirectTo('/auth/login', req)
  }
})

export default middleware as unknown as NextMiddleware

export const config = {
  matcher: [
    '/',
    '/search/:path*',
    '/discover/:path*',
    '/playlists/:path*',
    '/media/:path*',
    '/auth/:path*',
  ],
}
