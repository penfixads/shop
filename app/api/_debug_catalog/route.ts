import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const DEBUG_KEY = 'pf-catalog-debug-20260721'
const TARGET_IDS = ['CAT_DTP', 'CAT_MAT']

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('key') !== DEBUG_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: allCats, error: allCatErr } = await supabase
    .from('categories')
    .select('category_id, category_name, is_active')
    .order('category_name')

  const { data: targetSubs, error: subErr } = await supabase
    .from('subcategories')
    .select('subcategory_id, subcategory_name, category_id, active')
    .in('category_id', TARGET_IDS)

  const { count: totalActiveSubcount } = await supabase
    .from('subcategories')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)

  return NextResponse.json({
    allCategoriesCount: allCats?.length ?? null,
    allCategories: allCats,
    allCatErr,
    targetSubcategories: targetSubs,
    subErr,
    totalActiveSubcategoryCount: totalActiveSubcount,
  })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('key') !== DEBUG_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: catFix, error: catFixErr } = await supabase
    .from('categories')
    .update({ is_active: true })
    .in('category_id', TARGET_IDS)
    .select('category_id, category_name, is_active')

  const { data: subFix, error: subFixErr } = await supabase
    .from('subcategories')
    .update({ active: true })
    .in('category_id', TARGET_IDS)
    .select('subcategory_id, category_id, active')

  return NextResponse.json({ catFix, catFixErr, subFix, subFixErr })
}
