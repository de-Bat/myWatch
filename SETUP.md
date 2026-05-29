# myWatch — Setup Guide

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ — `npm install -g pnpm`
- **PostgreSQL** 15+ running locally (or a hosted instance)

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd myWatch
pnpm install
```

---

## 2. Create the Database

```sql
-- in psql or any Postgres client
CREATE DATABASE mywatch;
```

Default connection string is `postgresql://localhost:5432/mywatch`.  
If your Postgres requires a user/password, use:
`postgresql://user:password@localhost:5432/mywatch`

---

## 3. Configure the API

Create `apps/api/.env` (no example file — just these two variables):

```env
DATABASE_URL=postgresql://localhost:5432/mywatch
JWT_SECRET=change-me-to-something-random
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Run Migrations

```bash
cd apps/api
pnpm migrate
```

Expected output:
```
  apply 001_initial
Migrations complete.
```

---

## 5. Configure the Web App

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_API_KEY=<your key>      # https://www.themoviedb.org/settings/api
AUTH_SECRET=<random 32-byte string>       # openssl rand -base64 32
AUTH_URL=http://localhost:3000

# Optional — only needed for Google/Apple OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_ID=
APPLE_SECRET=
```

Get a free TMDB API key at: https://www.themoviedb.org/settings/api  
(Read Access Token, not API key v3 — but either works for search/discover)

---

## 6. Start the API

```bash
# Terminal 1
cd apps/api
pnpm dev
```

Expected:
```
API listening on http://0.0.0.0:3001
```

Verify it's running:
```bash
curl http://localhost:3001/health
# {"status":"ok"}
```

---

## 7. Start the Web App

```bash
# Terminal 2
cd apps/web
pnpm dev
```

Open: http://localhost:3000

---

## 8. Access on Local Network (iOS / Android TV / any device)

Replace `pnpm dev` with:

```bash
cd apps/web
pnpm dev -- --hostname 0.0.0.0
```

Find your machine's local IP:
- **Mac/Linux:** `ifconfig | grep "inet " | grep -v 127`
- **Windows:** `ipconfig` → look for IPv4 Address

Then open `http://<your-ip>:3000` on any device on the same Wi-Fi.

> **iOS Safari:** Works as-is. Add to Home Screen for full-screen experience (Share → Add to Home Screen).

> **Android TV:** Open the browser app (Chrome or built-in), navigate to `http://<your-ip>:3000`. D-pad navigation works for basic browsing; use the on-screen keyboard for search.

---

## 9. Production Build

```bash
# Build both
cd apps/api && pnpm build
cd apps/web && pnpm build

# Run both
cd apps/api && pnpm start       # http://0.0.0.0:3001
cd apps/web && pnpm start       # http://localhost:3000
```

---

## Running Tests

```bash
# From repo root — runs all 103 tests (core, tmdb, sync, api, web)
pnpm test
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on API start | Postgres not running, or wrong `DATABASE_URL` |
| `invalid signature` on login | `JWT_SECRET` mismatch between API restarts — keep it stable |
| TMDB images not loading | Normal on first load — cached in IndexedDB after first fetch |
| `AUTH_SECRET` error on web | Missing or empty `AUTH_SECRET` in `.env.local` |
| Google/Apple OAuth fails | `AUTH_URL` must match the exact URL you're accessing the app from |
