// pages/api/get-translations.js
// Admin loads existing translations for a menu item.

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
    const { itemId } = req.query
    if (!itemId) return res.status(400).json({ success: false, error: 'Missing itemId' })

    const { data: item } = await supabaseAdmin
      .from('menu_items').select('id, restaurant_id, name, description').eq('id', itemId).single()
    if (!item || item.restaurant_id !== restaurant.id) {
      return res.status(403).json({ success: false, error: 'Item not in your restaurant' })
    }

    const { data: translations } = await supabaseAdmin
      .from('menu_item_translations')
      .select('lang, name, description')
      .eq('item_id', itemId)

    const map = {}
    ;(translations || []).forEach(t => {
      map[t.lang] = { name: t.name || '', description: t.description || '' }
    })

    return res.status(200).json({
      success: true,
      sourceLang: restaurant.source_language || 'en',
      sourceText: { name: item.name, description: item.description },
      translations: map,
    })
  } catch (err) {
    console.error('get-translations error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}