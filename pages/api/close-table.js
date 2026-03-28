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

  const { error } = await supabase
    .from('orders')
    .update({ status: 'done' })
    .eq('table_id', table.id)
    .eq('status', 'open')

  if (error) return res.status(500).json({ error: 'Kunne ikke lukke bordet' })

  return res.status(200).json({ success: true })
}