// Post-deploy smoke test. Catches the "black screen" failure mode we've hit
// twice: a Vercel build-cache issue that ships a bundle with the Supabase env
// vars NOT inlined, so the app throws "Missing Supabase environment variables"
// at load and renders nothing.
//
// This deliberately checks the DEPLOYED bundle (not a local build, which was
// always fine) by:
//   1. fetching the page HTML and finding the main JS bundle,
//   2. asserting the configured Supabase URL is inlined in that bundle,
//   3. asserting the bundle isn't suspiciously small (broken builds were
//      ~290 KB vs the correct ~420 KB).
//
// Usage:
//   node scripts/smoke-test.mjs [url]
// Defaults to production. Exits non-zero (failing CI / your deploy step) on
// any problem, zero on success. No dependencies — plain Node fetch.

import { readFileSync } from 'node:fs'

const DEFAULT_URL = 'https://40k-tier-list.vercel.app'
const MIN_BUNDLE_BYTES = 350_000

const targetUrl = (process.argv[2] || DEFAULT_URL).replace(/\/$/, '')

function readExpectedSupabaseUrl() {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL
  try {
    const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    const match = envFile.match(/^VITE_SUPABASE_URL=(.+)$/m)
    if (match) return match[1].trim()
  } catch {
    // no .env.local — fall through
  }
  return null
}

function fail(message) {
  console.error(`\n✗ SMOKE TEST FAILED: ${message}`)
  console.error('  If this is the env-vars-not-inlined bug, redeploy with a clean cache:')
  console.error('    npx vercel --prod --force\n')
  process.exit(1)
}

const expectedSupabaseUrl = readExpectedSupabaseUrl()
if (!expectedSupabaseUrl) {
  fail('could not determine expected VITE_SUPABASE_URL (set it in env or .env.local)')
}

console.log(`Smoke testing ${targetUrl}`)

const host = expectedSupabaseUrl.replace(/^https?:\/\//, '')
const MAX_ATTEMPTS = 6
const RETRY_DELAY_MS = 5000

// Retry: right after a deploy the production alias can take a few seconds to
// point at the new build, so a transient stale/failed read shouldn't fail the
// gate. Only the final attempt calls fail().
async function attempt(n) {
  const last = n === MAX_ATTEMPTS
  const softFail = (msg) => {
    if (last) fail(msg)
    console.log(`  attempt ${n}/${MAX_ATTEMPTS}: ${msg} — retrying in ${RETRY_DELAY_MS / 1000}s`)
    return false
  }

  const htmlRes = await fetch(targetUrl, { cache: 'no-store' })
  if (!htmlRes.ok) return softFail(`page returned HTTP ${htmlRes.status}`)
  const html = await htmlRes.text()

  const bundleMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/)
  if (!bundleMatch) return softFail('could not find the main JS bundle in the page HTML')

  const bundleRes = await fetch(`${targetUrl}${bundleMatch[1]}`, { cache: 'no-store' })
  if (!bundleRes.ok) return softFail(`bundle returned HTTP ${bundleRes.status}`)
  const bundle = await bundleRes.text()

  if (bundle.length < MIN_BUNDLE_BYTES) {
    return softFail(
      `bundle ${bundleMatch[1]} is only ${Math.round(bundle.length / 1000)} KB (expected > ${MIN_BUNDLE_BYTES / 1000} KB) — likely an incomplete/cached build`,
    )
  }
  if (!bundle.includes(host)) {
    return softFail(`Supabase URL "${host}" is NOT inlined in ${bundleMatch[1]} — env vars not baked in`)
  }

  console.log(`  bundle: ${bundleMatch[1]} (${Math.round(bundle.length / 1000)} KB)`)
  console.log('\n✓ Smoke test passed — Supabase URL inlined and bundle looks complete.')
  return true
}

for (let n = 1; n <= MAX_ATTEMPTS; n++) {
  if (await attempt(n)) break
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
}
