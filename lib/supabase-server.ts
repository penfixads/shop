import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { getCookieDomain } from '@/lib/cookie-domain'

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  // SSO: on penfixads.com subdomains, session cookies are scoped to
  // .penfixads.com so jobs/tools/shop/etc. share one login (see lib/cookie-domain.ts)
  const cookieDomain = getCookieDomain(headers().get('host'))
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieDomain ? { cookieOptions: { domain: cookieDomain } } : {}),
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, ...(cookieDomain ? { domain: cookieDomain } : {}) })
            )
          } catch {}
        },
      },
    }
  )
}
