// components/BulkTranslateModal.js
// Modal to translate all menu items to multiple languages.
// Iterates client-side calling /api/translate per item, showing progress.

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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

const TEXTS = {
  da: {
    title: '🌐 Oversæt hele menuen',
    sourceLabel: 'Kilde-sprog',
    items: 'retter',
    translateTo: 'Oversæt til disse sprog:',
    selectAll: 'Vælg alle',
    selectNone: 'Fravælg alle',
    mode: 'Tilstand',
    modeMissing: 'Kun manglende oversættelser (anbefalet)',
    modeOverwrite: 'Overskriv ALLE oversættelser',
    estimate: 'Estimeret: ~{n} oversættelser',
    nothingToDo: 'Alle oversættelser findes allerede! Vælg "Overskriv" for at re-oversætte.',
    start: '🚀 Start oversættelse',
    cancel: 'Annuller',
    close: 'Luk',
    stop: 'Stop',
    translating: 'Oversætter...',
    progress: 'Fremgang',
    currently: 'Behandler',
    done: '✅ Færdig!',
    summary: 'Oversat {ok} ud af {total}.',
    errors: '{n} fejl',
    loading: 'Indlæser...',
    needItems: 'Tilføj retter til menuen først.',
  },
  en: {
    title: '🌐 Translate entire menu',
    sourceLabel: 'Source language',
    items: 'items',
    translateTo: 'Translate to these languages:',
    selectAll: 'Select all',
    selectNone: 'Select none',
    mode: 'Mode',
    modeMissing: 'Only missing translations (recommended)',
    modeOverwrite: 'Overwrite ALL translations',
    estimate: 'Estimate: ~{n} translations',
    nothingToDo: 'All translations already exist! Choose "Overwrite" to re-translate.',
    start: '🚀 Start translation',
    cancel: 'Cancel',
    close: 'Close',
    stop: 'Stop',
    translating: 'Translating...',
    progress: 'Progress',
    currently: 'Processing',
    done: '✅ Done!',
    summary: 'Translated {ok} of {total}.',
    errors: '{n} errors',
    loading: 'Loading...',
    needItems: 'Add menu items first.',
  },
  el: {
    title: '🌐 Μετάφραση όλου του μενού',
    sourceLabel: 'Γλώσσα πηγής',
    items: 'πιάτα',
    translateTo: 'Μετάφραση σε αυτές τις γλώσσες:',
    selectAll: 'Επιλογή όλων',
    selectNone: 'Αποεπιλογή',
    mode: 'Τρόπος',
    modeMissing: 'Μόνο που λείπουν (συνιστάται)',
    modeOverwrite: 'Αντικατάσταση ΟΛΩΝ',
    estimate: 'Εκτίμηση: ~{n} μεταφράσεις',
    nothingToDo: 'Όλες οι μεταφράσεις υπάρχουν ήδη!',
    start: '🚀 Έναρξη',
    cancel: 'Ακύρωση',
    close: 'Κλείσιμο',
    stop: 'Διακοπή',
    translating: 'Μετάφραση...',
    progress: 'Πρόοδος',
    currently: 'Επεξεργασία',
    done: '✅ Έτοιμο!',
    summary: 'Μεταφράστηκαν {ok} από {total}.',
    errors: '{n} σφάλματα',
    loading: 'Φόρτωση...',
    needItems: 'Προσθέστε πιάτα πρώτα.',
  },
}

export default function BulkTranslateModal({ items, sourceLang, lang = 'en', onClose, onCompleted }) {
  const t = TEXTS[lang] || TEXTS.en
  const sourceInfo = ALL_LANGS_INFO.find(l => l.code === sourceLang) || ALL_LANGS_INFO[0]

  // Default target langs = all except source
  const initialTargets = ALL_LANGS_INFO.filter(l => l.code !== sourceLang).map(l => l.code)

  const [selectedLangs, setSelectedLangs] = useState(initialTargets)
  const [mode, setMode] = useState('missing')  // 'missing' | 'overwrite'
  const [existingMap, setExistingMap] = useState({})  // { itemId: [langs] }
  const [loadingExisting, setLoadingExisting] = useState(true)

  const [running, setRunning] = useState(false)
  const [stopRequested, setStopRequested] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, errors: 0, current: '' })
  const [finished, setFinished] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Load existing translations on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/list-translations', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (data.success) setExistingMap(data.translations || {})
      } catch (err) {
        console.error('list-translations failed:', err)
      }
      setLoadingExisting(false)
    })()
  }, [])

  // Compute work to do
  const targetLangsAvailable = ALL_LANGS_INFO.filter(l => l.code !== sourceLang)
  const itemsToProcess = items || []

  // For each item, calculate which selected langs need translation
  const workPlan = []  // [{ item, missingLangs }]
  for (const item of itemsToProcess) {
    const existing = existingMap[item.id] || []
    let needLangs
    if (mode === 'overwrite') {
      needLangs = selectedLangs
    } else {
      needLangs = selectedLangs.filter(l => !existing.includes(l))
    }
    if (needLangs.length > 0) {
      workPlan.push({ item, missingLangs: needLangs })
    }
  }

  const totalTranslations = workPlan.reduce((s, w) => s + w.missingLangs.length, 0)

  const toggleLang = (code) => {
    setSelectedLangs(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])
  }

  const selectAll = () => setSelectedLangs(targetLangsAvailable.map(l => l.code))
  const selectNone = () => setSelectedLangs([])

  const start = async () => {
    setRunning(true); setStopRequested(false); setFinished(false); setErrorMsg('')
    setProgress({ done: 0, total: workPlan.length, ok: 0, errors: 0, current: '' })

    let ok = 0, errors = 0, doneCount = 0
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    for (const { item, missingLangs } of workPlan) {
      if (stopRequested) break

      setProgress(p => ({ ...p, current: item.name, done: doneCount }))

      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            itemId: item.id,
            name: item.name,
            description: item.description || '',
            targetLangs: missingLangs,
            save: true,
          }),
        })
        const data = await res.json()
        if (data.success) ok++
        else { errors++; console.warn('Item failed:', item.name, data.error) }
      } catch (err) {
        errors++
        console.error('Item error:', item.name, err)
      }

      doneCount++
      setProgress(p => ({ ...p, done: doneCount, ok, errors }))
    }

    setRunning(false)
    setFinished(true)
    if (onCompleted) onCompleted()
  }

  const requestStop = () => setStopRequested(true)

  // === RENDER ===
  const noItems = !itemsToProcess.length
  const nothingToDo = !running && !finished && !loadingExisting && totalTranslations === 0 && selectedLangs.length > 0
  const canStart = !running && !finished && selectedLangs.length > 0 && totalTranslations > 0

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:200,padding:20,overflowY:'auto'}} onClick={running ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:'white',borderRadius:16,maxWidth:600,width:'100%',marginTop:40,marginBottom:40}}>

        {/* Header */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid #e5e5e5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:18,fontWeight:700,color:'#1C1917'}}>{t.title}</div>
          {!running && (
            <button onClick={onClose} style={{background:'transparent',border:'none',fontSize:24,cursor:'pointer',color:'#78716C'}}>×</button>
          )}
        </div>

        <div style={{padding:24}}>
          {/* === RUNNING STATE === */}
          {running && (
            <div>
              <div style={{textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:14,color:'#78716C',marginBottom:8}}>{t.translating}</div>
                <div style={{fontSize:32,fontWeight:700,color:'#1C1917'}}>
                  {progress.done} / {progress.total}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{height:14,background:'#f5f5f0',borderRadius:7,overflow:'hidden',marginBottom:12}}>
                <div style={{
                  height:'100%',
                  width:`${progress.total ? (progress.done/progress.total)*100 : 0}%`,
                  background:'linear-gradient(90deg, #C2692A, #E8B17A)',
                  transition:'width 0.3s',
                }}/>
              </div>

              {progress.current && (
                <div style={{fontSize:13,color:'#78716C',textAlign:'center',marginBottom:16}}>
                  {t.currently}: <strong style={{color:'#1C1917'}}>{progress.current}</strong>
                </div>
              )}

              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#78716C',marginBottom:20}}>
                <span>✓ {progress.ok}</span>
                {progress.errors > 0 && <span style={{color:'#dc2626'}}>✗ {progress.errors}</span>}
              </div>

              <button onClick={requestStop} disabled={stopRequested}
                style={{width:'100%',padding:'10px',background:'transparent',border:'1px solid #dc2626',color:'#dc2626',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'system-ui',opacity:stopRequested?0.5:1}}>
                {stopRequested ? '...' : t.stop}
              </button>
            </div>
          )}

          {/* === FINISHED STATE === */}
          {finished && !running && (
            <div style={{textAlign:'center',padding:'10px 0'}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontSize:18,fontWeight:700,color:'#1C1917',marginBottom:8}}>{t.done}</div>
              <div style={{fontSize:14,color:'#78716C',marginBottom:8}}>
                {t.summary.replace('{ok}', progress.ok).replace('{total}', progress.total)}
              </div>
              {progress.errors > 0 && (
                <div style={{fontSize:13,color:'#dc2626',marginBottom:16}}>
                  ⚠️ {t.errors.replace('{n}', progress.errors)}
                </div>
              )}
              <button onClick={onClose}
                style={{padding:'10px 24px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',marginTop:16,fontFamily:'system-ui'}}>
                {t.close}
              </button>
            </div>
          )}

          {/* === SETUP STATE === */}
          {!running && !finished && (
            <>
              {/* Source info */}
              <div style={{padding:14,background:'#F4E3D7',border:'1px solid #C2692A33',borderRadius:10,marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:'#92400E',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>
                  {t.sourceLabel}
                </div>
                <div style={{fontSize:15,fontWeight:600,color:'#1C1917'}}>
                  {sourceInfo.flag} {sourceInfo.name} · {itemsToProcess.length} {t.items}
                </div>
              </div>

              {noItems ? (
                <div style={{textAlign:'center',padding:24,color:'#78716C'}}>{t.needItems}</div>
              ) : (
                <>
                  {/* Language picker */}
                  <div style={{marginBottom:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <label style={{fontSize:13,fontWeight:600,color:'#1C1917'}}>{t.translateTo}</label>
                      <div style={{display:'flex',gap:6}}>
                        <button type="button" onClick={selectAll} style={{padding:'2px 8px',background:'transparent',border:'1px solid #ddd',borderRadius:6,fontSize:11,cursor:'pointer',color:'#78716C',fontFamily:'system-ui'}}>{t.selectAll}</button>
                        <button type="button" onClick={selectNone} style={{padding:'2px 8px',background:'transparent',border:'1px solid #ddd',borderRadius:6,fontSize:11,cursor:'pointer',color:'#78716C',fontFamily:'system-ui'}}>{t.selectNone}</button>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:6}}>
                      {targetLangsAvailable.map(l => (
                        <label key={l.code} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:selectedLangs.includes(l.code)?'#F4E3D7':'#FAFAF7',border:selectedLangs.includes(l.code)?'1px solid #C2692A':'1px solid #e5e5e5',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'system-ui'}}>
                          <input type="checkbox" checked={selectedLangs.includes(l.code)} onChange={() => toggleLang(l.code)} style={{cursor:'pointer'}} />
                          <span>{l.flag} {l.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Mode picker */}
                  <div style={{marginBottom:16}}>
                    <label style={{fontSize:13,fontWeight:600,color:'#1C1917',display:'block',marginBottom:8}}>{t.mode}</label>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      <label style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:mode==='missing'?'#F0FDF4':'#FAFAF7',border:mode==='missing'?'1px solid #2D7A4F':'1px solid #e5e5e5',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'system-ui'}}>
                        <input type="radio" checked={mode==='missing'} onChange={() => setMode('missing')} />
                        <span>{t.modeMissing}</span>
                      </label>
                      <label style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:mode==='overwrite'?'#FEF3C7':'#FAFAF7',border:mode==='overwrite'?'1px solid #92400E':'1px solid #e5e5e5',borderRadius:8,cursor:'pointer',fontSize:13,fontFamily:'system-ui'}}>
                        <input type="radio" checked={mode==='overwrite'} onChange={() => setMode('overwrite')} />
                        <span>{t.modeOverwrite}</span>
                      </label>
                    </div>
                  </div>

                  {/* Estimate / nothing-to-do */}
                  {loadingExisting ? (
                    <div style={{textAlign:'center',padding:12,color:'#aaa',fontSize:13}}>{t.loading}</div>
                  ) : nothingToDo ? (
                    <div style={{padding:12,background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,fontSize:13,color:'#15803D',marginBottom:16}}>
                      ✓ {t.nothingToDo}
                    </div>
                  ) : (
                    <div style={{padding:12,background:'#FAFAF7',border:'1px solid #e5e5e5',borderRadius:8,fontSize:13,color:'#78716C',marginBottom:16,textAlign:'center'}}>
                      {t.estimate.replace('{n}', totalTranslations)}
                    </div>
                  )}

                  {errorMsg && (
                    <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626',marginBottom:12}}>⚠️ {errorMsg}</div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!running && !finished && !noItems && (
          <div style={{padding:'16px 24px',borderTop:'1px solid #e5e5e5',display:'flex',justifyContent:'flex-end',gap:8}}>
            <button onClick={onClose} style={{padding:'10px 16px',background:'transparent',color:'#78716C',border:'1px solid #e5e5e5',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'system-ui'}}>{t.cancel}</button>
            <button onClick={start} disabled={!canStart}
              style={{padding:'10px 24px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:canStart?'pointer':'not-allowed',fontFamily:'system-ui',opacity:canStart?1:0.5}}>
              {t.start}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}