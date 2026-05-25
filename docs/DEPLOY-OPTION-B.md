# Deploy Option B: Neon + Render + Vercel

This replaces the expired **Replit database**. Your **Vercel site** stays the HR frontend; **Render** runs the API; **Neon** holds PostgreSQL.

```
Browser → Vercel (UI) → /api/* rewrite → Render (API) → Neon (Postgres)
```

---

## What is already in the repo

| File | Purpose |
|------|---------|
| `render.yaml` | One-click API deploy on Render |
| `vercel.json` | Builds HR UI + proxies `/api` to your Render URL |
| `.env.example` | Template for local secrets |
| `pnpm run db:push` / `pnpm run db:seed` | Apply schema + demo data to any Postgres |

---

## Part 1 — Create Neon database (you)

1. Go to [https://neon.tech](https://neon.tech) and sign up (free).
2. **New project** → name it e.g. `doctor-hospital-hub` → region closest to you.
3. On the project dashboard, copy the **connection string** (PostgreSQL).
   - Use the **pooled** or **direct** string; both work with Render.
   - It should look like:
     ```
     postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
     ```
4. Keep this secret. Do not commit it to Git.

---

## Part 2 — Load schema and seed data (you, on your PC)

Use the Neon URL from Part 1.

### Windows (PowerShell)

```powershell
cd C:\Users\Personal\Desktop\Doctor-Hospital-Hub

# Paste your Neon URL (in quotes)
$env:DATABASE_URL = "postgresql://YOUR_NEON_CONNECTION_STRING"

pnpm run db:push
pnpm run db:seed
```

You should see `Seeded HR data.` (or `Already seeded.` if you run it twice).

### Verify (optional)

```powershell
pnpm exec tsx -e "import { db, employees, pool } from '@workspace/db'; const r = await db.select().from(employees).limit(3); console.log(r); await pool.end();"
```

You should see employee rows in the output.

---

## Part 3 — Deploy API on Render (you)

1. Push this repo to **GitHub** (if it is not there yet).
2. Go to [https://render.com](https://render.com) → sign up → **New** → **Blueprint**.
3. Connect your GitHub account and select the **Doctor-Hospital-Hub** repository.
4. Render should detect `render.yaml`. Click **Apply**.
5. When prompted for **`DATABASE_URL`**, paste your **Neon connection string** from Part 1.
6. Wait until the service status is **Live** (first deploy can take 5–10 minutes on the free plan).
7. Copy your public URL, e.g. `https://doctor-hospital-hub-api.onrender.com` (name may vary).

### Test the API

In a browser or terminal:

```
https://YOUR-SERVICE.onrender.com/api/healthz
```

Expected: `{"status":"ok"}`

```
https://YOUR-SERVICE.onrender.com/api/employees
```

Expected: JSON array of employees (not an HTML error page).

**Free plan note:** Render sleeps after inactivity. The first request after sleep can take ~30 seconds.

---

## Part 4 — Point Vercel at Render (you)

1. Open `vercel.json` in the repo root.
2. Find this line:
   ```json
   "destination": "https://REPLACE_WITH_YOUR_RENDER_URL.onrender.com/api/:path*"
   ```
3. Replace `REPLACE_WITH_YOUR_RENDER_URL` with your real Render hostname **only** (no `https://`, no path), e.g.:
   ```json
   "destination": "https://doctor-hospital-hub-api.onrender.com/api/:path*"
   ```
4. Commit and push to GitHub (or edit in GitHub’s web UI).

---

## Part 5 — Redeploy Vercel (you)

1. Go to [https://vercel.com](https://vercel.com) → your project.
2. **Deployments** → **Redeploy** (latest), or push a commit to trigger a new build.
3. Confirm project settings (if asked):
   - **Framework:** Vite (or Other)
   - **Build / output:** taken from `vercel.json` (`artifacts/hr-system/dist/public`)
4. Open your Vercel URL → **Employees** (or Dashboard) should load data.

### Quick test on the live Vercel site

Open in the browser (replace with your Vercel domain):

```
https://YOUR-VERCEL-APP.vercel.app/api/employees
```

You should get JSON (proxied to Render). If you see HTML or 502, check Parts 3–4.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Vercel UI loads but no data | Update `vercel.json` Render URL; redeploy Vercel |
| `/api/employees` HTML on Render | `DATABASE_URL` wrong or DB not seeded — repeat Part 2 |
| Render build fails on `pnpm` | Ensure repo uses pnpm; `render.yaml` enables corepack |
| `db:push` fails locally | Set `$env:DATABASE_URL` to Neon URL with `?sslmode=require` |
| Slow first API call | Render free tier cold start — wait and retry |
| Local dev still broken | Use `.env` with local Postgres + `API_PROXY_TARGET=http://127.0.0.1:8080` (see `scripts/start-local-dev.ps1`) |

---

## After everything works

- **Production:** Vercel + Render + Neon  
- **Local:** `.env` + local Postgres (or Neon URL) + API on 8080 + Vite on 5173  

You can stop using the Replit URL in `vite.config.ts` for local dev by setting `API_PROXY_TARGET` in `.env`.
