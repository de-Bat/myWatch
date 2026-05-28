import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/mywatch'

export const sql = postgres(connectionString)
