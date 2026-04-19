import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function extractSlugFromEmail(email) {
  const match = email.match(/^(admin|kitchen|bar)@(.+)\.com$/i)
  return match ? match[2] : null
}

export default function QrPrintPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState(null)
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [layout, setLayout] = useState('4') // '1', '2', '4' per page
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.email?.startsWith('admin@')) {
        router.push('/admin'); return
      }
      const slug = extractSlugFromEmail(session.user.email)
      if (!slug) { router.push('/admin'); return }
      const { data: rest } = await supabase.from('restaurants').select('*').eq('slug', slug).single()
      if (!rest) { router.push('/admin'); return }
      setRestaurant(rest)
      const { data: restaurantTables } = await supabase.from('tables')
        .select('*').eq('restaurant_id', rest.id).eq('active', true).order('position').order('name')
      setTables(restaurantTables || [])
      setLoading(false)
    })
  }, [])

  const print = () => window.print()

  if (loading) return <div style={{padding:40,textAlign:'center',fontFamily:'system-ui'}}>Loading...</div>
  if (!restaurant) return null

  const cardsPerPage = parseInt(layout)
  const gridCols = cardsPerPage === 1 ? 1 : 2
  const cardHeight = cardsPerPage === 1 ? '90vh' : cardsPerPage === 2 ? '45vh' : '45vh'

  return (
    <>
      <style jsx global>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .qr-page { page-break-after: always; }
          .qr-page:last-child { page-break-after: auto; }
          body { background: white !important; }
        }
        body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f0; }
      `}</style>

      {/* Controls bar - hidden when printing */}
      <div className="no-print" style={{position:'sticky',top:0,background:'white',borderBottom:'1px solid #e5e5e5',padding:'16px 24px',display:'flex',alignItems:'center',gap:16,zIndex:10,flexWrap:'wrap'}}>
        <button onClick={() => router.push('/admin')} style={{padding:'8px 14px',background:'transparent',border:'1px solid #e5e5e5',borderRadius:8,cursor:'pointer',fontSize:13}}>← Back</button>
        <div style={{flex:1,fontSize:18,fontWeight:700}}>🖨 QR Codes — {restaurant.name}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:13,color:'#78716C'}}>Per page:</span>
          {['1','2','4'].map(l => (
            <button key={l} onClick={() => setLayout(l)} style={{padding:'6px 14px',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',background:layout===l?'#C2692A':'transparent',color:layout===l?'white':'#888',border:layout===l?'none':'1px solid #e5e5e5'}}>{l}</button>
          ))}
        </div>
        <button onClick={print} style={{padding:'10px 20px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}}>
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* Print content */}
      <div style={{padding:'20px'}}>
        {(() => {
          const pages = []
          for (let i = 0; i < tables.length; i += cardsPerPage) {
            pages.push(tables.slice(i, i + cardsPerPage))
          }
          return pages.map((pageTables, pi) => (
            <div key={pi} className="qr-page" style={{
              display:'grid',
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gap: 16,
              marginBottom: 40,
              minHeight: cardsPerPage === 1 ? '90vh' : undefined,
            }}>
              {pageTables.map(table => {
                const menuUrl = `${baseUrl}/menu.html?restaurant=${restaurant.slug}&table=${table.token}`
                const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(menuUrl)}&margin=20`
                return (
                  <div key={table.id} style={{
                    background: 'white',
                    border: '2px solid #1C1917',
                    borderRadius: 12,
                    padding: cardsPerPage === 1 ? 40 : 24,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    height: cardHeight,
                    pageBreakInside: 'avoid',
                  }}>
                    <div style={{fontSize: cardsPerPage === 1 ? 16 : 12, color:'#78716C', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom: 8, fontWeight:600}}>
                      {restaurant.name}
                    </div>
                    <div style={{fontSize: cardsPerPage === 1 ? 48 : 28, fontWeight: 800, color:'#1C1917', marginBottom: 16, letterSpacing:'-0.02em'}}>
                      {table.name}
                    </div>
                    <img src={qrSrc} alt={`QR for ${table.name}`}
                      style={{width: cardsPerPage === 1 ? 400 : 200, height: cardsPerPage === 1 ? 400 : 200, border:'1px solid #f5f5f0'}} />
                    <div style={{fontSize: cardsPerPage === 1 ? 18 : 13, color:'#1C1917', marginTop: 16, fontWeight:600}}>
                      📱 Scan to order
                    </div>
                    <div style={{fontSize: cardsPerPage === 1 ? 13 : 9, color:'#aaa', marginTop: 8, fontFamily:'monospace', wordBreak:'break-all', maxWidth:'90%'}}>
                      {table.token}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        })()}
      </div>
    </>
  )
}