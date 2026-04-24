import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import ExportModal from '../components/ExportModal'
import { exportPlatform } from '../lib/xlsx-export'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) { setError('Wrong email or password'); setLoading(false); return }

    const { data: superAdmin } = await supabase
      .from('super_admins').select('*').eq('email', data.user.email).single()

    if (!superAdmin) {
      await supabase.auth.signOut()
      setError('You do not have super-admin access')
      setLoading(false); return
    }

    onLogin(data.user); setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:'#141414',borderRadius:16,border:'1px solid #262626',padding:40,width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:36,marginBottom:8}}>⚡</div>
          <div style={{fontSize:24,fontWeight:700,color:'white',letterSpacing:'-0.02em'}}>TableFlow</div>
          <div style={{fontSize:13,color:'#666',marginTop:4,textTransform:'uppercase',letterSpacing:'0.08em'}}>Super Admin</div>
        </div>
        <form onSubmit={login}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{width:'100%',padding:'12px 14px',border:'1px solid #262626',borderRadius:10,fontSize:15,fontFamily:'system-ui',outline:'none',background:'#0a0a0a',color:'white'}} />
          </div>
          <div style={{marginBottom:24}}>
            <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{width:'100%',padding:'12px 14px',border:'1px solid #262626',borderRadius:10,fontSize:15,fontFamily:'system-ui',outline:'none',background:'#0a0a0a',color:'white'}} />
          </div>
          {error && <div style={{background:'#2a1515',border:'1px solid #7f1d1d',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#f87171',marginBottom:16}}>{error}</div>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:'12px',background:'linear-gradient(135deg, #6366f1, #8b5cf6)',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'}}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

function CreateRestaurantModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [form, setForm] = useState({
    name: '', ownerName: '', ownerEmail: '', phone: '',
    address: '', city: '', country: 'Greece',
    plan: 'trial', tableCount: 10,
    currency: 'EUR', timezone: 'Europe/Athens',
  })

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const submit = async () => {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Failed'); setLoading(false); return }
      setResult(data)
      setStep(4)
      setLoading(false)
    } catch (e) {
      setError(e.message); setLoading(false)
    }
  }

  const copyCredentials = () => {
    if (!result) return
    const text = `TableFlow — ${result.restaurant.name}\n\nAdmin panel: https://taverna-kriti.vercel.app/admin\nEmail: ${result.credentials.admin.email}\nPassword: ${result.credentials.admin.password}\n\nKitchen: https://taverna-kriti.vercel.app/kitchen\nEmail: ${result.credentials.kitchen.email}\nPassword: ${result.credentials.kitchen.password}\n\nBar: https://taverna-kriti.vercel.app/bar\nEmail: ${result.credentials.bar.email}\nPassword: ${result.credentials.bar.password}\n\nMenu URL format: https://taverna-kriti.vercel.app/menu.html?restaurant=${result.restaurant.slug}&table=tbl-001`
    navigator.clipboard.writeText(text)
    alert('Credentials copied to clipboard!')
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
      <div style={{background:'#141414',border:'1px solid #262626',borderRadius:16,width:'100%',maxWidth:600,maxHeight:'90vh',overflow:'auto'}}>
        <div style={{padding:'24px 28px',borderBottom:'1px solid #262626',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:'white'}}>
              {step === 4 ? '✓ Restaurant Created' : 'Create New Restaurant'}
            </div>
            {step < 4 && <div style={{fontSize:12,color:'#888',marginTop:4}}>Step {step} of 3</div>}
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#888',fontSize:24,cursor:'pointer'}}>×</button>
        </div>

        <div style={{padding:28}}>
          {step < 4 && (
            <div style={{display:'flex',gap:4,marginBottom:24}}>
              {[1,2,3].map(i => (
                <div key={i} style={{flex:1,height:3,borderRadius:2,background: step >= i ? 'linear-gradient(90deg, #6366f1, #8b5cf6)' : '#262626'}}/>
              ))}
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 style={{fontSize:15,color:'white',marginBottom:16}}>Restaurant Info</h3>
              <Field label="Restaurant Name" value={form.name} onChange={v => update('name', v)} required placeholder="e.g. Taverna Kriti" />
              <Field label="Owner Name" value={form.ownerName} onChange={v => update('ownerName', v)} placeholder="e.g. Dimi Kostas" />
              <Field label="Owner Email" value={form.ownerEmail} onChange={v => update('ownerEmail', v)} type="email" required placeholder="owner@example.com" />
              <Field label="Phone" value={form.phone} onChange={v => update('phone', v)} placeholder="+30 123 456 789" />
              <Field label="Address" value={form.address} onChange={v => update('address', v)} placeholder="Street address" />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field label="City" value={form.city} onChange={v => update('city', v)} placeholder="Crete" />
                <Field label="Country" value={form.country} onChange={v => update('country', v)} placeholder="Greece" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{fontSize:15,color:'white',marginBottom:16}}>Plan & Setup</h3>
              <div style={{fontSize:12,color:'#888',marginBottom:8}}>Subscription Plan</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
                {[
                  {id:'trial', name:'Trial', price:'Free 30 days', limit:'15 tables'},
                  {id:'basic', name:'Basic', price:'€100/mo', limit:'15 tables'},
                  {id:'pro', name:'Pro', price:'€200/mo', limit:'50 tables'},
                  {id:'enterprise', name:'Enterprise', price:'€300/mo', limit:'Unlimited'},
                ].map(p => (
                  <button key={p.id} onClick={() => update('plan', p.id)}
                    style={{
                      padding:'14px 12px', textAlign:'left', borderRadius:10, cursor:'pointer',
                      background: form.plan === p.id ? '#1a1a2e' : '#0a0a0a',
                      border: form.plan === p.id ? '1.5px solid #6366f1' : '1px solid #262626',
                      color:'white', fontFamily:'system-ui',
                    }}>
                    <div style={{fontSize:14,fontWeight:600}}>{p.name}</div>
                    <div style={{fontSize:12,color:'#888',marginTop:2}}>{p.price}</div>
                    <div style={{fontSize:11,color:'#666',marginTop:4}}>{p.limit}</div>
                  </button>
                ))}
              </div>
              <Field label="Number of Tables" value={form.tableCount} onChange={v => update('tableCount', parseInt(v)||10)} type="number" required />
              <div style={{fontSize:12,color:'#666',marginTop:-8,marginBottom:16}}>
                Tables will be auto-generated: Table 1, Table 2... — can be renamed later
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field label="Currency" value={form.currency} onChange={v => update('currency', v)} placeholder="EUR" />
                <Field label="Timezone" value={form.timezone} onChange={v => update('timezone', v)} placeholder="Europe/Athens" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{fontSize:15,color:'white',marginBottom:16}}>Review & Create</h3>
              <div style={{background:'#0a0a0a',border:'1px solid #262626',borderRadius:10,padding:16,marginBottom:16}}>
                <Row label="Restaurant" value={form.name} />
                <Row label="Owner" value={`${form.ownerName} (${form.ownerEmail})`} />
                <Row label="Location" value={`${form.city}, ${form.country}`} />
                <Row label="Plan" value={form.plan.toUpperCase()} />
                <Row label="Tables" value={form.tableCount} />
                <Row label="Currency" value={form.currency} />
              </div>
              <div style={{background:'#1a1a2e',border:'1px solid #3730a3',borderRadius:10,padding:14,fontSize:12,color:'#a5b4fc'}}>
                <strong>What happens when you click Create:</strong>
                <ul style={{marginTop:8,paddingLeft:20,listStyle:'disc'}}>
                  <li>Restaurant is created with slug auto-generated from name</li>
                  <li>{form.tableCount} tables with unique QR tokens are created</li>
                  <li>Admin, kitchen, and bar users are created with auto-generated passwords</li>
                  <li>You'll see the login credentials on the next screen — copy them immediately</li>
                </ul>
              </div>
              {error && <div style={{background:'#2a1515',border:'1px solid #7f1d1d',borderRadius:8,padding:12,fontSize:13,color:'#f87171',marginTop:16}}>{error}</div>}
            </div>
          )}

          {step === 4 && result && (
            <div>
              <div style={{textAlign:'center',marginBottom:24}}>
                <div style={{width:60,height:60,margin:'0 auto 12px',background:'#0d2f1f',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>✓</div>
                <div style={{fontSize:18,fontWeight:600,color:'white'}}>{result.restaurant.name} created!</div>
                <div style={{fontSize:12,color:'#888',marginTop:4}}>{result.tableCount} tables · slug: {result.restaurant.slug}</div>
              </div>

              <div style={{background:'#2a2015',border:'1px solid #78350f',borderRadius:10,padding:14,marginBottom:16,fontSize:12,color:'#fbbf24'}}>
                ⚠️ <strong>Save these credentials now!</strong> Passwords cannot be recovered — only reset.
              </div>

              <CredentialCard title="Admin" email={result.credentials.admin.email} password={result.credentials.admin.password} url="/admin" />
              <CredentialCard title="Kitchen" email={result.credentials.kitchen.email} password={result.credentials.kitchen.password} url="/kitchen" />
              <CredentialCard title="Bar" email={result.credentials.bar.email} password={result.credentials.bar.password} url="/bar" />

              <div style={{marginTop:16,padding:14,background:'#0a0a0a',border:'1px solid #262626',borderRadius:10,fontSize:12,color:'#888'}}>
                <div style={{fontWeight:600,color:'white',marginBottom:4}}>Menu URL format:</div>
                <code style={{fontSize:11,color:'#10b981',wordBreak:'break-all'}}>/menu.html?restaurant={result.restaurant.slug}&table=tbl-001</code>
              </div>

              <button onClick={copyCredentials} style={{width:'100%',marginTop:16,padding:12,background:'#262626',color:'white',border:'1px solid #333',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                📋 Copy all credentials
              </button>
            </div>
          )}

          <div style={{display:'flex',justifyContent:'space-between',marginTop:24,gap:8}}>
            {step === 4 ? (
              <button onClick={() => { onCreated(); onClose() }} style={{flex:1,padding:12,background:'linear-gradient(135deg, #6366f1, #8b5cf6)',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>Done</button>
            ) : (
              <>
                <button onClick={() => step > 1 ? setStep(step-1) : onClose()} style={{padding:'10px 20px',background:'transparent',border:'1px solid #262626',color:'#888',borderRadius:10,fontSize:14,cursor:'pointer'}}>
                  {step > 1 ? '← Back' : 'Cancel'}
                </button>
                {step < 3 ? (
                  <button onClick={() => setStep(step+1)} disabled={step === 1 && (!form.name || !form.ownerEmail)}
                    style={{padding:'10px 24px',background:'linear-gradient(135deg, #6366f1, #8b5cf6)',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',opacity: (step === 1 && (!form.name || !form.ownerEmail)) ? 0.5 : 1}}>
                    Next →
                  </button>
                ) : (
                  <button onClick={submit} disabled={loading}
                    style={{padding:'10px 24px',background:'linear-gradient(135deg, #6366f1, #8b5cf6)',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                    {loading ? 'Creating...' : '✓ Create Restaurant'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,color:'#888',display:'block',marginBottom:6}}>
        {label}{required && <span style={{color:'#f87171'}}> *</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',padding:'10px 12px',border:'1px solid #262626',borderRadius:8,fontSize:14,fontFamily:'system-ui',outline:'none',background:'#0a0a0a',color:'white'}} />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13}}>
      <span style={{color:'#888'}}>{label}</span>
      <span style={{color:'white',fontWeight:500}}>{value}</span>
    </div>
  )
}

function CredentialCard({ title, email, password, url }) {
  return (
    <div style={{background:'#0a0a0a',border:'1px solid #262626',borderRadius:10,padding:12,marginBottom:8}}>
      <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600,marginBottom:8}}>{title} · {url}</div>
      <div style={{fontSize:12,color:'#aaa',marginBottom:4}}><strong style={{color:'white'}}>Email:</strong> {email}</div>
      <div style={{fontSize:12,color:'#aaa'}}><strong style={{color:'white'}}>Password:</strong> <code style={{color:'#10b981',fontSize:12}}>{password}</code></div>
    </div>
  )
}

export default function SuperAdminPage() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [metrics, setMetrics] = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: superAdmin } = await supabase
          .from('super_admins').select('*').eq('email', session.user.email).single()
        if (superAdmin) setUser(session.user)
      }
      setAuthLoading(false)
    })
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: metricsData }, { data: restaurantsData }] = await Promise.all([
      supabase.from('platform_metrics').select('*').single(),
      supabase.from('restaurant_overview').select('*'),
    ])
    if (metricsData) setMetrics(metricsData)
    if (restaurantsData) setRestaurants(restaurantsData)
    setLoading(false)
  }, [])

  useEffect(() => { if (user) fetchData() }, [user])

  const logout = async () => { await supabase.auth.signOut(); setUser(null) }

  const handleExport = async (opts) => {
    // Fetch full restaurant list from source of truth (restaurants table)
    const { data: allRestaurants } = await supabase.from('restaurants').select('id, name, slug, plan, city, country')
    if (!allRestaurants || allRestaurants.length === 0) {
      throw new Error('No restaurants to export')
    }
    await exportPlatform({ restaurants: allRestaurants, ...opts })
  }

  if (authLoading) return <div style={st.center}><p style={{color:'#666'}}>...</p></div>
  if (!user) return <LoginScreen onLogin={setUser} />
  if (loading) return <div style={st.center}><p style={{color:'#666'}}>Loading...</p></div>

  const filteredRestaurants = restaurants.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.owner_email?.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={st.page}>
      {showCreate && <CreateRestaurantModal onClose={() => setShowCreate(false)} onCreated={fetchData} />}
      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        title="Export — All Restaurants"
        subtitle={`Download combined data for ${restaurants.length} restaurant${restaurants.length === 1 ? '' : 's'}`}
      />

      <header style={st.header}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>⚡</span>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:'white',letterSpacing:'-0.02em'}}>TableFlow</div>
            <div style={{fontSize:11,color:'#666',textTransform:'uppercase',letterSpacing:'0.08em'}}>Super Admin</div>
          </div>
        </div>
        <div style={{display:'flex',gap:4,background:'#141414',padding:4,borderRadius:10,border:'1px solid #262626'}}>
          {['dashboard','restaurants'].map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{padding:'6px 16px',borderRadius:7,fontSize:13,fontWeight:500,cursor:'pointer',background:tab===tb?'#262626':'transparent',color:tab===tb?'white':'#888',border:'none',fontFamily:'system-ui',textTransform:'capitalize'}}>
              {tb}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:12,color:'#666'}}>{user.email}</span>
          <button onClick={logout} style={{padding:'6px 12px',background:'transparent',border:'1px solid #262626',borderRadius:7,fontSize:12,cursor:'pointer',color:'#888'}}>Logout</button>
        </div>
      </header>

      {tab === 'dashboard' && (
        <div style={st.content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
            <h1 style={{...st.h1, marginBottom:0}}>Platform Overview</h1>
            <button onClick={() => setShowExport(true)} style={{...st.primaryBtn}}>
              📊 Export All
            </button>
          </div>

          <div style={st.metricsGrid}>
            <MetricCard label="MRR" value={`€${(metrics?.mrr || 0).toFixed(0)}`} hint="Monthly Recurring Revenue" color="#6366f1" />
            <MetricCard label="Active Restaurants" value={metrics?.active_restaurants || 0} hint={`${metrics?.total_restaurants || 0} total`} color="#10b981" />
            <MetricCard label="Orders Today" value={metrics?.orders_today || 0} hint={`${metrics?.orders_this_month || 0} this month`} color="#f59e0b" />
            <MetricCard label="GMV Today" value={`€${(metrics?.gmv_today || 0).toFixed(0)}`} hint={`€${(metrics?.gmv_this_month || 0).toFixed(0)} this month`} color="#ec4899" />
          </div>

          <div style={{marginTop:32}}>
            <h2 style={st.h2}>Top Restaurants (by revenue this month)</h2>
            <div style={st.card}>
              {restaurants.slice(0, 10).sort((a,b) => b.revenue_this_month - a.revenue_this_month).map((r, i) => (
                <div key={r.id} style={{display:'flex',alignItems:'center',padding:'14px 0',borderBottom: i < 9 ? '1px solid #262626' : 'none', gap:12}}>
                  <div style={{width:24,fontSize:13,color:'#666',fontWeight:600}}>{i+1}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:600,color:'white'}}>{r.name}</div>
                    <div style={{fontSize:12,color:'#666',marginTop:2}}>{r.city}, {r.country} · {r.plan}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:14,fontWeight:600,color:'#10b981'}}>€{(r.revenue_this_month || 0).toFixed(2)}</div>
                    <div style={{fontSize:11,color:'#666',marginTop:2}}>{r.orders_today} orders today</div>
                  </div>
                </div>
              ))}
              {restaurants.length === 0 && <p style={{color:'#666',textAlign:'center',padding:20}}>No restaurants yet</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'restaurants' && (
        <div style={st.content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,gap:16,flexWrap:'wrap'}}>
            <h1 style={{...st.h1, marginBottom:0}}>Restaurants</h1>
            <div style={{display:'flex',gap:8}}>
              <button style={{...st.primaryBtn, background:'#262626', border:'1px solid #333'}} onClick={() => setShowExport(true)}>📊 Export All</button>
              <button style={st.primaryBtn} onClick={() => setShowCreate(true)}>+ New restaurant</button>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search by name, email, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:'100%',padding:'12px 16px',background:'#141414',border:'1px solid #262626',borderRadius:10,fontSize:14,color:'white',outline:'none',marginBottom:16,fontFamily:'system-ui'}}
          />

          <div style={st.card}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 100px 120px 120px 80px',gap:12,padding:'12px 4px',borderBottom:'1px solid #262626',fontSize:11,color:'#666',textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600}}>
              <div>Restaurant</div>
              <div>Owner</div>
              <div>Plan</div>
              <div style={{textAlign:'right'}}>Tables</div>
              <div style={{textAlign:'right'}}>Revenue (MTD)</div>
              <div style={{textAlign:'right'}}>Status</div>
            </div>

            {filteredRestaurants.map(r => (
              <a key={r.id} href={`/super-admin/${r.slug}`} style={{display:'grid',gridTemplateColumns:'2fr 1fr 100px 120px 120px 80px',gap:12,padding:'14px 4px',borderBottom:'1px solid #262626',alignItems:'center',textDecoration:'none',color:'inherit',transition:'background 0.1s'}}
                onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:'white'}}>{r.name}</div>
                  <div style={{fontSize:12,color:'#666',marginTop:2}}>{r.city}, {r.country}</div>
                </div>
                <div style={{fontSize:12,color:'#aaa',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.owner_email || '—'}</div>
                <div>
                  <span style={{...getPlanStyle(r.plan)}}>{r.plan}</span>
                </div>
                <div style={{textAlign:'right',fontSize:13,color:'#aaa'}}>{r.table_count}</div>
                <div style={{textAlign:'right',fontSize:14,fontWeight:600,color:'#10b981'}}>€{(r.revenue_this_month || 0).toFixed(0)}</div>
                <div style={{textAlign:'right'}}>
                  <span style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,background: r.active ? '#0d2f1f' : '#2a1515', color: r.active ? '#10b981' : '#f87171'}}>
                    {r.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </a>
            ))}

            {filteredRestaurants.length === 0 && (
              <p style={{color:'#666',textAlign:'center',padding:40}}>
                {search ? 'No restaurants match your search' : 'No restaurants yet'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, hint, color }) {
  return (
    <div style={st.card}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:color,display:'inline-block'}}/>
        <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600}}>{label}</div>
      </div>
      <div style={{fontSize:32,fontWeight:700,color:'white',letterSpacing:'-0.02em'}}>{value}</div>
      <div style={{fontSize:12,color:'#666',marginTop:4}}>{hint}</div>
    </div>
  )
}

function getPlanStyle(plan) {
  const map = {
    trial:      { background: '#2a2015', color: '#f59e0b', border: '1px solid #78350f' },
    basic:      { background: '#1a1a2e', color: '#8b9cf6', border: '1px solid #3730a3' },
    pro:        { background: '#1a2e2a', color: '#10b981', border: '1px solid #065f46' },
    enterprise: { background: '#2e1a2e', color: '#ec4899', border: '1px solid #9f1239' },
  }
  return {
    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
    ...(map[plan] || map.trial)
  }
}

const st = {
  page:        {minHeight:'100vh',background:'#0a0a0a',fontFamily:'system-ui,sans-serif',color:'white'},
  header:      {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid #1a1a1a',position:'sticky',top:0,background:'#0a0a0a',zIndex:10,gap:16,flexWrap:'wrap'},
  content:     {maxWidth:1200,margin:'0 auto',padding:'32px 24px'},
  h1:          {fontSize:28,fontWeight:700,marginBottom:24,letterSpacing:'-0.02em'},
  h2:          {fontSize:16,fontWeight:600,marginBottom:12,color:'#ccc'},
  card:        {background:'#141414',border:'1px solid #262626',borderRadius:12,padding:20},
  metricsGrid: {display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:16},
  primaryBtn:  {padding:'10px 18px',background:'linear-gradient(135deg, #6366f1, #8b5cf6)',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'},
  center:      {display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0a0a0a',color:'white'},
}