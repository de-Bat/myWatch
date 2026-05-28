import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  const applied = await sql<{ version: string }[]>`
    SELECT version FROM schema_migrations ORDER BY version
  `
  const appliedVersions = new Set(applied.map((r) => r.version))

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const version = file.replace('.sql', '')
    if (appliedVersions.has(version)) {
      console.log(`  skip  ${file}`)
      continue
    }

    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
    await sql.begin(async (tx) => {
      await tx.unsafe(content)
      await tx`INSERT INTO schema_migrations (version) VALUES (${version})`
    })
    console.log(`  apply ${file}`)
  }

  console.log('Migrations complete.')
  await sql.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
