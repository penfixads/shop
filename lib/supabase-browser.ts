import { createBrowserClient } from '@supabase/ssr'
import { getCookieDomain } from '@/lib/cookie-domain'

export function createSupabaseBrowserClient() {
  // SSO: on penfixads.com subdomains, session cookies are scoped to
  // .penfixads.com so jobs/tools/shop/etc. share one login (see lib/cookie-domain.ts)
  const cookieDomain = typeof window !== 'undefined' ? getCookieDomain(window.location.host) : undefined
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookieDomain ? { cookieOptions: { domain: cookieDomain } } : undefined
  )
}
