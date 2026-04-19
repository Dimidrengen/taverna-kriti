import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function extractSlugFromEmail(email) {
  const match = email.match(/^(admin|kitchen|bar)@(.+)\.com$/i)
  return match ? match[2] : null
}

const LANGS = {
  el: { title:'Μπαρ', noOrders:'Δεν υπάρχουν ενεργές παραγγελίες', done:'✓ Έτοιμο', sending:'Στέλνεται…', drinks:'Ποτά', closeTable:'Κλείσιμο & Πληρωμή', closing:'Κλείνει…', bill:'Λογαριασμός', total:'Σύνολο', allTables:'Όλα τα τραπέζια', activeDrinks:'Ενεργά ποτά', tableWord:'Τραπέζι', logout:'Αποσύνδεση' },
  en: { title:'Bar', noOrders:'No active orders', done:'✓ Done', sending:'Sending…', drinks:'Drinks', closeTable:'Close & Payment', closing:'Closing…', bill:'Bill', total:'Total', allTables:'All tables', activeDrinks:'Active drinks', tableWord:'Table', logout:'Log out' },
  da: { title:'Bar', noOrders:'Ingen aktive ordrer', done:'✓ Færdig', sending:'Sender…', drinks:'Drikkevarer', closeTable:'Luk & Betal', closing:'Lukker…', bill:'Regning', total:'Total', allTables:'Alle borde', activeDrinks:'Aktive drikkevarer', tableWord:'Bord', logout:'Log ud' },
}

function getTableLabel(name, tableWord) {
  if (!name) return name
  return name.replace(/^Table\s*/i, tableWord + ' ').replace(/^Bord\s*/i, tableWord + ' ').replace(/^Τραπέζι\s*/i, tableWord + ' ')
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('da-DK', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Copenhagen' })
}

function formatAge(dateStr) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
}

function groupDrinkOrders(rows, translations) {
  const map = {}
  for (const row of rows) {
    const key = row.table_token
    if (!map[key]) map[key] = { table_label:row.table_label, table_token:row.table_token, orders:{} }
    if (!map[key].orders[row.order_id]) {
      map[key].orders[row.order_id] = { order_id:row.order_id, flow_type:row.flow_type, created_at:row.created_at, order_note:row.order_note, drinks:[] }
    }
    const translatedName = translations[row.item_id] || row.name
    map[key].orders[row.order_id].drinks.push({ ...row, name: translatedName })
  }
  return Object.values(map)
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) { setError('Forkert email eller adgangskode'); setLoading(false); return }
    if (!data.user.email.startsWith('bar@')) {
      await supabase.auth.signOut()
      setError('Du har ikke bar adgang')
      setLoading(false); return
    }
    const slug = extractSlugFromEmail(data.user.email)
    if (!slug) { await supabase.auth.signOut(); setError('Ugyldig email'); setLoading(false); return }
    const { data: restaurant } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
    if (!restaurant) { await supabase.auth.signOut(); setError('Restaurant ikke fundet'); setLoading(false); return }
    if (!restaurant.active) { await supabase.auth.signOut(); setError('Restauranten er deaktiveret'); setLoading(false); return }
    onLogin(data.user, restaurant)
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100dvh',background:'#0d0d0d',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:'#1a1a1a',borderRadius:16,border:'1px solid #2a2a2a',padding:40,width:'100%',maxWidth:380}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:12}}>🍹</div>
          <div style={{fontSize:22,fontWeight:700,color:'#f1f1f1'}}>Bar</div>
          <div style={{fontSize:14,color:'#6b7280',marginTop:4}}>TableFlow</div>
        </div>
        <form onSubmit={login}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:13,color:'#6b7280',display:'block',marginBottom:6}}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{width:'100%',padding:'10px 14px',border:'1px solid #333',borderRadius:10,fontSize:15,fontFamily:'system-ui',outline:'none',background:'#0d0d0d',color:'#f1f1f1'}} />
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:13,color:'#6b7280',display:'block',marginBottom:6}}>Adgangskode</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{width:'100%',padding:'10px 14px',border:'1px solid #333',borderRadius:10,fontSize:15,fontFamily:'system-ui',outline:'none',background:'#0d0d0d',color:'#f1f1f1'}} />
          </div>
          {error && <div style={{background:'#3a1a1a',border:'1px solid #7f1d1d',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#f87171',marginBottom:16}}>{error}</div>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:'12px',background:'#0ea5e9',color:'#000',border:'none',borderRadius:10,fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'}}>
            {loading ? 'Logger ind...' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function BarPage() {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [drinkOrders, setDrinkOrders] = useState([])
  const [allTables, setAllTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState({})
  const [closing, setClosing] = useState({})
  const [bills, setBills] = useState({})
  const [served, setServed] = useState({})
  const [tab, setTab] = useState('drinks')
  const [lang, setLang] = useState('el')
  const [translations, setTrans] = useState({})
  const [tick, setTick] = useState(0)
  const t = LANGS[lang]

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email?.startsWith('bar@')) {
        const slug = extractSlugFromEmail(session.user.email)
        if (slug) {
          const { data: rest } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
          if (rest && rest.active) { setUser(session.user); setRestaurant(rest) }
        }
      }
      setAuthLoading(false)
    })
  }, [])

  const handleLogin = (u, r) => { setUser(u); setRestaurant(r) }

  useEffect(() => {
    const interval = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchTranslations = useCallback(async (l) => {
    const { data } = await supabase.from('menu_item_translations').select('item_id, name').eq('lang', l)
    if (data) { const map = {}; data.forEach(r => { map[r.item_id] = r.name }); setTrans(map) }
  }, [])

  const fetchOrders = useCallback(async () => {
    if (!restaurant) return
    const { data } = await supabase.from('bar_open_orders').select('*').eq('restaurant_id', restaurant.id)
    if (data) setDrinkOrders(groupDrinkOrders(data, translations))
    setLoading(false)
  }, [translations, restaurant])

  const fetchAllTables = useCallback(async () => {
    if (!restaurant) return
    const { data: restaurantTables } = await supabase.from('tables').select('id').eq('restaurant_id', restaurant.id)
    if (!restaurantTables || restaurantTables.length === 0) { setAllTables([]); return }
    const tableIds = restaurantTables.map(t => t.id)
    const { data: orders } = await supabase.from('orders').select('table_id').eq('status', 'open').in('table_id', tableIds)
    if (!orders || orders.length === 0) { setAllTables([]); return }
    const activeTableIds = [...new Set(orders.map(o => o.table_id))]
    const { data: tables } = await supabase.from('tables').select('id, name, token').in('id', activeTableIds).order('name')
    if (tables) setAllTables(tables)
  }, [restaurant])

  useEffect(() => { if (user) fetchTranslations(lang) }, [lang, user])
  useEffect(() => { if (user && restaurant) { fetchOrders(); fetchAllTables() } }, [translations, restaurant])

  useEffect(() => {
    if (!user || !restaurant) return
    const channel = supabase.channel('bar-realtime-' + restaurant.id)
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, () => { fetchOrders(); fetchAllTables() })
      .on('postgres_changes', { event:'*', schema:'public', table:'order_lines' }, () => { fetchOrders(); fetchAllTables() })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders, fetchAllTables, user, restaurant])

  const changeLang = (l) => { setLang(l); fetchTranslations(l).then(() => fetchOrders()) }

  const markDone = async (orderId) => {
    setPending(p => ({ ...p, [orderId]: true }))
    try {
      await fetch('/api/course-done', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId, course:'drinks' }) })
    } catch(e) { console.error(e) }
    finally { setPending(p => { const n={...p}; delete n[orderId]; return n }) }
  }

  const toggleServed = async (lineId) => {
    const isServed = !!served[lineId]
    setServed(p => ({ ...p, [lineId]: !isServed }))
    await supabase.from('order_lines').update({ served_at: isServed ? null : new Date().toISOString() }).eq('id', lineId)
  }

  const fetchBill = async (tableToken) => {
    if (bills[tableToken]) { setBills(p => { const n={...p}; delete n[tableToken]; return n }); return }
    const res = await fetch(`/api/table-bill?tableToken=${tableToken}`)
    const data = await res.json()
    setBills(p => ({ ...p, [tableToken]: data }))
  }

  const closeTable = async (tableToken, tableName) => {
    if (!confirm(`Luk ${getTableLabel(tableName, t.tableWord)}?`)) return
    setClosing(p => ({ ...p, [tableToken]: true }))
    try {
      await fetch('/api/close-table', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tableToken }) })
      setBills(p => { const n={...p}; delete n[tableToken]; return n })
      await fetchAllTables()
    } catch(e) { console.error(e) }
    finally { setClosing(p => { const n={...p}; delete n[tableToken]; return n }) }
  }

  const logout = async () => { await supabase.auth.signOut(); setUser(null); setRestaurant(null) }

  if (authLoading) return <div style={styles.center}><p style={{color:'#aaa'}}>...</p></div>
  if (!user || !restaurant) return <LoginScreen onLogin={handleLogin} />
  if (loading) return <div style={styles.center}><p style={{color:'#aaa'}}>...</p></div>

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>🍹 {restaurant.name} — {t.title}</span>
        <div style={{display:'flex',gap:8}}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',background:lang===l?'#0ea5e9':'transparent',color:lang===l?'#000':'#888',border:lang===l?'none':'1px solid #333'}}>{l.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={logout} style={{padding:'6px 14px',background:'transparent',border:'1px solid #333',borderRadius:8,fontSize:13,cursor:'pointer',color:'#6b7280'}}>{t.logout}</button>
      </header>

      <div style={{display:'flex',gap:0,borderBottom:'1px solid #222',padding:'0 24px'}}>
        <button onClick={() => setTab('drinks')} style={{padding:'12px 20px',fontSize:14,fontWeight:600,cursor:'pointer',background:'transparent',border:'none',color:tab==='drinks'?'#0ea5e9':'#666',borderBottom:tab==='drinks'?'2px solid #0ea5e9':'2px solid transparent'}}>
          🍹 {t.activeDrinks} {drinkOrders.length > 0 && <span style={{background:'#0ea5e9',color:'#000',borderRadius:10,padding:'1px 7px',fontSize:11,marginLeft:6}}>{drinkOrders.length}</span>}
        </button>
        <button onClick={() => setTab('tables')} style={{padding:'12px 20px',fontSize:14,fontWeight:600,cursor:'pointer',background:'transparent',border:'none',color:tab==='tables'?'#0ea5e9':'#666',borderBottom:tab==='tables'?'2px solid #0ea5e9':'2px solid transparent'}}>
          🪑 {t.allTables} {allTables.length > 0 && <span style={{background:'#444',color:'#fff',borderRadius:10,padding:'1px 7px',fontSize:11,marginLeft:6}}>{allTables.length}</span>}
        </button>
      </div>

      {tab === 'drinks' && (
        drinkOrders.length === 0
          ? <div style={styles.emptyWrap}><div style={{fontSize:48}}>🍹</div><p style={{color:'#aaa',fontSize:18,marginTop:12}}>{t.noOrders}</p></div>
          : <div style={styles.grid}>
              {drinkOrders.map(table => (
                <div key={table.table_token} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={styles.tableLabel}>{getTableLabel(table.table_label, t.tableWord)}</span>
                  </div>
                  {Object.values(table.orders).filter(o => o.drinks.length > 0).map(order => {
                    const age = formatAge(order.created_at)
                    const time = formatTime(order.created_at)
                    return (
                      <div key={order.order_id}>
                        <div style={{padding:'6px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #1f1f1f'}}>
                          <span style={{fontSize:14,fontWeight:600,color:'#f1f1f1'}}>{time}</span>
                          <span style={{fontSize:12,color:age>20?'#ef4444':'#9ca3af'}}>{age} min</span>
                        </div>
                        {order.order_note && (
                          <div style={{padding:'8px 16px',fontSize:13,color:'#f59e0b',fontStyle:'italic',display:'flex',gap:6,background:'#1f1a0e',borderBottom:'1px solid #333'}}>
                            <span>📝</span><span>{order.order_note}</span>
                          </div>
                        )}
                        <div style={styles.drinksLabel}>
                          <span style={{width:8,height:8,borderRadius:'50%',background:'#0ea5e9',display:'inline-block',marginRight:8}}/>
                          <span style={{fontSize:13,fontWeight:700,textTransform:'uppercase',color:'#0ea5e9'}}>{t.drinks}</span>
                        </div>
                        <div style={styles.lineList}>
                          {order.drinks.map(line => {
                            const isServed = !!served[line.line_id]
                            return (
                              <div key={line.line_id} style={{...styles.lineItem, opacity: isServed ? 0.4 : 1}}>
                                <span style={{fontSize:14,color:'#6b7280',minWidth:24}}>{line.qty}×</span>
                                <span style={{fontSize:16,flex:1,textDecoration:isServed?'line-through':'none'}}>{line.name}</span>
                                <button onClick={() => toggleServed(line.line_id)} style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',fontSize:16,background:isServed?'#22c55e':'#2a2a2a',color:isServed?'white':'#666',flexShrink:0}}>✓</button>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{padding:'8px 16px 16px'}}>
                          <button disabled={pending[order.order_id]} onClick={() => markDone(order.order_id)}
                            style={{width:'100%',padding:'10px 0',background:'transparent',border:'1px solid #0ea5e9',borderRadius:8,fontSize:14,fontWeight:600,color:'#0ea5e9',opacity:pending[order.order_id]?0.5:1,cursor:'pointer'}}>
                            {pending[order.order_id] ? t.sending : t.done}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
      )}

      {tab === 'tables' && (
        allTables.length === 0
          ? <div style={styles.emptyWrap}><div style={{fontSize:48}}>🪑</div><p style={{color:'#aaa',fontSize:18,marginTop:12}}>{t.noOrders}</p></div>
          : <div style={styles.grid}>
              {allTables.map(table => {
                const bill = bills[table.token]
                const isClosing = closing[table.token]
                return (
                  <div key={table.token} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <span style={styles.tableLabel}>{getTableLabel(table.name, t.tableWord)}</span>
                    </div>
                    {bill && (
                      <div style={{padding:'12px 16px'}}>
                        <div style={{fontSize:12,color:'#6b7280',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em'}}>{t.bill}</div>
                        {bill.orders && bill.orders.flatMap(o => o.lines).map((l,i) => (
                          <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:14,padding:'3px 0',color:'#ccc'}}>
                            <span>{l.qty}× {l.name}</span><span>€{(l.price*l.qty).toFixed(2)}</span>
                          </div>
                        ))}
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:17,fontWeight:700,color:'white',marginTop:10,paddingTop:10,borderTop:'1px solid #333'}}>
                          <span>{t.total}</span><span>€{bill.grandTotal?.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    <div style={{padding:'12px 16px',display:'flex',gap:8}}>
                      <button onClick={() => fetchBill(table.token)} style={{flex:1,padding:'10px 0',background:'transparent',border:'1px solid #444',borderRadius:8,fontSize:14,fontWeight:600,color:'#aaa',cursor:'pointer'}}>
                        {bill ? '▲ Skjul' : `📋 ${t.bill}`}
                      </button>
                      <button disabled={isClosing} onClick={() => closeTable(table.token, table.name)}
                        style={{flex:1,padding:'10px 0',background:'transparent',border:'1px solid #dc2626',borderRadius:8,fontSize:14,fontWeight:600,color:'#dc2626',opacity:isClosing?0.5:1,cursor:'pointer'}}>
                        {isClosing ? t.closing : t.closeTable}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
      )}
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
  drinksLabel:{display:'flex',alignItems:'center',padding:'12px 16px 4px'},
  lineList:   {padding:'4px 16px 8px',display:'flex',flexDirection:'column',gap:8},
  lineItem:   {display:'flex',gap:8,alignItems:'center',transition:'opacity 0.2s'},
  emptyWrap:  {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'calc(100dvh - 120px)'},
  center:     {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100dvh',background:'#0d0d0d',color:'#f1f1f1'},
}