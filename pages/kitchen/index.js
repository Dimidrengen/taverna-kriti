import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LANGS = {
  el: { title:'Κουζίνα', noOrders:'Δεν υπάρχουν ενεργές παραγγελίες', done:'✓ Έτοιμο', sending:'Στέλνεται…', courses:{ starters:'Ορεκτικά', mains:'Κυρίως', sides:'Συνοδευτικά', salads:'Σαλάτες', dessert:'Επιδόρπια' }, flowAll:'Όλα μαζί', flowSeq:'Ανά σειρά', tableWord:'Τραπέζι' },
  en: { title:'Kitchen', noOrders:'No active orders', done:'✓ Done', sending:'Sending…', courses:{ starters:'Starters', mains:'Mains', sides:'Sides', salads:'Salads', dessert:'Dessert' }, flowAll:'All at once', flowSeq:'By course', tableWord:'Table' },
  da: { title:'Køkken', noOrders:'Ingen aktive ordrer', done:'✓ Færdig', sending:'Sender…', courses:{ starters:'Forretter', mains:'Hovedretter', sides:'Tilbehør', salads:'Salater', dessert:'Dessert' }, flowAll:'Alt på én gang', flowSeq:'Kursvis', tableWord:'Bord' },
}

const COURSE_COLOR = { starters:'#f59e0b', mains:'#ef4444', sides:'#8b5cf6', salads:'#22c55e', dessert:'#ec4899' }
const KITCHEN_COURSES = ['starters','mains','sides','salads','dessert']

function getTableLabel(name, tableWord) {
  if (!name) return name
  return name.replace(/^Table /i, tableWord + ' ').replace(/^Bord /i, tableWord + ' ').replace(/^Τραπέζι /i, tableWord + ' ')
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Copenhagen',
  })
}

function formatAge(dateStr) {
  const age = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  return Math.max(0, age)
}

function groupOrders(rows, translations) {
  const map = {}
  for (const row of rows) {
    if (!KITCHEN_COURSES.includes(row.course)) continue
    if (!map[row.order_id]) {
      map[row.order_id] = { order_id:row.order_id, table_label:row.table_label, flow_type:row.flow_type, created_at:row.created_at, order_note:row.order_note, courses:{} }
    }
    if (!map[row.order_id].courses[row.course]) map[row.order_id].courses[row.course] = []
    const translatedName = translations[row.item_id] || row.name
    map[row.order_id].courses[row.course].push({ ...row, name: translatedName })
  }
  return Object.values(map).filter(o => Object.keys(o.courses).length > 0).sort((a,b) => new Date(a.created_at)-new Date(b.created_at))
}

export default function KitchenPage() {
  const [orders, setOrders]      = useState([])
  const [loading, setLoading]    = useState(true)
  const [pending, setPending]    = useState({})
  const [served, setServed]      = useState({})
  const [lang, setLang]          = useState('el')
  const [translations, setTrans] = useState({})
  const [tick, setTick]          = useState(0)
  const t = LANGS[lang]

  useEffect(() => {
    const interval = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchTranslations = useCallback(async (l) => {
    const { data } = await supabase.from('menu_item_translations').select('item_id, name').eq('lang', l)
    if (data) {
      const map = {}
      data.forEach(r => { map[r.item_id] = r.name })
      setTrans(map)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase.from('kitchen_active_orders').select('*')
    if (!error && data) setOrders(groupOrders(data, translations))
    setLoading(false)
  }, [translations])

  useEffect(() => { fetchTranslations(lang) }, [lang])
  useEffect(() => { fetchOrders() }, [translations])

  useEffect(() => {
    const channel = supabase.channel('kitchen-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, fetchOrders)
      .on('postgres_changes', { event:'*', schema:'public', table:'order_lines' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders])

  const changeLang = (l) => {
    setLang(l)
    fetchTranslations(l).then(() => fetchOrders())
  }

  const markDone = async (orderId, course) => {
    const key = `${orderId}-${course}`
    setPending(p => ({ ...p, [key]: true }))
    try {
      await fetch('/api/course-done', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId, course }),
      })
    } catch(e) { console.error(e) }
    finally { setPending(p => { const n={...p}; delete n[key]; return n }) }
  }

  const toggleServed = async (lineId) => {
    const isServed = !!served[lineId]
    setServed(p => ({ ...p, [lineId]: !isServed }))
    await supabase.from('order_lines')
      .update({ served_at: isServed ? null : new Date().toISOString() })
      .eq('id', lineId)
  }

  if (loading) return <div style={styles.center}><p style={{color:'#aaa',fontSize:18}}>{t.noOrders}</p></div>

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>🍳 {t.title}</span>
        <div style={{display:'flex',gap:8}}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{
              padding:'4px 12px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
              background: lang===l ? '#f59e0b' : 'transparent',
              color: lang===l ? '#000' : '#888',
              border: lang===l ? 'none' : '1px solid #333',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <span style={{fontSize:14,color:'#6b7280'}}>{orders.length}</span>
      </header>

      {orders.length === 0
        ? <div style={styles.emptyWrap}><div style={{fontSize:64}}>🍳</div><p style={{color:'#aaa',fontSize:20,marginTop:16}}>{t.noOrders}</p></div>
        : <div style={styles.grid}>
            {orders.map(order => (
              <OrderCard
                key={order.order_id + '-' + tick}
                order={order}
                pending={pending}
                served={served}
                onMarkDone={markDone}
                onToggleServed={toggleServed}
                t={t}
              />
            ))}
          </div>
      }
    </div>
  )
}

function OrderCard({ order, pending, served, onMarkDone, onToggleServed, t }) {
  const age = formatAge(order.created_at)
  const time = formatTime(order.created_at)
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.tableLabel}>{getTableLabel(order.table_label, t.tableWord)}</span>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
          <span style={{fontSize:14,fontWeight:600,color:'#f1f1f1'}}>{time}</span>
          <span style={{fontSize:12,color:age>20?'#ef4444':'#9ca3af'}}>{age} min</span>
        </div>
        <span style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,
          background:order.flow_type==='sequential'?'#1e3a5f':'#1a3a2a',
          color:order.flow_type==='sequential'?'#7dd3fc':'#86efac'}}>
          {order.flow_type==='sequential' ? t.flowSeq : t.flowAll}
        </span>
      </div>
      {order.order_note && (
        <div style={{padding:'10px 16px',background:'#1f1a0e',borderBottom:'1px solid #333',fontSize:13,color:'#f59e0b',fontStyle:'italic',display:'flex',gap:6,alignItems:'flex-start'}}>
          <span>📝</span><span>{order.order_note}</span>
        </div>
      )}
      {Object.entries(order.courses).map(([course, lines]) => {
        const key = `${order.order_id}-${course}`
        const color = COURSE_COLOR[course] || '#888'
        return (
          <div key={course} style={styles.courseBlock}>
            <div style={styles.courseHeader}>
              <span style={{width:8,height:8,borderRadius:'50%',background:color,display:'inline-block',marginRight:8}}/>
              <span style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color}}>
                {t.courses[course] || course}
              </span>
            </div>
            <ul style={{listStyle:'none',margin:0,padding:0,display:'flex',flexDirection:'column',gap:6}}>
              {lines.map(line => {
                const isServed = !!served[line.line_id]
                return (
                  <li key={line.line_id} style={{display:'flex',gap:8,padding:'4px 0',fontSize:16,alignItems:'center',opacity:isServed?0.4:1,transition:'opacity 0.2s'}}>
                    <span style={{fontSize:14,color:'#6b7280',minWidth:24}}>{line.qty}×</span>
                    <span style={{flex:1,textDecoration:isServed?'line-through':'none'}}>{line.name}</span>
                    <button
                      onClick={() => onToggleServed(line.line_id)}
                      style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',fontSize:16,flexShrink:0,
                        background: isServed ? '#22c55e' : '#2a2a2a',
                        color: isServed ? 'white' : '#555',
                      }}>✓</button>
                  </li>
                )
              })}
            </ul>
            <button
              style={{marginTop:12,width:'100%',padding:'10px 0',background:'transparent',
                border:`1px solid ${color}`,borderRadius:8,fontSize:14,fontWeight:600,
                color,opacity:pending[key]?0.5:1,cursor:pending[key]?'wait':'pointer'}}
              disabled={pending[key]}
              onClick={() => onMarkDone(order.order_id, course)}>
              {pending[key] ? t.sending : t.done}
            </button>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  page:        {minHeight:'100dvh',background:'#0d0d0d',color:'#f1f1f1',fontFamily:'system-ui, sans-serif',paddingBottom:40},
  header:      {display:'flex',alignItems:'center',gap:16,padding:'20px 24px',borderBottom:'1px solid #222',position:'sticky',top:0,background:'#0d0d0d',zIndex:10},
  headerTitle: {fontSize:22,fontWeight:700,flex:1},
  grid:        {display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:16,padding:24},
  card:        {background:'#1a1a1a',borderRadius:14,border:'1px solid #2a2a2a',overflow:'hidden'},
  cardHeader:  {display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid #222'},
  tableLabel:  {fontSize:18,fontWeight:700,flex:1},
  courseBlock: {padding:'14px 16px',borderBottom:'1px solid #222'},
  courseHeader:{display:'flex',alignItems:'center',marginBottom:10},
  emptyWrap:   {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'calc(100dvh - 73px)'},
  center:      {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',background:'#0d0d0d',color:'#f1f1f1'},
}