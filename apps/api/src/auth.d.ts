import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string | null; isGuest: boolean }
    user: { sub: string; email: string | null; isGuest: boolean }
  }
}
