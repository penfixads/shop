import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { getBannerImageMap } from '@/lib/banners'
import ShopClient from './ShopClient'

// Pricing/catalog edits made in the Penfix OS admin must show up immediately — without
// this, Next.js statically renders this page once at build time and keeps serving that
// same snapshot to every visitor until the next deploy.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createSupabaseAdminClient()

  const [{ data: categories }, { data: subcategories }] = await Promise.all([
    supabase.from('categories').select('category_id, category_name').eq('is_active', true).order('category_name'),
    supabase.from('subcategories').select('subcategory_id, subcategory_name, category_id, pricing_model, base_price, unit, description').eq('active', true).order('subcategory_name'),
  ])

  return <ShopClient categories={categories ?? []} subcategories={subcategories ?? []} imageMap={getBannerImageMap()} />
}
