import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function AdminPage() {
  const [tab, setTab] = useState('menu')
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name:'', description:'', price:'', category:'Starters', emoji:'', station:'kitchen' })

  const fetchData = useCallback(async () => {
    const [{ data: menuItems }, { data: openOrders }, { data: allTables }] = await Promise.all([
      supabase.from('menu_items').select('*').order('category').order('name'),
      supabase.from('orders').select('*, tables(name)').eq('status','open'),
      supabase.from('tables').select('*').order('name'),
    ])
    if (menuItems) setItems(menuItems)
    if (openOrders) setOrders(openOrders)
    if (allTables) setTables(allTables)
    setLoading(false)
  }, [])

  const fetchRevenue = useCallback(async () => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const { data } = await supabase
      .from('orders')
      .select('*, order_lines(name, qty, price)')
      .eq('status','done')
      .gte('created_at', today.toISOString())
    return data || []
  }, [])

  const [revenue, setRevenue] = useState([])
  useEffect(() => {
    fetchData()
    fetchRevenue().then(setRevenue)
  }, [])

  const saveItem = async (item) => {
    setSaving(true)
    await supabase.from('menu_items').update({
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      category: item.category,
      emoji: item.emoji,
      available: item.available,
      station: item.station,
    }).eq('id', item.id)
    setSaving(false)
    setEditing(null)
    fetchData()
  }

  const addItem = async () => {
    setSaving(true)
    const { data: restaurant } = await supabase.from('restaurants').select('id').eq('slug','taverna-kriti').single()
    await supabase.from('menu_items').insert({
      restaurant_id: restaurant.id,
      name: newItem.name,
      description: newItem.description,
      price: parseFloat(newItem.price),
      category: newItem.category,
      emoji: newItem.emoji,
      station: newItem.station,
      available: true,
    })
    setSaving(false)
    setShowAdd(false)
    setNewItem({ name:'', description:'', price:'', category:'Starters', emoji:'', station:'kitchen' })
    fetchData()
  }

  const toggleAvailable = async (item) => {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    fetchData()
  }

  const grandTotal = revenue.reduce((s, o) => s + (o.order_lines||[]).reduce((ls, l) => ls + l.price * l.qty, 0), 0)
  const categories = ['Starters','Salads','Mains','Sides','Desserts','Drinks']

  if (loading) return <div style={s.center}><p style={{color:'#aaa'}}>Indlæser...</p></div>

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.title}>⚙️ Taverna Kriti — Admin</span>
        <div style={{display:'flex',gap:8}}>
          {['menu','omsaetning','borde'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'6px 16px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
              background: tab===t ? '#C2692A' : 'transparent',
              color: tab===t ? 'white' : '#888',
              border: tab===t ? 'none' : '1px solid #333',
            }}>
              {t==='menu' ? '🍽 Menu' : t==='omsaetning' ? '📊 Omsætning' : '🪑 Borde'}
            </button>
          ))}
        </div>
      </header>

      {/* MENU TAB */}
      {tab === 'menu' && (
        <div style={s.content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <h2 style={s.sectionTitle}>Menupunkter</h2>
            <button onClick={() => setShowAdd(!showAdd)} style={s.addBtn}>+ Tilføj ret</button>
          </div>

          {showAdd && (
            <div style={s.card}>
              <h3 style={{fontSize:16,fontWeight:600,marginBottom:16,color:'#1C1917'}}>Ny ret</h3>
              <div style={s.grid2}>
                <input style={s.input} placeholder="Navn" value={newItem.name} onChange={e => setNewItem({...newItem, name:e.target.value})} />
                <input style={s.input} placeholder="Emoji" value={newItem.emoji} onChange={e => setNewItem({...newItem, emoji:e.target.value})} />
                <input style={s.input} placeholder="Pris (€)" type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price:e.target.value})} />
                <select style={s.input} value={newItem.category} onChange={e => setNewItem({...newItem, category:e.target.value})}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <select style={s.input} value={newItem.station} onChange={e => setNewItem({...newItem, station:e.target.value})}>
                  <option value="kitchen">Køkken</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              <textarea style={{...s.input, width:'100%', marginTop:8, resize:'none'}} rows={2} placeholder="Beskrivelse" value={newItem.description} onChange={e => setNewItem({...newItem, description:e.target.value})} />
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={addItem} disabled={saving||!newItem.name||!newItem.price} style={s.saveBtn}>{saving ? 'Gemmer...' : 'Gem'}</button>
                <button onClick={() => setShowAdd(false)} style={s.cancelBtn}>Annuller</button>
              </div>
            </div>
          )}

          {categories.map(cat => {
            const catItems = items.filter(i => i.category === cat)
            if (!catItems.length) return null
            return (
              <div key={cat} style={{marginBottom:24}}>
                <div style={s.catHeader}>{cat}</div>
                {catItems.map(item => (
                  <div key={item.id} style={{...s.card, marginBottom:8, opacity: item.available ? 1 : 0.5}}>
                    {editing?.id === item.id ? (
                      <div>
                        <div style={s.grid2}>
                          <input style={s.input} value={editing.name} onChange={e => setEditing({...editing, name:e.target.value})} placeholder="Navn" />
                          <input style={s.input} value={editing.emoji||''} onChange={e => setEditing({...editing, emoji:e.target.value})} placeholder="Emoji" />
                          <input style={s.input} type="number" value={editing.price} onChange={e => setEditing({...editing, price:e.target.value})} placeholder="Pris" />
                          <select style={s.input} value={editing.category} onChange={e => setEditing({...editing, category:e.target.value})}>
                            {categories.map(c => <option key={c}>{c}</option>)}
                          </select>
                          <select style={s.input} value={editing.station||'kitchen'} onChange={e => setEditing({...editing, station:e.target.value})}>
                            <option value="kitchen">Køkken</option>
                            <option value="bar">Bar</option>
                          </select>
                        </div>
                        <textarea style={{...s.input,width:'100%',marginTop:8,resize:'none'}} rows={2} value={editing.description||''} onChange={e => setEditing({...editing, description:e.target.value})} placeholder="Beskrivelse" />
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                          <button onClick={() => saveItem(editing)} disabled={saving} style={s.saveBtn}>{saving?'Gemmer...':'Gem'}</button>
                          <button onClick={() => setEditing(null)} style={s.cancelBtn}>Annuller</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <span style={{fontSize:24}}>{item.emoji||'🍽'}</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:15}}>{item.name}</div>
                          <div style={{fontSize:12,color:'#78716C'}}>{item.description}</div>
                        </div>
                        <div style={{fontWeight:700,fontSize:15,minWidth:50}}>€{Number(item.price).toFixed(2)}</div>
                        <button onClick={() => toggleAvailable(item)} style={{...s.iconBtn, background: item.available ? '#EBF5EF' : '#FEE2E2', color: item.available ? '#2D7A4F' : '#dc2626'}}>
                          {item.available ? '✓ Aktiv' : '✗ Inaktiv'}
                        </button>
                        <button onClick={() => setEditing({...item})} style={s.iconBtn}>✏️ Rediger</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* OMSÆTNING TAB */}
      {tab === 'omsaetning' && (
        <div style={s.content}>
          <h2 style={s.sectionTitle}>Dagens omsætning</h2>
          <div style={{...s.card, textAlign:'center', marginBottom:24}}>
            <div style={{fontSize:14,color:'#78716C',marginBottom:8}}>Total i dag</div>
            <div style={{fontSize:48,fontWeight:700,color:'#C2692A'}}>€{grandTotal.toFixed(2)}</div>
            <div style={{fontSize:13,color:'#78716C',marginTop:4}}>{revenue.length} lukkede borde</div>
          </div>
          {revenue.length === 0
            ? <p style={{color:'#aaa',textAlign:'center'}}>Ingen lukkede borde i dag endnu</p>
            : revenue.map(order => {
                const orderTotal = (order.order_lines||[]).reduce((s,l) => s+l.price*l.qty, 0)
                return (
                  <div key={order.id} style={{...s.card, marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontWeight:600}}>{order.tables?.name || 'Bord'}</span>
                      <span style={{fontWeight:700,color:'#C2692A'}}>€{orderTotal.toFixed(2)}</span>
                    </div>
                    <div style={{fontSize:12,color:'#78716C',marginTop:4}}>
                      {new Date(order.created_at).toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                )
              })
          }
        </div>
      )}

      {/* BORDE TAB */}
      {tab === 'borde' && (
        <div style={s.content}>
          <h2 style={s.sectionTitle}>Åbne borde</h2>
          {orders.length === 0
            ? <p style={{color:'#aaa',textAlign:'center'}}>Ingen åbne borde</p>
            : orders.map(order => (
                <div key={order.id} style={{...s.card, marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontWeight:600}}>{order.tables?.name}</span>
                    <span style={{fontSize:12,color:'#78716C'}}>{new Date(order.created_at).toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  )
}

const s = {
  page:        {minHeight:'100vh',background:'#F5F5F0',fontFamily:'system-ui,sans-serif'},
  header:      {background:'white',borderBottom:'1px solid #e5e5e5',padding:'16px 24px',display:'flex',alignItems:'center',gap:16,position:'sticky',top:0,zIndex:10},
  title:       {fontSize:20,fontWeight:700,flex:1,color:'#1C1917'},
  content:     {maxWidth:800,margin:'0 auto',padding:24},
  sectionTitle:{fontSize:20,fontWeight:700,color:'#1C1917',marginBottom:16},
  card:        {background:'white',borderRadius:12,border:'1px solid #e5e5e5',padding:16},
  catHeader:   {fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#78716C',marginBottom:8,paddingBottom:4,borderBottom:'1px solid #e5e5e5'},
  grid2:       {display:'grid',gridTemplateColumns:'1fr 1fr',gap:8},
  input:       {padding:'8px 12px',border:'1px solid #e5e5e5',borderRadius:8,fontSize:14,fontFamily:'system-ui,sans-serif',outline:'none',width:'100%'},
  addBtn:      {padding:'8px 16px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'},
  saveBtn:     {padding:'8px 16px',background:'#1C1917',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'},
  cancelBtn:   {padding:'8px 16px',background:'transparent',color:'#78716C',border:'1px solid #e5e5e5',borderRadius:8,fontSize:14,cursor:'pointer'},
  iconBtn:     {padding:'5px 10px',background:'#f5f5f0',border:'1px solid #e5e5e5',borderRadius:6,fontSize:12,cursor:'pointer',whiteSpace:'nowrap'},
  center:      {display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh'},
}