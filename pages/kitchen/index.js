import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COURSE_LABEL = {
  drinks:   'Drikkevarer',
  starters: 'Forretter',
  mains:    'Hovedretter',
  sides:    'Tilbehør',
  salads:   'Salater',
  dessert:  'Dessert',
}

const COURSE_COLOR = {
  drinks:   '#0ea5e9',
  starters: '#f59e0b',
  mains:    '#ef4444',
  sides:    '#8b5cf6',
  salads:   '#22c55e',
  dessert:  '#ec4899',
}

function groupOrders(rows) {
  const map = {}
  for (const row of rows) {
    if (!map[row.order_id]) {
      map[row.order_id] = {
        order_id:    row.order_id,
        table_label: row.table_label,
        flow_type:   row.flow_type,
        created_at:  row.created_at,
        courses:     {},
      }
    }
    const c = row.course || 'mains'
    if (!map[row.order_id].courses[c]) map[row.order_id].courses[c] = []
    map[row.order_id].courses[c].push(row)
  }
  return Object.values(map).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )
}

export default function KitchenPage() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState({})

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('kitchen_active_orders')
      .select('*')
    if (!error && data) setOrders(groupOrders(data))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('kitchen-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_lines' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders])

  const markDone = async (orderId, course) => {
    const key = `${orderId}-${course}`
    setPending(p => ({ ...p, [key]: true }))
    try {
      await fetch('/api/course-done', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId, course }),
      })
    } catch (e) {
      console.error(e)
    } finally {
      setPending(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  if (loading) return (
    <div style={styles.center}>
      <p style={{ color: '#aaa', fontSize: 18 }}>Henter ordrer…</p>
    </div>
  )

  if (orders.length === 0) return (
    <div style={styles.center}>
      <div style={{ fontSize: 64 }}>🍽</div>
      <p style={{ color: '#aaa', fontSize: 20, marginTop: 16 }}>Ingen aktive ordrer</p>
    </div>
  )

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>Køkken</span>
        <span style={{ fontSize: 14, color: '#6b7280' }}>{orders.length} aktive</span>
      </header>
      <div style={styles.grid}>
        {orders.map(order => (
          <OrderCard key={order.order_id} order={order} pending={pending} onMarkDone={markDone} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order, pending, onMarkDone }) {
  const age = Math.floor((Date.now() - new Date(order.created_at)) / 60000)
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.tableLabel}>{order.table_label}</span>
        <span style={{ fontSize: 13, color: age > 20 ? '#ef4444' : '#9ca3af' }}>{age} min</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
          background: order.flow_type === 'sequential' ? '#1e3a5f' : '#1a3a2a',
          color:      order.flow_type === 'sequential' ? '#7dd3fc' : '#86efac',
        }}>
          {order.flow_type === 'sequential' ? 'Kursvis' : 'Alt på én gang'}
        </span>
      </div>
      {Object.entries(order.courses).map(([course, lines]) => {
        const key = `${order.order_id}-${course}`
        const color = COURSE_COLOR[course] || '#888'
        return (
          <div key={course} style={styles.courseBlock}>
            <div style={styles.courseHeader}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', marginRight: 8 }} />
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color }}>{COURSE_LABEL[course]}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {lines.map(line => (
                <li key={line.line_id} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 16 }}>
                  <span style={{ fontSize: 14, color: '#6b7280', minWidth: 24 }}>{line.qty}×</span>
                  <span>{line.name}</span>
                </li>
              ))}
            </ul>
            <button
              style={{ marginTop: 12, width: '100%', padding: '10px 0', background: 'transparent',
                border: `1px solid ${color}`, borderRadius: 8, fontSize: 14, fontWeight: 600,
                color, opacity: pending[key] ? 0.5 : 1, cursor: pending[key] ? 'wait' : 'pointer' }}
              disabled={pending[key]}
              onClick={() => onMarkDone(order.order_id, course)}
            >
              {pending[key] ? 'Sender…' : '✓ Færdig'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  page:        { minHeight: '100dvh', background: '#0d0d0d', color: '#f1f1f1', fontFamily: 'system-ui, sans-serif', paddingBottom: 40 },
  header:      { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid #222', position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 10 },
  headerTitle: { fontSize: 22, fontWeight: 700, flex: 1 },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, padding: 24 },
  card:        { background: '#1a1a1a', borderRadius: 14, border: '1px solid #2a2a2a', overflow: 'hidden' },
  cardHeader:  { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #222' },
  tableLabel:  { fontSize: 18, fontWeight: 700, flex: 1 },
  courseBlock: { padding: '14px 16px', borderBottom: '1px solid #222' },
  courseHeader:{ display: 'flex', alignItems: 'center', marginBottom: 10 },
  center:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: '#0d0d0d', color: '#f1f1f1' },
}