// components/MenuImportModal.js
// Modal: upload PDF → parse via Claude → preview/edit → bulk import

import { useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const CATEGORIES = ['Starters', 'Salads', 'Mains', 'Sides', 'Desserts', 'Drinks']

const TEXTS = {
  da: {
    title: '📄 Importer menu fra PDF',
    step1Title: 'Vælg din menu-PDF',
    step1Desc: 'Vi læser PDF\'en og udtrækker alle retter automatisk. Du kan rette fejl bagefter.',
    selectFile: 'Vælg PDF',
    dragHere: 'eller træk PDF her',
    fileSize: 'Max 20 MB',
    parsing: 'Læser PDF... det tager 10-30 sekunder',
    parseError: 'Kunne ikke læse PDF',
    foundItems: 'Fandt {n} retter',
    selectAll: 'Vælg alle',
    selectNone: 'Fravælg alle',
    importing: 'Importerer...',
    cancel: 'Annuller',
    back: '← Vælg ny PDF',
    import: 'Importér {n} retter',
    nothingSelected: 'Ingen retter valgt',
    success: '✅ {n} retter importeret!',
    close: 'Luk',
    name: 'Navn',
    desc: 'Beskrivelse',
    price: 'Pris',
    category: 'Kategori',
    emoji: 'Emoji',
    onlyPdf: 'Kun PDF-filer er tilladt',
    tooLarge: 'PDF for stor (max 20 MB)',
  },
  en: {
    title: '📄 Import menu from PDF',
    step1Title: 'Select your menu PDF',
    step1Desc: 'We read the PDF and extract all items automatically. You can fix errors afterwards.',
    selectFile: 'Select PDF',
    dragHere: 'or drag PDF here',
    fileSize: 'Max 20 MB',
    parsing: 'Reading PDF... takes 10-30 seconds',
    parseError: 'Could not read PDF',
    foundItems: 'Found {n} items',
    selectAll: 'Select all',
    selectNone: 'Select none',
    importing: 'Importing...',
    cancel: 'Cancel',
    back: '← Choose new PDF',
    import: 'Import {n} items',
    nothingSelected: 'No items selected',
    success: '✅ {n} items imported!',
    close: 'Close',
    name: 'Name',
    desc: 'Description',
    price: 'Price',
    category: 'Category',
    emoji: 'Emoji',
    onlyPdf: 'Only PDF files allowed',
    tooLarge: 'PDF too large (max 20 MB)',
  },
  el: {
    title: '📄 Εισαγωγή μενού από PDF',
    step1Title: 'Επιλέξτε το PDF του μενού',
    step1Desc: 'Διαβάζουμε το PDF και εξάγουμε όλα τα πιάτα αυτόματα.',
    selectFile: 'Επιλογή PDF',
    dragHere: 'ή σύρετε εδώ',
    fileSize: 'Μέγ. 20 MB',
    parsing: 'Διάβασμα PDF... 10-30 δευτερόλεπτα',
    parseError: 'Δεν ήταν δυνατή η ανάγνωση',
    foundItems: 'Βρέθηκαν {n} πιάτα',
    selectAll: 'Επιλογή όλων',
    selectNone: 'Αποεπιλογή',
    importing: 'Εισαγωγή...',
    cancel: 'Ακύρωση',
    back: '← Νέο PDF',
    import: 'Εισαγωγή {n} πιάτων',
    nothingSelected: 'Κανένα επιλεγμένο',
    success: '✅ Έτοιμο!',
    close: 'Κλείσιμο',
    name: 'Όνομα',
    desc: 'Περιγραφή',
    price: 'Τιμή',
    category: 'Κατηγορία',
    emoji: 'Emoji',
    onlyPdf: 'Μόνο PDF',
    tooLarge: 'Πολύ μεγάλο',
  },
}

export default function MenuImportModal({ lang = 'en', onClose, onImported }) {
  const t = TEXTS[lang] || TEXTS.en
  const fileRef = useRef(null)

  const [step, setStep] = useState('select')  // 'select' | 'parsing' | 'preview' | 'importing' | 'done'
  const [error, setError] = useState('')
  const [items, setItems] = useState([])      // [{name, description, price, category, emoji, station, _selected}]
  const [importedCount, setImportedCount] = useState(0)

  const handleFile = async (file) => {
    setError('')
    if (!file) return
    if (file.type !== 'application/pdf') { setError(t.onlyPdf); return }
    if (file.size > 20 * 1024 * 1024) { setError(t.tooLarge); return }

    setStep('parsing')

    // Read file as base64
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result.split(',')[1])
      r.onerror = () => reject(new Error('Read failed'))
      r.readAsDataURL(file)
    })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/parse-menu-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ pdfBase64: base64 }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || t.parseError)
      if (!data.items?.length) throw new Error('No items found in PDF')

      setItems(data.items.map(i => ({ ...i, _selected: true })))
      setStep('preview')
    } catch (err) {
      setError(err.message)
      setStep('select')
    }
  }

  const onFileInputChange = (e) => handleFile(e.target.files?.[0])
  const onDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }
  const onDragOver = (e) => e.preventDefault()

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }
  const toggleItem = (idx) => updateItem(idx, '_selected', !items[idx]._selected)
  const selectAll = () => setItems(prev => prev.map(it => ({ ...it, _selected: true })))
  const selectNone = () => setItems(prev => prev.map(it => ({ ...it, _selected: false })))

  const selectedCount = items.filter(i => i._selected).length

  const doImport = async () => {
    setStep('importing'); setError('')
    const toImport = items.filter(i => i._selected).map(i => {
      const { _selected, ...rest } = i
      return rest
    })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/bulk-add-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ items: toImport }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Import failed')
      setImportedCount(data.inserted)
      setStep('done')
      if (onImported) onImported()
    } catch (err) {
      setError(err.message)
      setStep('preview')
    }
  }

  // Group preview items by category for display
  const grouped = {}
  items.forEach((item, idx) => {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push({ ...item, _idx: idx })
  })

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:200,padding:20,overflowY:'auto'}} onClick={step==='parsing'||step==='importing' ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:'white',borderRadius:16,maxWidth:800,width:'100%',marginTop:20,marginBottom:20}}>

        {/* Header */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid #e5e5e5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:18,fontWeight:700,color:'#1C1917'}}>{t.title}</div>
          {step!=='parsing' && step!=='importing' && (
            <button onClick={onClose} style={{background:'transparent',border:'none',fontSize:24,cursor:'pointer',color:'#78716C'}}>×</button>
          )}
        </div>

        <div style={{padding:24}}>

          {/* === STEP: SELECT === */}
          {step === 'select' && (
            <>
              <p style={{fontSize:14,color:'#78716C',marginBottom:20,lineHeight:1.5}}>{t.step1Desc}</p>

              <div onDrop={onDrop} onDragOver={onDragOver}
                style={{border:'2px dashed #C2692A',borderRadius:12,padding:40,textAlign:'center',background:'#FAFAF7',cursor:'pointer'}}
                onClick={() => fileRef.current.click()}>
                <div style={{fontSize:48,marginBottom:12}}>📄</div>
                <div style={{fontSize:16,fontWeight:600,color:'#1C1917',marginBottom:6}}>{t.step1Title}</div>
                <div style={{fontSize:13,color:'#78716C',marginBottom:16}}>{t.dragHere}</div>
                <button type="button" style={{padding:'10px 20px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'}}>
                  {t.selectFile}
                </button>
                <div style={{fontSize:11,color:'#aaa',marginTop:12}}>{t.fileSize}</div>
                <input ref={fileRef} type="file" accept="application/pdf" style={{display:'none'}} onChange={onFileInputChange} />
              </div>

              {error && <div style={{marginTop:16,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626'}}>⚠️ {error}</div>}
            </>
          )}

          {/* === STEP: PARSING === */}
          {step === 'parsing' && (
            <div style={{textAlign:'center',padding:40}}>
              <div style={{fontSize:48,marginBottom:16}}>🤖</div>
              <div style={{fontSize:16,fontWeight:600,color:'#1C1917',marginBottom:8}}>{t.parsing}</div>
              <div style={{width:'100%',height:6,background:'#f5f5f0',borderRadius:3,overflow:'hidden',marginTop:20}}>
                <div style={{height:'100%',background:'linear-gradient(90deg, #C2692A, #E8B17A)',animation:'pulse 1.5s ease-in-out infinite',width:'60%'}}/>
              </div>
              <style jsx>{`
                @keyframes pulse {
                  0%, 100% { opacity: 0.4; transform: translateX(-30%); }
                  50% { opacity: 1; transform: translateX(70%); }
                }
              `}</style>
            </div>
          )}

          {/* === STEP: PREVIEW === */}
          {step === 'preview' && (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
                <div style={{fontSize:15,fontWeight:600,color:'#1C1917'}}>
                  {t.foundItems.replace('{n}', items.length)}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={selectAll} style={{padding:'4px 10px',background:'transparent',border:'1px solid #ddd',borderRadius:6,fontSize:12,cursor:'pointer',color:'#78716C',fontFamily:'system-ui'}}>{t.selectAll}</button>
                  <button onClick={selectNone} style={{padding:'4px 10px',background:'transparent',border:'1px solid #ddd',borderRadius:6,fontSize:12,cursor:'pointer',color:'#78716C',fontFamily:'system-ui'}}>{t.selectNone}</button>
                </div>
              </div>

              {error && <div style={{marginBottom:16,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#dc2626'}}>⚠️ {error}</div>}

              {CATEGORIES.map(cat => {
                if (!grouped[cat]) return null
                return (
                  <div key={cat} style={{marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#78716C',marginBottom:8,paddingBottom:4,borderBottom:'1px solid #e5e5e5'}}>{cat}</div>
                    {grouped[cat].map(it => (
                      <div key={it._idx} style={{padding:10,background:it._selected?'#FAFAF7':'#f5f5f0',border:`1px solid ${it._selected?'#e5e5e5':'#ddd'}`,borderRadius:8,marginBottom:6,opacity:it._selected?1:0.5}}>
                        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                          <input type="checkbox" checked={it._selected} onChange={() => toggleItem(it._idx)} style={{cursor:'pointer'}} />
                          <input type="text" value={it.emoji} onChange={e => updateItem(it._idx, 'emoji', e.target.value)}
                            style={{width:40,padding:'6px',border:'1px solid #e5e5e5',borderRadius:6,fontSize:18,textAlign:'center',fontFamily:'system-ui'}} />
                          <input type="text" value={it.name} onChange={e => updateItem(it._idx, 'name', e.target.value)}
                            style={{flex:1,minWidth:140,padding:'6px 10px',border:'1px solid #e5e5e5',borderRadius:6,fontSize:13,fontFamily:'system-ui'}} />
                          <input type="number" value={it.price} step="0.01" onChange={e => updateItem(it._idx, 'price', parseFloat(e.target.value)||0)}
                            style={{width:80,padding:'6px 10px',border:'1px solid #e5e5e5',borderRadius:6,fontSize:13,fontFamily:'system-ui'}} />
                          <select value={it.category} onChange={e => updateItem(it._idx, 'category', e.target.value)}
                            style={{padding:'6px 10px',border:'1px solid #e5e5e5',borderRadius:6,fontSize:12,fontFamily:'system-ui'}}>
                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        {it.description && (
                          <input type="text" value={it.description} onChange={e => updateItem(it._idx, 'description', e.target.value)}
                            placeholder={t.desc}
                            style={{width:'100%',marginTop:6,padding:'6px 10px',border:'1px solid #e5e5e5',borderRadius:6,fontSize:12,fontFamily:'system-ui',color:'#78716C',boxSizing:'border-box'}} />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}

          {/* === STEP: IMPORTING === */}
          {step === 'importing' && (
            <div style={{textAlign:'center',padding:40}}>
              <div style={{fontSize:48,marginBottom:16}}>💾</div>
              <div style={{fontSize:16,fontWeight:600,color:'#1C1917'}}>{t.importing}</div>
            </div>
          )}

          {/* === STEP: DONE === */}
          {step === 'done' && (
            <div style={{textAlign:'center',padding:30}}>
              <div style={{fontSize:64,marginBottom:16}}>🎉</div>
              <div style={{fontSize:18,fontWeight:700,color:'#1C1917',marginBottom:8}}>
                {t.success.replace('{n}', importedCount)}
              </div>
              <button onClick={onClose}
                style={{marginTop:20,padding:'10px 24px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'system-ui'}}>
                {t.close}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div style={{padding:'16px 24px',borderTop:'1px solid #e5e5e5',display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
            <button onClick={() => { setItems([]); setStep('select') }}
              style={{padding:'10px 16px',background:'transparent',color:'#78716C',border:'1px solid #e5e5e5',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'system-ui'}}>
              {t.back}
            </button>
            <div style={{display:'flex',gap:8}}>
              <button onClick={onClose}
                style={{padding:'10px 16px',background:'transparent',color:'#78716C',border:'1px solid #e5e5e5',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'system-ui'}}>
                {t.cancel}
              </button>
              <button onClick={doImport} disabled={selectedCount === 0}
                style={{padding:'10px 20px',background:'#C2692A',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:selectedCount===0?'not-allowed':'pointer',fontFamily:'system-ui',opacity:selectedCount===0?0.5:1}}>
                {selectedCount === 0 ? t.nothingSelected : t.import.replace('{n}', selectedCount)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}