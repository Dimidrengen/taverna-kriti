import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Supabase fires PASSWORD_RECOVERY event when user lands here from email link
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) {
        setValidSession(true)
      }
      setReady(true)
    })
    // Fallback: check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true)
      setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Adgangskoden skal være mindst 8 tegn'); return }
    if (password !== confirm) { setError('Adgangskoderne matcher ikke'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { setError(error.message); return }
    setSuccess(true)
    // Sign out so they have to log in fresh with new password
    await supabase.auth.signOut()
    setTimeout(() => router.push('/admin'), 2500)
  }

  if (!ready) return <div style={s.center}><p style={{color:'#aaa'}}>...</p></div>

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:12}}>🔑</div>
          <div style={{fontSize:22,fontWeight:700,color:'#1C1917'}}>Reset adgangskode</div>
          <div style={{fontSize:14,color:'#78716C',marginTop:4}}>TableFlow</div>
        </div>

        {!validSession && (
          <div style={s.errorBox}>
            <div style={{fontWeight:600,marginBottom:6}}>Linket er udløbet eller ugyldigt</div>
            <div style={{fontSize:13,color:'#78716C'}}>
              Reset-links er kun gyldige i 60 minutter og kan kun bruges én gang. Gå tilbage til login og bed om et nyt link.
            </div>
            <button onClick={() => router.push('/admin')} style={{...s.btn, marginTop:14}}>
              Tilbage til login
            </button>
          </div>
        )}

        {validSession && success && (
          <div style={s.successBox}>
            <div style={{fontSize:24,marginBottom:8}}>✓</div>
            <div style={{fontWeight:600,marginBottom:6}}>Adgangskoden er opdateret!</div>
            <div style={{fontSize:13,color:'#78716C'}}>Du sendes til login om et øjeblik...</div>
          </div>
        )}

        {validSession && !success && (
          <form onSubmit={submit}>
            <div style={{marginBottom:16}}>
              <label style={s.label}>Ny adgangskode</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 tegn"
                required
                minLength={8}
                style={s.input}
                autoFocus
              />
            </div>
            <div style={{marginBottom:24}}>
              <label style={s.label}>Bekræft adgangskode</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Skriv samme adgangskode igen"
                required
                minLength={8}
                style={s.input}
              />
            </div>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="submit" disabled={loading} style={s.primaryBtn}>
              {loading ? 'Opdaterer...' : 'Opdater adgangskode'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const s = {
  page: {minHeight:'100vh',background:'#F5F5F0',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',padding:20},
  card: {background:'white',borderRadius:16,border:'1px solid #e5e5e5',padding:40,width:'100%',maxWidth:420},
  label: {fontSize:13,color:'#78716C',display:'block',marginBottom:6},
  input: {width:'100%',padding:'10px 14px',border:'1px solid #e5e5e5',borderRadius:10,fontSize:15,fontFamily:'system-ui',outline:'none',boxSizing:'border-box'},
  btn: {width:'100%',padding:'10px',background:'transparent',color:'#78716C',border:'1px solid #e5e5e5',borderRadius:10,fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'system-ui'},
  primaryBtn: {width:'100%',padding:'12px',background:'#C2692A',color:'white',border:'none',borderRadius:10,fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'},
  errorBox: {background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'12px 14px',fontSize:13,color:'#dc2626',marginBottom:16,textAlign:'center'},
  successBox: {background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'20px',fontSize:14,color:'#15803D',textAlign:'center'},
  center: {minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F5F5F0'},
}