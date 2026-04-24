import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ---- Helpers for date ranges ----
function getDateRange(period, specificMonth) {
  if (specificMonth) {
    const [y, m] = specificMonth.split('-').map(Number)
    const from = new Date(y, m - 1, 1, 0, 0, 0, 0)
    const to = new Date(y, m, 1, 0, 0, 0, 0)
    return { from, to, label: from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
  }
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  let from = new Date()
  let label = ''
  if (period === 'week') {
    from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0,0,0,0)
    label = 'Last 7 days'
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    label = 'This month'
  } else if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    from = new Date(now.getFullYear(), q * 3, 1)
    label = `Q${q+1} ${now.getFullYear()}`
  } else if (period === 'year') {
    from = new Date(now.getFullYear(), 0, 1)
    label = `${now.getFullYear()}`
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    label = 'This month'
  }
  return { from, to, label }
}

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}

// ---- Shared period filter component ----
function PeriodFilter({ period, specificMonth, onChangePeriod, onChangeMonth, monthOptions }) {
  return (
    <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
      {[
        {id:'week', label:'Week'},
        {id:'month', label:'Month'},
        {id:'quarter', label:'Quarter'},
        {id:'year', label:'Year'},
      ].map(p => {
        const isActive = period === p.id && !specificMonth
        return (
          <button
            key={p.id}
            onClick={() => { onChangePeriod(p.id); onChangeMonth('') }}
            style={{
              padding:'5px 12px',
              borderRadius:6,
              fontSize:11,
              fontWeight:600,
              cursor:'pointer',
              background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
              color: isActive ? 'white' : '#aaa',
              border: isActive ? 'none' : '1px solid #262626',
              fontFamily:'system-ui',
            }}
          >
            {p.label}
          </button>
        )
      })}
      <select
        value={specificMonth}
        onChange={e => onChangeMonth(e.target.value)}
        style={{
          padding:'5px 10px',
          borderRadius:6,
          fontSize:11,
          fontWeight:600,
          cursor:'pointer',
          background: specificMonth ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
          color: specificMonth ? 'white' : '#aaa',
          border: specificMonth ? 'none' : '1px solid #262626',
          fontFamily:'system-ui',
          outline:'none',
          marginLeft:4,
        }}
      >
        <option value="" style={{background:'#141414'}}>Specific month…</option>
        {monthOptions.map(m => (
          <option key={m.value} value={m.value} style={{background:'#141414'}}>{m.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function RestaurantDetailPage() {
  const router = useRouter()
  const { slug } = router.query
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [restaurant, setRestaurant] = useState(null)
  const [tables, setTables] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [topItems, setTopItems] = useState([])
  const [topItemsLoading, setTopItemsLoading] = useState(false)
  const [hourlyData, setHourlyData] = useState([])
  const [hourlyLoading, setHourlyLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingPlan, setSavingPlan] = useState(false)

  // Top Sellers period filter
  const [topPeriod, setTopPeriod] = useState('month')
  const [topSpecificMonth, setTopSpecificMonth] = useState('')

  // Peak Hours period filter
  const [peakPeriod, setPeakPeriod] = useState('month')
  const [peakSpecificMonth, setPeakSpecificMonth] = useState('')

  const monthOptions = useMemo(() => getMonthOptions(), [])

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

  const fetchTopItems = useCallback(async (restaurantId) => {
    if (!restaurantId) return
    setTopItemsLoading(true)
    const { from, to } = getDateRange(topPeriod, topSpecificMonth)
    const { data: itemEvents } = await supabase
      .from('analytics_events')
      .select('event_data')
      .eq('restaurant_id', restaurantId)
      .eq('event_type', 'item_ordered')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())

    const itemMap = {}
    itemEvents?.forEach(e => {
      const name = e.event_data?.name
      if (!name) return
      if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 }
      itemMap[name].qty += e.event_data.qty || 0
      itemMap[name].revenue += (e.event_data.line_total || 0)
    })
    setTopItems(Object.values(itemMap).sort((a,b) => b.qty - a.qty).slice(0, 10))
    setTopItemsLoading(false)
  }, [topPeriod, topSpecificMonth])

  const fetchHourly = useCallback(async (restaurantId) => {
    if (!restaurantId) return
    setHourlyLoading(true)
    const { from, to } = getDateRange(peakPeriod, peakSpecificMonth)
    const { data: orderEvents } = await supabase
      .from('analytics_events')
      .select('hour_of_day')
      .eq('restaurant_id', restaurantId)
      .eq('event_type', 'order_placed')
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())

    const hourMap = {}
    for (let h = 0; h < 24; h++) hourMap[h] = 0
    orderEvents?.forEach(e => {
      if (typeof e.hour_of_day === 'number') {
        hourMap[e.hour_of_day] = (hourMap[e.hour_of_day] || 0) + 1
      }
    })
    setHourlyData(Object.entries(hourMap).map(([hour, count]) => ({ hour: parseInt(hour), count })))
    setHourlyLoading(false)
  }, [peakPeriod, peakSpecificMonth])

  const fetchData = useCallback(async () => {
    if (!slug) return
    const { data: rest } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
    if (!rest) { setLoading(false); return }
    setRestaurant(rest)

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
    const [
      { data: tablesData },
      { data: ordersData },
      { data: orderEvents },
      { data: closedEvents },
      { data: itemEventsMtd },
    ] = await Promise.all([
      supabase.from('tables').select('*').eq('restaurant_id', rest.id).order('name'),
      supabase.from('orders').select('id, created_at, status, total, guest_count, tables(name), order_lines(name, qty, price)').in('table_id', (await supabase.from('tables').select('id').eq('restaurant_id', rest.id)).data?.map(t => t.id) || []).order('created_at', { ascending: false }).limit(20),
      supabase.from('analytics_events').select('hour_of_day').eq('restaurant_id', rest.id).eq('event_type', 'order_placed').gte('created_at', monthStart.toISOString()),
      supabase.from('analytics_events').select('event_data').eq('restaurant_id', rest.id).eq('event_type', 'table_closed').gte('created_at', monthStart.toISOString()),
      supabase.from('analytics_events').select('event_data').eq('restaurant_id', rest.id).eq('event_type', 'item_ordered').gte('created_at', monthStart.toISOString()),
    ])

    if (tablesData) setTables(tablesData)
    if (ordersData) setRecentOrders(ordersData)

    const totalRevenue = closedEvents?.reduce((s, e) => s + (e.event_data?.total_amount || 0), 0) || 0
    const totalOrders = orderEvents?.length || 0
    const totalItems = itemEventsMtd?.reduce((s, e) => s + (e.event_data?.qty || 0), 0) || 0
    const totalGuests = closedEvents?.reduce((s, e) => s + (e.event_data?.guest_count || 0), 0) || 0
    const avgDuration = closedEvents?.length > 0
      ? Math.round(closedEvents.reduce((s, e) => s + (e.event_data?.duration_minutes || 0), 0) / closedEvents.length)
      : 0

    setStats({
      totalRevenue, totalOrders, totalItems, totalGuests, avgDuration,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    })
    setLoading(false)

    fetchTopItems(rest.id)
    fetchHourly(rest.id)
  }, [slug, fetchTopItems, fetchHourly])

  useEffect(() => { if (user && slug) fetchData() }, [user, slug])

  useEffect(() => {
    if (restaurant?.id) fetchTopItems(restaurant.id)
  }, [topPeriod, topSpecificMonth, restaurant?.id, fetchTopItems])

  useEffect(() => {
    if (restaurant?.id) fetchHourly(restaurant.id)
  }, [peakPeriod, peakSpecificMonth, restaurant?.id, fetchHourly])

  const updatePlan = async (newPlan) => {
    setSavingPlan(true)
    await supabase.from('restaurants').update({ plan: newPlan }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, plan: newPlan })
    setSavingPlan(false)
  }

  const toggleActive = async () => {
    const newActive = !restaurant.active
    await supabase.from('restaurants').update({ active: newActive }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, active: newActive })
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/super-admin') }

  if (authLoading) return <div style={s.center}><p style={{color:'#666'}}>...</p></div>
  if (!user) { router.push('/super-admin'); return null }
  if (loading) return <div style={s.center}><p style={{color:'#666'}}>Loading...</p></div>
  if (!restaurant) return <div style={s.center}><p style={{color:'#666'}}>Restaurant not found</p></div>

  const maxHourly = Math.max(...hourlyData.map(h => h.count), 1)
  const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, {hour:0,count:0})
  const { label: topPeriodLabel } = getDateRange(topPeriod, topSpecificMonth)
  const { label: peakPeriodLabel } = getDateRange(peakPeriod, peakSpecificMonth)
  const totalOrdersInPeriod = hourlyData.reduce((s, h) => s + h.count, 0)

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={() => router.push('/super-admin')} style={{background:'transparent',border:'1px solid #262626',color:'#888',padding:'6px 12px',borderRadius:7,cursor:'pointer',fontSize:13}}>← Back</button>
          <span style={{fontSize:20}}>⚡</span>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:'white',letterSpacing:'-0.02em'}}>TableFlow</div>
            <div style={{fontSize:11,color:'#666',textTransform:'uppercase',letterSpacing:'0.08em'}}>Super Admin</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:12,color:'#666'}}>{user.email}</span>
          <button onClick={logout} style={{padding:'6px 12px',background:'transparent',border:'1px solid #262626',borderRadius:7,fontSize:12,cursor:'pointer',color:'#888'}}>Logout</button>
        </div>
      </header>

      <div style={s.content}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32,flexWrap:'wrap',gap:16}}>
          <div>
            <h1 style={s.h1}>{restaurant.name}</h1>
            <div style={{display:'flex',alignItems:'center',gap:12,color:'#888',fontSize:14,flexWrap:'wrap'}}>
              <span>📍 {restaurant.city || '—'}, {restaurant.country || '—'}</span>
              <span>•</span>
              <span>🔗 /{restaurant.slug}</span>
              <span>•</span>
              <span>📧 {restaurant.owner_email || '—'}</span>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={toggleActive} style={{...s.btn, background: restaurant.active ? '#2a1515' : '#0d2f1f', color: restaurant.active ? '#f87171' : '#10b981', border: restaurant.active ? '1px solid #7f1d1d' : '1px solid #065f46'}}>
              {restaurant.active ? '⏸ Suspend' : '▶ Activate'}
            </button>
            <a href={`https://taverna-kriti.vercel.app/admin`} target="_blank" rel="noopener" style={{...s.btn, textDecoration:'none', display:'inline-flex', alignItems:'center'}}>
              🔓 Open admin
            </a>
          </div>
        </div>

        <div style={{...s.card, marginBottom:24}}>
          <div style={{fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600,marginBottom:12}}>Subscription Plan</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {['trial','basic','pro','enterprise'].map(p => (
              <button key={p} onClick={() => updatePlan(p)} disabled={savingPlan}
                style={{
                  padding:'10px 20px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',textTransform:'uppercase',letterSpacing:'0.05em',
                  background: restaurant.plan === p ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                  color: restaurant.plan === p ? 'white' : '#888',
                  border: restaurant.plan === p ? 'none' : '1px solid #262626',
                }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{marginTop:12,fontSize:12,color:'#666'}}>
            {restaurant.plan === 'trial' && 'Free for 30 days — auto-converts to Basic'}
            {restaurant.plan === 'basic' && '€100/month — up to 15 tables, 100 menu items, 3 languages'}
            {restaurant.plan === 'pro' && '€200/month — up to 50 tables, 500 menu items, 8 languages, analytics'}
            {restaurant.plan === 'enterprise' && '€300/month — unlimited everything, custom features, API access'}
          </div>
        </div>

        <div style={s.metricsGrid}>
          <MetricCard label="Revenue (MTD)" value={`€${(stats?.totalRevenue || 0).toFixed(0)}`} hint={`${stats?.totalOrders || 0} orders`} color="#10b981" />
          <MetricCard label="Avg Order Value" value={`€${(stats?.avgOrderValue || 0).toFixed(2)}`} hint={`${stats?.totalItems || 0} items sold`} color="#6366f1" />
          <MetricCard label="Tables" value={tables.length} hint={`${tables.filter(t => t.active !== false).length} active`} color="#f59e0b" />
          <MetricCard label="Avg Dining Time" value={`${stats?.avgDuration || 0} min`} hint={`${stats?.totalGuests || 0} guests served`} color="#ec4899" />
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:24}}>
          {/* TOP SELLERS */}
          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <h2 style={{...s.h2, marginBottom:0}}>🏆 Top Sellers</h2>
              <div style={{fontSize:11,color:'#888'}}>{topPeriodLabel}</div>
            </div>
            <div style={{marginBottom:16}}>
              <PeriodFilter
                period={topPeriod}
                specificMonth={topSpecificMonth}
                onChangePeriod={setTopPeriod}
                onChangeMonth={setTopSpecificMonth}
                monthOptions={monthOptions}
              />
            </div>
            {topItemsLoading ? (
              <p style={{color:'#666',textAlign:'center',padding:20}}>Loading…</p>
            ) : topItems.length === 0 ? (
              <p style={{color:'#666',textAlign:'center',padding:20}}>No data for this period</p>
            ) : (
              topItems.map((item, i) => (
                <div key={item.name} style={{display:'flex',alignItems:'center',padding:'10px 0',borderBottom: i < topItems.length - 1 ? '1px solid #262626' : 'none', gap:12}}>
                  <div style={{width:20,fontSize:12,color:'#666',fontWeight:600}}>{i+1}</div>
                  <div style={{flex:1,fontSize:13,color:'white',fontWeight:500}}>{item.name}</div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#10b981'}}>{item.qty}×</div>
                    <div style={{fontSize:11,color:'#666'}}>€{item.revenue.toFixed(2)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PEAK HOURS */}
          <div style={s.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <h2 style={{...s.h2, marginBottom:0}}>⏰ Peak Hours</h2>
              <div style={{fontSize:11,color:'#888'}}>{peakPeriodLabel}</div>
            </div>
            <div style={{marginBottom:16}}>
              <PeriodFilter
                period={peakPeriod}
                specificMonth={peakSpecificMonth}
                onChangePeriod={setPeakPeriod}
                onChangeMonth={setPeakSpecificMonth}
                monthOptions={monthOptions}
              />
            </div>
            {hourlyLoading ? (
              <p style={{color:'#666',textAlign:'center',padding:20}}>Loading…</p>
            ) : hourlyData.every(h => h.count === 0) ? (
              <p style={{color:'#666',textAlign:'center',padding:20}}>No data for this period</p>
            ) : (
              <>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div style={{fontSize:12,color:'#aaa'}}>
                    Peak: <strong style={{color:'white'}}>{String(peakHour.hour).padStart(2,'0')}:00</strong>
                    <span style={{color:'#666'}}> · {peakHour.count} orders</span>
                  </div>
                  <div style={{fontSize:10,color:'#666'}}>
                    Total: {totalOrdersInPeriod} · Max: {maxHourly}
                  </div>
                </div>

                <div style={{position:'relative',height:140,marginBottom:10}}>
                  {[0.25, 0.5, 0.75].map(frac => (
                    <div key={frac} style={{position:'absolute',left:0,right:0,top:`${(1-frac)*100}%`,borderTop:'1px dashed #222',pointerEvents:'none'}}/>
                  ))}

                  <div style={{display:'flex',alignItems:'flex-end',gap:2,height:'100%',position:'relative',zIndex:1}}>
                    {hourlyData.map(h => {
                      const isPeak = h.count === peakHour.count && h.count > 0
                      const heightPct = h.count > 0 ? Math.max((h.count / maxHourly) * 100, 6) : 0
                      return (
                        <div
                          key={h.hour}
                          title={`${String(h.hour).padStart(2,'0')}:00 — ${h.count} order${h.count===1?'':'s'}`}
                          style={{
                            flex:1,
                            display:'flex',
                            flexDirection:'column',
                            alignItems:'center',
                            justifyContent:'flex-end',
                            height:'100%',
                            cursor: h.count > 0 ? 'pointer' : 'default',
                          }}
                        >
                          {h.count > 0 && (
                            <div style={{
                              fontSize:9,
                              color: isPeak ? '#c4b5fd' : '#888',
                              marginBottom:2,
                              fontWeight:600,
                              lineHeight:1,
                            }}>
                              {h.count}
                            </div>
                          )}
                          <div style={{
                            width:'100%',
                            height: `${heightPct}%`,
                            minHeight: h.count > 0 ? 6 : 0,
                            background: h.count === 0
                              ? 'transparent'
                              : isPeak
                                ? 'linear-gradient(180deg, #a78bfa, #6366f1)'
                                : 'linear-gradient(180deg, #6366f1, #4338ca)',
                            borderRadius:'3px 3px 0 0',
                            opacity: h.count === 0 ? 0 : (isPeak ? 1 : 0.7),
                            transition:'opacity 0.2s',
                            boxShadow: isPeak ? '0 0 12px rgba(139, 92, 246, 0.4)' : 'none',
                          }}/>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#666',paddingTop:2,borderTop:'1px solid #262626'}}>
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{...s.card, marginTop:24}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style={{...s.h2,marginBottom:0}}>🪑 Tables ({tables.length})</h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))',gap:8}}>
            {tables.map(t => (
              <div key={t.id} style={{background:'#0a0a0a',border:'1px solid #262626',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:13,fontWeight:600,color:'white'}}>{t.name}</div>
                <div style={{fontSize:10,color:'#666',marginTop:2,fontFamily:'monospace'}}>{t.token}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{...s.card, marginTop:24}}>
          <h2 style={s.h2}>📦 Recent Orders ({recentOrders.length})</h2>
          {recentOrders.length === 0 ? (
            <p style={{color:'#666',textAlign:'center',padding:20}}>No orders yet</p>
          ) : (
            recentOrders.map((o, i) => {
              const total = (o.order_lines || []).reduce((s,l) => s + l.price * l.qty, 0)
              const itemCount = (o.order_lines || []).reduce((s,l) => s + l.qty, 0)
              return (
                <div key={o.id} style={{display:'grid',gridTemplateColumns:'100px 1fr 100px 100px 100px',gap:12,padding:'12px 0',borderBottom: i < recentOrders.length - 1 ? '1px solid #262626' : 'none',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:13,color:'white',fontWeight:500}}>{o.tables?.name || '—'}</div>
                    <div style={{fontSize:10,color:'#666'}}>{new Date(o.created_at).toLocaleString('da-DK', {timeZone:'Europe/Copenhagen', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</div>
                  </div>
                  <div style={{fontSize:12,color:'#aaa'}}>
                    {(o.order_lines || []).slice(0,3).map(l => `${l.qty}× ${l.name}`).join(', ')}
                    {o.order_lines && o.order_lines.length > 3 && ` +${o.order_lines.length - 3} more`}
                  </div>
                  <div style={{textAlign:'right',fontSize:12,color:'#888'}}>{itemCount} items</div>
                  <div style={{textAlign:'right',fontSize:12,color:'#888'}}>{o.guest_count || '—'} guests</div>
                  <div style={{textAlign:'right',fontSize:14,fontWeight:600,color:'#10b981'}}>€{total.toFixed(2)}</div>
                </div>
              )
            })
          )}
        </div>

        <div style={{...s.card, marginTop:24, border:'1px solid #7f1d1d', background:'#1a0a0a'}}>
          <h2 style={{...s.h2, color:'#f87171'}}>⚠️ Danger Zone</h2>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #2a1515'}}>
            <div>
              <div style={{fontSize:14,color:'white',fontWeight:500}}>Suspend restaurant</div>
              <div style={{fontSize:12,color:'#888',marginTop:2}}>Restaurant can no longer accept orders</div>
            </div>
            <button onClick={toggleActive} style={{...s.btn, background:'transparent', color:'#f87171', border:'1px solid #7f1d1d'}}>
              {restaurant.active ? 'Suspend' : 'Reactivate'}
            </button>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0'}}>
            <div>
              <div style={{fontSize:14,color:'white',fontWeight:500}}>Delete restaurant</div>
              <div style={{fontSize:12,color:'#888',marginTop:2}}>Permanently delete all data — cannot be undone</div>
            </div>
            <button onClick={() => alert('Sletning kommer i næste version — for nu kan du gøre det direkte i Supabase')} style={{...s.btn, background:'#dc2626', color:'white', border:'none'}}>
              Delete
            </button>
          </div>
        </div>
      </div>
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
      <div style={{fontSize:28,fontWeight:700,color:'white',letterSpacing:'-0.02em'}}>{value}</div>
      <div style={{fontSize:12,color:'#666',marginTop:4}}>{hint}</div>
    </div>
  )
}

const s = {
  page:        {minHeight:'100vh',background:'#0a0a0a',fontFamily:'system-ui,sans-serif',color:'white'},
  header:      {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 24px',borderBottom:'1px solid #1a1a1a',position:'sticky',top:0,background:'#0a0a0a',zIndex:10,gap:16,flexWrap:'wrap'},
  content:     {maxWidth:1200,margin:'0 auto',padding:'32px 24px'},
  h1:          {fontSize:28,fontWeight:700,marginBottom:8,letterSpacing:'-0.02em'},
  h2:          {fontSize:14,fontWeight:600,marginBottom:16,color:'#ccc'},
  card:        {background:'#141414',border:'1px solid #262626',borderRadius:12,padding:20},
  metricsGrid: {display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:16},
  btn:         {padding:'8px 16px',background:'#262626',color:'white',border:'1px solid #333',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'system-ui'},
  center:      {display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0a0a0a',color:'white'},
}