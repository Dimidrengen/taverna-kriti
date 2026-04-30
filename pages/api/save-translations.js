// pages/api/save-translations.js
// Admin saves manual translations (overrides) for a menu item.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ALL_LANGS = ['en', 'da', 'de', 'el', 'fr', 'sv', 'no', 'fi']

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
    .from('restaurants').select('id').eq('slug', slug).single()
  if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' })

  try {
    const { itemId, translations } = req.body || {}
    if (!itemId || !translations) {
      return res.status(400).json({ success: false, error: 'Missing data' })
    }

    // Verify item belongs to this admin's restaurant
    const { data: item } = await supabaseAdmin
      .from('menu_items').select('id, restaurant_id').eq('id', itemId).single()
    if (!item || item.restaurant_id !== restaurant.id) {
      return res.status(403).json({ success: false, error: 'Item not in your restaurant' })
    }

    // Upsert each translation
    for (const [lang, t] of Object.entries(translations)) {
      if (!ALL_LANGS.includes(lang)) continue
      const name = (t.name || '').trim()
      const description = (t.description || '').trim()

      // If both fields empty, delete the row instead of saving empty translation
      if (!name && !description) {
        await supabaseAdmin
          .from('menu_item_translations')
          .delete()
          .eq('item_id', itemId)
          .eq('lang', lang)
        continue
      }

      await supabaseAdmin.from('menu_item_translations').upsert({
        item_id: itemId,
        lang,
        name,
        description,
      }, { onConflict: 'item_id,lang' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('save-translations error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}