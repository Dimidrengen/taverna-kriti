import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const LANGS = {
  da: { menu:'🍽 Menu', revenue:'📊 Omsætning', tables:'🪑 Borde', menuItems:'Menupunkter', addItem:'+ Tilføj ret', newItem:'Ny ret', name:'Navn', description:'Beskrivelse', price:'Pris (€)', kitchen:'Køkken', bar:'Bar', save:'Gem', saving:'Gemmer...', cancel:'Annuller', active:'✓ Aktiv', inactive:'✗ Inaktiv', edit:'✏️ Rediger', todayRevenue:'Dagens omsætning', totalToday:'Total i dag', closedTables:'lukkede borde', noClosedTables:'Ingen lukkede borde i dag endnu', openTables:'Åbne borde', noOpenTables:'Ingen åbne borde', loading:'Indlæser...', resetRevenue:'Nulstil omsætning', resetConfirm:'Er du sikker på du vil nulstille dagens omsætning? Dette kan ikke fortrydes.', resetYes:'Ja, nulstil', resetNo:'Annuller', resetting:'Nulstiller...', stats:'📈 Statistik', period:'Periode', today:'I dag', thisWeek:'Denne uge', thisMonth:'Denne måned', allTime:'Alt', table:'Bord', seatings:'Seatings', totalRevenue:'Total omsætning', avgPerSeating:'Gns. per seating', noStats:'Ingen data i denne periode', uploadImage:'Upload billede', removeImage:'Fjern billede', uploading:'Uploader...' },
  en: { menu:'🍽 Menu', revenue:'📊 Revenue', tables:'🪑 Tables', menuItems:'Menu items', addItem:'+ Add item', newItem:'New item', name:'Name', description:'Description', price:'Price (€)', kitchen:'Kitchen', bar:'Bar', save:'Save', saving:'Saving...', cancel:'Cancel', active:'✓ Active', inactive:'✗ Inactive', edit:'✏️ Edit', todayRevenue:"Today's revenue", totalToday:'Total today', closedTables:'closed tables', noClosedTables:'No closed tables today', openTables:'Open tables', noOpenTables:'No open tables', loading:'Loading...', resetRevenue:'Reset revenue', resetConfirm:"Are you sure you want to reset today's revenue? This cannot be undone.", resetYes:'Yes, reset', resetNo:'Cancel', resetting:'Resetting...', stats:'📈 Statistics', period:'Period', today:'Today', thisWeek:'This week', thisMonth:'This month', allTime:'All time', table:'Table', seatings:'Seatings', totalRevenue:'Total revenue', avgPerSeating:'Avg. per seating', noStats:'No data in this period', uploadImage:'Upload image', removeImage:'Remove image', uploading:'Uploading...' },
  el: { menu:'🍽 Μενού', revenue:'📊 Έσοδα', tables:'🪑 Τραπέζια', menuItems:'Στοιχεία μενού', addItem:'+ Προσθήκη', newItem:'Νέο πιάτο', name:'Όνομα', description:'Περιγραφή', price:'Τιμή (€)', kitchen:'Κουζίνα', bar:'Μπαρ', save:'Αποθήκευση', saving:'Αποθήκευση...', cancel:'Ακύρωση', active:'✓ Ενεργό', inactive:'✗ Ανενεργό', edit:'✏️ Επεξεργασία', todayRevenue:'Έσοδα σήμερα', totalToday:'Σύνολο σήμερα', closedTables:'κλειστά τραπέζια', noClosedTables:'Δεν υπάρχουν κλειστά τραπέζια σήμερα', openTables:'Ανοιχτά τραπέζια', noOpenTables:'Δεν υπάρχουν ανοιχτά τραπέζια', loading:'Φόρτωση...', resetRevenue:'Επαναφορά εσόδων', resetConfirm:'Είστε σίγουροι ότι θέλετε να επαναφέρετε τα έσοδα;', resetYes:'Ναι', resetNo:'Ακύρωση', resetting:'Επαναφορά...', stats:'📈 Στατιστικά', period:'Περίοδος', today:'Σήμερα', thisWeek:'Αυτή την εβδομάδα', thisMonth:'Αυτό τον μήνα', allTime:'Όλα', table:'Τραπέζι', seatings:'Seatings', totalRevenue:'Συνολικά έσοδα', avgPerSeating:'Μέσος όρος ανά seating', noStats:'Δεν υπάρχουν δεδομένα', uploadImage:'Ανεβάστε εικόνα', removeImage:'Αφαίρεση εικόνας', uploading:'Ανεβαίνει...' },
}

const EMOJI_OPTIONS = {
  Starters: ['🫒','🧆','🥙','🫔','🥗','🐟','🦑','🍋','🧅','🫕','🥚','🧀','🥬','🌿'],
  Salads:   ['🥗','🍅','🥒','🫑','🧅','🫒','🌿','🥬','🍋'],
  Mains:    ['🍖','🥩','🐑','🫕','🍲','🐟','🦐','🦑','🍗','🥘','🫔','🌊'],
  Sides:    ['🍟','🥔','🫘','🥖','🫓','🧄','🧅','🌽','🥦'],
  Desserts: ['🍯','🥐','🍮','🍰','🧁','🍩','🍪','🍫','🫐','🍓'],
  Drinks:   ['🍺','🍻','🍷','🥂','🍸','🍹','☕','🫖','🥤','💧','🧃','🍵','🥛'],
}
const ALL_EMOJIS = [...new Set(Object.values(EMOJI_OPTIONS).flat())]

function EmojiPicker({ value, onChange, category }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const emojis = EMOJI_OPTIONS[category] || ALL_EMOJIS
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  return (
    <div ref={ref} style={{position:'relative'}}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{width:'100%',padding:'8px 12px',border:'1px solid #e5e5e5',borderRadius:8,fontSize:22,cursor:'pointer',background:'white',textAlign:'left',display:'flex',alignItems:'center',gap:8}}>
        <span>{value || '➕'}</span>
        <span style={{fontSize:12,color:'#78716C',marginLeft:'auto'}}>▾</span>
      </button>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:100,background:'white',border:'1px solid #e5e5e5',borderRadius:12,padding:10,display:'flex',flexWrap:'wrap',gap:4,width:220,boxShadow:'0 4px 16px rgba(0,0,0,0.10)'}}>
          {emojis.map(e => (
            <button key={e} type="button" onClick={() => { onChange(e); setOpen(false) }} style={{width:36,height:36,fontSize:20,border:'none',borderRadius:8,cursor:'pointer',background:value===e?'#F4E3D7':'transparent',outline:value===e?'2px solid #C2692A':'none'}}>{e}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function ImageUpload({ itemId, currentUrl, onUploaded, onRemoved, t }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const upload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${itemId}.${ext}`
    const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      await supabase.from('menu_items').update({ image_url: url }).eq('id', itemId)
      onUploaded(url)
    }
    setUploading(false)
  }

  const remove = async () => {
    await supabase.from('menu_items').update({ image_url: null }).eq('id', itemId)
    onRemoved()
  }

  return (
    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
      {currentUrl && (
        <img src={currentUrl} alt="" style={{width:48,height:48,borderRadius:8,objectFit:'cover',border:'1px solid #e5e5e5'}} />
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={upload} />
      <button type="button" onClick={() => fileRef.current.click()} disabled={uploading}
        style={{padding:'6px 12px',background:'#f5f5f0',border:'1px solid #e5e5e5',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'system-ui'}}>
        {uploading ? t.uploading : (currentUrl ? '🔄 ' + t.uploadImage : '📷 ' + t.uploadImage)}
      </button>
      {currentUrl && (
        <button type="button" onClick={remove}
          style={{padding:'6px 12px',background:'#FEE2E2',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',color:'#dc2626',fontFamily:'system-ui'}}>
          {t.removeImage}
        </button>
      )}
    </div>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState('menu')
  const [lang, setLang] = useState('da')
  const [items, setItems] = useState([])
  const [orders, setOrders] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name:'', description:'', price:'', category:'Starters', emoji:'', station:'kitchen' })
  const [revenue, setRevenue] = useState([])
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [statsPeriod, setStatsPeriod] = useState('today')
  const [statsData, setStatsData] = useState([])
  const [statsLoading, setStatsLoading] = useState(false)
  const t = LANGS[lang]

  const fetchData = useCallback(async () => {
    const [{ data: menuItems }, { data: openOrders }, { data: allTables }] = await Promise.all([
      supabase.from('menu_items').select('*').order('category').order('name'),
      supabase.from('orders').select('id, created_at, status, tables(name, token)').eq('status','open'),
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
    const { data } = await supabase.from('orders').select('id, created_at, tables(name), order_lines(name, qty, price)').eq('status','done').gte('created_at', today.toISOString())
    return data || []
  }, [])

  useEffect(() => { fetchData(); fetchRevenue().then(setRevenue) }, [])
  useEffect(() => { if (tab === 'statistik') fetchStats(statsPeriod) }, [tab, statsPeriod])

  const saveItem = async (item) => {
    setSaving(true)
    await supabase.from('menu_items').update({
      name: item.name, description: item.description, price: parseFloat(item.price),
      category: item.category, emoji: item.emoji, available: item.available, station: item.station,
    }).eq('id', item.id)
    setSaving(false)
    setEditing(null)
    fetchData()
  }

  const addItem = async () => {
    setSaving(true)
    const { data: restaurant } = await supabase.from('restaurants').select('id').eq('slug','taverna-kriti').single()
    await supabase.from('menu_items').insert({
      restaurant_id: restaurant.id, name: newItem.name, description: newItem.description,
      price: parseFloat(newItem.price), category: newItem.category, emoji: newItem.emoji,
      station: newItem.station, available: true,
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

  const fetchStats = async (period) => {
    setStatsLoading(true)
    const now = new Date()
    let from = new Date()
    if (period === 'today') { from.setHours(0,0,0,0) }
    else if (period === 'thisWeek') { from.setDate(now.getDate() - now.getDay()); from.setHours(0,0,0,0) }
    else if (period === 'thisMonth') { from = new Date(now.getFullYear(), now.getMonth(), 1) }
    else { from = new Date('2020-01-01') }
    const query = supabase.from('orders').select('id, created_at, tables(name), order_lines(qty, price)').in('status', ['done', 'archived'])
    if (period !== 'allTime') query.gte('created_at', from.toISOString())
    const { data } = await query
    if (!data) { setStatsData([]); setStatsLoading(false); return }
    const map = {}
    data.forEach(order => {
      const name = order.tables?.name || 'Ukendt'
      if (!map[name]) map[name] = { name, seatings: 0, total: 0 }
      map[name].seatings++
      map[name].total += (order.order_lines||[]).reduce((s,l) => s + l.price * l.qty, 0)
    })
    setStatsData(Object.values(map).sort((a,b) => b.total - a.total))
    setStatsLoading(false)
  }

  const resetRevenue = async () => {
    setResetting(true)
    const today = new Date()
    today.setHours(0,0,0,0)
    await supabase.from('orders').update({ status: 'archived' }).eq('status', 'done').gte('created_at', today.toISOString())
    setRevenue([])
    setResetting(false)
    setShowResetConfirm(false)
  }

  const grandTotal = revenue.reduce((s, o) => s + (o.order_lines||[]).reduce((ls, l) => ls + l.price * l.qty, 0), 0)
  const categories = ['Starters','Salads','Mains','Sides','Desserts','Drinks']

  if (loading) return <div style={s.center}><p style={{color:'#aaa'}}>{t.loading}</p></div>

  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.title}>⚙️ Taverna Kriti — Admin</span>
        <div style={{display:'flex',gap:6,marginRight:12}}>
          {['da','en','el'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',background:lang===l?'#C2692A':'transparent',color:lang===l?'white':'#888',border:lang===l?'none':'1px solid #ddd'}}>{l.toUpperCase()}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {['menu','omsaetning','borde','statistik'].map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{padding:'6px 16px',borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',background:tab===tb?'#C2692A':'transparent',color:tab===tb?'white':'#888',border:tab===tb?'none':'1px solid #333'}}>
              {tb==='menu' ? t.menu : tb==='omsaetning' ? t.revenue : tb==='borde' ? t.tables : t.stats}
            </button>
          ))}
        </div>
      </header>

      {tab === 'menu' && (
        <div style={s.content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <h2 style={s.sectionTitle}>{t.menuItems}</h2>
            <button onClick={() => setShowAdd(!showAdd)} style={s.addBtn}>{t.addItem}</button>
          </div>

          {showAdd && (
            <div style={{...s.card, marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:600,marginBottom:16,color:'#1C1917'}}>{t.newItem}</h3>
              <div style={s.grid2}>
                <input style={s.input} placeholder={t.name} value={newItem.name} onChange={e => setNewItem({...newItem, name:e.target.value})} />
                <EmojiPicker value={newItem.emoji} onChange={v => setNewItem({...newItem, emoji:v})} category={newItem.category} />
                <input style={s.input} placeholder={t.price} type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price:e.target.value})} />
                <select style={s.input} value={newItem.category} onChange={e => setNewItem({...newItem, category:e.target.value})}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <select style={s.input} value={newItem.station} onChange={e => setNewItem({...newItem, station:e.target.value})}>
                  <option value="kitchen">{t.kitchen}</option>
                  <option value="bar">{t.bar}</option>
                </select>
              </div>
              <textarea style={{...s.input, width:'100%', marginTop:8, resize:'none'}} rows={2} placeholder={t.description} value={newItem.description} onChange={e => setNewItem({...newItem, description:e.target.value})} />
              <div style={{display:'flex',gap:8,marginTop:12}}>
                <button onClick={addItem} disabled={saving||!newItem.name||!newItem.price} style={s.saveBtn}>{saving ? t.saving : t.save}</button>
                <button onClick={() => setShowAdd(false)} style={s.cancelBtn}>{t.cancel}</button>
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
                          <input style={s.input} value={editing.name} onChange={e => setEditing({...editing, name:e.target.value})} placeholder={t.name} />
                          <EmojiPicker value={editing.emoji||''} onChange={v => setEditing({...editing, emoji:v})} category={editing.category} />
                          <input style={s.input} type="number" value={editing.price} onChange={e => setEditing({...editing, price:e.target.value})} placeholder={t.price} />
                          <select style={s.input} value={editing.category} onChange={e => setEditing({...editing, category:e.target.value})}>
                            {categories.map(c => <option key={c}>{c}</option>)}
                          </select>
                          <select style={s.input} value={editing.station||'kitchen'} onChange={e => setEditing({...editing, station:e.target.value})}>
                            <option value="kitchen">{t.kitchen}</option>
                            <option value="bar">{t.bar}</option>
                          </select>
                        </div>
                        <textarea style={{...s.input,width:'100%',marginTop:8,resize:'none'}} rows={2} value={editing.description||''} onChange={e => setEditing({...editing, description:e.target.value})} placeholder={t.description} />
                        <ImageUpload
                          itemId={editing.id}
                          currentUrl={editing.image_url}
                          onUploaded={url => setEditing({...editing, image_url: url})}
                          onRemoved={() => setEditing({...editing, image_url: null})}
                          t={t}
                        />
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                          <button onClick={() => saveItem(editing)} disabled={saving} style={s.saveBtn}>{saving ? t.saving : t.save}</button>
                          <button onClick={() => setEditing(null)} style={s.cancelBtn}>{t.cancel}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} style={{width:44,height:44,borderRadius:10,objectFit:'cover',flexShrink:0,border:'1px solid #e5e5e5'}} />
                          : <span style={{fontSize:24,width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f0',borderRadius:10,flexShrink:0}}>{item.emoji||'🍽'}</span>
                        }
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:15}}>{item.name}</div>
                          <div style={{fontSize:12,color:'#78716C'}}>{item.description}</div>
                        </div>
                        <div style={{fontWeight:700,fontSize:15,minWidth:50}}>€{Number(item.price).toFixed(2)}</div>
                        <button onClick={() => toggleAvailable(item)} style={{...s.iconBtn, background: item.available ? '#EBF5EF' : '#FEE2E2', color: item.available ? '#2D7A4F' : '#dc2626'}}>
                          {item.available ? t.active : t.inactive}
                        </button>
                        <button onClick={() => setEditing({...item})} style={s.iconBtn}>{t.edit}</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'omsaetning' && (
        <div style={s.content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:12}}>
            <h2 style={{...s.sectionTitle,marginBottom:0}}>{t.todayRevenue}</h2>
            <button onClick={() => setShowResetConfirm(true)} style={{padding:'8px 16px',background:'transparent',border:'1px solid #dc2626',borderRadius:8,fontSize:14,fontWeight:600,color:'#dc2626',cursor:'pointer'}}>
              🔄 {t.resetRevenue}
            </button>
          </div>
          {showResetConfirm && (
            <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:12,padding:20,marginBottom:20}}>
              <p style={{fontWeight:600,color:'#dc2626',marginBottom:16}}>{t.resetConfirm}</p>
              <div style={{display:'flex',gap:8}}>
                <button onClick={resetRevenue} disabled={resetting} style={{padding:'8px 16px',background:'#dc2626',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}}>{resetting ? t.resetting : t.resetYes}</button>
                <button onClick={() => setShowResetConfirm(false)} style={{padding:'8px 16px',background:'transparent',border:'1px solid #ddd',borderRadius:8,fontSize:14,cursor:'pointer'}}>{t.resetNo}</button>
              </div>
            </div>
          )}
          <div style={{...s.card, textAlign:'center', marginBottom:24}}>
            <div style={{fontSize:14,color:'#78716C',marginBottom:8}}>{t.totalToday}</div>
            <div style={{fontSize:48,fontWeight:700,color:'#C2692A'}}>€{grandTotal.toFixed(2)}</div>
            <div style={{fontSize:13,color:'#78716C',marginTop:4}}>{revenue.length} {t.closedTables}</div>
          </div>
          {revenue.length === 0
            ? <p style={{color:'#aaa',textAlign:'center'}}>{t.noClosedTables}</p>
            : revenue.map(order => {
                const orderTotal = (order.order_lines||[]).reduce((s,l) => s+l.price*l.qty, 0)
                return (
                  <div key={order.id} style={{...s.card, marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontWeight:600}}>{order.tables?.name || 'Ukendt bord'}</span>
                      <span style={{fontWeight:700,color:'#C2692A'}}>€{orderTotal.toFixed(2)}</span>
                    </div>
                    <div style={{fontSize:12,color:'#78716C',marginTop:4}}>{new Date(order.created_at).toLocaleTimeString('da-DK', {hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                )
              })
          }
        </div>
      )}

      {tab === 'statistik' && (
        <div style={s.content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:8}}>
            <h2 style={{...s.sectionTitle,marginBottom:0}}>{t.stats}</h2>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {['today','thisWeek','thisMonth','allTime'].map(p => (
                <button key={p} onClick={() => setStatsPeriod(p)} style={{padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:statsPeriod===p?'#1C1917':'transparent',color:statsPeriod===p?'white':'#888',border:statsPeriod===p?'none':'1px solid #ddd'}}>
                  {p==='today' ? t.today : p==='thisWeek' ? t.thisWeek : p==='thisMonth' ? t.thisMonth : t.allTime}
                </button>
              ))}
            </div>
          </div>
          {statsLoading
            ? <p style={{color:'#aaa',textAlign:'center'}}>{t.loading}</p>
            : statsData.length === 0
              ? <p style={{color:'#aaa',textAlign:'center'}}>{t.noStats}</p>
              : <>
                  <div style={{...s.card, marginBottom:20, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, textAlign:'center'}}>
                    <div>
                      <div style={{fontSize:12,color:'#78716C',marginBottom:4}}>{t.totalRevenue}</div>
                      <div style={{fontSize:28,fontWeight:700,color:'#C2692A'}}>€{statsData.reduce((s,r)=>s+r.total,0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#78716C',marginBottom:4}}>{t.seatings}</div>
                      <div style={{fontSize:28,fontWeight:700,color:'#1C1917'}}>{statsData.reduce((s,r)=>s+r.seatings,0)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:12,color:'#78716C',marginBottom:4}}>{t.avgPerSeating}</div>
                      <div style={{fontSize:28,fontWeight:700,color:'#1C1917'}}>€{statsData.reduce((s,r)=>s+r.seatings,0) > 0 ? (statsData.reduce((s,r)=>s+r.total,0) / statsData.reduce((s,r)=>s+r.seatings,0)).toFixed(2) : '0.00'}</div>
                    </div>
                  </div>
                  <div style={s.card}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 80px 100px 120px',gap:8,padding:'8px 0',borderBottom:'1px solid #e5e5e5',marginBottom:8}}>
                      <div style={{fontSize:12,fontWeight:700,color:'#78716C',textTransform:'uppercase'}}>{t.table}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#78716C',textTransform:'uppercase',textAlign:'center'}}>{t.seatings}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#78716C',textTransform:'uppercase',textAlign:'right'}}>{t.totalRevenue}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#78716C',textTransform:'uppercase',textAlign:'right'}}>{t.avgPerSeating}</div>
                    </div>
                    {statsData.map(row => (
                      <div key={row.name} style={{display:'grid',gridTemplateColumns:'1fr 80px 100px 120px',gap:8,padding:'10px 0',borderBottom:'1px solid #f5f5f0'}}>
                        <div style={{fontWeight:600}}>{row.name}</div>
                        <div style={{textAlign:'center',color:'#78716C'}}>{row.seatings}</div>
                        <div style={{textAlign:'right',fontWeight:600,color:'#C2692A'}}>€{row.total.toFixed(2)}</div>
                        <div style={{textAlign:'right',color:'#78716C'}}>€{row.seatings > 0 ? (row.total/row.seatings).toFixed(2) : '0.00'}</div>
                      </div>
                    ))}
                  </div>
                </>
          }
        </div>
      )}

      {tab === 'borde' && (
        <div style={s.content}>
          <h2 style={s.sectionTitle}>{t.openTables}</h2>
          {orders.length === 0
            ? <p style={{color:'#aaa',textAlign:'center'}}>{t.noOpenTables}</p>
            : orders.map(order => (
                <div key={order.id} style={{...s.card, marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontWeight:600}}>{order.tables?.name || 'Ukendt bord'}</span>
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
  header:      {background:'white',borderBottom:'1px solid #e5e5e5',padding:'16px 24px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'},
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