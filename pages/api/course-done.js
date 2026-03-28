import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { orderId, course } = req.body

  if (!orderId || !course) {
    return res.status(400).json({ error: 'orderId og course er påkrævet' })
  }

  const { error } = await supabase.rpc('mark_course_done', {
    p_order_id: orderId,
    p_course:   course,
  })

  if (error) {
    console.error('mark_course_done fejl:', error)
    return res.status(500).json({ error: 'Kunne ikke markere kursus færdigt' })
  }

  return res.status(200).json({ success: true })
}