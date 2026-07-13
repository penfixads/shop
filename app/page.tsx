import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getBannerImageMap } from '@/lib/banners'
import ShopClient from './ShopClient'

export default async function HomePage() {
  const supabase = createSupabaseServerClient()

  const [{ data: categories }, { data: subcategories }] = await Promise.all([
    supabase.from('categories').select('category_id, category_name').eq('is_active', true).order('category_name'),
    supabase.from('subcategories').select('subcategory_id, subcategory_name, category_id, pricing_model, base_price, unit').eq('active', true).order('subcategory_name'),
  ])

  return <ShopClient categories={categories ?? []} subcategories={subcategories ?? []} imageMap={getBannerImageMap()} />
}
