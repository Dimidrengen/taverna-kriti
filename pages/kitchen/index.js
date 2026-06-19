import { useEffect, useState, useCallback, useRef } from 'react'
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
  el: { title:'Κουζίνα', noOrders:'Δεν υπάρχουν ενεργές παραγγελίες', done:'Έτοιμο', sending:'Στέλνεται…', accept:'Έναρξη', accepting:'...', courses:{ starters:'Ορεκτικά', mains:'Κυρίως', sides:'Συνοδευτικά', salads:'Σαλάτες', dessert:'Επιδόρπια' }, flowAll:'Όλα μαζί', flowSeq:'Ανά σειρά', tableWord:'Τραπέζι', logout:'Έξοδος', order:'Παραγγελία', sound:'Ήχος', email:'Email', password:'Κωδικός', login:'Σύνδεση', loggingIn:'Σύνδεση...', loginErr:'Λάθος κωδικός', notKitchen:'Δεν είναι κουζίνα', invalidEmail:'Μη έγκυρο email', notFound:'Δεν βρέθηκε ή απενεργοποιήθηκε' },
  en: { title:'Kitchen', noOrders:'No active orders', done:'Done', sending:'Sending…', accept:'Start', accepting:'...', courses:{ starters:'Starters', mains:'Mains', sides:'Sides', salads:'Salads', dessert:'Dessert' }, flowAll:'All at once', flowSeq:'By course', tableWord:'Table', logout:'Log out', order:'Order', sound:'Sound', email:'Email', password:'Password', login:'Log in', loggingIn:'Logging in...', loginErr:'Wrong email or password', notKitchen:'Not kitchen', invalidEmail:'Invalid email', notFound:'Not found or deactivated' },
  da: { title:'Køkken', noOrders:'Ingen aktive ordrer', done:'Færdig', sending:'Sender…', accept:'Start', accepting:'...', courses:{ starters:'Forretter', mains:'Hovedretter', sides:'Tilbehør', salads:'Salater', dessert:'Dessert' }, flowAll:'Alt på én gang', flowSeq:'Kursvis', tableWord:'Bord', logout:'Log ud', order:'Ordre', sound:'Lyd', email:'Email', password:'Adgangskode', login:'Log ind', loggingIn:'Logger ind...', loginErr:'Forkert email eller adgangskode', notKitchen:'Ikke køkken', invalidEmail:'Ugyldig email', notFound:'Ikke fundet eller deaktiveret' },
}

const COURSE_COLOR = { starters:'#D97706', mains:'#C2692A', sides:'#7C3AED', salads:'#16A34A', dessert:'#DB2777' }
const KITCHEN_COURSES = ['starters','mains','sides','salads','dessert']

function getTableLabel(name, tableWord) {
  if (!name) return name
  return name.replace(/^Table /i, tableWord + ' ').replace(/^Bord /i, tableWord + ' ').replace(/^Τραπέζι /i, tableWord + ' ')
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('da-DK', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Copenhagen' })
}

function formatAge(dateStr) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
}

function groupOrders(rows, translations) {
  const map = {}
  for (const row of rows) {
    if (!KITCHEN_COURSES.includes(row.course)) continue
    if (!map[row.order_id]) {
      map[row.order_id] = { order_id:row.order_id, table_label:row.table_label, flow_type:row.flow_type, created_at:row.created_at, order_note:row.order_note, order_number:row.order_number, guest_status:row.guest_status, courses:{} }
    }
    if (!map[row.order_id].courses[row.course]) map[row.order_id].courses[row.course] = []
    const translatedName = translations[row.item_id] || row.name
    map[row.order_id].courses[row.course].push({ ...row, name: translatedName })
  }
  return Object.values(map).filter(o => Object.keys(o.courses).length > 0).sort((a,b) => new Date(a.created_at)-new Date(b.created_at))
}

let _audioCtx = null
function playOrderDing() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (_audioCtx.state === 'suspended') _audioCtx.resume()
    const now = _audioCtx.currentTime
    const osc1 = _audioCtx.createOscillator(); osc1.frequency.value = 880; osc1.type = 'sine'
    const osc2 = _audioCtx.createOscillator(); osc2.frequency.value = 1318.5; osc2.type = 'sine'
    const gain = _audioCtx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc1.connect(gain); osc2.connect(gain); gain.connect(_audioCtx.destination)
    osc1.start(now); osc2.start(now + 0.08)
    osc1.stop(now + 0.7); osc2.stop(now + 0.8)
  } catch(e) {}
}

const STYLES = `
.kp-page { min-height: 100dvh; background: #FAF5EE; color: #1C1410; font-family: 'Inter', system-ui, sans-serif; padding-bottom: 40px; -webkit-font-smoothing: antialiased; }
.kp-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #E8DFD2; position: sticky; top: 0; background: rgba(250,245,238,0.94); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 10; flex-wrap: wrap; }
.kp-brand { flex: 1; min-width: 180px; }
.kp-brand-name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 600; line-height: 1.1; color: #1C1410; letter-spacing: -0.01em; }
.kp-brand-page { font-size: 10px; color: #8B7D6E; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; margin-top: 3px; }
.kp-counter { font-size: 14px; color: #8B7D6E; font-variant-numeric: tabular-nums; }
.kp-langrow { display: flex; gap: 4px; }
.kp-lang { padding: 5px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; cursor: pointer; background: transparent; color: #8B7D6E; border: 1px solid #E8DFD2; letter-spacing: 0.1em; transition: all 0.15s; font-family: inherit; }
.kp-lang.active { background: #C2692A; border-color: #C2692A; color: white; }
.kp-iconbtn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #E8DFD2; background: transparent; cursor: pointer; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; color: #1C1410; transition: all 0.15s; }
.kp-iconbtn:hover { background: #F3EBDB; }
.kp-iconbtn.muted { opacity: 0.4; }
.kp-logout { padding: 6px 14px; background: transparent; border: 1px solid #E8DFD2; border-radius: 100px; font-size: 12px; cursor: pointer; color: #8B7D6E; letter-spacing: 0.06em; font-family: inherit; transition: all 0.15s; }
.kp-logout:hover { background: #F3EBDB; color: #1C1410; }
.kp-grid { display: grid; grid-template-columns: 1fr; gap: 14px; padding: 16px 20px; max-width: 100%; }
.kp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100dvh - 73px); padding: 40px; }
.kp-empty-icon { font-size: 56px; opacity: 0.4; margin-bottom: 18px; }
.kp-empty-text { color: #8B7D6E; font-size: 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; }
.kp-card { background: #FFFFFF; border-radius: 14px; border: 1px solid #E8DFD2; overflow: hidden; transition: box-shadow 0.18s, transform 0.18s; box-shadow: 0 1px 3px rgba(28,20,16,0.04); }
.kp-card.new { border-left: 4px solid #D97706; box-shadow: 0 4px 18px rgba(217,119,6,0.18); animation: kpPulse 2s ease-out 3; }
.kp-card.preparing { border-left: 4px solid #2563EB; }
.kp-card.late { border-left: 4px solid #DC2626; }
@keyframes kpPulse { 0%,100% { box-shadow: 0 4px 18px rgba(217,119,6,0.18); } 50% { box-shadow: 0 4px 24px rgba(217,119,6,0.32); } }
.kp-card-head { padding: 14px 18px; border-bottom: 1px solid #F0E9DC; display: flex; gap: 12px; align-items: flex-start; }
.kp-card-head-main { flex: 1; min-width: 0; }
.kp-order-num { font-size: 10px; color: #C2692A; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; }
.kp-table-label { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 600; color: #1C1410; line-height: 1.1; margin-top: 2px; letter-spacing: -0.01em; }
.kp-card-head-meta { text-align: right; display: flex; flex-direction: column; gap: 2px; }
.kp-time { font-size: 14px; font-weight: 500; color: #1C1410; font-variant-numeric: tabular-nums; }
.kp-age { font-size: 12px; color: #8B7D6E; font-variant-numeric: tabular-nums; }
.kp-age.late { color: #DC2626; font-weight: 600; }
.kp-flow-tag { font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 100px; letter-spacing: 0.1em; text-transform: uppercase; flex-shrink: 0; }
.kp-flow-tag.seq { background: rgba(37,99,235,0.1); color: #1E40AF; }
.kp-flow-tag.all { background: rgba(22,163,74,0.1); color: #15803D; }
.kp-note { padding: 12px 18px; background: #FEF7E6; border-bottom: 1px solid #F0E9DC; font-size: 13px; color: #92400E; display: flex; gap: 8px; align-items: flex-start; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; }
.kp-accept-wrap { padding: 14px 18px; background: rgba(217,119,6,0.06); border-bottom: 1px solid #F0E9DC; }
.kp-btn-accept { width: 100%; padding: 12px; background: #D97706; color: white; border: none; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.kp-btn-accept:hover { background: #B45309; }
.kp-btn-accept:disabled { opacity: 0.5; cursor: wait; }
.kp-course { padding: 14px 18px; border-bottom: 1px solid #F0E9DC; }
.kp-course:last-child { border-bottom: none; }
.kp-course-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.kp-course-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.kp-course-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; }
.kp-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.kp-item { display: flex; gap: 10px; align-items: center; padding: 2px 0; transition: opacity 0.2s; }
.kp-item.served { opacity: 0.4; }
.kp-item-qty { font-size: 14px; color: #8B7D6E; min-width: 28px; font-variant-numeric: tabular-nums; font-weight: 500; }
.kp-item-name { flex: 1; font-size: 15px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; color: #1C1410; line-height: 1.3; }
.kp-item.served .kp-item-name { text-decoration: line-through; }
.kp-check { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #E8DFD2; background: transparent; cursor: pointer; font-size: 14px; flex-shrink: 0; color: transparent; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
.kp-check:hover { border-color: #16A34A; }
.kp-check.checked { background: #16A34A; border-color: #16A34A; color: white; }
.kp-btn-done { margin-top: 12px; width: 100%; padding: 11px; background: transparent; border: 1.5px solid; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; font-family: inherit; transition: all 0.18s; }
.kp-btn-done:disabled { opacity: 0.5; cursor: wait; }

@media (min-width: 600px) {
  .kp-grid { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; padding: 20px 24px; }
  .kp-brand-name { font-size: 24px; }
  .kp-table-label { font-size: 28px; }
  .kp-item-name { font-size: 17px; }
  .kp-item-qty { font-size: 15px; min-width: 32px; }
  .kp-time { font-size: 15px; }
  .kp-age { font-size: 13px; }
}
@media (min-width: 1024px) {
  .kp-grid { grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 18px; padding: 24px 28px; }
  .kp-brand-name { font-size: 28px; }
  .kp-table-label { font-size: 36px; }
  .kp-item-name { font-size: 19px; }
  .kp-item-qty { font-size: 16px; min-width: 36px; font-weight: 600; }
  .kp-check { width: 38px; height: 38px; font-size: 16px; }
  .kp-course-name { font-size: 13px; }
  .kp-order-num { font-size: 11px; }
  .kp-time { font-size: 17px; }
  .kp-age { font-size: 14px; }
  .kp-btn-done { padding: 13px; font-size: 12px; }
  .kp-btn-accept { padding: 14px; font-size: 13px; }
}
@media (min-width: 1440px) {
  .kp-grid { grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); }
  .kp-table-label { font-size: 40px; }
  .kp-item-name { font-size: 21px; }
}

.kp-login-page { min-height: 100dvh; background: #FAF5EE; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Inter', system-ui, sans-serif; }
.kp-login-card { background: white; border-radius: 16px; border: 1px solid #E8DFD2; padding: 40px 32px; width: 100%; max-width: 380px; }
.kp-login-head { text-align: center; margin-bottom: 32px; }
.kp-login-icon { font-size: 36px; margin-bottom: 14px; }
.kp-login-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 600; color: #1C1410; }
.kp-login-sub { font-size: 11px; color: #8B7D6E; margin-top: 6px; letter-spacing: 0.2em; text-transform: uppercase; }
.kp-input-label { font-size: 10px; color: #8B7D6E; display: block; margin-bottom: 6px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 600; }
.kp-input { width: 100%; padding: 12px 14px; border: 1px solid #E8DFD2; border-radius: 10px; font-size: 15px; font-family: inherit; outline: none; background: #FAF5EE; color: #1C1410; box-sizing: border-box; transition: border-color 0.15s; }
.kp-input:focus { border-color: #C2692A; }
.kp-err { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #DC2626; margin-bottom: 16px; }
.kp-btn-login { width: 100%; padding: 14px; background: #C2692A; color: white; border: none; border-radius: 100px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; letter-spacing: 0.15em; text-transform: uppercase; transition: all 0.18s; }
.kp-btn-login:hover { background: #A8572A; }
.kp-btn-login:disabled { opacity: 0.6; cursor: wait; }
`

function LoginScreen({ onLogin, t }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) { setError(t.loginErr); setLoading(false); return }
    if (!data.user.email.startsWith('kitchen@')) { await supabase.auth.signOut(); setError(t.notKitchen); setLoading(false); return }
    const slug = extractSlugFromEmail(data.user.email)
    if (!slug) { await supabase.auth.signOut(); setError(t.invalidEmail); setLoading(false); return }
    const { data: restaurant } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
    if (!restaurant || !restaurant.active) { await supabase.auth.signOut(); setError(t.notFound); setLoading(false); return }
    onLogin(data.user, restaurant)
    setLoading(false)
  }

  return (
    <div className="kp-login-page">
      <div className="kp-login-card">
        <div className="kp-login-head">
          <div className="kp-login-icon">🍳</div>
          <div className="kp-login-title">{t.title}</div>
          <div className="kp-login-sub">TableFlow</div>
        </div>
        <form onSubmit={login}>
          <div style={{marginBottom:16}}>
            <label className="kp-input-label">{t.email}</label>
            <input type="email" className="kp-input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{marginBottom:20}}>
            <label className="kp-input-label">{t.password}</label>
            <input type="password" className="kp-input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="kp-err">{error}</div>}
          <button type="submit" disabled={loading} className="kp-btn-login">
            {loading ? t.loggingIn : t.login}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function KitchenPage() {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState({})
  const [served, setServed] = useState({})
  const [accepting, setAccepting] = useState({})
  const [lang, setLang] = useState('el')
  const [translations, setTrans] = useState({})
  const [tick, setTick] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevOrderIds = useRef(new Set())
  const isFirstFetch = useRef(true)
  const t = LANGS[lang]

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tf_kitchen_sound')
      if (saved === '0') setSoundEnabled(false)
    } catch(e) {}
  }, [])

  const toggleSound = () => {
    setSoundEnabled(s => {
      const nv = !s
      try { localStorage.setItem('tf_kitchen_sound', nv ? '1' : '0') } catch(e) {}
      if (nv) playOrderDing()
      return nv
    })
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email?.startsWith('kitchen@')) {
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
    const { data: viewData } = await supabase.from('kitchen_active_orders').select('*').eq('restaurant_id', restaurant.id)
    if (!viewData) { setLoading(false); return }
    const orderIds = [...new Set(viewData.map(r => r.order_id))]
    const { data: orderInfo } = await supabase.from('orders').select('id, order_number, guest_status').in('id', orderIds)
    const orderMap = {}
    orderInfo?.forEach(o => { orderMap[o.id] = o })
    const enriched = viewData.map(r => ({ ...r, order_number: orderMap[r.order_id]?.order_number, guest_status: orderMap[r.order_id]?.guest_status }))
    const grouped = groupOrders(enriched, translations)
    const newIds = new Set(grouped.map(o => o.order_id))
    if (!isFirstFetch.current && soundEnabled) {
      const newOnes = [...newIds].filter(id => !prevOrderIds.current.has(id))
      if (newOnes.length > 0) playOrderDing()
    }
    prevOrderIds.current = newIds
    isFirstFetch.current = false
    setOrders(grouped)
    setLoading(false)
  }, [translations, restaurant, soundEnabled])

  useEffect(() => { if (user) fetchTranslations(lang) }, [lang, user])
  useEffect(() => { if (user && restaurant) fetchOrders() }, [translations, restaurant])

  useEffect(() => {
    if (!user || !restaurant) return
    const channel = supabase.channel('kitchen-realtime-' + restaurant.id)
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, fetchOrders)
      .on('postgres_changes', { event:'*', schema:'public', table:'order_lines' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchOrders, user, restaurant])

  const changeLang = (l) => { setLang(l); fetchTranslations(l).then(() => fetchOrders()) }

  const markDone = async (orderId, course) => {
    const key = `${orderId}-${course}`
    setPending(p => ({ ...p, [key]: true }))
    try {
      await fetch('/api/course-done', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId, course }) })
    } catch(e) { console.error(e) }
    finally { setPending(p => { const n={...p}; delete n[key]; return n }) }
  }

  const acceptOrder = async (orderId) => {
    setAccepting(a => ({ ...a, [orderId]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/order-status', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId, newStatus: 'preparing' }),
      })
      fetchOrders()
    } catch(e) { console.error(e) }
    finally { setAccepting(a => { const n={...a}; delete n[orderId]; return n }) }
  }

  const toggleServed = async (lineId) => {
    const isServed = !!served[lineId]
    setServed(p => ({ ...p, [lineId]: !isServed }))
    await supabase.from('order_lines').update({ served_at: isServed ? null : new Date().toISOString() }).eq('id', lineId)
  }

  const logout = async () => { await supabase.auth.signOut(); setUser(null); setRestaurant(null) }

  if (authLoading) return <><style dangerouslySetInnerHTML={{__html:STYLES}}/><div className="kp-page"><div className="kp-empty"><div className="kp-empty-text">...</div></div></div></>
  if (!user || !restaurant) return <><style dangerouslySetInnerHTML={{__html:STYLES}}/><LoginScreen onLogin={handleLogin} t={t} /></>

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:STYLES}}/>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div className="kp-page">
        <header className="kp-header">
          <div className="kp-brand">
            <div className="kp-brand-name">{restaurant.name}</div>
            <div className="kp-brand-page">{t.title}</div>
          </div>
          <span className="kp-counter">{orders.length}</span>
          <div className="kp-langrow">
            {Object.keys(LANGS).map(l => (
              <button key={l} onClick={() => changeLang(l)} className={'kp-lang' + (lang===l?' active':'')}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={toggleSound} className={'kp-iconbtn' + (!soundEnabled?' muted':'')} title={t.sound}>
            {soundEnabled ? '🔔' : '🔕'}
          </button>
          <button onClick={logout} className="kp-logout">{t.logout}</button>
        </header>

        {loading || orders.length === 0
          ? <div className="kp-empty"><div className="kp-empty-icon">🍳</div><div className="kp-empty-text">{t.noOrders}</div></div>
          : <div className="kp-grid">
              {orders.map(order => (
                <OrderCard key={order.order_id + '-' + tick} order={order} pending={pending} served={served} accepting={accepting} onAccept={acceptOrder} onMarkDone={markDone} onToggleServed={toggleServed} t={t} />
              ))}
            </div>
        }
      </div>
    </>
  )
}

function OrderCard({ order, pending, served, accepting, onAccept, onMarkDone, onToggleServed, t }) {
  const age = formatAge(order.created_at)
  const time = formatTime(order.created_at)
  const isReceived = order.guest_status === 'received'
  const isLate = age > 20
  const cardClass = 'kp-card' + (isReceived ? ' new' : isLate ? ' late' : order.guest_status === 'preparing' ? ' preparing' : '')

  return (
    <div className={cardClass}>
      <div className="kp-card-head">
        <div className="kp-card-head-main">
          {order.order_number && <div className="kp-order-num">{t.order} #{order.order_number}</div>}
          <div className="kp-table-label">{getTableLabel(order.table_label, t.tableWord)}</div>
        </div>
        <div className="kp-card-head-meta">
          <span className="kp-time">{time}</span>
          <span className={'kp-age' + (isLate ? ' late' : '')}>{age} min</span>
        </div>
        <span className={'kp-flow-tag ' + (order.flow_type==='sequential' ? 'seq' : 'all')}>
          {order.flow_type==='sequential' ? t.flowSeq : t.flowAll}
        </span>
      </div>
      {order.order_note && (
        <div className="kp-note">
          <span>📝</span><span>{order.order_note}</span>
        </div>
      )}
      {isReceived && (
        <div className="kp-accept-wrap">
          <button onClick={() => onAccept(order.order_id)} disabled={accepting[order.order_id]} className="kp-btn-accept">
            {accepting[order.order_id] ? t.accepting : '▶ ' + t.accept}
          </button>
        </div>
      )}
      {Object.entries(order.courses).map(([course, lines]) => {
        const key = `${order.order_id}-${course}`
        const color = COURSE_COLOR[course] || '#8B7D6E'
        return (
          <div key={course} className="kp-course">
            <div className="kp-course-head">
              <span className="kp-course-dot" style={{background: color}}/>
              <span className="kp-course-name" style={{color}}>{t.courses[course] || course}</span>
            </div>
            <ul className="kp-items">
              {lines.map(line => {
                const isServed = !!served[line.line_id]
                return (
                  <li key={line.line_id} className={'kp-item' + (isServed?' served':'')}>
                    <span className="kp-item-qty">{line.qty}×</span>
                    <span className="kp-item-name">{line.name}</span>
                    <button onClick={() => onToggleServed(line.line_id)} className={'kp-check' + (isServed?' checked':'')}>✓</button>
                  </li>
                )
              })}
            </ul>
            <button className="kp-btn-done" style={{borderColor: color, color}} disabled={pending[key]} onClick={() => onMarkDone(order.order_id, course)}>
              {pending[key] ? t.sending : '✓ ' + t.done}
            </button>
          </div>
        )
      })}
    </div>
  )
}