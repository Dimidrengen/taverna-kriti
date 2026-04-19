import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { restaurant, lang = 'en', table: tableToken } = req.query

  if (!restaurant) return res.status(400).json({ error: 'Missing restaurant' })

  const { data: restaurantData } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', restaurant)
    .single()

  if (!restaurantData) return res.status(404).json({ error: 'Restaurant not found' })

  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantData.id)
    .eq('available', true)
    .order('sort_order', { ascending: true })

  const { data: translations } = await supabase
    .from('menu_item_translations')
    .select('*')
    .eq('lang', lang)
    .in('item_id', items.map(i => i.id))

  const { data: catTranslations } = await supabase
    .from('category_translations')
    .select('*')
    .eq('restaurant_id', restaurantData.id)
    .eq('lang', lang)

  const translationMap = {}
  translations?.forEach(t => { translationMap[t.item_id] = t })

  const catMap = {}
  catTranslations?.forEach(t => { catMap[t.category] = t.translation })

  const translatedItems = items.map(item => ({
    ...item,
    originalName: item.name,
    name: translationMap[item.id]?.name || item.name,
    description: translationMap[item.id]?.description || item.description,
    category: catMap[item.category] || item.category,
    originalCategory: item.category,
  }))

  // === ANALYTICS EVENT ===
  if (tableToken) {
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('token', tableToken)
      .eq('restaurant_id', restaurantData.id)
      .single()

    if (table) {
      await supabase.from('analytics_events').insert({
        restaurant_id: restaurantData.id,
        event_type: 'menu_viewed',
        table_id: table.id,
        event_data: { lang: lang, item_count: items.length }
      })
    }
  }

  res.status(200).json({
    restaurant: restaurantData,
    items: translatedItems,
    lang
  })
}