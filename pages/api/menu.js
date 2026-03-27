import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { restaurant } = req.query

  if (!restaurant) {
    return res.status(400).json({ error: 'Missing restaurant' })
  }

  const { data: restaurantData } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', restaurant)
    .single()

  if (!restaurantData) {
    return res.status(404).json({ error: 'Restaurant not found' })
  }

  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantData.id)
    .eq('available', true)
    .order('sort_order', { ascending: true })

  res.status(200).json({
    restaurant: restaurantData,
    items: items || []
  })
}