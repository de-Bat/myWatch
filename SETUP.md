# myWatch — Setup Guide

- [Option A: Docker](#option-a--docker-recommended) — zero local setup, recommended for running the app
- [Option B: Manual](#option-b--manual-development) — for active development with hot reload
- [First Use](#first-use)
- [Access from iOS / Android TV](#access-from-ios--android-tv)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)

---

## Option A — Docker (Recommended)

Spins up PostgreSQL, the API, and the web app in containers. No local Node.js or Postgres needed.

### Prerequisites

Install [Docker Desktop](https://www.docker.com/products/docker-desktop) (Mac/Windows/Linux).

Verify:

```bash
docker --version        # 24+
docker compose version  # 2.x
```

### Step 1 — Get a TMDB API key

The app needs TMDB for search, posters, metadata, and discover.

1. Sign up free at https://www.themoviedb.org/signup
2. Go to **Settings → API**: https://www.themoviedb.org/settings/api
3. Request a key — choose **Developer**, fill in the form
4. Copy the **API Read Access Token** (the long `eyJ…` JWT)

> The shorter "API Key (v3)" also works.

### Step 2 — Create the env file

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
# Required
JWT_SECRET=<random 32-byte hex string>
NEXT_PUBLIC_TMDB_API_KEY=<your TMDB token>
AUTH_SECRET=<random base64 string>

# Ports — change if defaults conflict with other local services
PORT_WEB=3000
PORT_API=3001
PORT_DB=5432

# AUTH_URL, NEXT_PUBLIC_API_URL, INTERNAL_API_URL are auto-derived from the port
# variables above — leave them out unless you need a custom value (e.g. LAN IP)

# Optional — email/password works without these
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_ID=
APPLE_SECRET=
```

> **Changing ports?** Only edit `PORT_WEB` / `PORT_API` / `PORT_DB`. Do **not** also set `AUTH_URL` or `NEXT_PUBLIC_API_URL` — if those are present in `.env` they override the port variables. If your existing `.env` has them, delete those lines.

Generate secrets:

```bash
# JWT_SECRET / any hex secret (Mac/Linux/Windows Node)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# AUTH_SECRET (Mac/Linux)
openssl rand -base64 32

# AUTH_SECRET (Windows PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

> Keep `JWT_SECRET` stable — changing it logs everyone out.

### Step 3 — Build and start

```bash
docker compose up --build
```

First build: ~3–5 minutes (downloads base images, installs deps, compiles TypeScript, builds Next.js).  
Subsequent starts: ~15 seconds (images cached).

Expected output when ready:

```
postgres  | database system is ready to accept connections
api       | Running database migrations...
api       | Migrations complete.
api       | Starting API server...
api       | API listening on http://0.0.0.0:3001
web       | ▲ Next.js 14.2.29
web       | ✓ Ready
```

### Step 4 — Open the app

| Service | Default URL | Configurable via |
|---------|-------------|-----------------|
| Web app | http://localhost:3000 | `PORT_WEB` in `.env` |
| API health | http://localhost:3001/health | `PORT_API` in `.env` |
| PostgreSQL | localhost:5432 | `PORT_DB` in `.env` |

### Docker commands reference

```bash
# Start in background (detached)
docker compose up -d

# View all logs
docker compose logs -f

# View logs for one service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres

# Stop (keeps database data)
docker compose down

# Stop and wipe database (full reset)
docker compose down -v

# Rebuild after code changes
docker compose up --build

# Open a Postgres shell
docker compose exec postgres psql -U mywatch -d mywatch

# Check tables
docker compose exec postgres psql -U mywatch -d mywatch -c "\dt"

# Restart one service
docker compose restart api
```

---

## Option B — Manual (Development)

Run everything locally with hot reload. Better for active development.

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| PostgreSQL | 15+ | https://www.postgresql.org/download |

Verify:

```bash
node --version    # v20.x.x or higher
pnpm --version    # 9.x.x or higher
psql --version    # psql (PostgreSQL) 15.x or higher
```

---

### Step 1 — Clone and install

```bash
git clone <repo-url>
cd myWatch
pnpm install
```

Installs dependencies for all workspaces: `apps/api`, `apps/web`, `packages/*`.

---

### Step 2 — Get a TMDB API key

Same as Docker Step 1 above — sign up at https://www.themoviedb.org and get an API key.

---

### Step 3 — Create the PostgreSQL database

**Option A: psql**

```bash
psql -U postgres
```

```sql
CREATE DATABASE mywatch;
\q
```

**Option B: GUI** (TablePlus, pgAdmin, DBeaver)

Create a database named `mywatch`.

**Verify:**

```bash
psql -U postgres -d mywatch -c "SELECT 1"
# Expected: ?column? = 1
```

---

### Step 4 — Configure the API

Create `apps/api/.env`:

```bash
# Mac/Linux
touch apps/api/.env

# Windows (PowerShell)
New-Item apps/api/.env
```

Add:

```env
DATABASE_URL=postgresql://localhost:5432/mywatch
JWT_SECRET=<random secret>
# PORT=3001  # uncomment to change the API port
```

With username/password:

```env
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mywatch
```

Generate `JWT_SECRET`:

```bash
# Mac/Linux
openssl rand -hex 32

# Windows (PowerShell)
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Any platform
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Keep `JWT_SECRET` stable across restarts — changing it invalidates all login sessions.

---

### Step 5 — Run database migrations

Creates all tables: `users`, `oauth_accounts`, `watchlist_items`, `media_cache`, `playlists`, `playlist_items`.

```bash
cd apps/api
pnpm migrate
```

Expected:

```
  apply 001_initial
  apply 002_watch_providers
  apply 003_playlists
Migrations complete.
```

`apply` = ran fresh. `skip` = already applied (safe to ignore).

Verify tables:

```bash
psql -U postgres -d mywatch -c "\dt"
```

Expected:

```
 media_cache | oauth_accounts | playlist_items | playlists | schema_migrations | users | watchlist_items
```

---

### Step 6 — Configure the web app

```bash
# Mac/Linux
cp apps/web/.env.local.example apps/web/.env.local

# Windows (PowerShell)
Copy-Item apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```env
# Dev server port (default: 3000)
PORT=3000

# Fastify API base URL — update port if you changed PORT in apps/api/.env
NEXT_PUBLIC_API_URL=http://localhost:3001

# TMDB API key from Step 2
NEXT_PUBLIC_TMDB_API_KEY=eyJhbGciOiJIUzI1NiJ9...

# Auth.js session secret — openssl rand -base64 32
AUTH_SECRET=your-random-secret-here

# Web app URL — must match exactly for OAuth callbacks
AUTH_URL=http://localhost:3000

# --- Optional: Google OAuth ---
# Redirect URI to register: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- Optional: Apple Sign-In ---
# Redirect URI to register: http://localhost:3000/api/auth/callback/apple
APPLE_ID=
APPLE_SECRET=
```

> Email/password login works without Google and Apple credentials.

---

### Step 7 — Start the API

**Terminal 1:**

```bash
cd apps/api
pnpm dev
```

Expected:

```
API listening on http://0.0.0.0:3001
```

Verify (replace `3001` with your `PORT` if changed):

```bash
curl http://localhost:3001/health
# {"status":"ok"}
```

Uses `tsx watch` — auto-reloads on file changes.

---

### Step 8 — Start the web app

**Terminal 2:**

```bash
cd apps/web
pnpm dev
```

Expected:

```
▲ Next.js 14.2.29
- Local:        http://localhost:3000
- Ready in 2s
```

Open http://localhost:3000 (or the port set in `PORT`).

---

## First Use

### Create an account

1. Go to http://localhost:3000 (or `http://localhost:$PORT_WEB` if changed)
2. Click **Profile** in the top-right nav
3. Click **Register** on the login page
4. Enter email, password, display name → redirected to My List

### Try the features

**Search and add:**
1. Click **Search** in the nav
2. Type a movie or show name (e.g. "The Wire")
3. Click **+ Add** → pick a status (Planned / In Progress / Watched / Quit)

**My List:**
1. Home screen shows your list
2. Filter by status using the tabs at the top
3. Filter by type (Movies / TV) and sort using the dropdowns
4. Use the **List / Grid** toggle (top-right of filter bar) to switch views
5. Genre chips appear below the controls row once items with genre data are cached — click a genre to filter

**Media detail:**
1. Click any item in your list, search results, or discover cards
2. Change status, rate 1–10, add notes
3. For TV shows set to **In Progress**: season + episode tracker appears
4. **WHERE TO WATCH** section: TMDB streaming providers load automatically; add custom platforms (Jellyfin, Cellcom, FreTV, etc.) via the preset buttons or free-text input
5. Items with future release dates show an **UPCOMING** badge and full release date

**Playlists:**
1. Click the playlist icon in the nav header
2. Click **New Playlist** → choose Manual or Smart
3. **Manual**: right-click any card in My List → **Add to Playlist**; drag items to reorder in the playlist detail view
4. **Smart**: set rules (statuses, media type, min rating) — items populate automatically

**Discover:**
- Browse Trending This Week, Top Rated
- After adding an In Progress or Watched item, personalized recs appear ("Because You Watched…")

**Sync:**
- Click **Sync** (top-right of My List) or **Profile → Sync Now**
- Pushes local changes (watchlist + playlists) to Postgres, pulls any changes from other devices
- Works across devices logged into the same account

---

## Access from iOS / Android TV

The web app runs in any browser — no native app needed.

### Step 1 — Find your local IP

```bash
# Mac
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows (PowerShell)
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' })[0].IPAddress
```

Example result: `192.168.1.42`

### Step 2 — Expose the servers on your network

**Docker:**

Edit `.env`:

```env
AUTH_URL=http://192.168.1.42:3000          # replace 3000 with PORT_WEB if changed
NEXT_PUBLIC_API_URL=http://192.168.1.42:3001  # replace 3001 with PORT_API if changed
```

Rebuild:

```bash
docker compose up --build
```

> `NEXT_PUBLIC_*` vars are baked in at build time — rebuild is required.

**Manual:**

Stop `pnpm dev` in both terminals and restart:

```bash
# Terminal 1 — API (already binds to 0.0.0.0, nothing to change)
cd apps/api && pnpm dev

# Terminal 2 — Web
cd apps/web && pnpm dev -- --hostname 0.0.0.0
```

Edit `apps/web/.env.local`:

```env
AUTH_URL=http://192.168.1.42:3000
```

Restart `pnpm dev` in the web terminal.

### Step 3 — Open on the device

Navigate to `http://192.168.1.42:3000` in the device browser.

Both devices must be on the same Wi-Fi network.

**iOS Safari tips:**
- Works immediately — no configuration needed
- Full-screen mode: tap **Share → Add to Home Screen** → launches without browser chrome, like a native app

**Android TV tips:**
- Open Chrome or the built-in browser, navigate to the URL
- D-pad navigates focus, select button confirms, back button goes back
- Use the on-screen keyboard for search
- If D-pad navigation is awkward, cast from an Android phone instead

---

## Production Build (without Docker)

```bash
# Build API
cd apps/api
pnpm build
# Output: apps/api/dist/index.js

# Build web
cd apps/web
pnpm build
# Output: apps/web/.next/standalone/

# Run API
cd apps/api && NODE_ENV=production pnpm start

# Run web
cd apps/web && NODE_ENV=production pnpm start
```

Using PM2:

```bash
npm install -g pm2

pm2 start apps/api/dist/index.js --name mywatch-api
pm2 start "pnpm start" --name mywatch-web --cwd apps/web
pm2 save
pm2 startup   # auto-start on reboot
```

---

## Running Tests

```bash
# All 103 tests (run from repo root)
pnpm test

# Watch mode
pnpm test:watch
```

| Package | Tests | What's covered |
|---------|-------|----------------|
| `packages/core` | 21 | Zod schemas, status machine |
| `packages/tmdb` | 21 | normalize, cache staleness, client |
| `packages/sync` | 12 | LWW conflict resolution, device ID |
| `apps/api` | 26 | health, register/login/me, OAuth, sync push/pull, password hash |
| `apps/web` | 23 | API client, Dexie store, sync engine (tombstone propagation) |

---

## Troubleshooting

### API won't start — "ECONNREFUSED"

PostgreSQL isn't running or `DATABASE_URL` is wrong.

```bash
# Check Postgres is running (replace 5432 with PORT_DB if changed)
pg_isready

# Test connection directly
psql "postgresql://localhost:5432/mywatch" -c "SELECT 1"

# Docker: check postgres container
docker compose logs postgres
```

### "relation does not exist"

Migrations haven't run.

```bash
# Manual
cd apps/api && pnpm migrate

# Docker — migrations run automatically; check logs
docker compose logs api
```

### Login returns "Invalid email or password"

API isn't reachable from the web app.

1. Confirm API terminal shows `API listening on http://0.0.0.0:<PORT>`
2. Open `http://localhost:<PORT_API>/health` — must return `{"status":"ok"}`
3. Confirm `NEXT_PUBLIC_API_URL` in `.env.local` matches the API port

### Session loop / "AUTH_SECRET" error

`AUTH_SECRET` is missing or empty. Set it to any non-empty string in `.env.local` (or `.env` for Docker) and restart.

### Google/Apple OAuth — "redirect_uri_mismatch"

The callback URL in your OAuth provider doesn't match `AUTH_URL`.

- **Google Cloud Console** → Credentials → OAuth 2.0 Client → Authorized redirect URIs:
  Add `http://localhost:<PORT_WEB>/api/auth/callback/google`
- **Apple Developer** → Certificates → Services ID → Return URLs:
  Add `http://localhost:<PORT_WEB>/api/auth/callback/apple`

For LAN access replace `localhost:<PORT_WEB>` with your IP and port.

### TMDB posters not showing

Expected on first load — fetched from TMDB and cached in IndexedDB. Appear after first successful fetch.

If they never appear: check `NEXT_PUBLIC_TMDB_API_KEY` is set and not expired.

### "invalid signature" on API calls

`JWT_SECRET` changed between restarts. Sign out and sign back in to get a fresh token.

### Can't reach the app from phone or TV

1. Both devices must be on the same Wi-Fi
2. Test API from the device: open `http://<your-ip>:<PORT_API>/health` in the device browser
3. If unreachable, check firewall — allow inbound on `PORT_WEB` and `PORT_API` (defaults: 3000, 3001)
4. For Docker: confirm `NEXT_PUBLIC_API_URL` uses the IP, not `localhost`, and rebuild

### Docker build fails — "NEXT_PUBLIC_TMDB_API_KEY is required"

The variable isn't set in `.env`. Check `.env` exists (not just `.env.example`) and the variable is filled in.
