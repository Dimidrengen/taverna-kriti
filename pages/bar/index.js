import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LANGS = {
  el: { title:'Μπαρ', noOrders:'Δεν υπάρχουν ενεργές παραγγελίες', done:'✓ Έτοιμο', sending:'Στέλνεται…', drinks:'Ποτά', flowAll:'Όλα μαζί', flowSeq:'Ανά σειρά', closeTable:'Κλείσιμο & Πληρωμή', closing:'Κλείνει…', bill:'Λογαριασμός', total:'Σύνολο' },
  en: { title:'Bar', noOrders:'No active orders', done:'✓ Done', sending:'Sending…', drinks:'Drinks', flowAll:'All at once', flowSeq:'By course', closeTable:'Close & Payment', closing:'Closing…', bill:'Bill', total:'Total' },
  da: { title:'Bar', noOrders:'Ingen aktive ordrer', done:'✓ Færdig', sending:'Sender…', drinks:'Drikkevarer', flowAll:'Alt på én gang', flowSeq:'Kursvis', closeTable:'Luk & Betal', closing:'Lukker…', bill:'Regning', total:'Total' },
}

function groupByTable(rows, translations) {
  const map = {}
  for (const row of rows) {
    const key = row.table_token
    if (!map[key]) {
      map[key] = { table_label:row.table_label, table_token:row.table_token, orders:{} }
    }
    if (!map[key].orders[row.order_id]) {
      map[key].orders[row.order_id] = { order_id:row.order_id, flow_type:row.flow_type, created_at:row.created_at, drinks:[] }
    }
    if (row.course === 'drinks') {
      const translatedName = translations[row.item_id] || row.name
      map[key].orders[row.order_id].drinks.push({ ...row, name: translatedName })
    }
  }
  return Object.values(map).filter(t => Object.values(t.orders).some(o => o.drinks.length > 0))
    .sort((a,b) => {
      const aTime = Math.min(...Object.values(a.orders).map(o => new Date(o.created_at)))
      const bTime = Math.min(...Object.values(b.orders).map(o => new Date(o.created_at)))
      return aTime - bTime
    })
}

export default function BarPage() {
  const [tables, setTables]      = useState([])
  const [loading, setLoading]    = useState(true)
  const [pending, setPending]    = useState({})
  const [closing, setClosing]    = useState({})
  const [bills, setBills]        = useState({})
  const [lang, setLang]          = useState('el')
  const [translations, setTrans] = useState({})
  const t = LANGS[lang]

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
    if (!error && data) setTables(groupByTable(data, translations))
    setLoading(false)
  }, [translations])

  useEffect(() => { fetchTranslations(lang) }, [lang])
  useEffect(() => { fetchOrders() }, [translations])

  useEffect(() => {
    const channel = supabase.channel('bar-realtime')
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, fetchOrders)
      .on('postgres_changes', { event:'*', schema:'public', table:'order_lines' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders])

  const changeLang = (l) => {
    setLang(l)
    fetchTranslations(l).then(() => fetchOrders())
  }

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

  const fetchBill = async (tableToken) => {
    const shown = bills[tableToken]
    if (shown) { setBills(p => { const n={...p}; delete n[tableToken]; return n }); return }
    const res = await fetch(`/api/table-bill?tableToken=${tableToken}`)
    const data = await res.json()
    setBills(p => ({ ...p, [tableToken]: data }))
  }

  const closeTable = async (tableToken, tableLabel) => {
    if (!confirm(`Luk ${tableLabel} og marker som betalt?`)) return
    setClosing(p => ({ ...p, [tableToken]: true }))
    try {
      await fetch('/api/close-table', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tableToken }),
      })
      setBills(p => { const n={...p}; delete n[tableToken]; return n })
    } catch(e) { console.error(e) }
    finally { setClosing(p => { const n={...p}; delete n[tableToken]; return n }) }
  }

  if (loading) return <div style={styles.center}><p style={{color:'#aaa',fontSize:18}}>{t.noOrders}</p></div>

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>🍹 {t.title}</span>
        <div style={{display:'flex',gap:8}}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{
              padding:'4px 12px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
              background: lang===l ? '#0ea5e9' : 'transparent',
              color: lang===l ? '#000' : '#888',
              border: lang===l ? 'none' : '1px solid #333',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <span style={{fontSize:14,color:'#6b7280'}}>{tables.length}</span>
      </header>

      {tables.length === 0
        ? <div style={styles.emptyWrap}><div style={{fontSize:64}}>🍹</div><p style={{color:'#aaa',fontSize:20,marginTop:16}}>{t.noOrders}</p></div>
        : <div style={styles.grid}>
            {tables.map(table => {
              const bill = bills[table.table_token]
              const isClosing = closing[table.table_token]
              const allOrders = Object.values(table.orders)
              const firstTime = Math.min(...allOrders.map(o => new Date(o.created_at)))
              const age = Math.floor((Date.now() - firstTime) / 60000)

              return (
                <div key={table.table_token} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={styles.tableLabel}>{table.table_label}</span>
                    <span style={{fontSize:13,color:age>30?'#ef4444':'#9ca3af'}}>{age} min</span>
                  </div>

                  {/* Drikkevarer per ordre */}
                  {allOrders.filter(o => o.drinks.length > 0).map(order => (
                    <div key={order.order_id} style={styles.drinkBlock}>
                      <div style={styles.drinksLabel}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:'#0ea5e9',display:'inline-block',marginRight:8}}/>
                        <span style={{fontSize:13,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'#0ea5e9'}}>{t.drinks}</span>
                      </div>
                      <div style={styles.lineList}>
                        {order.drinks.map(line => (
                          <div key={line.line_id} style={styles.lineItem}>
                            <span style={{fontSize:14,color:'#6b7280',minWidth:24}}>{line.qty}×</span>
                            <span style={{fontSize:16}}>{line.name}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{padding:'0 16px 12px'}}>
                        <button
                          style={{width:'100%',padding:'10px 0',background:'transparent',
                            border:'1px solid #0ea5e9',borderRadius:8,fontSize:14,fontWeight:600,
                            color:'#0ea5e9',opacity:pending[order.order_id]?0.5:1,cursor:pending[order.order_id]?'wait':'pointer'}}
                          disabled={pending[order.order_id]}
                          onClick={() => markDone(order.order_id)}>
                          {pending[order.order_id] ? t.sending : t.done}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Regning */}
                  {bill && (
                    <div style={{padding:'12px 16px',borderTop:'1px solid #222'}}>
                      <div style={{fontSize:12,color:'#6b7280',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>{t.bill}</div>
                      {bill.orders && bill.orders.map(o => o.lines.map(l => (
                        <div key={l.name+l.qty} style={{display:'flex',justifyContent:'space-between',fontSize:14,padding:'2px 0',color:'#ccc'}}>
                          <span>{l.qty}× {l.name}</span>
                          <span>€{(l.price*l.qty).toFixed(2)}</span>
                        </div>
                      )))}
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:700,color:'white',marginTop:8,paddingTop:8,borderTop:'1px solid #333'}}>
                        <span>{t.total}</span>
                        <span>€{bill.grandTotal?.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Knapper */}
                  <div style={{padding:'12px 16px',display:'flex',gap:8}}>
                    <button
                      onClick={() => fetchBill(table.table_token)}
                      style={{flex:1,padding:'10px 0',background:'transparent',border:'1px solid #444',borderRadius:8,fontSize:14,fontWeight:600,color:'#aaa',cursor:'pointer'}}>
                      {bill ? '▲ Skjul' : `📋 ${t.bill}`}
                    </button>
                    <button
                      onClick={() => closeTable(table.table_token, table.table_label)}
                      disabled={isClosing}
                      style={{flex:1,padding:'10px 0',background:'transparent',border:'1px solid #dc2626',borderRadius:8,fontSize:14,fontWeight:600,color:'#dc2626',opacity:isClosing?0.5:1,cursor:isClosing?'wait':'pointer'}}>
                      {isClosing ? t.closing : t.closeTable}
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
  grid:       {display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:16,padding:24},
  card:       {background:'#1a1a1a',borderRadius:14,border:'1px solid #2a2a2a',overflow:'hidden'},
  cardHeader: {display:'flex',alignItems:'center',gap:10,padding:'14px 16px',borderBottom:'1px solid #222'},
  tableLabel: {fontSize:18,fontWeight:700,flex:1},
  drinkBlock: {borderBottom:'1px solid #222'},
  drinksLabel:{display:'flex',alignItems:'center',padding:'12px 16px 4px'},
  lineList:   {padding:'4px 16px 8px',display:'flex',flexDirection:'column',gap:6},
  lineItem:   {display:'flex',gap:8,alignItems:'center'},
  emptyWrap:  {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'calc(100dvh - 73px)'},
  center:     {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',background:'#0d0d0d',color:'#f1f1f1'},
}