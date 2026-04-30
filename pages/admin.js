import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const PLAN_TABLE_LIMITS = { trial: 15, basic: 15, pro: 50, enterprise: 9999 }
const PLAN_PRICES = { trial: 0, basic: 100, pro: 200, enterprise: 300 }
const LIVE_STATUS_PLANS = ['pro', 'enterprise']

// All supported languages with display info
const ALL_LANGS_INFO = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'da', flag: '🇩🇰', name: 'Dansk' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'el', flag: '🇬🇷', name: 'Ελληνικά' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'sv', flag: '🇸🇪', name: 'Svenska' },
  { code: 'no', flag: '🇳🇴', name: 'Norsk' },
  { code: 'fi', flag: '🇫🇮', name: 'Suomi' },
]

function getLangInfo(code) {
  return ALL_LANGS_INFO.find(l => l.code === code) || { code, flag: '🌐', name: code.toUpperCase() }
}

function extractSlugFromEmail(email) {
  const match = email.match(/^(admin|kitchen|bar)@(.+)\.com$/i)
  return match ? match[2] : null
}

const LOGIN_LANGS = {
  en: { title: 'Admin', subtitle: 'TableFlow', email: 'Email', password: 'Password', login: 'Log in', loggingIn: 'Logging in...', forgot: 'Forgot password?', sending: 'Sending...', hint: 'Kitchen and bar: contact your administrator to reset your password.', err_credentials: 'Wrong email or password', err_notAdmin: 'Not admin', err_invalidEmail: 'Invalid email', err_notFound: 'Restaurant not found', err_deactivated: 'Restaurant deactivated', err_enterEmail: 'Enter your admin email first', err_adminOnly: 'Forgot password is only for admin. Kitchen/bar: contact your administrator.', resetSent: 'If the account exists, a reset link has been sent. Check your inbox (and spam).' },
  da: { title: 'Admin', subtitle: 'TableFlow', email: 'Email', password: 'Adgangskode', login: 'Log ind', loggingIn: 'Logger ind...', forgot: 'Glemt adgangskode?', sending: 'Sender...', hint: 'Kitchen og bar: kontakt din administrator for at få nulstillet adgangskoden.', err_credentials: 'Forkert email eller adgangskode', err_notAdmin: 'Ikke admin', err_invalidEmail: 'Ugyldig email', err_notFound: 'Restaurant ikke fundet', err_deactivated: 'Restaurant deaktiveret', err_enterEmail: 'Indtast din admin-email først', err_adminOnly: 'Glemt adgangskode er kun for admin. Kitchen/bar: kontakt din administrator.', resetSent: 'Hvis kontoen findes, er der sendt en email med reset-link. Tjek din indbakke (og spam).' },
  el: { title: 'Διαχειριστής', subtitle: 'TableFlow', email: 'Email', password: 'Κωδικός', login: 'Σύνδεση', loggingIn: 'Σύνδεση...', forgot: 'Ξέχασες τον κωδικό;', sending: 'Αποστολή...', hint: 'Κουζίνα και μπαρ: επικοινωνήστε με τον διαχειριστή σας.', err_credentials: 'Λάθος email ή κωδικός', err_notAdmin: 'Δεν είσαι admin', err_invalidEmail: 'Μη έγκυρο email', err_notFound: 'Το εστιατόριο δεν βρέθηκε', err_deactivated: 'Το εστιατόριο είναι απενεργοποιημένο', err_enterEmail: 'Εισάγετε το email του admin πρώτα', err_adminOnly: 'Η επαναφορά κωδικού είναι μόνο για admin.', resetSent: 'Εάν ο λογαριασμός υπάρχει, στάλθηκε σύνδεσμος επαναφοράς.' },
}

const LANGS = {
  da: { menu:'🍽 Menu', revenue:'📊 Omsætning', tables:'🪑 Borde', settings:'⚙️ Indstillinger', menuItems:'Menupunkter', addItem:'+ Tilføj ret', newItem:'Ny ret', name:'Navn', description:'Beskrivelse', price:'Pris (€)', kitchen:'Køkken', bar:'Bar', save:'Gem', saving:'Gemmer...', cancel:'Annuller', active:'✓ Aktiv', inactive:'✗ Inaktiv', edit:'✏️ Rediger', translate:'🌍 Oversæt', todayRevenue:'Dagens omsætning', totalToday:'Total i dag', closedTables:'lukkede borde', noClosedTables:'Ingen lukkede borde i dag endnu', openTables:'Åbne borde', noOpenTables:'Ingen åbne borde', loading:'Indlæser...', resetRevenue:'Nulstil omsætning', resetConfirm:'Er du sikker? Dette nulstiller også ordrenumre.', resetYes:'Ja, nulstil', resetNo:'Annuller', resetting:'Nulstiller...', stats:'📈 Statistik', today:'I dag', thisWeek:'Denne uge', thisMonth:'Denne måned', allTime:'Alt', table:'Bord', seatings:'Seatings', totalRevenue:'Total omsætning', avgPerSeating:'Gns. per seating', noStats:'Ingen data', uploadImage:'Upload billede', removeImage:'Fjern billede', uploading:'Uploader...', logout:'Log ud', noItems:'Ingen menupunkter endnu', tableName:'Bord navn', addTable:'+ Tilføj bord', printAllQR:'🖨 Print alle QR', viewQR:'📱 QR-kode', rename:'Omdøb', deactivate:'⏸ Deaktiver', activate:'▶ Aktiver', deleteTable:'🗑 Slet', confirmDelete:'Er du sikker på du vil slette dette bord?', tablesUsed:'borde brugt', upgradePlan:'Opgrader plan for at tilføje flere borde', password:'Adgangskode', changePassword:'Skift adgangskode', newPassword:'Ny adgangskode', passwordMin:'Min. 8 tegn', passwordChanged:'Adgangskode opdateret!', planInfo:'Plan information', currentPlan:'Nuværende plan', liveStatus:'Live ordre status for gæster', liveStatusDesc:'Gæster kan se live status af deres ordre (Modtaget → Tilberedes → Klar → Leveret) og ordrenummer', liveStatusUpgrade:'⭐ Opgrader til Pro eller Enterprise for at aktivere denne feature', liveStatusSaved:'Indstilling gemt', resetPwBtn:'Reset', tempPwTitle:'Midlertidig adgangskode — kopier nu, vises kun én gang!', copy:'Kopier', hide:'Skjul', resetPwConfirm:'Generer ny midlertidig adgangskode for {role}?', sourceLangHint:'Du tilføjer retter på {lang}. Klik 🌍 på en ret for at oversætte til andre sprog.', translateTitle:'Oversæt: {name}', autoTranslate:'🤖 Auto-oversæt alle', autoTranslating:'Oversætter...', saveTranslations:'Gem oversættelser', sourceLanguageLabel:'Kilde-sprog (skrives af admin)', translationFor:'Oversættelse for', autoFillThis:'🤖 Auto-fyld', translateInfo:'Tomt felt = brug auto-oversæt eller original tekst som fallback', translationsSaved:'Oversættelser gemt!', translateError:'Oversættelse fejlede' },
  en: { menu:'🍽 Menu', revenue:'📊 Revenue', tables:'🪑 Tables', settings:'⚙️ Settings', menuItems:'Menu items', addItem:'+ Add item', newItem:'New item', name:'Name', description:'Description', price:'Price (€)', kitchen:'Kitchen', bar:'Bar', save:'Save', saving:'Saving...', cancel:'Cancel', active:'✓ Active', inactive:'✗ Inactive', edit:'✏️ Edit', translate:'🌍 Translate', todayRevenue:"Today's revenue", totalToday:'Total today', closedTables:'closed tables', noClosedTables:'No closed tables today', openTables:'Open tables', noOpenTables:'No open tables', loading:'Loading...', resetRevenue:'Reset revenue', resetConfirm:'Are you sure? This also resets order numbers.', resetYes:'Yes, reset', resetNo:'Cancel', resetting:'Resetting...', stats:'📈 Statistics', today:'Today', thisWeek:'This week', thisMonth:'This month', allTime:'All time', table:'Table', seatings:'Seatings', totalRevenue:'Total revenue', avgPerSeating:'Avg. per seating', noStats:'No data', uploadImage:'Upload image', removeImage:'Remove', uploading:'Uploading...', logout:'Log out', noItems:'No menu items yet', tableName:'Table name', addTable:'+ Add table', printAllQR:'🖨 Print all QR', viewQR:'📱 QR code', rename:'Rename', deactivate:'⏸ Deactivate', activate:'▶ Activate', deleteTable:'🗑 Delete', confirmDelete:'Delete this table?', tablesUsed:'tables used', upgradePlan:'Upgrade plan to add more tables', password:'Password', changePassword:'Change password', newPassword:'New password', passwordMin:'Min. 8 chars', passwordChanged:'Password updated!', planInfo:'Plan information', currentPlan:'Current plan', liveStatus:'Live order status for guests', liveStatusDesc:'Guests can see live order status (Received → Preparing → Ready → Delivered) and order number', liveStatusUpgrade:'⭐ Upgrade to Pro or Enterprise to enable this feature', liveStatusSaved:'Setting saved', resetPwBtn:'Reset', tempPwTitle:'Temporary password — copy now, shown only once!', copy:'Copy', hide:'Hide', resetPwConfirm:'Generate new temporary password for {role}?', sourceLangHint:'You\'re adding dishes in {lang}. Click 🌍 on a dish to translate to other languages.', translateTitle:'Translate: {name}', autoTranslate:'🤖 Auto-translate all', autoTranslating:'Translating...', saveTranslations:'Save translations', sourceLanguageLabel:'Source language (written by admin)', translationFor:'Translation for', autoFillThis:'🤖 Auto-fill', translateInfo:'Empty field = use auto-translate or original text as fallback', translationsSaved:'Translations saved!', translateError:'Translation failed' },
  el: { menu:'🍽 Μενού', revenue:'📊 Έσοδα', tables:'🪑 Τραπέζια', settings:'⚙️ Ρυθμίσεις', menuItems:'Στοιχεία μενού', addItem:'+ Προσθήκη', newItem:'Νέο πιάτο', name:'Όνομα', description:'Περιγραφή', price:'Τιμή (€)', kitchen:'Κουζίνα', bar:'Μπαρ', save:'Αποθήκευση', saving:'...', cancel:'Ακύρωση', active:'✓', inactive:'✗', edit:'✏️', translate:'🌍 Μετάφραση', todayRevenue:'Έσοδα', totalToday:'Σύνολο', closedTables:'κλειστά', noClosedTables:'Κανένα', openTables:'Ανοιχτά', noOpenTables:'Κανένα', loading:'Φόρτωση...', resetRevenue:'Επαναφορά', resetConfirm:'Σίγουρα;', resetYes:'Ναι', resetNo:'Ακύρωση', resetting:'...', stats:'📈 Στατιστικά', today:'Σήμερα', thisWeek:'Εβδομάδα', thisMonth:'Μήνα', allTime:'Όλα', table:'Τραπέζι', seatings:'Seatings', totalRevenue:'Σύνολο', avgPerSeating:'Μέσος', noStats:'Κανένα', uploadImage:'Upload', removeImage:'Αφαίρεση', uploading:'...', logout:'Αποσύνδεση', noItems:'Κανένα', tableName:'Όνομα', addTable:'+ Προσθήκη', printAllQR:'🖨 QR', viewQR:'📱 QR', rename:'Μετονομασία', deactivate:'⏸', activate:'▶', deleteTable:'🗑', confirmDelete:'Διαγραφή;', tablesUsed:'τραπέζια', upgradePlan:'Αναβάθμιση', password:'Κωδικός', changePassword:'Αλλαγή', newPassword:'Νέος', passwordMin:'Min 8', passwordChanged:'OK!', planInfo:'Plan', currentPlan:'Plan', liveStatus:'Live status παραγγελιών', liveStatusDesc:'Live status', liveStatusUpgrade:'⭐ Pro/Enterprise', liveStatusSaved:'OK', resetPwBtn:'Επαναφορά', tempPwTitle:'Προσωρινός κωδικός', copy:'Αντιγραφή', hide:'Απόκρυψη', resetPwConfirm:'Νέος κωδικός για {role};', sourceLangHint:'Προσθέτετε πιάτα στα {lang}. Κάντε κλικ 🌍 για μετάφραση.', translateTitle:'Μετάφραση: {name}', autoTranslate:'🤖 Αυτόματη μετάφραση', autoTranslating:'Μετάφραση...', saveTranslations:'Αποθήκευση', sourceLanguageLabel:'Γλώσσα πηγής', translationFor:'Μετάφραση για', autoFillThis:'🤖 Αυτόματη', translateInfo:'Άδειο = χρήση αυτόματης μετάφρασης', translationsSaved:'Αποθηκεύτηκε!', translateError:'Σφάλμα' },
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

function LoginScreen({ onLogin }) {
  const [loginLang, setLoginLang] = useState('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tf_login_lang')
      if (saved && LOGIN_LANGS[saved]) setLoginLang(saved)
    } catch {}
  }, [])

  const changeLang = (l) => {
    setLoginLang(l)
    try { localStorage.setItem('tf_login_lang', l) } catch {}
  }

  const lt = LOGIN_LANGS[loginLang]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSending, setResetSending] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setResetMsg('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) { setError(lt.err_credentials); setLoading(false); return }
    if (!data.user.email.startsWith('admin@')) { await supabase.auth.signOut(); setError(lt.err_notAdmin); setLoading(false); return }
    const slug = extractSlugFromEmail(data.user.email)
    if (!slug) { await supabase.auth.signOut(); setError(lt.err_invalidEmail); setLoading(false); return }
    const { data: restaurant } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
    if (!restaurant) { await supabase.auth.signOut(); setError(lt.err_notFound); setLoading(false); return }
    if (!restaurant.active) { await supabase.auth.signOut(); setError(lt.err_deactivated); setLoading(false); return }
    onLogin(data.user, restaurant)
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    setError(''); setResetMsg('')
    if (!email) { setError(lt.err_enterEmail); return }
    if (!email.startsWith('admin@')) { setError(lt.err_adminOnly); return }
    setResetSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSending(false)
    if (error) { setError(error.message); return }
    setResetMsg(lt.resetSent)
  }

  return (
    <div style={{minHeight:'100vh',background:'#F5F5F0',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',padding:20}}>
      <div style={{background:'white',borderRadius:16,border:'1px solid #e5e5e5',padding:40,width:'100%',maxWidth:380}}>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:24}}>
          {['en','da','el'].map(l => (
            <button key={l} type="button" onClick={() => changeLang(l)}
              style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',background:loginLang===l?'#C2692A':'transparent',color:loginLang===l?'white':'#888',border:loginLang===l?'none':'1px solid #ddd',fontFamily:'system-ui'}}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:12}}>⚙️</div>
          <div style={{fontSize:22,fontWeight:700,color:'#1C1917'}}>{lt.title}</div>
          <div style={{fontSize:14,color:'#78716C',marginTop:4}}>{lt.subtitle}</div>
        </div>
        <form onSubmit={login}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:13,color:'#78716C',display:'block',marginBottom:6}}>{lt.email}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e5e5',borderRadius:10,fontSize:15,fontFamily:'system-ui',outline:'none',boxSizing:'border-box'}} />
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:13,color:'#78716C',display:'block',marginBottom:6}}>{lt.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{width:'100%',padding:'10px 14px',border:'1px solid #e5e5e5',borderRadius:10,fontSize:15,fontFamily:'system-ui',outline:'none',boxSizing:'border-box'}} />
          </div>
          {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626',marginBottom:16}}>{error}</div>}
          {resetMsg && <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#15803D',marginBottom:16}}>{resetMsg}</div>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:'12px',background:'#C2692A',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'}}>
            {loading ? lt.loggingIn : lt.login}
          </button>
          <div style={{textAlign:'center',marginTop:16}}>
            <button type="button" onClick={handleForgotPassword} disabled={resetSending}
              style={{background:'transparent',border:'none',color:'#78716C',fontSize:13,cursor:'pointer',textDecoration:'underline',fontFamily:'system-ui'}}>
              {resetSending ? lt.sending : lt.forgot}
            </button>
          </div>
          <div style={{marginTop:20,padding:'10px 12px',background:'#FAFAF7',border:'1px solid #e5e5e5',borderRadius:8,fontSize:11,color:'#78716C',lineHeight:1.5,textAlign:'center'}}>
            {lt.hint}
          </div>
        </form>
      </div>
    </div>
  )
}

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
      {currentUrl && <img src={currentUrl} alt="" style={{width:48,height:48,borderRadius:8,objectFit:'cover',border:'1px solid #e5e5e5'}} />}
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={upload} />
      <button type="button" onClick={() => fileRef.current.click()} disabled={uploading} style={{padding:'6px 12px',background:'#f5f5f0',border:'1px solid #e5e5e5',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'system-ui'}}>
        {uploading ? t.uploading : (currentUrl ? '🔄 ' + t.uploadImage : '📷 ' + t.uploadImage)}
      </button>
      {currentUrl && (
        <button type="button" onClick={remove} style={{padding:'6px 12px',background:'#FEE2E2',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',color:'#dc2626',fontFamily:'system-ui'}}>{t.removeImage}</button>
      )}
    </div>
  )
}

function QrModal({ table, restaurant, onClose, t }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const menuUrl = `${baseUrl}/menu.html?restaurant=${restaurant.slug}&table=${table.token}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(menuUrl)}&margin=20`
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:'white',borderRadius:16,padding:32,maxWidth:450,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:12,color:'#78716C',textTransform:'uppercase',letterSpacing:'0.15em',marginBottom:4}}>{restaurant.name}</div>
        <div style={{fontSize:28,fontWeight:800,color:'#1C1917',marginBottom:20}}>{table.name}</div>
        <img src={qrSrc} alt="QR" style={{width:'100%',maxWidth:300,margin:'0 auto',border:'1px solid #e5e5e5'}} />
        <div style={{fontSize:14,color:'#1C1917',marginTop:12,fontWeight:600}}>📱 Scan to order</div>
        <div style={{fontSize:10,color:'#aaa',marginTop:12,fontFamily:'monospace',wordBreak:'break-all'}}>{menuUrl}</div>
        <div style={{display:'flex',gap:8,marginTop:20}}>
          <button onClick={() => navigator.clipboard.writeText(menuUrl)} style={{flex:1,padding:'10px',background:'#f5f5f0',border:'1px solid #e5e5e5',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>📋 Copy URL</button>
          <button onClick={onClose} style={{flex:1,padding:'10px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>Close</button>
        </div>
      </div>
    </div>
  )
}

// === TRANSLATION MODAL ===
function TranslateModal({ item, sourceLang, onClose, onSaved, t }) {
  const [loading, setLoading] = useState(true)
  const [autoTranslating, setAutoTranslating] = useState(false)
  const [perFieldLoading, setPerFieldLoading] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [translations, setTranslations] = useState({})

  // Target languages = all languages except source
  const targetLangs = ALL_LANGS_INFO.filter(l => l.code !== sourceLang)
  const sourceInfo = getLangInfo(sourceLang)

  // Load existing translations on open
  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`/api/get-translations?itemId=${item.id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (data.success) {
          // Initialize empty entries for missing langs
          const map = {}
          for (const lang of targetLangs) {
            map[lang.code] = data.translations[lang.code] || { name: '', description: '' }
          }
          setTranslations(map)
        }
      } catch (err) {
        setError(err.message)
      }
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const updateField = (lang, field, value) => {
    setTranslations(prev => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }))
    setSuccess('')
  }

  const autoTranslateAll = async () => {
    setAutoTranslating(true); setError(''); setSuccess('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          itemId: item.id,
          name: item.name,
          description: item.description || '',
          targetLangs: targetLangs.map(l => l.code),
          save: false,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || t.translateError)
      const newMap = { ...translations }
      for (const [lang, tr] of Object.entries(data.translations)) {
        if (tr && !tr.error) {
          newMap[lang] = { name: tr.name || '', description: tr.description || '' }
        }
      }
      setTranslations(newMap)
    } catch (err) {
      setError(err.message)
    }
    setAutoTranslating(false)
  }

  const autoTranslateOne = async (lang) => {
    setPerFieldLoading(p => ({ ...p, [lang]: true })); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          itemId: item.id,
          name: item.name,
          description: item.description || '',
          targetLangs: [lang],
          save: false,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || t.translateError)
      const tr = data.translations[lang]
      if (tr && !tr.error) {
        setTranslations(prev => ({
          ...prev,
          [lang]: { name: tr.name || '', description: tr.description || '' },
        }))
      }
    } catch (err) {
      setError(err.message)
    }
    setPerFieldLoading(p => ({ ...p, [lang]: false }))
  }

  const save = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/save-translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ itemId: item.id, translations }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Save failed')
      setSuccess(t.translationsSaved)
      setTimeout(() => { onSaved && onSaved(); onClose() }, 800)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const title = (t.translateTitle || 'Translate: {name}').replace('{name}', item.name)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:200,padding:20,overflowY:'auto'}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:'white',borderRadius:16,maxWidth:700,width:'100%',marginTop:20,marginBottom:20}}>
        {/* Header */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid #e5e5e5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:'#1C1917'}}>{title}</div>
            <div style={{fontSize:12,color:'#78716C',marginTop:4}}>
              {t.sourceLanguageLabel}: {sourceInfo.flag} {sourceInfo.name}
            </div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',fontSize:24,cursor:'pointer',color:'#78716C'}}>×</button>
        </div>

        <div style={{padding:24}}>
          {/* Source preview */}
          <div style={{padding:16,background:'#F4E3D7',border:'1px solid #C2692A33',borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#92400E',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>
              {sourceInfo.flag} {sourceInfo.name} (kilde / source)
            </div>
            <div style={{fontSize:15,fontWeight:600,color:'#1C1917'}}>{item.name}</div>
            {item.description && <div style={{fontSize:13,color:'#57534E',marginTop:4}}>{item.description}</div>}
          </div>

          {/* Auto-translate all button */}
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            <button onClick={autoTranslateAll} disabled={autoTranslating || loading}
              style={{padding:'10px 16px',background:'#1C1917',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'system-ui',opacity: autoTranslating||loading ? 0.5 : 1}}>
              {autoTranslating ? t.autoTranslating : t.autoTranslate}
            </button>
            <div style={{flex:1,minWidth:200,padding:'8px 12px',background:'#FAFAF7',border:'1px solid #e5e5e5',borderRadius:8,fontSize:11,color:'#78716C',lineHeight:1.4}}>
              {t.translateInfo}
            </div>
          </div>

          {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626',marginBottom:12}}>⚠️ {error}</div>}
          {success && <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#15803D',marginBottom:12}}>✓ {success}</div>}

          {loading ? (
            <p style={{textAlign:'center',color:'#aaa',padding:24}}>{t.loading}</p>
          ) : (
            <div>
              {targetLangs.map(lang => {
                const tr = translations[lang.code] || { name: '', description: '' }
                const isLoading = perFieldLoading[lang.code]
                return (
                  <div key={lang.code} style={{padding:14,background:'#FAFAF7',border:'1px solid #e5e5e5',borderRadius:10,marginBottom:10}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#1C1917'}}>
                        {lang.flag} {lang.name}
                      </div>
                      <button onClick={() => autoTranslateOne(lang.code)} disabled={isLoading || autoTranslating}
                        style={{padding:'5px 10px',background:'#FEF3C7',color:'#92400E',border:'1px solid #FCD34D',borderRadius:6,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'system-ui',opacity: isLoading||autoTranslating ? 0.5 : 1}}>
                        {isLoading ? '...' : t.autoFillThis}
                      </button>
                    </div>
                    <input type="text" value={tr.name} onChange={e => updateField(lang.code, 'name', e.target.value)}
                      placeholder={`${t.name} (${lang.name})`}
                      style={{width:'100%',padding:'8px 12px',border:'1px solid #e5e5e5',borderRadius:6,fontSize:14,fontFamily:'system-ui',outline:'none',marginBottom:6,boxSizing:'border-box'}} />
                    <textarea value={tr.description} onChange={e => updateField(lang.code, 'description', e.target.value)}
                      placeholder={`${t.description} (${lang.name})`} rows={2}
                      style={{width:'100%',padding:'8px 12px',border:'1px solid #e5e5e5',borderRadius:6,fontSize:13,fontFamily:'system-ui',outline:'none',resize:'none',boxSizing:'border-box'}} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'16px 24px',borderTop:'1px solid #e5e5e5',display:'flex',justifyContent:'flex-end',gap:8}}>
          <button onClick={onClose} style={{padding:'10px 16px',background:'transparent',color:'#78716C',border:'1px solid #e5e5e5',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'system-ui'}}>{t.cancel}</button>
          <button onClick={save} disabled={saving || loading}
            style={{padding:'10px 20px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'system-ui',opacity: saving||loading ? 0.5 : 1}}>
            {saving ? t.saving : t.saveTranslations}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
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

  const [qrTable, setQrTable] = useState(null)
  const [translateItem, setTranslateItem] = useState(null)
  const [newTableName, setNewTableName] = useState('')
  const [addingTable, setAddingTable] = useState(false)
  const [editingTable, setEditingTable] = useState(null)
  const [tableError, setTableError] = useState('')

  const [passwords, setPasswords] = useState({ admin:'', kitchen:'', bar:'' })
  const [pwMessage, setPwMessage] = useState({})
  const [pwSaving, setPwSaving] = useState({})
  const [tempPasswords, setTempPasswords] = useState({})

  const [liveStatusSaving, setLiveStatusSaving] = useState(false)
  const [liveStatusMsg, setLiveStatusMsg] = useState('')

  const t = LANGS[lang]

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email?.startsWith('admin@')) {
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

  const fetchData = useCallback(async () => {
    if (!restaurant) return
    const [{ data: menuItems }, { data: restaurantTables }] = await Promise.all([
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('category').order('name'),
      supabase.from('tables').select('*').eq('restaurant_id', restaurant.id).order('position').order('name'),
    ])
    if (menuItems) setItems(menuItems)
    if (restaurantTables) setTables(restaurantTables)
    if (restaurantTables && restaurantTables.length > 0) {
      const tableIds = restaurantTables.map(t => t.id)
      const { data: openOrders } = await supabase.from('orders').select('id, created_at, status, tables(name, token)').eq('status','open').in('table_id', tableIds)
      if (openOrders) setOrders(openOrders)
    } else { setOrders([]) }
    setLoading(false)
  }, [restaurant])

  const fetchRevenue = useCallback(async () => {
    if (!restaurant) return []
    const today = new Date(); today.setHours(0,0,0,0)
    const { data: restaurantTables } = await supabase.from('tables').select('id').eq('restaurant_id', restaurant.id)
    if (!restaurantTables || restaurantTables.length === 0) return []
    const tableIds = restaurantTables.map(t => t.id)
    const { data } = await supabase.from('orders').select('id, created_at, tables(name), order_lines(name, qty, price)').eq('status','done').gte('created_at', today.toISOString()).in('table_id', tableIds)
    return data || []
  }, [restaurant])

  useEffect(() => { if (user && restaurant) { fetchData(); fetchRevenue().then(setRevenue) } }, [user, restaurant])
  useEffect(() => { if (tab === 'statistik') fetchStats(statsPeriod) }, [tab, statsPeriod])

  const saveItem = async (item) => {
    setSaving(true)
    await supabase.from('menu_items').update({ name:item.name, description:item.description, price:parseFloat(item.price), category:item.category, emoji:item.emoji, available:item.available, station:item.station }).eq('id', item.id)
    setSaving(false); setEditing(null); fetchData()
  }

  const addItem = async () => {
    setSaving(true)
    await supabase.from('menu_items').insert({ restaurant_id:restaurant.id, name:newItem.name, description:newItem.description, price:parseFloat(newItem.price), category:newItem.category, emoji:newItem.emoji, station:newItem.station, available:true })
    setSaving(false); setShowAdd(false)
    setNewItem({ name:'', description:'', price:'', category:'Starters', emoji:'', station:'kitchen' })
    fetchData()
  }

  const toggleAvailable = async (item) => {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    fetchData()
  }

  const fetchStats = async (period) => {
    if (!restaurant) return
    setStatsLoading(true)
    const now = new Date(); let from = new Date()
    if (period === 'today') { from.setHours(0,0,0,0) }
    else if (period === 'thisWeek') { from.setDate(now.getDate() - now.getDay()); from.setHours(0,0,0,0) }
    else if (period === 'thisMonth') { from = new Date(now.getFullYear(), now.getMonth(), 1) }
    else { from = new Date('2020-01-01') }
    const { data: restaurantTables } = await supabase.from('tables').select('id').eq('restaurant_id', restaurant.id)
    if (!restaurantTables || restaurantTables.length === 0) { setStatsData([]); setStatsLoading(false); return }
    const tableIds = restaurantTables.map(t => t.id)
    const query = supabase.from('orders').select('id, created_at, tables(name), order_lines(qty, price)').in('status', ['done', 'archived']).in('table_id', tableIds)
    if (period !== 'allTime') query.gte('created_at', from.toISOString())
    const { data } = await query
    if (!data) { setStatsData([]); setStatsLoading(false); return }
    const map = {}
    data.forEach(order => {
      const name = order.tables?.name || 'Ukendt'
      if (!map[name]) map[name] = { name, seatings:0, total:0 }
      map[name].seatings++
      map[name].total += (order.order_lines||[]).reduce((s,l) => s + l.price * l.qty, 0)
    })
    setStatsData(Object.values(map).sort((a,b) => b.total - a.total))
    setStatsLoading(false)
  }

  const resetRevenue = async () => {
    if (!restaurant) return
    setResetting(true)
    const today = new Date(); today.setHours(0,0,0,0)
    const { data: restaurantTables } = await supabase.from('tables').select('id').eq('restaurant_id', restaurant.id)
    const tableIds = restaurantTables.map(t => t.id)
    await supabase.from('orders').update({ status:'archived' }).eq('status','done').gte('created_at', today.toISOString()).in('table_id', tableIds)
    await supabase.from('restaurant_order_counters').update({ last_number: 0, updated_at: new Date().toISOString() }).eq('restaurant_id', restaurant.id)
    setRevenue([]); setResetting(false); setShowResetConfirm(false)
  }

  const callAdminAPI = async (body) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/restaurant-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  const addTable = async () => {
    if (!newTableName) return
    setAddingTable(true); setTableError('')
    const result = await callAdminAPI({ action: 'add_table', name: newTableName })
    if (!result.success) setTableError(result.error || 'Fejl')
    else { setNewTableName(''); fetchData() }
    setAddingTable(false)
  }

  const renameTable = async (tableId, name) => {
    const result = await callAdminAPI({ action: 'rename_table', tableId, name })
    if (result.success) { setEditingTable(null); fetchData() }
    else alert(result.error)
  }

  const toggleTableActive = async (tableId) => {
    const result = await callAdminAPI({ action: 'toggle_table_active', tableId })
    if (result.success) fetchData()
    else alert(result.error)
  }

  const deleteTable = async (tableId) => {
    if (!confirm(t.confirmDelete)) return
    const result = await callAdminAPI({ action: 'delete_table', tableId })
    if (result.success) { fetchData(); if (result.softDelete) alert(result.message) }
    else alert(result.error)
  }

  const changePassword = async (role) => {
    const newPassword = passwords[role]
    if (!newPassword || newPassword.length < 8) {
      setPwMessage(p => ({ ...p, [role]: { type:'error', text:t.passwordMin } }))
      return
    }
    setPwSaving(p => ({ ...p, [role]: true }))
    const result = await callAdminAPI({ action: 'change_password', role, newPassword })
    if (result.success) {
      setPwMessage(p => ({ ...p, [role]: { type:'success', text:t.passwordChanged } }))
      setPasswords(p => ({ ...p, [role]: '' }))
    } else {
      setPwMessage(p => ({ ...p, [role]: { type:'error', text:result.error } }))
    }
    setPwSaving(p => ({ ...p, [role]: false }))
    setTimeout(() => setPwMessage(p => { const n={...p}; delete n[role]; return n }), 3000)
  }

  const resetToTemp = async (role) => {
    const confirmMsg = (t.resetPwConfirm || 'Generate new temp password for {role}?').replace('{role}', role)
    if (!confirm(confirmMsg)) return
    setPwSaving(p => ({ ...p, [role]: true }))
    const letters = 'abcdefghjkmnpqrstuvwxyz'
    const digits = '23456789'
    const tempPw = Array.from({length:3}, () => letters[Math.floor(Math.random()*letters.length)]).join('')
                 + Array.from({length:4}, () => digits[Math.floor(Math.random()*digits.length)]).join('')
    const result = await callAdminAPI({ action: 'change_password', role, newPassword: tempPw })
    if (result.success) {
      setTempPasswords(p => ({ ...p, [role]: tempPw }))
      setPwMessage(p => { const n={...p}; delete n[role]; return n })
    } else {
      setPwMessage(p => ({ ...p, [role]: { type:'error', text:result.error } }))
    }
    setPwSaving(p => ({ ...p, [role]: false }))
  }

  const toggleLiveStatus = async () => {
    if (!LIVE_STATUS_PLANS.includes(restaurant.plan)) return
    setLiveStatusSaving(true); setLiveStatusMsg('')
    const newValue = !restaurant.show_live_status
    const { error } = await supabase.from('restaurants').update({ show_live_status: newValue }).eq('id', restaurant.id)
    if (!error) {
      setRestaurant({ ...restaurant, show_live_status: newValue })
      setLiveStatusMsg(t.liveStatusSaved)
      setTimeout(() => setLiveStatusMsg(''), 2000)
    }
    setLiveStatusSaving(false)
  }

  const logout = async () => { await supabase.auth.signOut(); setUser(null); setRestaurant(null) }

  const grandTotal = revenue.reduce((s, o) => s + (o.order_lines||[]).reduce((ls, l) => ls + l.price * l.qty, 0), 0)
  const categories = ['Starters','Salads','Mains','Sides','Desserts','Drinks']

  if (authLoading) return <div style={s.center}><p style={{color:'#aaa'}}>...</p></div>
  if (!user || !restaurant) return <LoginScreen onLogin={handleLogin} />
  if (loading) return <div style={s.center}><p style={{color:'#aaa'}}>{t.loading}</p></div>

  const activeTables = tables.filter(tb => tb.active !== false)
  const tableLimit = PLAN_TABLE_LIMITS[restaurant.plan] || 15
  const tablesUsedPct = Math.min(100, (activeTables.length / tableLimit) * 100)
  const atLimit = activeTables.length >= tableLimit && restaurant.plan !== 'enterprise'
  const canUseLiveStatus = LIVE_STATUS_PLANS.includes(restaurant.plan)
  const sourceLang = restaurant.source_language || 'en'
  const sourceLangInfo = getLangInfo(sourceLang)
  const sourceLangHint = (t.sourceLangHint || '').replace('{lang}', `${sourceLangInfo.flag} ${sourceLangInfo.name}`)

  return (
    <div style={s.page}>
      {qrTable && <QrModal table={qrTable} restaurant={restaurant} onClose={() => setQrTable(null)} t={t} />}
      {translateItem && (
        <TranslateModal
          item={translateItem}
          sourceLang={sourceLang}
          onClose={() => setTranslateItem(null)}
          onSaved={() => fetchData()}
          t={t}
        />
      )}

      <header style={s.header}>
        <span style={s.title}>⚙️ {restaurant.name} — Admin</span>
        <div style={{display:'flex',gap:6,marginRight:12}}>
          {['da','en','el'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{padding:'4px 12px',borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',background:lang===l?'#C2692A':'transparent',color:lang===l?'white':'#888',border:lang===l?'none':'1px solid #ddd'}}>{l.toUpperCase()}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {['menu','omsaetning','borde','statistik','settings'].map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{padding:'6px 16px',borderRadius:20,fontSize:13,fontWeight:600,cursor:'pointer',background:tab===tb?'#C2692A':'transparent',color:tab===tb?'white':'#888',border:tab===tb?'none':'1px solid #333'}}>
              {tb==='menu' ? t.menu : tb==='omsaetning' ? t.revenue : tb==='borde' ? t.tables : tb==='statistik' ? t.stats : t.settings}
            </button>
          ))}
        </div>
        <button onClick={logout} style={{padding:'6px 14px',background:'transparent',border:'1px solid #ddd',borderRadius:8,fontSize:13,cursor:'pointer',color:'#78716C'}}>{t.logout}</button>
      </header>

      {tab === 'menu' && (
        <div style={s.content}>
          {/* Source language hint */}
          <div style={{padding:'10px 14px',background:'linear-gradient(90deg, #F4E3D7, #FAFAF7)',border:'1px solid #C2692A33',borderRadius:10,marginBottom:16,fontSize:13,color:'#92400E',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:18}}>💡</span>
            <span>{sourceLangHint}</span>
          </div>

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
          {items.length === 0 && !showAdd && (
            <div style={{...s.card, textAlign:'center', padding:40, color:'#78716C'}}>
              <div style={{fontSize:48,marginBottom:12}}>🍽</div>
              <p>{t.noItems}</p>
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
                        <ImageUpload itemId={editing.id} currentUrl={editing.image_url} onUploaded={url => setEditing({...editing, image_url:url})} onRemoved={() => setEditing({...editing, image_url:null})} t={t} />
                        <div style={{display:'flex',gap:8,marginTop:12}}>
                          <button onClick={() => saveItem(editing)} disabled={saving} style={s.saveBtn}>{saving ? t.saving : t.save}</button>
                          <button onClick={() => setEditing(null)} style={s.cancelBtn}>{t.cancel}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} style={{width:44,height:44,borderRadius:10,objectFit:'cover',flexShrink:0,border:'1px solid #e5e5e5'}} />
                          : <span style={{fontSize:24,width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f0',borderRadius:10,flexShrink:0}}>{item.emoji||'🍽'}</span>
                        }
                        <div style={{flex:1, minWidth:120}}>
                          <div style={{fontWeight:600,fontSize:15}}>{item.name}</div>
                          <div style={{fontSize:12,color:'#78716C'}}>{item.description}</div>
                        </div>
                        <div style={{fontWeight:700,fontSize:15,minWidth:50}}>€{Number(item.price).toFixed(2)}</div>
                        <button onClick={() => toggleAvailable(item)} style={{...s.iconBtn, background:item.available?'#EBF5EF':'#FEE2E2', color:item.available?'#2D7A4F':'#dc2626'}}>{item.available ? t.active : t.inactive}</button>
                        <button onClick={() => setTranslateItem(item)} style={{...s.iconBtn, background:'#EFF6FF', color:'#1E40AF', border:'1px solid #BFDBFE'}}>{t.translate}</button>
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
            <button onClick={() => setShowResetConfirm(true)} style={{padding:'8px 16px',background:'transparent',border:'1px solid #dc2626',borderRadius:8,fontSize:14,fontWeight:600,color:'#dc2626',cursor:'pointer'}}>🔄 {t.resetRevenue}</button>
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
          {revenue.length === 0 ? <p style={{color:'#aaa',textAlign:'center'}}>{t.noClosedTables}</p>
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
          {statsLoading ? <p style={{color:'#aaa',textAlign:'center'}}>{t.loading}</p>
            : statsData.length === 0 ? <p style={{color:'#aaa',textAlign:'center'}}>{t.noStats}</p>
            : <>
                <div style={{...s.card, marginBottom:20, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, textAlign:'center'}}>
                  <div><div style={{fontSize:12,color:'#78716C',marginBottom:4}}>{t.totalRevenue}</div><div style={{fontSize:28,fontWeight:700,color:'#C2692A'}}>€{statsData.reduce((s,r)=>s+r.total,0).toFixed(2)}</div></div>
                  <div><div style={{fontSize:12,color:'#78716C',marginBottom:4}}>{t.seatings}</div><div style={{fontSize:28,fontWeight:700,color:'#1C1917'}}>{statsData.reduce((s,r)=>s+r.seatings,0)}</div></div>
                  <div><div style={{fontSize:12,color:'#78716C',marginBottom:4}}>{t.avgPerSeating}</div><div style={{fontSize:28,fontWeight:700,color:'#1C1917'}}>€{statsData.reduce((s,r)=>s+r.seatings,0) > 0 ? (statsData.reduce((s,r)=>s+r.total,0)/statsData.reduce((s,r)=>s+r.seatings,0)).toFixed(2) : '0.00'}</div></div>
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
          <div style={{...s.card, marginBottom:20, background:'linear-gradient(135deg, #F4E3D7, #E8D5C0)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:12,color:'#78716C',textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600}}>{t.currentPlan}</div>
                <div style={{fontSize:24,fontWeight:700,color:'#1C1917',marginTop:4,textTransform:'capitalize'}}>
                  {restaurant.plan} {PLAN_PRICES[restaurant.plan] > 0 && <span style={{fontSize:14,fontWeight:600,color:'#78716C'}}>— €{PLAN_PRICES[restaurant.plan]}/mo</span>}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:13,color:'#78716C'}}>{activeTables.length} / {restaurant.plan === 'enterprise' ? '∞' : tableLimit} {t.tablesUsed}</div>
              </div>
            </div>
            {restaurant.plan !== 'enterprise' && (
              <div style={{height:8,background:'rgba(255,255,255,0.5)',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${tablesUsedPct}%`,background:tablesUsedPct>90?'#dc2626':'#C2692A',transition:'width 0.3s'}}/>
              </div>
            )}
          </div>

          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            <input value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder={t.tableName} 
              style={{...s.input, flex:1, minWidth:200}} disabled={atLimit} />
            <button onClick={addTable} disabled={!newTableName || addingTable || atLimit} style={{...s.addBtn, opacity:(atLimit||!newTableName)?0.5:1}}>
              {addingTable ? '...' : t.addTable}
            </button>
            {activeTables.length > 0 && (
              <a href="/qr-print" target="_blank" style={{...s.saveBtn, textDecoration:'none', display:'inline-flex', alignItems:'center'}}>{t.printAllQR}</a>
            )}
          </div>
          {atLimit && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:'#dc2626'}}>⚠️ {t.upgradePlan}</div>}
          {tableError && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:12,marginBottom:16,fontSize:13,color:'#dc2626'}}>{tableError}</div>}

          {tables.map(table => (
            <div key={table.id} style={{...s.card, marginBottom:8, opacity: table.active === false ? 0.5 : 1}}>
              <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                {editingTable?.id === table.id ? (
                  <>
                    <input value={editingTable.name} onChange={e => setEditingTable({...editingTable, name:e.target.value})} style={{...s.input, flex:1, minWidth:150}} autoFocus />
                    <button onClick={() => renameTable(table.id, editingTable.name)} style={s.saveBtn}>{t.save}</button>
                    <button onClick={() => setEditingTable(null)} style={s.cancelBtn}>{t.cancel}</button>
                  </>
                ) : (
                  <>
                    <div style={{flex:1,minWidth:150}}>
                      <div style={{fontWeight:600,fontSize:15}}>{table.name}</div>
                      <div style={{fontSize:11,color:'#78716C',fontFamily:'monospace',marginTop:2}}>{table.token}</div>
                    </div>
                    <button onClick={() => setQrTable(table)} style={s.iconBtn}>{t.viewQR}</button>
                    <button onClick={() => setEditingTable({...table})} style={s.iconBtn}>{t.rename}</button>
                    <button onClick={() => toggleTableActive(table.id)} style={{...s.iconBtn, background: table.active === false ? '#EBF5EF' : '#FEF3C7', color: table.active === false ? '#2D7A4F' : '#92400E'}}>
                      {table.active === false ? t.activate : t.deactivate}
                    </button>
                    <button onClick={() => deleteTable(table.id)} style={{...s.iconBtn, background:'#FEE2E2', color:'#dc2626'}}>{t.deleteTable}</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {tables.length === 0 && (
            <div style={{...s.card, textAlign:'center', padding:40, color:'#78716C'}}>
              <div style={{fontSize:48,marginBottom:12}}>🪑</div>
              <p>No tables yet. Add your first table above!</p>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div style={s.content}>
          <h2 style={s.sectionTitle}>{t.settings}</h2>

          <div style={{...s.card, marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:250}}>
                <h3 style={{fontSize:16,fontWeight:600,color:'#1C1917',marginBottom:4}}>🔴 {t.liveStatus}</h3>
                <p style={{fontSize:13,color:'#78716C',lineHeight:1.5}}>{t.liveStatusDesc}</p>
                {!canUseLiveStatus && (
                  <div style={{marginTop:10,padding:10,background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:8,fontSize:12,color:'#92400E',fontWeight:600}}>
                    {t.liveStatusUpgrade}
                  </div>
                )}
                {liveStatusMsg && <div style={{marginTop:8,fontSize:12,color:'#10b981',fontWeight:600}}>✓ {liveStatusMsg}</div>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <button onClick={toggleLiveStatus} disabled={!canUseLiveStatus || liveStatusSaving}
                  style={{
                    width:56,height:32,borderRadius:16,border:'none',cursor:canUseLiveStatus?'pointer':'not-allowed',
                    background: restaurant.show_live_status ? '#10b981' : '#e5e5e5',
                    opacity: canUseLiveStatus ? 1 : 0.5,
                    position:'relative',transition:'background 0.2s',
                  }}>
                  <div style={{
                    width:26,height:26,borderRadius:'50%',background:'white',position:'absolute',top:3,
                    left: restaurant.show_live_status ? 27 : 3,
                    transition:'left 0.2s',boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
                  }}/>
                </button>
              </div>
            </div>
          </div>
          
          <div style={{...s.card, marginBottom:20}}>
            <h3 style={{fontSize:16,fontWeight:600,marginBottom:16,color:'#1C1917'}}>{t.changePassword}</h3>
            {['admin','kitchen','bar'].map(role => (
              <div key={role} style={{marginBottom:16,padding:16,background:'#f5f5f0',borderRadius:10}}>
                <div style={{fontSize:13,fontWeight:600,color:'#1C1917',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em'}}>{role}</div>
                <div style={{fontSize:12,color:'#78716C',marginBottom:10,fontFamily:'monospace'}}>{role}@{restaurant.slug}.com</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                  <input type="password" value={passwords[role]} onChange={e => setPasswords(p => ({...p, [role]:e.target.value}))}
                    placeholder={t.newPassword} style={{...s.input, flex:1, minWidth:200}} />
                  <button onClick={() => changePassword(role)} disabled={pwSaving[role] || !passwords[role]} style={{...s.saveBtn, opacity:!passwords[role]?0.5:1}}>
                    {pwSaving[role] ? '...' : t.save}
                  </button>
                  <button onClick={() => resetToTemp(role)} disabled={pwSaving[role]}
                    style={{padding:'8px 14px',background:'#FEF3C7',color:'#92400E',border:'1px solid #FCD34D',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'system-ui',whiteSpace:'nowrap'}}>
                    🔄 {t.resetPwBtn}
                  </button>
                </div>
                {tempPasswords[role] && (
                  <div style={{marginTop:10,padding:12,background:'#FEF3C7',border:'1px solid #FCD34D',borderRadius:8}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#92400E',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>
                      {t.tempPwTitle}
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      <code style={{flex:1,minWidth:120,padding:'8px 10px',background:'white',border:'1px solid #FCD34D',borderRadius:6,fontSize:14,fontWeight:600,color:'#1C1917',fontFamily:'monospace',userSelect:'all'}}>
                        {tempPasswords[role]}
                      </code>
                      <button onClick={() => { navigator.clipboard.writeText(tempPasswords[role]); }}
                        style={{padding:'8px 12px',background:'#1C1917',color:'white',border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'}}>
                        📋 {t.copy}
                      </button>
                      <button onClick={() => setTempPasswords(p => { const n={...p}; delete n[role]; return n })}
                        style={{padding:'8px 12px',background:'transparent',color:'#78716C',border:'1px solid #e5e5e5',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'system-ui'}}>
                        {t.hide}
                      </button>
                    </div>
                  </div>
                )}
                {pwMessage[role] && !tempPasswords[role] && (
                  <div style={{marginTop:8,fontSize:12,color:pwMessage[role].type==='success'?'#10b981':'#dc2626'}}>
                    {pwMessage[role].text}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{...s.card}}>
            <h3 style={{fontSize:16,fontWeight:600,marginBottom:16,color:'#1C1917'}}>{t.planInfo}</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div><div style={{fontSize:12,color:'#78716C'}}>{t.currentPlan}</div><div style={{fontSize:20,fontWeight:700,marginTop:2,textTransform:'capitalize'}}>{restaurant.plan}</div></div>
              <div><div style={{fontSize:12,color:'#78716C'}}>Tables</div><div style={{fontSize:20,fontWeight:700,marginTop:2}}>{activeTables.length} / {restaurant.plan === 'enterprise' ? '∞' : tableLimit}</div></div>
              <div><div style={{fontSize:12,color:'#78716C'}}>Menu source language</div><div style={{fontSize:20,fontWeight:700,marginTop:2}}>{sourceLangInfo.flag} {sourceLangInfo.name}</div></div>
            </div>
          </div>
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