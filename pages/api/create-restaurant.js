import { createClient } from '@supabase/supabase-js'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 12; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length))
  return pw
}

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured — missing Supabase credentials' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'Missing auth' })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) return res.status(401).json({ error: 'Invalid auth' })

    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins').select('*').eq('email', user.email).single()
    if (!superAdmin) return res.status(403).json({ error: 'Not a super admin' })

    const {
      name, ownerName, ownerEmail, phone, address, city, country,
      plan = 'trial', tableCount = 10, currency = 'EUR', timezone = 'Europe/Athens',
    } = req.body

    if (!name || !ownerEmail) return res.status(400).json({ error: 'Missing required fields' })

    const slug = slugify(name)

    const { data: existing } = await supabaseAdmin.from('restaurants').select('id').eq('slug', slug).maybeSingle()
    if (existing) return res.status(400).json({ error: `Restaurant with slug "${slug}" already exists` })

    const { data: restaurant, error: restError } = await supabaseAdmin
      .from('restaurants')
      .insert({
        name, slug, owner_email: ownerEmail, owner_name: ownerName,
        phone, address, city, country, plan, currency, timezone,
        active: true,
      })
      .select().single()

    if (restError) return res.status(500).json({ error: 'Could not create restaurant: ' + restError.message })

    const tablesToInsert = []
    for (let i = 1; i <= tableCount; i++) {
      const padded = String(i).padStart(3, '0')
      tablesToInsert.push({
        restaurant_id: restaurant.id,
        name: `Table ${i}`,
        token: `${slug}-tbl-${padded}`,
      })
    }
    const { error: tablesError } = await supabaseAdmin.from('tables').insert(tablesToInsert)
    if (tablesError) {
      await supabaseAdmin.from('restaurants').delete().eq('id', restaurant.id)
      return res.status(500).json({ error: 'Could not create tables: ' + tablesError.message })
    }

    const planPrices = { trial: 0, basic: 29, pro: 79, enterprise: 199 }
    await supabaseAdmin.from('subscriptions').insert({
      restaurant_id: restaurant.id,
      plan,
      status: 'active',
      price_monthly: planPrices[plan] || 0,
    })

    const adminPassword = generatePassword()
    const kitchenPassword = generatePassword()
    const barPassword = generatePassword()
    const adminEmail = `admin@${slug}.com`
    const kitchenEmail = `kitchen@${slug}.com`
    const barEmail = `bar@${slug}.com`

    const users = [
      { email: adminEmail, password: adminPassword },
      { email: kitchenEmail, password: kitchenPassword },
      { email: barEmail, password: barPassword },
    ]

    for (const u of users) {
      await supabaseAdmin.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
      })
    }

    return res.status(200).json({
      success: true,
      restaurant,
      credentials: {
        admin: { email: adminEmail, password: adminPassword },
        kitchen: { email: kitchenEmail, password: kitchenPassword },
        bar: { email: barEmail, password: barPassword },
      },
      tableCount,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Unknown error: ' + err.message })
  }
}