// pages/api/bulk-add-items.js
// Bulk insert menu items for the admin's restaurant.

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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
    const { items } = req.body || {}
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'No items provided' })
    }

    const validCategories = ['Starters', 'Salads', 'Mains', 'Sides', 'Desserts', 'Drinks']
    const validStations = ['kitchen', 'bar']

    const rows = items
      .filter(i => i && i.name)
      .map(i => ({
        restaurant_id: restaurant.id,
        name: String(i.name).trim().slice(0, 200),
        description: String(i.description || '').trim().slice(0, 1000),
        price: parseFloat(i.price) || 0,
        category: validCategories.includes(i.category) ? i.category : 'Mains',
        emoji: i.emoji || '🍽',
        station: validStations.includes(i.station) ? i.station : 'kitchen',
        available: true,
      }))

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid items' })
    }

    const { data, error } = await supabaseAdmin
      .from('menu_items').insert(rows).select('id')

    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }

    return res.status(200).json({ success: true, inserted: data?.length || 0 })
  } catch (err) {
    console.error('bulk-add-items error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}