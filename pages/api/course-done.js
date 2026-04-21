import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { orderId, course } = req.body
  if (!orderId || !course) return res.status(400).json({ error: 'Missing orderId or course' })

  const now = new Date().toISOString()

  // Mark all lines in this course as done
  const { error: updateError } = await supabase
    .from('order_lines')
    .update({ kitchen_done_at: now })
    .eq('order_id', orderId)
    .eq('course', course)
    .is('kitchen_done_at', null)

  if (updateError) return res.status(500).json({ error: updateError.message })

  // Check if ALL lines for this order are done
  const { data: allLines } = await supabase
    .from('order_lines')
    .select('kitchen_done_at, sent_at')
    .eq('order_id', orderId)

  const allDone = allLines && allLines.length > 0 && 
    allLines.every(l => l.sent_at === null || l.kitchen_done_at !== null)

  // Get current order status
  const { data: order } = await supabase
    .from('orders')
    .select('guest_status')
    .eq('id', orderId)
    .single()

  // Update guest_status based on progress
  if (order) {
    let newStatus = order.guest_status
    if (allDone) {
      newStatus = 'ready'
    } else if (order.guest_status === 'received') {
      // First course marked done → change from received to preparing
      newStatus = 'preparing'
    }
    if (newStatus !== order.guest_status) {
      await supabase.from('orders').update({ guest_status: newStatus }).eq('id', orderId)
    }
  }

  return res.status(200).json({ success: true, allDone })
}