# Database Migrations

Every change to the database schema lives here as a numbered `.sql` file
(`122_add_something.sql`). The runner (`scripts/migrate.mjs`) applies pending
files in order, each in its own transaction, and records what it ran in a
`schema_migrations` table so nothing is ever applied twice.

## One-time setup

1. **Add `DATABASE_URL` to `.env.local`.**
   Supabase Dashboard → Settings → Database → Connection string → URI tab →
   copy the **Session pooler** string. Paste your database password into it.

2. **Install the Postgres driver** (first time only):
   ```
   npm install
   ```

3. **Baseline your existing database.** Your 121 existing migrations are
   ALREADY applied to the live database. Tell the runner to mark them as
   done WITHOUT re-running them:
   ```
   npm run migrate:baseline
   ```
   This inserts all current filenames into `schema_migrations` without
   executing any SQL. Do this exactly once.

## Daily workflow

- **See what's pending** (safe, read-only):
  ```
  npm run migrate:status
  ```

- **Apply all pending migrations:**
  ```
  npm run migrate
  ```
  Each file runs inside a transaction. If one fails, it rolls back
  completely and stops — you fix the SQL and re-run. No more half-applied
  migrations.

## Writing a new migration

1. Create the next numbered file: `migrations/122_your_change.sql`.
2. Make it **idempotent** where possible (`create or replace`,
   `add column if not exists`, `drop ... if exists`) so a re-run is safe.
3. If a migration changes a function's return type, `drop function` first
   (Postgres can't `create or replace` a function whose signature changed).
4. Run `npm run migrate:status` to confirm it's detected, then
   `npm run migrate`.

## Rules

- Never edit a migration that's already been applied. Write a new one.
- Never hand-paste SQL into Supabase for schema changes anymore — always
  a numbered file + `npm run migrate`, so the file and the database stay
  in sync and clinic #2's database can be built from the same files.
- Filenames must start with a number. Sorting is numeric
  (`9_x.sql` runs before `10_x.sql`).

## Schema snapshot (source of truth for what's live)

Migrations are a *history* of changes. When the same function is redefined
across several migrations (e.g. `dispense_prescription_item` in 26, 46, 49,
116), you can't tell which version is current just by reading the files.

`schema/schema.sql` solves this — it's a dump of the CURRENT state of every
function, trigger, table, and enum, pulled straight from the live database.

**Regenerate it after applying migrations:**
```
npm run snapshot
```

Commit `schema/schema.sql` to git. To know what a function actually does
right now, read `schema.sql` — not the migration history. When building
clinic #2's database, `schema.sql` shows exactly what the schema should look
like once all migrations are applied.

Do NOT edit `schema.sql` by hand and do NOT run it against a database — it's
a read-only reference. The migrations remain the executable source; the
snapshot is the readable current-state view.

### Recommended workflow
1. Write `migrations/NNN_change.sql`
2. `npm run migrate`
3. `npm run snapshot`
4. Commit both the migration and the updated `schema.sql`
