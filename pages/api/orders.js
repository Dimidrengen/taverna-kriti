import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { tableToken, note, lines, total } = req.body

  // Find bordet via token
  const { data: table } = await supabase
    .from('tables')
    .select('*')
    .eq('token', tableToken)
    .single()

  if (!table) {
    return res.status(404).json({ error: 'Table not found' })
  }

  // Opret ordren
  const { data: order } = await supabase
    .from('orders')
    .insert({ table_id: table.id, note, total })
    .select()
    .single()

  // Opret ordrelinjer
  const orderLines = lines.map(line => ({
    order_id: order.id,
    item_id: null,
    name: line.name,
    qty: line.qty,
    price: line.price,
    station: line.station
  }))

  await supabase.from('order_lines').insert(orderLines)

  res.status(200).json({ success: true, orderId: order.id })
}
