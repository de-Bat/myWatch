import NextAuth, { type NextAuthResult } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import { apiClient } from './lib/api-client'

const result: NextAuthResult = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const { token, user } = await apiClient.auth.login({
            email: credentials.email as string,
            password: credentials.password as string,
          })
          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatarUrl,
            apiToken: token,
          }
        } catch {
          return null
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && account?.provider === 'credentials') {
        token.apiToken = (user as Record<string, unknown>).apiToken as string
        token.userId = user.id!
      }
      if (account?.provider === 'google' && account.id_token) {
        const { token: apiToken, user: apiUser } = await apiClient.auth.oauthGoogle(
          account.id_token,
        )
        token.apiToken = apiToken
        token.userId = apiUser.id
      }
      if (account?.provider === 'apple' && account.id_token) {
        const { token: apiToken, user: apiUser } = await apiClient.auth.oauthApple(
          account.id_token as string,
        )
        token.apiToken = apiToken
        token.userId = apiUser.id
      }
      return token
    },
    async session({ session, token }) {
      session.apiToken = token.apiToken as string
      session.user.id = (token.userId ?? token.sub) as string
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
  },
})

export const handlers: NextAuthResult['handlers'] = result.handlers
export const signIn: NextAuthResult['signIn'] = result.signIn
export const signOut: NextAuthResult['signOut'] = result.signOut
export const auth: NextAuthResult['auth'] = result.auth
