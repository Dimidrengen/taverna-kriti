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
  el: { title:'Μπαρ', noOrders:'Δεν υπάρχουν ενεργές παραγγελίες', done:'Έτοιμο', sending:'Στέλνεται…', drinks:'Ποτά', closeTable:'Κλείσιμο & Πληρωμή', closing:'Κλείνει…', bill:'Λογαριασμός', total:'Σύνολο', allTables:'Τραπέζια', activeDrinks:'Ποτά', delivery:'Παράδοση', tableWord:'Τραπέζι', logout:'Έξοδος', deliver:'Παραδόθηκε', delivered:'✓ Παραδόθηκε', delivering:'...', order:'Παραγγελία', statusReady:'Έτοιμο', noDeliv:'Τίποτα έτοιμο', hide:'Απόκρυψη', sound:'Ήχος', email:'Email', password:'Κωδικός', login:'Σύνδεση', loggingIn:'Σύνδεση...', loginErr:'Λάθος κωδικός', notBar:'Δεν είναι μπαρ', invalidEmail:'Μη έγκυρο email', notFound:'Δεν βρέθηκε', confirmClose:'Κλείσιμο' },
  en: { title:'Bar', noOrders:'No active orders', done:'Done', sending:'Sending…', drinks:'Drinks', closeTable:'Close & Pay', closing:'Closing…', bill:'Bill', total:'Total', allTables:'Tables', activeDrinks:'Drinks', delivery:'Delivery', tableWord:'Table', logout:'Log out', deliver:'Deliver', delivered:'✓ Delivered', delivering:'...', order:'Order', statusReady:'Ready', noDeliv:'Nothing ready for delivery', hide:'Hide', sound:'Sound', email:'Email', password:'Password', login:'Log in', loggingIn:'Logging in...', loginErr:'Wrong email or password', notBar:'Not bar', invalidEmail:'Invalid email', notFound:'Not found', confirmClose:'Close' },
  da: { title:'Bar', noOrders:'Ingen aktive ordrer', done:'Færdig', sending:'Sender…', drinks:'Drikkevarer', closeTable:'Luk & Betal', closing:'Lukker…', bill:'Regning', total:'Total', allTables:'Borde', activeDrinks:'Drikkevarer', delivery:'Levering', tableWord:'Bord', logout:'Log ud', deliver:'Lever', delivered:'✓ Leveret', delivering:'...', order:'Ordre', statusReady:'Klar', noDeliv:'Intet klar til levering', hide:'Skjul', sound:'Lyd', email:'Email', password:'Adgangskode', login:'Log ind', loggingIn:'Logger ind...', loginErr:'Forkert email eller adgangskode', notBar:'Ikke bar', invalidEmail:'Ugyldig email', notFound:'Ikke fundet', confirmClose:'Luk' },
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
      map[key].orders[row.order_id] = { order_id:row.order_id, flow_type:row.flow_type, created_at:row.created_at, order_note:row.order_note, order_number:row.order_number, guest_status:row.guest_status, drinks:[] }
    }
    const translatedName = translations[row.item_id] || row.name
    map[key].orders[row.order_id].drinks.push({ ...row, name: translatedName })
  }
  return Object.values(map)
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

const BAR_ACCENT = '#1E5F8C'
const BAR_ACCENT_SOFT = '#2A7AAD'

const STYLES = `
.bp-page { min-height: 100dvh; background: #FAF5EE; color: #1C1410; font-family: 'Inter', system-ui, sans-serif; padding-bottom: 40px; -webkit-font-smoothing: antialiased; }
.bp-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #E8DFD2; position: sticky; top: 0; background: rgba(250,245,238,0.94); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); z-index: 10; flex-wrap: wrap; }
.bp-brand { flex: 1; min-width: 180px; }
.bp-brand-name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 600; line-height: 1.1; color: #1C1410; letter-spacing: -0.01em; }
.bp-brand-page { font-size: 10px; color: #8B7D6E; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; margin-top: 3px; }
.bp-langrow { display: flex; gap: 4px; }
.bp-lang { padding: 5px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; cursor: pointer; background: transparent; color: #8B7D6E; border: 1px solid #E8DFD2; letter-spacing: 0.1em; transition: all 0.15s; font-family: inherit; }
.bp-lang.active { background: ${BAR_ACCENT}; border-color: ${BAR_ACCENT}; color: white; }
.bp-iconbtn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid #E8DFD2; background: transparent; cursor: pointer; font-size: 16px; display: inline-flex; align-items: center; justify-content: center; color: #1C1410; transition: all 0.15s; }
.bp-iconbtn:hover { background: #F3EBDB; }
.bp-iconbtn.muted { opacity: 0.4; }
.bp-logout { padding: 6px 14px; background: transparent; border: 1px solid #E8DFD2; border-radius: 100px; font-size: 12px; cursor: pointer; color: #8B7D6E; letter-spacing: 0.06em; font-family: inherit; transition: all 0.15s; }
.bp-logout:hover { background: #F3EBDB; color: #1C1410; }
.bp-tabs { display: flex; gap: 0; border-bottom: 1px solid #E8DFD2; padding: 0 20px; overflow-x: auto; background: #FAF5EE; position: sticky; top: 73px; z-index: 9; scrollbar-width: none; }
.bp-tabs::-webkit-scrollbar { display: none; }
.bp-tab { padding: 14px 18px; font-size: 13px; font-weight: 500; cursor: pointer; background: transparent; border: none; color: #8B7D6E; border-bottom: 2px solid transparent; white-space: nowrap; font-family: inherit; letter-spacing: 0.04em; transition: all 0.18s; display: flex; align-items: center; gap: 8px; }
.bp-tab:hover { color: #1C1410; }
.bp-tab.active { color: #1C1410; font-weight: 600; }
.bp-tab.active.t-drinks { border-bottom-color: ${BAR_ACCENT}; }
.bp-tab.active.t-delivery { border-bottom-color: #16A34A; }
.bp-tab.active.t-tables { border-bottom-color: #C2692A; }
.bp-tab-count { font-size: 10px; padding: 2px 7px; border-radius: 100px; background: #E8DFD2; color: #1C1410; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0; }
.bp-tab.active.t-drinks .bp-tab-count { background: ${BAR_ACCENT}; color: white; }
.bp-tab.active.t-delivery .bp-tab-count { background: #16A34A; color: white; }
.bp-tab.active.t-tables .bp-tab-count { background: #C2692A; color: white; }
.bp-grid { display: grid; grid-template-columns: 1fr; gap: 14px; padding: 16px 20px; }
.bp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: calc(100dvh - 130px); padding: 40px; }
.bp-empty-icon { font-size: 56px; opacity: 0.4; margin-bottom: 18px; }
.bp-empty-text { color: #8B7D6E; font-size: 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; }
.bp-card { background: #FFFFFF; border-radius: 14px; border: 1px solid #E8DFD2; overflow: hidden; box-shadow: 0 1px 3px rgba(28,20,16,0.04); }
.bp-card.ready { border-left: 4px solid #16A34A; background: #F4FBF6; box-shadow: 0 4px 18px rgba(22,163,74,0.15); }
.bp-card.late { border-left: 4px solid #DC2626; }
.bp-card-head { padding: 14px 18px; border-bottom: 1px solid #F0E9DC; display: flex; gap: 12px; align-items: center; }
.bp-table-label { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 600; color: #1C1410; flex: 1; letter-spacing: -0.01em; line-height: 1.1; }
.bp-order-row { padding: 8px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F0E9DC; }
.bp-order-num { font-size: 10px; color: ${BAR_ACCENT}; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; }
.bp-time { font-size: 14px; font-weight: 500; color: #1C1410; font-variant-numeric: tabular-nums; }
.bp-age { font-size: 12px; color: #8B7D6E; font-variant-numeric: tabular-nums; }
.bp-age.late { color: #DC2626; font-weight: 600; }
.bp-note { padding: 10px 18px; background: #FEF7E6; border-bottom: 1px solid #F0E9DC; font-size: 13px; color: #92400E; display: flex; gap: 8px; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; }
.bp-section-head { display: flex; align-items: center; padding: 12px 18px 4px; gap: 8px; }
.bp-section-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.bp-section-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; }
.bp-lines { padding: 0 18px 12px; display: flex; flex-direction: column; gap: 8px; }
.bp-line { display: flex; gap: 10px; align-items: center; padding: 2px 0; transition: opacity 0.2s; }
.bp-line.served { opacity: 0.4; }
.bp-line-qty { font-size: 14px; color: #8B7D6E; min-width: 28px; font-variant-numeric: tabular-nums; font-weight: 500; }
.bp-line-name { flex: 1; font-size: 15px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; color: #1C1410; line-height: 1.3; }
.bp-line.served .bp-line-name { text-decoration: line-through; }
.bp-check { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #E8DFD2; background: transparent; cursor: pointer; font-size: 14px; flex-shrink: 0; color: transparent; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
.bp-check:hover { border-color: #16A34A; }
.bp-check.checked { background: #16A34A; border-color: #16A34A; color: white; }
.bp-card-actions { padding: 0 18px 14px; display: flex; gap: 8px; flex-wrap: wrap; }
.bp-btn { flex: 1; min-width: 120px; padding: 11px; background: transparent; border: 1.5px solid; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; cursor: pointer; font-family: inherit; transition: all 0.18s; }
.bp-btn:disabled { opacity: 0.5; cursor: wait; }
.bp-btn-done { border-color: ${BAR_ACCENT}; color: ${BAR_ACCENT}; }
.bp-btn-done:hover { background: ${BAR_ACCENT}; color: white; }
.bp-btn-deliver { width: 100%; padding: 14px; background: #16A34A; border: none; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: white; cursor: pointer; font-family: inherit; transition: all 0.18s; box-shadow: 0 4px 14px rgba(22,163,74,0.25); }
.bp-btn-deliver:hover { background: #15803D; }
.bp-btn-deliver:disabled { opacity: 0.5; cursor: wait; }
.bp-btn-bill { border-color: #E8DFD2; color: #8B7D6E; }
.bp-btn-bill:hover { background: #F3EBDB; color: #1C1410; }
.bp-btn-close { border-color: #DC2626; color: #DC2626; }
.bp-btn-close:hover { background: #DC2626; color: white; }
.bp-bill-box { padding: 14px 18px; background: #FAF5EE; border-bottom: 1px solid #F0E9DC; }
.bp-bill-title { font-size: 10px; color: #8B7D6E; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 700; }
.bp-bill-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #1C1410; font-family: 'Cormorant Garamond', Georgia, serif; }
.bp-bill-total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; margin-top: 12px; border-top: 1px solid #E8DFD2; }
.bp-bill-total-label { font-size: 10px; color: #8B7D6E; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; }
.bp-bill-total-val { font-size: 24px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; color: #1C1410; font-variant-numeric: tabular-nums; }
.bp-ready-meta { font-size: 12px; color: #16A34A; font-weight: 600; letter-spacing: 0.05em; margin-top: 4px; }

@media (min-width: 600px) {
  .bp-grid { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; padding: 20px 24px; }
  .bp-brand-name { font-size: 24px; }
  .bp-table-label { font-size: 28px; }
  .bp-line-name { font-size: 17px; }
  .bp-line-qty { font-size: 15px; min-width: 32px; }
  .bp-time { font-size: 15px; }
}
@media (min-width: 1024px) {
  .bp-grid { grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 18px; padding: 24px 28px; }
  .bp-brand-name { font-size: 28px; }
  .bp-table-label { font-size: 36px; }
  .bp-line-name { font-size: 19px; }
  .bp-line-qty { font-size: 16px; min-width: 36px; font-weight: 600; }
  .bp-check { width: 38px; height: 38px; font-size: 16px; }
  .bp-section-name { font-size: 13px; }
  .bp-order-num { font-size: 11px; }
  .bp-time { font-size: 17px; }
  .bp-age { font-size: 14px; }
  .bp-btn { padding: 13px; font-size: 12px; }
  .bp-btn-deliver { padding: 16px; font-size: 13px; }
  .bp-tab { padding: 16px 22px; font-size: 14px; }
  .bp-bill-total-val { font-size: 28px; }
}
@media (min-width: 1440px) {
  .bp-grid { grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); }
  .bp-table-label { font-size: 40px; }
  .bp-line-name { font-size: 21px; }
}

.bp-login-page { min-height: 100dvh; background: #FAF5EE; display: flex; align-items: center; justify-content: center; padding: 20px; font-family: 'Inter', system-ui, sans-serif; }
.bp-login-card { background: white; border-radius: 16px; border: 1px solid #E8DFD2; padding: 40px 32px; width: 100%; max-width: 380px; }
.bp-login-head { text-align: center; margin-bottom: 32px; }
.bp-login-icon { font-size: 36px; margin-bottom: 14px; }
.bp-login-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 28px; font-weight: 600; color: #1C1410; }
.bp-login-sub { font-size: 11px; color: #8B7D6E; margin-top: 6px; letter-spacing: 0.2em; text-transform: uppercase; }
.bp-input-label { font-size: 10px; color: #8B7D6E; display: block; margin-bottom: 6px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 600; }
.bp-input { width: 100%; padding: 12px 14px; border: 1px solid #E8DFD2; border-radius: 10px; font-size: 15px; font-family: inherit; outline: none; background: #FAF5EE; color: #1C1410; box-sizing: border-box; transition: border-color 0.15s; }
.bp-input:focus { border-color: ${BAR_ACCENT}; }
.bp-err { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #DC2626; margin-bottom: 16px; }
.bp-btn-login { width: 100%; padding: 14px; background: ${BAR_ACCENT}; color: white; border: none; border-radius: 100px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; letter-spacing: 0.15em; text-transform: uppercase; transition: all 0.18s; }
.bp-btn-login:hover { background: ${BAR_ACCENT_SOFT}; }
.bp-btn-login:disabled { opacity: 0.6; cursor: wait; }
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
    if (!data.user.email.startsWith('bar@')) { await supabase.auth.signOut(); setError(t.notBar); setLoading(false); return }
    const slug = extractSlugFromEmail(data.user.email)
    if (!slug) { await supabase.auth.signOut(); setError(t.invalidEmail); setLoading(false); return }
    const { data: restaurant } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
    if (!restaurant || !restaurant.active) { await supabase.auth.signOut(); setError(t.notFound); setLoading(false); return }
    onLogin(data.user, restaurant)
    setLoading(false)
  }

  return (
    <div className="bp-login-page">
      <div className="bp-login-card">
        <div className="bp-login-head">
          <div className="bp-login-icon">🍹</div>
          <div className="bp-login-title">{t.title}</div>
          <div className="bp-login-sub">TableFlow</div>
        </div>
        <form onSubmit={login}>
          <div style={{marginBottom:16}}>
            <label className="bp-input-label">{t.email}</label>
            <input type="email" className="bp-input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{marginBottom:20}}>
            <label className="bp-input-label">{t.password}</label>
            <input type="password" className="bp-input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="bp-err">{error}</div>}
          <button type="submit" disabled={loading} className="bp-btn-login">
            {loading ? t.loggingIn : t.login}
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
  const [readyOrders, setReadyOrders] = useState([])
  const [allTables, setAllTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState({})
  const [closing, setClosing] = useState({})
  const [delivering, setDelivering] = useState({})
  const [bills, setBills] = useState({})
  const [served, setServed] = useState({})
  const [tab, setTab] = useState('drinks')
  const [lang, setLang] = useState('el')
  const [translations, setTrans] = useState({})
  const [tick, setTick] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevDrinkIds = useRef(new Set())
  const prevReadyIds = useRef(new Set())
  const isFirstFetch = useRef(true)
  const t = LANGS[lang]

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tf_bar_sound')
      if (saved === '0') setSoundEnabled(false)
    } catch(e) {}
  }, [])

  const toggleSound = () => {
    setSoundEnabled(s => {
      const nv = !s
      try { localStorage.setItem('tf_bar_sound', nv ? '1' : '0') } catch(e) {}
      if (nv) playOrderDing()
      return nv
    })
  }

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
    const { data: viewData } = await supabase.from('bar_open_orders').select('*').eq('restaurant_id', restaurant.id)
    let newDrinkOrders = []
    if (viewData) {
      const orderIds = [...new Set(viewData.map(r => r.order_id))]
      if (orderIds.length > 0) {
        const { data: orderInfo } = await supabase.from('orders').select('id, order_number, guest_status').in('id', orderIds)
        const orderMap = {}
        orderInfo?.forEach(o => { orderMap[o.id] = o })
        const enriched = viewData.map(r => ({ ...r, order_number: orderMap[r.order_id]?.order_number, guest_status: orderMap[r.order_id]?.guest_status }))
        newDrinkOrders = groupDrinkOrders(enriched, translations)
      }
    }
    setDrinkOrders(newDrinkOrders)
    const drinkIds = new Set()
    newDrinkOrders.forEach(t => Object.values(t.orders).forEach(o => drinkIds.add(o.order_id)))

    const { data: restaurantTables } = await supabase.from('tables').select('id, name, token').eq('restaurant_id', restaurant.id)
    let newReadyOrders = []
    if (restaurantTables && restaurantTables.length > 0) {
      const tableIds = restaurantTables.map(t => t.id)
      const { data: ready } = await supabase
        .from('orders')
        .select('id, order_number, guest_status, created_at, table_id, tables(name, token), order_lines(name, qty, price, course)')
        .eq('status', 'open')
        .eq('guest_status', 'ready')
        .in('table_id', tableIds)
      newReadyOrders = ready || []
    }
    setReadyOrders(newReadyOrders)
    const readyIds = new Set(newReadyOrders.map(o => o.id))

    if (!isFirstFetch.current && soundEnabled) {
      const newDrink = [...drinkIds].filter(id => !prevDrinkIds.current.has(id))
      const newReady = [...readyIds].filter(id => !prevReadyIds.current.has(id))
      if (newDrink.length > 0 || newReady.length > 0) playOrderDing()
    }
    prevDrinkIds.current = drinkIds
    prevReadyIds.current = readyIds
    isFirstFetch.current = false

    setLoading(false)
  }, [translations, restaurant, soundEnabled])

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

  const markDelivered = async (orderId) => {
    setDelivering(d => ({ ...d, [orderId]: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/order-status', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId, newStatus: 'delivered' }),
      })
      fetchOrders()
    } catch(e) { console.error(e) }
    finally { setDelivering(d => { const n={...d}; delete n[orderId]; return n }) }
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
    if (!confirm(`${t.confirmClose} ${getTableLabel(tableName, t.tableWord)}?`)) return
    setClosing(p => ({ ...p, [tableToken]: true }))
    try {
      await fetch('/api/close-table', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tableToken }) })
      setBills(p => { const n={...p}; delete n[tableToken]; return n })
      await fetchAllTables()
    } catch(e) { console.error(e) }
    finally { setClosing(p => { const n={...p}; delete n[tableToken]; return n }) }
  }

  const logout = async () => { await supabase.auth.signOut(); setUser(null); setRestaurant(null) }

  if (authLoading) return <><style dangerouslySetInnerHTML={{__html:STYLES}}/><div className="bp-page"><div className="bp-empty"><div className="bp-empty-text">...</div></div></div></>
  if (!user || !restaurant) return <><style dangerouslySetInnerHTML={{__html:STYLES}}/><LoginScreen onLogin={handleLogin} t={t} /></>

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:STYLES}}/>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div className="bp-page">
        <header className="bp-header">
          <div className="bp-brand">
            <div className="bp-brand-name">{restaurant.name}</div>
            <div className="bp-brand-page">{t.title}</div>
          </div>
          <div className="bp-langrow">
            {Object.keys(LANGS).map(l => (
              <button key={l} onClick={() => changeLang(l)} className={'bp-lang' + (lang===l?' active':'')}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={toggleSound} className={'bp-iconbtn' + (!soundEnabled?' muted':'')} title={t.sound}>
            {soundEnabled ? '🔔' : '🔕'}
          </button>
          <button onClick={logout} className="bp-logout">{t.logout}</button>
        </header>

        <div className="bp-tabs">
          <button onClick={() => setTab('drinks')} className={'bp-tab t-drinks' + (tab==='drinks'?' active':'')}>
            🍹 {t.activeDrinks} {drinkOrders.length > 0 && <span className="bp-tab-count">{drinkOrders.length}</span>}
          </button>
          <button onClick={() => setTab('delivery')} className={'bp-tab t-delivery' + (tab==='delivery'?' active':'')}>
            📦 {t.delivery} {readyOrders.length > 0 && <span className="bp-tab-count">{readyOrders.length}</span>}
          </button>
          <button onClick={() => setTab('tables')} className={'bp-tab t-tables' + (tab==='tables'?' active':'')}>
            🪑 {t.allTables} {allTables.length > 0 && <span className="bp-tab-count">{allTables.length}</span>}
          </button>
        </div>

        {tab === 'drinks' && (
          drinkOrders.length === 0
            ? <div className="bp-empty"><div className="bp-empty-icon">🍹</div><div className="bp-empty-text">{t.noOrders}</div></div>
            : <div className="bp-grid">
                {drinkOrders.map(table => (
                  <div key={table.table_token + '-' + tick} className="bp-card">
                    <div className="bp-card-head">
                      <div className="bp-table-label">{getTableLabel(table.table_label, t.tableWord)}</div>
                    </div>
                    {Object.values(table.orders).filter(o => o.drinks.length > 0).map(order => {
                      const age = formatAge(order.created_at)
                      const time = formatTime(order.created_at)
                      const isLate = age > 20
                      return (
                        <div key={order.order_id}>
                          <div className="bp-order-row">
                            <div>
                              {order.order_number && <div className="bp-order-num">{t.order} #{order.order_number}</div>}
                              <span className="bp-time">{time}</span>
                            </div>
                            <span className={'bp-age' + (isLate?' late':'')}>{age} min</span>
                          </div>
                          {order.order_note && (
                            <div className="bp-note"><span>📝</span><span>{order.order_note}</span></div>
                          )}
                          <div className="bp-section-head">
                            <span className="bp-section-dot" style={{background: BAR_ACCENT}}/>
                            <span className="bp-section-name" style={{color: BAR_ACCENT}}>{t.drinks}</span>
                          </div>
                          <div className="bp-lines">
                            {order.drinks.map(line => {
                              const isServed = !!served[line.line_id]
                              return (
                                <div key={line.line_id} className={'bp-line' + (isServed?' served':'')}>
                                  <span className="bp-line-qty">{line.qty}×</span>
                                  <span className="bp-line-name">{line.name}</span>
                                  <button onClick={() => toggleServed(line.line_id)} className={'bp-check' + (isServed?' checked':'')}>✓</button>
                                </div>
                              )
                            })}
                          </div>
                          <div className="bp-card-actions">
                            <button disabled={pending[order.order_id]} onClick={() => markDone(order.order_id)} className="bp-btn bp-btn-done">
                              {pending[order.order_id] ? t.sending : '✓ ' + t.done}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
        )}

        {tab === 'delivery' && (
          readyOrders.length === 0
            ? <div className="bp-empty"><div className="bp-empty-icon">📦</div><div className="bp-empty-text">{t.noDeliv}</div></div>
            : <div className="bp-grid">
                {readyOrders.map(order => {
                  const age = formatAge(order.created_at)
                  const itemCount = (order.order_lines||[]).reduce((s,l) => s+l.qty, 0)
                  const isLate = age > 20
                  return (
                    <div key={order.id + '-' + tick} className={'bp-card ready' + (isLate?' late':'')}>
                      <div style={{padding:'14px 18px', borderBottom:'1px solid #F0E9DC'}}>
                        {order.order_number && <div className="bp-order-num" style={{color:'#16A34A'}}>{t.order} #{order.order_number}</div>}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center', marginTop:4}}>
                          <div className="bp-table-label">{getTableLabel(order.tables?.name, t.tableWord)}</div>
                          <span className={'bp-age' + (isLate?' late':'')}>{age} min</span>
                        </div>
                        <div className="bp-ready-meta">{t.statusReady} · {itemCount} {t.drinks.toLowerCase()}</div>
                      </div>
                      <div className="bp-lines" style={{paddingTop:12}}>
                        {(order.order_lines||[]).map((line,i) => (
                          <div key={i} className="bp-line">
                            <span className="bp-line-qty">{line.qty}×</span>
                            <span className="bp-line-name">{line.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bp-card-actions">
                        <button disabled={delivering[order.id]} onClick={() => markDelivered(order.id)} className="bp-btn-deliver">
                          {delivering[order.id] ? t.delivering : '📦 ' + t.deliver}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
        )}

        {tab === 'tables' && (
          allTables.length === 0
            ? <div className="bp-empty"><div className="bp-empty-icon">🪑</div><div className="bp-empty-text">{t.noOrders}</div></div>
            : <div className="bp-grid">
                {allTables.map(table => {
                  const bill = bills[table.token]
                  const isClosing = closing[table.token]
                  return (
                    <div key={table.token} className="bp-card">
                      <div className="bp-card-head">
                        <div className="bp-table-label">{getTableLabel(table.name, t.tableWord)}</div>
                      </div>
                      {bill && (
                        <div className="bp-bill-box">
                          <div className="bp-bill-title">{t.bill}</div>
                          {bill.orders && bill.orders.flatMap(o => o.lines).map((l,i) => (
                            <div key={i} className="bp-bill-row">
                              <span>{l.qty}× {l.name}</span><span>€{(l.price*l.qty).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="bp-bill-total">
                            <span className="bp-bill-total-label">{t.total}</span>
                            <span className="bp-bill-total-val">€{bill.grandTotal?.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                      <div className="bp-card-actions" style={{padding:'14px 18px'}}>
                        <button onClick={() => fetchBill(table.token)} className="bp-btn bp-btn-bill">
                          {bill ? '▲ ' + t.hide : '📋 ' + t.bill}
                        </button>
                        <button disabled={isClosing} onClick={() => closeTable(table.token, table.name)} className="bp-btn bp-btn-close">
                          {isClosing ? t.closing : t.closeTable}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
        )}
      </div>
    </>
  )
}