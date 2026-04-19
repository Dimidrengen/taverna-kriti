import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tableToken } = req.body
  if (!tableToken) return res.status(400).json({ error: 'Missing tableToken' })

  const { data: table } = await supabase
    .from('tables')
    .select('*')
    .eq('token', tableToken)
    .single()

  if (!table) return res.status(404).json({ error: 'Table not found' })

  // Hent åbne ordrer før vi lukker så vi kan beregne metrics
  const { data: openOrders } = await supabase
    .from('orders')
    .select('id, created_at, guest_count, order_lines(qty, price)')
    .eq('table_id', table.id)
    .eq('status', 'open')

  const { error } = await supabase
    .from('orders')
    .update({ status: 'done' })
    .eq('table_id', table.id)
    .eq('status', 'open')

  if (error) return res.status(500).json({ error: 'Kunne ikke lukke bordet' })

  // === ANALYTICS EVENTS ===
  if (openOrders && openOrders.length > 0) {
    const firstOrder = openOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
    const totalAmount = openOrders.reduce((s, o) =>
      s + (o.order_lines || []).reduce((ls, l) => ls + l.price * l.qty, 0), 0)
    const totalItems = openOrders.reduce((s, o) =>
      s + (o.order_lines || []).reduce((ls, l) => ls + l.qty, 0), 0)
    const durationMinutes = Math.round((Date.now() - new Date(firstOrder.created_at).getTime()) / 60000)
    const guestCount = openOrders[0]?.guest_count || null

    await supabase.from('analytics_events').insert({
      restaurant_id: table.restaurant_id,
      event_type: 'table_closed',
      table_id: table.id,
      event_data: {
        total_amount: totalAmount,
        total_items: totalItems,
        order_count: openOrders.length,
        duration_minutes: durationMinutes,
        guest_count: guestCount,
        avg_per_guest: guestCount ? +(totalAmount / guestCount).toFixed(2) : null,
      }
    })
  }

  return res.status(200).json({ success: true })
}