import { createClient } from '@supabase/supabase-js'

function extractSlugFromEmail(email) {
  const match = email.match(/^(admin|kitchen|bar)@(.+)\.com$/i)
  return match ? match[2] : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server not configured' })

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Verify user
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Missing auth' })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Invalid auth' })
    if (!user.email.match(/^(admin|kitchen|bar)@/)) return res.status(403).json({ error: 'Access denied' })

    const slug = extractSlugFromEmail(user.email)
    if (!slug) return res.status(400).json({ error: 'Invalid email' })
    const { data: restaurant } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })

    const { orderId, newStatus } = req.body
    if (!orderId || !newStatus) return res.status(400).json({ error: 'Missing fields' })
    if (!['received','preparing','ready','delivered'].includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    // Verify order belongs to this restaurant
    const { data: order } = await supabase
      .from('orders')
      .select('id, table_id, tables(restaurant_id)')
      .eq('id', orderId)
      .single()
    if (!order || order.tables?.restaurant_id !== restaurant.id) {
      return res.status(403).json({ error: 'Not your order' })
    }

    // Update guest_status
    const { error } = await supabase
      .from('orders')
      .update({ guest_status: newStatus })
      .eq('id', orderId)
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ success: true, newStatus })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}