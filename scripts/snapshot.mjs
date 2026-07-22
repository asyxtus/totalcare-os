#!/usr/bin/env node
// scripts/snapshot.mjs
//
// Dumps the CURRENT state of the database's functions, triggers, tables,
// and enums into schema/schema.sql. This is the single source of truth for
// "what's actually live right now" — solving function drift, where the same
// function (e.g. dispense_prescription_item) is redefined across migrations
// 26, 46, 49, 116 and you can't tell which version is current without
// querying the DB.
//
// Run this AFTER applying migrations, so schema.sql always reflects reality:
//   npm run snapshot
//
// Commit schema/schema.sql to git. When onboarding clinic #2 or reviewing
// what a function does, read schema.sql — not the migration history.
//
// Requires DATABASE_URL in .env.local (same as the migration runner).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'schema')
const OUT_FILE = join(OUT_DIR, 'schema.sql')

// ── Load DATABASE_URL from .env.local ───────────────────────────────────────
function loadEnv() {
  try {
    const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('\n✗ DATABASE_URL not set in .env.local (same one the migration runner uses).\n')
  process.exit(1)
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()

  const parts = []
  const now = new Date().toISOString()

  parts.push(`-- ============================================================================`)
  parts.push(`-- SCHEMA SNAPSHOT — generated ${now}`)
  parts.push(`--`)
  parts.push(`-- This is the CURRENT state of the database, dumped from the live DB.`)
  parts.push(`-- It is the single source of truth for what functions/triggers/tables`)
  parts.push(`-- actually exist right now — not the migration history.`)
  parts.push(`--`)
  parts.push(`-- Regenerate with: npm run snapshot  (after applying migrations)`)
  parts.push(`-- Do NOT edit by hand. Do NOT run this file against a database.`)
  parts.push(`-- ============================================================================`)
  parts.push('')

  // ── ENUM TYPES ──────────────────────────────────────────────────────────
  const enums = await client.query(`
    select t.typname as name,
           array_agg(e.enumlabel::text order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname
    order by t.typname
  `)
  if (enums.rows.length) {
    parts.push('-- ─────────────────────────── ENUM TYPES ───────────────────────────')
    parts.push('')
    for (const e of enums.rows) {
      const labelArray = Array.isArray(e.labels)
        ? e.labels
        : String(e.labels).replace(/^\{|\}$/g, '').split(',').filter(Boolean)
      const labels = labelArray.map((l) => `'${l}'`).join(', ')
      parts.push(`-- enum ${e.name}: ${labels}`)
    }
    parts.push('')
  }

  // ── TABLES (columns only — a readable reference, not for execution) ──────
  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `)
  parts.push('-- ─────────────────────────── TABLES ───────────────────────────')
  parts.push('')
  for (const t of tables.rows) {
    const cols = await client.query(`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position
    `, [t.table_name])
    parts.push(`-- TABLE ${t.table_name}`)
    for (const c of cols.rows) {
      const nn = c.is_nullable === 'NO' ? ' NOT NULL' : ''
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : ''
      parts.push(`--   ${c.column_name} ${c.data_type}${nn}${def}`)
    }
    parts.push('')
  }

  // ── FUNCTIONS (full current definitions) ────────────────────────────────
  const funcs = await client.query(`
    select p.proname as name,
           pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
    order by p.proname
  `)
  parts.push('-- ─────────────────────── FUNCTIONS (CURRENT) ───────────────────────')
  parts.push('-- These are the LIVE definitions. If a function was redefined across')
  parts.push('-- several migrations, only the current version appears here.')
  parts.push('')
  for (const f of funcs.rows) {
    parts.push(`-- FUNCTION: ${f.name}`)
    parts.push(f.definition + ';')
    parts.push('')
  }

  // ── TRIGGERS ────────────────────────────────────────────────────────────
  const triggers = await client.query(`
    select tgname as name,
           pg_get_triggerdef(t.oid) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
    order by tgname
  `)
  if (triggers.rows.length) {
    parts.push('-- ─────────────────────────── TRIGGERS ───────────────────────────')
    parts.push('')
    for (const t of triggers.rows) {
      parts.push(t.definition + ';')
    }
    parts.push('')
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, parts.join('\n'), 'utf8')

  console.log(`\n  ✓ Schema snapshot written to schema/schema.sql`)
  console.log(`    ${enums.rows.length} enums · ${tables.rows.length} tables · ${funcs.rows.length} functions · ${triggers.rows.length} triggers`)
  console.log(`\n  Commit this file to git. It's your source of truth for what's live.\n`)

  await client.end()
}

main().catch((err) => {
  console.error('\n✗ Snapshot failed:', err.message, '\n')
  process.exit(1)
})
