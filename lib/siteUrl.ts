// lib/siteUrl.ts
//
// Invite emails (staff, clinic admins, platform admins) need an absolute
// URL to redirect back to after the user clicks the link. Supabase's
// dashboard has a "Site URL" setting that's used as a fallback when no
// redirectTo is passed explicitly — but that setting defaults to
// http://localhost:3000 and is easy to forget to update after deploying,
// which is exactly what caused invite links to point at localhost in
// production. Rather than depend on that dashboard setting, every invite
// call in this app passes redirectTo explicitly, built from this helper.

export function getSiteUrl(): string {
  // Set this in Vercel (and .env.local for dev) to your real production
  // domain, e.g. https://totalcare-os.vercel.app or your custom domain.
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  // Vercel sets this automatically per-deployment — a reasonable fallback
  // if NEXT_PUBLIC_SITE_URL hasn't been set yet, though it points at the
  // specific deployment URL rather than a custom domain.
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}
