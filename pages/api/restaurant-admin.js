import { createClient } from '@supabase/supabase-js'

const PLAN_TABLE_LIMITS = { trial: 15, basic: 15, pro: 50, enterprise: 9999 }

function extractSlugFromEmail(email) {
  const match = email.match(/^(admin|kitchen|bar)@(.+)\.com$/i)
  return match ? match[2] : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Server not configured' })

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    // Verify admin user via JWT token
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Missing auth' })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Invalid auth' })

    // Only admin@ users can manage tables/passwords
    if (!user.email.startsWith('admin@')) return res.status(403).json({ error: 'Admin access required' })

    const slug = extractSlugFromEmail(user.email)
    if (!slug) return res.status(400).json({ error: 'Invalid email format' })

    const { data: restaurant } = await supabaseAdmin
      .from('restaurants').select('*').eq('slug', slug).single()
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' })
    if (!restaurant.active) return res.status(403).json({ error: 'Restaurant is suspended' })

    const { action } = req.body

    // === TABLE MANAGEMENT ===

    if (action === 'add_table') {
      const { name } = req.body
      if (!name) return res.status(400).json({ error: 'Table name required' })

      // Check plan limit
      const { count } = await supabaseAdmin.from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id)
        .eq('active', true)
      const limit = PLAN_TABLE_LIMITS[restaurant.plan] || 15
      if (count >= limit) {
        return res.status(400).json({ error: `Plan ${restaurant.plan} allows max ${limit} tables. Upgrade to add more.`, planLimitReached: true })
      }

      // Generate unique token
      const { data: existingTokens } = await supabaseAdmin.from('tables').select('token').eq('restaurant_id', restaurant.id)
      let nextNum = 1
      const existingNums = (existingTokens || []).map(t => {
        const m = t.token.match(/-tbl-(\d+)$/)
        return m ? parseInt(m[1]) : 0
      })
      nextNum = Math.max(0, ...existingNums) + 1
      const padded = String(nextNum).padStart(3, '0')
      const token = `${slug}-tbl-${padded}`

      const { data: newTable, error } = await supabaseAdmin.from('tables')
        .insert({ restaurant_id: restaurant.id, name, token, active: true, position: nextNum })
        .select().single()
      if (error) return res.status(500).json({ error: error.message })

      return res.status(200).json({ success: true, table: newTable })
    }

    if (action === 'rename_table') {
      const { tableId, name } = req.body
      if (!tableId || !name) return res.status(400).json({ error: 'Missing fields' })

      // Verify table belongs to this restaurant
      const { data: table } = await supabaseAdmin.from('tables').select('*').eq('id', tableId).single()
      if (!table || table.restaurant_id !== restaurant.id) return res.status(403).json({ error: 'Not your table' })

      const { error } = await supabaseAdmin.from('tables').update({ name }).eq('id', tableId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    if (action === 'toggle_table_active') {
      const { tableId } = req.body
      const { data: table } = await supabaseAdmin.from('tables').select('*').eq('id', tableId).single()
      if (!table || table.restaurant_id !== restaurant.id) return res.status(403).json({ error: 'Not your table' })

      const { error } = await supabaseAdmin.from('tables').update({ active: !table.active }).eq('id', tableId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true, active: !table.active })
    }

    if (action === 'delete_table') {
      const { tableId } = req.body
      const { data: table } = await supabaseAdmin.from('tables').select('*').eq('id', tableId).single()
      if (!table || table.restaurant_id !== restaurant.id) return res.status(403).json({ error: 'Not your table' })

      // Check if table has any orders
      const { count: orderCount } = await supabaseAdmin.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('table_id', tableId)

      if (orderCount > 0) {
        // Can't delete - soft delete instead
        await supabaseAdmin.from('tables').update({ active: false }).eq('id', tableId)
        return res.status(200).json({ success: true, softDelete: true, message: 'Table has history, deactivated instead' })
      }

      const { error } = await supabaseAdmin.from('tables').delete().eq('id', tableId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // === PASSWORD MANAGEMENT ===

    if (action === 'change_password') {
      const { role, newPassword } = req.body
      if (!['admin', 'kitchen', 'bar'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
      if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

      const targetEmail = `${role}@${slug}.com`

      // Find user by email
      const { data: users } = await supabaseAdmin.auth.admin.listUsers()
      const targetUser = users?.users?.find(u => u.email === targetEmail)
      if (!targetUser) return res.status(404).json({ error: `User ${targetEmail} not found` })

      // Update password
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, { password: newPassword })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ success: true, email: targetEmail })
    }

    return res.status(400).json({ error: 'Unknown action: ' + action })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Unknown error: ' + err.message })
  }
}