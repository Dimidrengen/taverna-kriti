import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// =============================================================================
// Date range helpers
// =============================================================================
export function getDateRange(period, specificMonth, specificYear) {
  if (specificMonth) {
    const [y, m] = specificMonth.split('-').map(Number)
    const from = new Date(y, m - 1, 1, 0, 0, 0, 0)
    const to = new Date(y, m, 1, 0, 0, 0, 0)
    return { from, to, label: from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
  }
  if (specificYear) {
    const y = parseInt(specificYear)
    return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), label: String(y) }
  }
  const now = new Date()
  if (period === 'week') {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0,0,0,0)
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return { from, to, label: 'Last 7 days' }
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { from, to, label: from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), q * 3, 1)
    const to = new Date(now.getFullYear(), (q + 1) * 3, 1)
    return { from, to, label: `Q${q+1} ${now.getFullYear()}` }
  }
  if (period === 'year') {
    const from = new Date(now.getFullYear(), 0, 1)
    const to = new Date(now.getFullYear() + 1, 0, 1)
    return { from, to, label: String(now.getFullYear()) }
  }
  if (period === 'allTime') {
    return { from: new Date('2020-01-01'), to: new Date('2100-01-01'), label: 'All time' }
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from, to, label: from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
}

export function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}

export function getYearOptions() {
  const options = []
  const year = new Date().getFullYear()
  for (let i = 0; i < 5; i++) options.push({ value: String(year - i), label: String(year - i) })
  return options
}

// =============================================================================
// Small helpers
// =============================================================================
function formatDate(d) {
  return new Date(d).toLocaleDateString('da-DK', { timeZone: 'Europe/Copenhagen' })
}
function formatTime(d) {
  return new Date(d).toLocaleTimeString('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' })
}
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// =============================================================================
// Data fetching
// =============================================================================
async function fetchRestaurantOrders(restaurantId, from, to) {
  const { data: tables } = await supabase
    .from('tables')
    .select('id, name')
    .eq('restaurant_id', restaurantId)

  if (!tables || tables.length === 0) return []

  const tableIds = tables.map(t => t.id)
  const tableMap = {}
  tables.forEach(t => { tableMap[t.id] = t.name })

  // Paginate to handle more than 1000 rows
  let all = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, status, guest_count, table_id, order_lines(name, qty, price)')
      .in('table_id', tableIds)
      .in('status', ['done', 'archived'])
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error || !data || data.length === 0) break
    all = all.concat(data.map(o => ({ ...o, table_name: tableMap[o.table_id] })))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

// =============================================================================
// Row builders (return arrays of plain objects for xlsx)
// =============================================================================
function toOrderRows(orders, restaurantName) {
  return orders.map((o, idx) => {
    const total = (o.order_lines || []).reduce((s, l) => s + (l.price * l.qty), 0)
    const itemCount = (o.order_lines || []).reduce((s, l) => s + l.qty, 0)
    const row = {
      Date: formatDate(o.created_at),
      Time: formatTime(o.created_at),
      Table: o.table_name || '—',
      Items: itemCount,
      Guests: o.guest_count || 0,
      'Total (€)': Number(total.toFixed(2)),
      Status: o.status,
    }
    return restaurantName ? { Restaurant: restaurantName, ...row } : row
  })
}

function toItemRows(orders, restaurantName) {
  const rows = []
  orders.forEach(o => {
    (o.order_lines || []).forEach(line => {
      const row = {
        Date: formatDate(o.created_at),
        Time: formatTime(o.created_at),
        Table: o.table_name || '—',
        Item: line.name,
        Qty: line.qty,
        'Unit Price (€)': Number(Number(line.price).toFixed(2)),
        'Total (€)': Number((line.price * line.qty).toFixed(2)),
      }
      rows.push(restaurantName ? { Restaurant: restaurantName, ...row } : row)
    })
  })
  return rows
}

function toDailyBreakdown(orders) {
  const byDay = {}
  orders.forEach(o => {
    const key = formatDate(o.created_at)
    if (!byDay[key]) byDay[key] = { Date: key, Orders: 0, Items: 0, 'Revenue (€)': 0 }
    byDay[key].Orders++
    byDay[key].Items += (o.order_lines || []).reduce((s, l) => s + l.qty, 0)
    byDay[key]['Revenue (€)'] += (o.order_lines || []).reduce((s, l) => s + l.price * l.qty, 0)
  })
  return Object.values(byDay)
    .map(r => ({ ...r, 'Revenue (€)': Number(r['Revenue (€)'].toFixed(2)) }))
    .sort((a, b) => a.Date.localeCompare(b.Date))
}

function toItemRanking(orders) {
  const byItem = {}
  orders.forEach(o => {
    (o.order_lines || []).forEach(line => {
      if (!byItem[line.name]) byItem[line.name] = { Item: line.name, 'Times Ordered': 0, Qty: 0, 'Revenue (€)': 0 }
      byItem[line.name]['Times Ordered']++
      byItem[line.name].Qty += line.qty
      byItem[line.name]['Revenue (€)'] += line.price * line.qty
    })
  })
  return Object.values(byItem)
    .map(r => ({ ...r, 'Revenue (€)': Number(r['Revenue (€)'].toFixed(2)) }))
    .sort((a, b) => b.Qty - a.Qty)
}

function buildSummary(orders, label, extraFields = {}) {
  const totalRevenue = orders.reduce((s, o) => s + (o.order_lines || []).reduce((ss, l) => ss + l.price * l.qty, 0), 0)
  const totalItems = orders.reduce((s, o) => s + (o.order_lines || []).reduce((ss, l) => ss + l.qty, 0), 0)
  const totalGuests = orders.reduce((s, o) => s + (o.guest_count || 0), 0)
  const totalOrders = orders.length
  return [
    ...Object.entries(extraFields).map(([k, v]) => ({ Metric: k, Value: v })),
    { Metric: 'Period', Value: label },
    { Metric: 'Generated', Value: new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' }) },
    { Metric: '', Value: '' },
    { Metric: 'Total Orders', Value: totalOrders },
    { Metric: 'Total Items Sold', Value: totalItems },
    { Metric: 'Total Guests', Value: totalGuests },
    { Metric: 'Total Revenue (€)', Value: Number(totalRevenue.toFixed(2)) },
    { Metric: 'Avg Order Value (€)', Value: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0 },
    { Metric: 'Avg Items per Order', Value: totalOrders > 0 ? Number((totalItems / totalOrders).toFixed(2)) : 0 },
  ]
}

function appendSheet(wb, data, name) {
  const rows = data.length > 0 ? data : [{ Note: 'No data for this period' }]
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31))
}

// =============================================================================
// Public: export single restaurant
// =============================================================================
export async function exportRestaurant({ restaurantId, restaurantName, restaurantSlug, period, specificMonth, specificYear, format }) {
  const { from, to, label } = getDateRange(period, specificMonth, specificYear)
  const orders = await fetchRestaurantOrders(restaurantId, from, to)
  const wb = XLSX.utils.book_new()

  if (format === 'flat') {
    appendSheet(wb, toItemRows(orders), 'Items Sold')
  } else {
    appendSheet(wb, buildSummary(orders, label, { Restaurant: restaurantName }), 'Summary')
    appendSheet(wb, toOrderRows(orders), 'Orders')
    appendSheet(wb, toItemRows(orders), 'Items Sold')
    appendSheet(wb, toDailyBreakdown(orders), 'Daily Breakdown')
    appendSheet(wb, toItemRanking(orders), 'Item Ranking')
  }

  const filename = `${slugify(restaurantSlug || restaurantName)}-${slugify(label)}.xlsx`
  XLSX.writeFile(wb, filename)
}

// =============================================================================
// Public: export platform (all restaurants combined)
// =============================================================================
export async function exportPlatform({ restaurants, period, specificMonth, specificYear, format }) {
  const { from, to, label } = getDateRange(period, specificMonth, specificYear)

  // Fetch sequentially — simpler, and restaurant counts stay low
  const perR = []
  for (const r of restaurants) {
    const orders = await fetchRestaurantOrders(r.id, from, to)
    perR.push({ restaurant: r, orders })
  }

  const wb = XLSX.utils.book_new()

  if (format === 'flat') {
    const allItems = perR.flatMap(({ restaurant, orders }) => toItemRows(orders, restaurant.name))
    appendSheet(wb, allItems, 'All Items Sold')
  } else {
    const totalRevenue = perR.reduce((s, { orders }) =>
      s + orders.reduce((ss, o) => ss + (o.order_lines || []).reduce((sss, l) => sss + l.price * l.qty, 0), 0), 0)
    const totalOrders = perR.reduce((s, { orders }) => s + orders.length, 0)
    const totalItems = perR.reduce((s, { orders }) =>
      s + orders.reduce((ss, o) => ss + (o.order_lines || []).reduce((sss, l) => sss + l.qty, 0), 0), 0)
    const totalGuests = perR.reduce((s, { orders }) => s + orders.reduce((ss, o) => ss + (o.guest_count || 0), 0), 0)

    const summary = [
      { Metric: 'Period', Value: label },
      { Metric: 'Generated', Value: new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen' }) },
      { Metric: 'Restaurants Included', Value: restaurants.length },
      { Metric: '', Value: '' },
      { Metric: 'Total Orders', Value: totalOrders },
      { Metric: 'Total Items Sold', Value: totalItems },
      { Metric: 'Total Guests', Value: totalGuests },
      { Metric: 'Total Revenue (€)', Value: Number(totalRevenue.toFixed(2)) },
      { Metric: 'Avg Revenue per Restaurant (€)', Value: restaurants.length > 0 ? Number((totalRevenue / restaurants.length).toFixed(2)) : 0 },
      { Metric: 'Avg Order Value (€)', Value: totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0 },
    ]
    appendSheet(wb, summary, 'Platform Summary')

    const byRestaurant = perR.map(({ restaurant, orders }) => {
      const rev = orders.reduce((s, o) => s + (o.order_lines || []).reduce((ss, l) => ss + l.price * l.qty, 0), 0)
      const items = orders.reduce((s, o) => s + (o.order_lines || []).reduce((ss, l) => ss + l.qty, 0), 0)
      const guests = orders.reduce((s, o) => s + (o.guest_count || 0), 0)
      return {
        Restaurant: restaurant.name,
        Slug: restaurant.slug,
        Plan: restaurant.plan,
        City: restaurant.city || '',
        Country: restaurant.country || '',
        Orders: orders.length,
        Items: items,
        Guests: guests,
        'Revenue (€)': Number(rev.toFixed(2)),
        'Avg Order (€)': orders.length > 0 ? Number((rev / orders.length).toFixed(2)) : 0,
      }
    }).sort((a, b) => b['Revenue (€)'] - a['Revenue (€)'])
    appendSheet(wb, byRestaurant, 'By Restaurant')

    const allOrders = perR.flatMap(({ restaurant, orders }) => toOrderRows(orders, restaurant.name))
    appendSheet(wb, allOrders, 'All Orders')

    const allItems = perR.flatMap(({ restaurant, orders }) => toItemRows(orders, restaurant.name))
    appendSheet(wb, allItems, 'All Items Sold')

    const allOrdersFlat = perR.flatMap(({ orders }) => orders)
    appendSheet(wb, toDailyBreakdown(allOrdersFlat), 'Daily Breakdown')
  }

  const filename = `tableflow-platform-${slugify(label)}.xlsx`
  XLSX.writeFile(wb, filename)
}