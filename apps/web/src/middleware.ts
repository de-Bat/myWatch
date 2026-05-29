import { auth } from '@/auth'
import { type NextMiddleware, NextResponse } from 'next/server'

// auth(callback) returns NextMiddleware per next-auth v5 types
const middleware = auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/profile') && !isLoggedIn) {
    return NextResponse.redirect(new URL('/auth/login', req.nextUrl))
  }
  if (pathname.startsWith('/auth') && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }
})

export default middleware as unknown as NextMiddleware

export const config = {
  matcher: ['/profile/:path*', '/auth/:path*'],
}
