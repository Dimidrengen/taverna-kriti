import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const { tableToken } = req.query
  if (!tableToken) return res.status(400).json({ error: 'Missing tableToken' })

  const { data: table } = await supabase
    .from('tables')
    .select('id, name, token, restaurant_id, restaurants(show_live_status)')
    .eq('token', tableToken)
    .single()
  if (!table) return res.status(404).json({ error: 'Table not found' })

  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, note, flow_type, guest_count, order_number, guest_status, order_lines(id, name, qty, price, course, station, sent_at, kitchen_done_at, served_at)')
    .eq('table_id', table.id)
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  const allLines = []
  const orderSummaries = []
  let grandTotal = 0

  orders?.forEach(o => {
    const lines = o.order_lines || []
    const orderTotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
    grandTotal += orderTotal
    orderSummaries.push({
      id: o.id,
      order_number: o.order_number,
      guest_status: o.guest_status || 'received',
      created_at: o.created_at,
      total: orderTotal,
      item_count: lines.reduce((s, l) => s + l.qty, 0),
      lines: lines,
      note: o.note,
    })
    allLines.push(...lines)
  })

  return res.status(200).json({
    table: { id: table.id, name: table.name, token: table.token },
    showLiveStatus: table.restaurants?.show_live_status || false,
    orders: orderSummaries,
    grandTotal,
    itemCount: allLines.reduce((s, l) => s + l.qty, 0),
  })
}