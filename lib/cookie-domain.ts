// SSO across the Penfix ecosystem: when the app is served from a
// penfixads.com subdomain (jobs.penfixads.com, tools.penfixads.com, ...),
// scope the Supabase session cookie to `.penfixads.com` so one login is
// recognized by every app. On any other host (localhost dev, *.vercel.app
// previews) return undefined so the cookie stays host-scoped — a browser
// rejects cookies set for a domain the site isn't on.
// Mirrors penfixads-OS/lib/cookie-domain.ts — keep the two in sync.
export function getCookieDomain(host: string | null | undefined): string | undefined {
  if (!host) return undefined
  const hostname = host.split(':')[0]
  if (hostname === 'penfixads.com' || hostname.endsWith('.penfixads.com')) {
    return '.penfixads.com'
  }
  return undefined
}
