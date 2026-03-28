import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const INITIAL_COURSES = {
  all_at_once: ['drinks', 'starters', 'mains', 'sides', 'salads'],
  sequential:  ['drinks'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { tableToken, note, lines, total, flowType = 'all_at_once' } = req.body

  const { data: table } = await supabase
    .from('tables')
    .select('*')
    .eq('token', tableToken)
    .single()

  if (!table) return res.status(404).json({ error: 'Table not found' })

  const { data: order } = await supabase
    .from('orders')
    .insert({
      table_id:       table.id,
      note,
      total,
      flow_type:      flowType,
      current_course: 'drinks',
      status:         'open',
    })
    .select()
    .single()

  if (!order) return res.status(500).json({ error: 'Kunne ikke oprette ordre' })

  const initialCourses = INITIAL_COURSES[flowType] || INITIAL_COURSES.all_at_once
  const now = new Date().toISOString()

  const orderLines = lines.map(line => ({
    order_id: order.id,
    item_id:  line.item_id || null,
    name:     line.name,
    qty:      line.qty,
    price:    line.price,
    station:  line.station,
    course:   line.course || 'mains',
    sent_at:  initialCourses.includes(line.course) ? now : null,
  }))

  const { error: linesError } = await supabase
    .from('order_lines')
    .insert(orderLines)

  if (linesError) {
    await supabase.from('orders').delete().eq('id', order.id)
    return res.status(500).json({ error: 'Kunne ikke oprette ordrelinjer' })
  }

  return res.status(200).json({ success: true, orderId: order.id })
}
