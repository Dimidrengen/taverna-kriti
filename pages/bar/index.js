import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LANGS = {
  el: { title:'Μπαρ', noOrders:'Δεν υπάρχουν ενεργές παραγγελίες', done:'✓ Έτοιμο', sending:'Στέλνεται…', drinks:'Ποτά', flowAll:'Όλα μαζί', flowSeq:'Ανά σειρά' },
  en: { title:'Bar', noOrders:'No active orders', done:'✓ Done', sending:'Sending…', drinks:'Drinks', flowAll:'All at once', flowSeq:'By course' },
  da: { title:'Bar', noOrders:'Ingen aktive ordrer', done:'✓ Færdig', sending:'Sender…', drinks:'Drikkevarer', flowAll:'Alt på én gang', flowSeq:'Kursvis' },
}

const BAR_COURSES = ['drinks']

function groupOrders(rows) {
  const map = {}
  for (const row of rows) {
    if (!BAR_COURSES.includes(row.course)) continue
    if (!map[row.order_id]) {
      map[row.order_id] = { order_id:row.order_id, table_label:row.table_label, flow_type:row.flow_type, created_at:row.created_at, lines:[] }
    }
    map[row.order_id].lines.push(row)
  }
  return Object.values(map).filter(o => o.lines.length > 0).sort((a,b) => new Date(a.created_at)-new Date(b.created_at))
}

export default function BarPage() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState({})
  const [lang, setLang]       = useState('el')
  const t = LANGS[lang]

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase.from('kitchen_active_orders').select('*')
    if (!error && data) setOrders(groupOrders(data))
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
    const channel = supabase.channel('bar-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, fetchOrders)
      .on('postgres_changes', { event:'*', schema:'public', table:'order_lines' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders])

  const markDone = async (orderId) => {
    setPending(p => ({ ...p, [orderId]: true }))
    try {
      await fetch('/api/course-done', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId, course:'drinks' }),
      })
    } catch(e) { console.error(e) }
    finally { setPending(p => { const n={...p}; delete n[orderId]; return n }) }
  }

  if (loading) return <div style={styles.center}><p style={{color:'#aaa',fontSize:18}}>{t.noOrders}</p></div>

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>🍹 {t.title}</span>
        <div style={{display:'flex',gap:8}}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding:'4px 12px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
              background: lang===l ? '#0ea5e9' : 'transparent',
              color: lang===l ? '#000' : '#888',
              border: lang===l ? 'none' : '1px solid #333',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <span style={{fontSize:14,color:'#6b7280'}}>{orders.length}</span>
      </header>

      {orders.length === 0
        ? <div style={styles.emptyWrap}><div style={{fontSize:64}}>🍹</div><p style={{color:'#aaa',fontSize:20,marginTop:16}}>{t.noOrders}</p></div>
        : <div style={styles.grid}>
            {orders.map(order => {
              const age = Math.floor((Date.now() - new Date(order.created_at)) / 60000)
              const isWaiting = pending[order.order_id]
              return (
                <div key={order.order_id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={styles.tableLabel}>{order.table_label}</span>
                    <span style={{fontSize:13,color:age>10?'#ef4444':'#9ca3af'}}>{age} min</span>
                    <span style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,
                      background:order.flow_type==='sequential'?'#1e3a5f':'#1a3a2a',
                      color:order.flow_type==='sequential'?'#7dd3fc':'#86efac'}}>
                      {order.flow_type==='sequential' ? t.flowSeq : t.flowAll}
                    </span>
                  </div>
                  <div style={styles.drinksLabel}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:'#0ea5e9',display:'inline-block',marginRight:8}}/>
                    <span style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'#0ea5e9'}}>{t.drinks}</span>
                  </div>
                  <div style={styles.lineList}>
                    {order.lines.map(line => (
                      <div key={line.line_id} style={styles.lineItem}>
                        <span style={{fontSize:14,color:'#6b7280',minWidth:24}}>{line.qty}×</span>
                        <span style={{fontSize:16}}>{line.name}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{padding:'0 16px 16px'}}>
                    <button
                      style={{width:'100%',padding:'10px 0',background:'transparent',
                        border:'1px solid #0ea5e9',borderRadius:8,fontSize:14,fontWeight:600,
                        color:'#0ea5e9',opacity:isWaiting?0.5:1,cursor:isWaiting?'wait':'pointer'}}
                      disabled={isWaiting}
                      onClick={() => markDone(order.order_id)}>
                      {isWaiting ? t.sending : t.done}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

const styles = {
  page:       {minHeight:'100dvh',background:'#0d0d0d',color:'#f1f1f1',fontFamily:'system-ui, sans-serif',paddingBottom:40},
  header:     {display:'flex',alignItems:'center',gap:16,padding:'20px 24px',borderBottom:'1px solid #222',position:'sticky',top:0,background:'#0d0d0d',zIndex:10},
  headerTitle:{fontSize:22,fontWeight:700,flex:1},
  grid:       {display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:16,padding:24},
  card:       {background:'#1a1a1a',borderRadius:14,border:'1px solid #2a2a2a',overflow:'hidden'},
  cardHeader: {display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid #222'},
  tableLabel: {fontSize:18,fontWeight:700,flex:1},
  drinksLabel:{display:'flex',alignItems:'center',padding:'12px 16px 4px'},
  lineList:   {padding:'4px 16px 12px',display:'flex',flexDirection:'column',gap:8},
  lineItem:   {display:'flex',gap:8,alignItems:'center'},
  emptyWrap:  {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'calc(100dvh - 73px)'},
  center:     {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',background:'#0d0d0d',color:'#f1f1f1'},
}