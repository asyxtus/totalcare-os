# TotalCare OS

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy the environment template and fill in your real Supabase values:
   ```
   cp .env.local.example .env.local
   ```
   Then edit `.env.local` with your project's URL and keys from the
   Supabase dashboard (Settings → API). Never commit this file —
   `.gitignore` already excludes it.

3. Run the dev server:
   ```
   npm run dev
   ```

4. Open http://localhost:3000 — it redirects to `/login`.

## What's built so far

- `app/login` — real Supabase auth, bilingual (FR/EN), friendly error
  messages
- `app/(authenticated)` — role-gated layout wrapping every authenticated
  screen; fetches staff role server-side before rendering nav
- `components/AppShell.tsx` — responsive shell: sidebar on desktop,
  bottom tab bar on mobile (breakpoint: 768px)
- `app/globals.css` — the full design token system, light + dark mode,
  WCAG AA verified contrast
- Dashboard, Patients, Pharmacy, Billing — placeholder screens only,
  built one at a time going forward

## Database

The full schema (18+ SQL files) lives separately — see the schema files
already run against your Supabase project via the SQL Editor. This repo
is the frontend only.

## Known gaps

See `BACKLOG.md` (kept alongside the schema files) for the full running
list of deferred decisions and known gaps across the whole build,
including what's still missing on the frontend side.
