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
    .select('*')
    .eq('token', tableToken)
    .single()

  if (!table) return res.status(404).json({ error: 'Table not found' })

  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, total, note, status')
    .eq('table_id', table.id)
    .eq('status', 'open')
    .order('created_at')

  if (!orders || orders.length === 0) {
    return res.status(200).json({ orders: [], grandTotal: 0 })
  }

  const orderIds = orders.map(o => o.id)

  const { data: lines } = await supabase
    .from('order_lines')
    .select('order_id, name, qty, price')
    .in('order_id', orderIds)

  const ordersWithLines = orders.map(order => ({
    ...order,
    lines: lines.filter(l => l.order_id === order.id)
  }))

  const grandTotal = ordersWithLines.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.price * l.qty, 0), 0)

  return res.status(200).json({ orders: ordersWithLines, grandTotal, tableName: table.name })
}