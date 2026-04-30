// pages/api/list-translations.js
// Returns all translations for the admin's restaurant in one query.
// Used by bulk-translate UI to determine which item/lang pairs are missing.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !user || !user.email?.startsWith('admin@')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const slugMatch = user.email.match(/^admin@(.+)\.com$/i)
  const slug = slugMatch ? slugMatch[1] : null
  if (!slug) return res.status(403).json({ success: false, error: 'Invalid admin' })

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants').select('id, source_language').eq('slug', slug).single()
  if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })

  try {
    // Get all item IDs for this restaurant
    const { data: items } = await supabaseAdmin
      .from('menu_items')
      .select('id')
      .eq('restaurant_id', restaurant.id)

    if (!items || items.length === 0) {
      return res.status(200).json({ success: true, translations: {}, sourceLang: restaurant.source_language || 'en' })
    }

    const itemIds = items.map(i => i.id)

    // Fetch all translations in one query
    const { data: translations } = await supabaseAdmin
      .from('menu_item_translations')
      .select('item_id, lang')
      .in('item_id', itemIds)

    // Build map: { itemId: ['da', 'el', ...] }
    const map = {}
    for (const id of itemIds) map[id] = []
    ;(translations || []).forEach(t => {
      if (!map[t.item_id]) map[t.item_id] = []
      map[t.item_id].push(t.lang)
    })

    return res.status(200).json({
      success: true,
      sourceLang: restaurant.source_language || 'en',
      translations: map,  // { itemId: [existing langs] }
    })
  } catch (err) {
    console.error('list-translations error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}