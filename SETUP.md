# myWatch — Setup Guide

A local-first media watchlist app. Fastify API + PostgreSQL backend, Next.js 14 frontend with IndexedDB sync.

---

## What You'll Need

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| PostgreSQL | 15+ | https://www.postgresql.org/download |

Verify everything is installed:

```bash
node --version    # v20.x.x or higher
pnpm --version    # 9.x.x or higher
psql --version    # psql (PostgreSQL) 15.x or higher
```

---

## Step 1 — Clone and Install Dependencies

```bash
git clone <repo-url>
cd myWatch
pnpm install
```

This installs dependencies for all workspaces: `apps/api`, `apps/web`, and `packages/*`.

Expected output ends with something like:
```
Done in 30s
```

---

## Step 2 — Create the PostgreSQL Database

### Option A: Using psql (command line)

```bash
psql -U postgres
```

Then inside psql:

```sql
CREATE DATABASE mywatch;
\q
```

### Option B: Using a GUI (TablePlus, pgAdmin, DBeaver)

Create a new database named `mywatch`.

### Verify

```bash
psql -U postgres -d mywatch -c "SELECT 1"
```

Expected: `?column? = 1`

---

## Step 3 — Configure the API

Create the file `apps/api/.env`:

```bash
# Mac/Linux
touch apps/api/.env

# Windows (PowerShell)
New-Item apps/api/.env
```

Add these two variables:

```env
DATABASE_URL=postgresql://localhost:5432/mywatch
JWT_SECRET=replace-this-with-a-random-secret
```

If your Postgres has a username and password:

```env
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mywatch
```

Generate a strong `JWT_SECRET`:

```bash
# Mac/Linux
openssl rand -hex 32

# Windows (PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Any platform (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Keep `JWT_SECRET` stable across restarts — changing it invalidates all existing login sessions.

---

## Step 4 — Run Database Migrations

This creates the tables: `users`, `oauth_accounts`, `watchlist_items`, `media_cache`.

```bash
cd apps/api
pnpm migrate
```

Expected output:

```
  apply 001_initial
Migrations complete.
```

If you see `apply` → the migration ran fresh.  
If you see `skip` → the migration was already applied (safe to ignore).

Verify the tables were created:

```bash
psql -U postgres -d mywatch -c "\dt"
```

Expected tables:
```
 public | media_cache       | table | ...
 public | oauth_accounts    | table | ...
 public | schema_migrations | table | ...
 public | users             | table | ...
 public | watchlist_items   | table | ...
```

---

## Step 5 — Get a TMDB API Key

The app uses TMDB (The Movie Database) for search, metadata, posters, and discover.

1. Create a free account at https://www.themoviedb.org/signup
2. Go to Settings → API: https://www.themoviedb.org/settings/api
3. Request an API key (choose "Developer", fill in the form)
4. Copy the **API Read Access Token** (long JWT starting with `eyJ...`)

> The shorter "API Key (v3 auth)" also works — both are accepted.

---

## Step 6 — Configure the Web App

Copy the example env file:

```bash
# Mac/Linux
cp apps/web/.env.local.example apps/web/.env.local

# Windows (PowerShell)
Copy-Item apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local` and fill in the values:

```env
# URL of the Fastify API (do not change for local dev)
NEXT_PUBLIC_API_URL=http://localhost:3001

# TMDB API key from Step 5
NEXT_PUBLIC_TMDB_API_KEY=eyJhbGciOiJIUzI1NiJ9...

# Random secret for Auth.js session encryption
# Generate with: openssl rand -base64 32
AUTH_SECRET=your-random-secret-here

# URL this web app is served from (must match exactly for OAuth callbacks)
AUTH_URL=http://localhost:3000

# --- Optional: Google OAuth ---
# From Google Cloud Console → Credentials → OAuth 2.0 Client IDs
# Redirect URI to add: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- Optional: Apple Sign-In ---
# From Apple Developer → Certificates, Identifiers & Profiles → Services IDs
# Redirect URI to add: http://localhost:3000/api/auth/callback/apple
APPLE_ID=
APPLE_SECRET=
```

> Google and Apple OAuth are optional. Email/password login works without them.

Generate `AUTH_SECRET`:

```bash
# Mac/Linux
openssl rand -base64 32

# Windows (PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## Step 7 — Start the API

Open a terminal and run:

```bash
cd apps/api
pnpm dev
```

Expected output:

```
API listening on http://0.0.0.0:3001
```

Verify it's healthy:

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{"status":"ok"}
```

> Keep this terminal running. The API uses `tsx watch` so it auto-reloads on file changes.

---

## Step 8 — Start the Web App

Open a **second terminal** and run:

```bash
cd apps/web
pnpm dev
```

Expected output:

```
▲ Next.js 14.2.29
- Local:        http://localhost:3000
- Ready in 2.1s
```

Open http://localhost:3000 in your browser.

---

## Step 9 — Create Your First Account

1. Go to http://localhost:3000
2. Click **Profile** in the top nav (or go to http://localhost:3000/auth/login)
3. Click **Register** at the bottom of the login page
4. Fill in email, password, and display name
5. You'll be logged in automatically and redirected to My List

---

## Step 10 — Test the App

**Search for something:**
1. Click **Search** in the nav
2. Type a movie or show name (e.g. "Inception")
3. Click **+ Add** → choose a status (Planned, In Progress, Watched, Quit)

**View your list:**
1. Go back to **My List** (home screen)
2. Use the status tabs to filter (All / Planned / In Progress / Watched / Quit)
3. Use the dropdowns to filter by type (Movies / TV) and sort

**View media detail:**
1. Click any item in your list (or any card in Search/Discover)
2. Change status, set a rating, add notes
3. For TV shows set to **In Progress**: season + episode tracker appears
4. Click **Save** to persist changes

**Discover:**
1. Go to **Discover** in the nav
2. Browse Trending This Week and Top Rated
3. After adding something to In Progress/Watched, personalized recommendations appear

**Sync:**
1. While logged in, click **Sync** in the top-right of My List
2. Or go to **Profile** → **Sync Now**
3. Changes push to PostgreSQL and pull back any changes from other devices

---

## Step 11 — Access from iOS or Android TV

The web app works on any device on the same Wi-Fi network.

### Find your local IP address

```bash
# Mac
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows (PowerShell)
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' })[0].IPAddress
```

### Start web server accessible on network

Stop the current `pnpm dev` and restart with:

```bash
cd apps/web
pnpm dev -- --hostname 0.0.0.0
```

### Update AUTH_URL

Edit `apps/web/.env.local` — change `AUTH_URL` to your local IP:

```env
AUTH_URL=http://192.168.1.x:3000
```

Restart `pnpm dev` after changing `.env.local`.

### Open on device

Open `http://192.168.1.x:3000` (use your actual IP) in the device browser.

**iOS Safari:**
- Works immediately
- For full-screen: tap Share → **Add to Home Screen** → gives app-like experience without browser chrome

**Android TV:**
- Open Chrome or the built-in browser
- Navigate to `http://192.168.1.x:3000`
- Use D-pad to navigate, on-screen keyboard for search
- Recommend casting from phone if D-pad navigation is awkward

---

## Production Build

Build optimized bundles for both apps:

```bash
# Build the API
cd apps/api
pnpm build
# Output: apps/api/dist/index.js

# Build the web app
cd apps/web
pnpm build
# Output: apps/web/.next/
```

Run in production mode:

```bash
# Terminal 1 — API
cd apps/api
pnpm start
# Listens on http://0.0.0.0:3001

# Terminal 2 — Web
cd apps/web
pnpm start
# Listens on http://localhost:3000
```

For production deployment, set `NODE_ENV=production` and use a process manager like PM2:

```bash
npm install -g pm2
pm2 start apps/api/dist/index.js --name mywatch-api
pm2 start "pnpm start" --name mywatch-web --cwd apps/web
pm2 save
```

---

## Running Tests

```bash
# Run all 103 tests across all packages
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch
```

Test breakdown:
- `packages/core` — 21 tests (schemas, status machine)
- `packages/tmdb` — 21 tests (normalize, cache, client)
- `packages/sync` — 12 tests (conflict resolution, device ID)
- `apps/api` — 26 tests (health, auth, oauth, sync, password)
- `apps/web` — 23 tests (api client, Dexie store, sync engine)

---

## Troubleshooting

### "ECONNREFUSED" when starting API
PostgreSQL isn't running, or `DATABASE_URL` is wrong.

```bash
# Check Postgres is running
pg_isready

# Test the connection string directly
psql "postgresql://localhost:5432/mywatch" -c "SELECT 1"
```

### "relation does not exist" error
Migrations haven't run yet.

```bash
cd apps/api && pnpm migrate
```

### Login returns "Invalid email or password"
The API isn't reachable from the web app. Check:
1. API terminal shows `API listening on http://0.0.0.0:3001`
2. `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env.local`
3. Visit http://localhost:3001/health — should return `{"status":"ok"}`

### "AUTH_SECRET" error or session loop
`AUTH_SECRET` is missing or empty in `apps/web/.env.local`. Must be set to any non-empty string (use the generated value from Step 6).

### Google/Apple OAuth "redirect_uri_mismatch"
The callback URL registered in Google Cloud Console or Apple Developer portal doesn't match.

- Google: add `http://localhost:3000/api/auth/callback/google` in Authorized redirect URIs
- Apple: add `http://localhost:3000/api/auth/callback/apple` in Return URLs

### TMDB images not showing
Expected on first load — images are fetched from TMDB and cached in IndexedDB. They appear after the first successful fetch. If they never appear, check `NEXT_PUBLIC_TMDB_API_KEY` is set correctly.

### "invalid signature" on API requests
`JWT_SECRET` changed between API restarts. Log out and back in to get a new token.

### Cannot access from phone/TV
- Confirm both devices are on the same Wi-Fi network
- API must also be accessible: open `http://<your-ip>:3001/health` from the device browser
- If API is unreachable from the device, update `NEXT_PUBLIC_API_URL` in `.env.local` to use your local IP instead of `localhost`:
  ```env
  NEXT_PUBLIC_API_URL=http://192.168.1.x:3001
  ```
  Then restart `pnpm dev`.
