import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

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

    // Tjek om email er super-admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('*')
      .eq('email', data.user.email)
      .single()

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

export default function SuperAdminPage() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [metrics, setMetrics] = useState(null)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: superAdmin } = await supabase
          .from('super_admins')
          .select('*')
          .eq('email', session.user.email)
          .single()
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

  if (authLoading) return <div style={s.center}><p style={{color:'#666'}}>...</p></div>
  if (!user) return <LoginScreen onLogin={setUser} />
  if (loading) return <div style={s.center}><p style={{color:'#666'}}>Loading...</p></div>

  const filteredRestaurants = restaurants.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.owner_email?.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.page}>
      <header style={s.header}>
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
        <div style={s.content}>
          <h1 style={s.h1}>Platform Overview</h1>

          <div style={s.metricsGrid}>
            <MetricCard label="MRR" value={`€${(metrics?.mrr || 0).toFixed(0)}`} hint="Monthly Recurring Revenue" color="#6366f1" />
            <MetricCard label="Active Restaurants" value={metrics?.active_restaurants || 0} hint={`${metrics?.total_restaurants || 0} total`} color="#10b981" />
            <MetricCard label="Orders Today" value={metrics?.orders_today || 0} hint={`${metrics?.orders_this_month || 0} this month`} color="#f59e0b" />
            <MetricCard label="GMV Today" value={`€${(metrics?.gmv_today || 0).toFixed(0)}`} hint={`€${(metrics?.gmv_this_month || 0).toFixed(0)} this month`} color="#ec4899" />
          </div>

          <div style={{marginTop:32}}>
            <h2 style={s.h2}>Top Restaurants (by revenue this month)</h2>
            <div style={s.card}>
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
        <div style={s.content}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,gap:16,flexWrap:'wrap'}}>
            <h1 style={{...s.h1, marginBottom:0}}>Restaurants</h1>
            <button style={s.primaryBtn} onClick={() => alert('Opret-restaurant wizard kommer i næste step!')}>+ New restaurant</button>
          </div>

          <input
            type="text"
            placeholder="Search by name, email, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{width:'100%',padding:'12px 16px',background:'#141414',border:'1px solid #262626',borderRadius:10,fontSize:14,color:'white',outline:'none',marginBottom:16,fontFamily:'system-ui'}}
          />

          <div style={s.card}>
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
    <div style={s.card}>
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

const s = {
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