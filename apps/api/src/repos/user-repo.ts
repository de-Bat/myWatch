import type { Sql } from 'postgres'

export interface UserRecord {
  id: string
  email: string | null
  displayName: string
  avatarUrl: string | null
  isGuest: boolean
  passwordHash: string | null
  createdAt: string
  updatedAt: string
}

export interface UserRepo {
  findByEmail(email: string): Promise<UserRecord | null>
  findById(id: string): Promise<UserRecord | null>
  create(data: {
    email: string
    displayName: string
    passwordHash: string
  }): Promise<UserRecord>
  findOrCreateOAuth(data: {
    provider: string
    providerAccountId: string
    email: string | null
    displayName: string
    avatarUrl: string | null
  }): Promise<UserRecord>
  createResetToken(userId: string): Promise<string>
  findResetToken(token: string): Promise<{ token: string; userId: string; expiresAt: string; usedAt: string | null } | null>
  updatePassword(userId: string, passwordHash: string): Promise<void>
  markResetTokenUsed(token: string): Promise<void>
}

interface UserRow {
  id: string
  email: string | null
  display_name: string
  avatar_url: string | null
  is_guest: boolean
  password_hash: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isGuest: row.is_guest,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export function createUserRepo(sql: Sql): UserRepo {
  return {
    async findByEmail(email) {
      const rows = await sql<UserRow[]>`
        SELECT id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `
      return rows[0] ? mapRow(rows[0]) : null
    },

    async findById(id) {
      const rows = await sql<UserRow[]>`
        SELECT id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
        FROM users
        WHERE id = ${id}
        LIMIT 1
      `
      return rows[0] ? mapRow(rows[0]) : null
    },

    async create({ email, displayName, passwordHash }) {
      const rows = await sql<UserRow[]>`
        INSERT INTO users (email, display_name, password_hash, is_guest)
        VALUES (${email}, ${displayName}, ${passwordHash}, false)
        RETURNING id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
      `
      return mapRow(rows[0])
    },

    async findOrCreateOAuth({ provider, providerAccountId, email, displayName, avatarUrl }) {
      return sql.begin(async (tx) => {
        // Check if oauth account already exists
        const existing = await tx<{ user_id: string }[]>`
          SELECT user_id FROM oauth_accounts
          WHERE provider = ${provider} AND provider_account_id = ${providerAccountId}
          LIMIT 1
        `
        if (existing[0]) {
          const rows = await tx<UserRow[]>`
            SELECT id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
            FROM users WHERE id = ${existing[0].user_id}
          `
          return mapRow(rows[0])
        }

        // Create new user + link oauth account
        const userRows = await tx<UserRow[]>`
          INSERT INTO users (email, display_name, avatar_url, is_guest)
          VALUES (${email}, ${displayName}, ${avatarUrl}, false)
          ON CONFLICT (email) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
                updated_at = NOW()
          RETURNING id, email, display_name, avatar_url, is_guest, password_hash, created_at, updated_at
        `
        const user = mapRow(userRows[0])

        await tx`
          INSERT INTO oauth_accounts (user_id, provider, provider_account_id)
          VALUES (${user.id}, ${provider}, ${providerAccountId})
          ON CONFLICT DO NOTHING
        `

        return user
      })
    },

    async createResetToken(userId) {
      const rows = await sql<{ token: string }[]>`
        INSERT INTO password_reset_tokens (user_id, expires_at)
        VALUES (${userId}, NOW() + INTERVAL '1 hour')
        RETURNING token::text
      `
      return rows[0].token
    },

    async findResetToken(token) {
      const rows = await sql<{
        token: string
        user_id: string
        expires_at: Date
        used_at: Date | null
      }[]>`
        SELECT token::text, user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token = ${token}::uuid
        LIMIT 1
      `
      if (!rows[0]) return null
      return {
        token: rows[0].token,
        userId: rows[0].user_id,
        expiresAt: rows[0].expires_at.toISOString(),
        usedAt: rows[0].used_at?.toISOString() ?? null,
      }
    },

    async updatePassword(userId, passwordHash) {
      await sql`
        UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW()
        WHERE id = ${userId}
      `
    },

    async markResetTokenUsed(token) {
      await sql`
        UPDATE password_reset_tokens SET used_at = NOW()
        WHERE token = ${token}::uuid
      `
    },
  }
}
