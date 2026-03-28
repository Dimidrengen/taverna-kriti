import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const BASE_URL = 'https://taverna-kriti.vercel.app'
const RESTAURANT = 'taverna-kriti'

export default function QRPage() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tables')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setTables(data)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div style={styles.center}>
      <p style={{ color: '#666', fontSize: 16 }}>Henter borde…</p>
    </div>
  )

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>QR Koder — Taverna Kriti</h1>
        <p style={styles.sub}>Print denne side og klip QR koderne ud til hvert bord</p>
        <button onClick={() => window.print()} style={styles.printBtn}>🖨 Print alle</button>
      </div>

      <div style={styles.grid}>
        {tables.map(table => {
          const url = `${BASE_URL}/menu.html?restaurant=${RESTAURANT}&table=${table.token}`
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
          return (
            <div key={table.id} style={styles.card}>
              <img src={qrUrl} alt={`QR ${table.name}`} style={styles.qr} />
              <div style={styles.tableName}>{table.name}</div>
              <div style={styles.tableUrl}>{table.token}</div>
            </div>
          )
        })}
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-card { break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

const styles = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 24px',
    fontFamily: 'system-ui, sans-serif',
    background: '#f9f9f9',
    minHeight: '100vh',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a1a',
    margin: '0 0 8px',
  },
  sub: {
    fontSize: 15,
    color: '#666',
    margin: '0 0 20px',
  },
  printBtn: {
    padding: '10px 24px',
    background: '#C2692A',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 24,
  },
  card: {
    background: 'white',
    borderRadius: 14,
    border: '1px solid #e5e5e5',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  qr: {
    width: 180,
    height: 180,
    borderRadius: 8,
  },
  tableName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  tableUrl: {
    fontSize: 12,
    color: '#999',
  },
}