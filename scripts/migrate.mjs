#!/usr/bin/env node
// scripts/migrate.mjs
//
// TotalCare OS migration runner.
//
// Applies every numbered .sql file in /migrations that hasn't been applied
// yet, in filename order, each inside its own transaction. Records what it
// ran in a schema_migrations table so it never runs the same file twice.
//
// Usage:
//   npm run migrate            apply all pending migrations
//   npm run migrate:status     show applied vs pending (no changes)
//   npm run migrate:baseline   mark ALL current files as applied WITHOUT
//                              running them — use once, for the 121 files
//                              already live in your database.
//
// Requires DATABASE_URL in .env.local (Supabase → Settings → Database →
// Connection string → "Session pooler" or "Direct connection", URI format).

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

// ── Load DATABASE_URL from .env.local (simple parser, no dep) ───────────────
function loadEnv() {
  try {
    const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // .env.local absent — rely on real env vars (e.g. in CI)
  }
}
loadEnv()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('\n✗ DATABASE_URL not set.\n')
  console.error('  Add it to .env.local. Get it from:')
  console.error('  Supabase Dashboard → Settings → Database → Connection string')
  console.error('  → URI tab → copy the "Session pooler" or "Direct connection" string.')
  console.error('  It looks like: postgresql://postgres.xxxx:[PASSWORD]@aws-...pooler.supabase.com:5432/postgres\n')
  process.exit(1)
}

const mode =
  process.argv.includes('--status') ? 'status'
  : process.argv.includes('--baseline') ? 'baseline'
  : 'migrate'

// ── List numbered migration files, sorted numerically ──────────────────────
function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)[1], 10)
      const nb = parseInt(b.match(/^(\d+)/)[1], 10)
      return na - nb || a.localeCompare(b)
    })
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  // Ensure the tracking table exists
  await client.query(`
    create table if not exists schema_migrations (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    )
  `)

  const { rows: appliedRows } = await client.query('select filename from schema_migrations')
  const applied = new Set(appliedRows.map((r) => r.filename))
  const files = listMigrationFiles()
  const pending = files.filter((f) => !applied.has(f))

  // ── STATUS ────────────────────────────────────────────────────────────────
  if (mode === 'status') {
    console.log(`\n  Applied:  ${applied.size}`)
    console.log(`  Pending:  ${pending.length}`)
    if (pending.length) {
      console.log('\n  Pending migrations:')
      for (const f of pending) console.log(`    • ${f}`)
    } else {
      console.log('\n  ✓ Database is up to date.')
    }
    console.log('')
    await client.end()
    return
  }

  // ── BASELINE ────────────────────────────────────────────────────────────────
  // Marks every current file as applied WITHOUT executing it. Use once to
  // adopt the runner against a database that already has these migrations.
  if (mode === 'baseline') {
    let marked = 0
    for (const f of files) {
      if (!applied.has(f)) {
        await client.query('insert into schema_migrations (filename) values ($1) on conflict do nothing', [f])
        marked++
      }
    }
    console.log(`\n  ✓ Baseline complete. Marked ${marked} existing migration(s) as applied.`)
    console.log('    Future `npm run migrate` runs will only apply NEW files.\n')
    await client.end()
    return
  }

  // ── MIGRATE ──────────────────────────────────────────────────────────────
  if (pending.length === 0) {
    console.log('\n  ✓ No pending migrations. Database is up to date.\n')
    await client.end()
    return
  }

  console.log(`\n  Applying ${pending.length} migration(s)…\n`)

  for (const f of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8')
    process.stdout.write(`  → ${f} … `)
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations (filename) values ($1)', [f])
      await client.query('commit')
      console.log('✓')
    } catch (err) {
      await client.query('rollback')
      console.log('✗')
      console.error(`\n  Migration ${f} failed and was rolled back:\n`)
      console.error(`    ${err.message}\n`)
      console.error('  No changes from this file were applied. Fix the SQL and re-run.\n')
      await client.end()
      process.exit(1)
    }
  }

  console.log(`\n  ✓ Applied ${pending.length} migration(s) successfully.\n`)
  await client.end()
}

main().catch((err) => {
  console.error('\n✗ Migration runner error:', err.message, '\n')
  process.exit(1)
})
