import { useState, useMemo } from 'react'
import { getMonthOptions, getYearOptions } from '../lib/xlsx-export'

export default function ExportModal({ open, onClose, onExport, title = 'Export to Excel', subtitle }) {
  const [period, setPeriod] = useState('month')
  const [specificMonth, setSpecificMonth] = useState('')
  const [specificYear, setSpecificYear] = useState('')
  const [format, setFormat] = useState('multi')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const monthOptions = useMemo(() => getMonthOptions(), [])
  const yearOptions = useMemo(() => getYearOptions(), [])

  if (!open) return null

  const handleExport = async () => {
    setExporting(true); setError('')
    try {
      await onExport({ period, specificMonth, specificYear, format })
      onClose()
      setPeriod('month'); setSpecificMonth(''); setSpecificYear(''); setFormat('multi')
    } catch (e) {
      setError(e.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const presets = [
    { id: 'week',    label: 'Week' },
    { id: 'month',   label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'year',    label: 'Year' },
    { id: 'allTime', label: 'All time' },
  ]

  return (
    <div style={ovr} onClick={() => !exporting && onClose()}>
      <div onClick={e => e.stopPropagation()} style={modal}>
        <div style={{padding:'20px 24px',borderBottom:'1px solid #262626',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:'white'}}>{title}</div>
            {subtitle && <div style={{fontSize:12,color:'#888',marginTop:4}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} disabled={exporting} style={{background:'transparent',border:'none',color:'#888',fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        <div style={{padding:24}}>
          {/* Period */}
          <div style={{marginBottom:20}}>
            <div style={lbl}>Period</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {presets.map(p => {
                const isActive = period === p.id && !specificMonth && !specificYear
                return (
                  <button key={p.id}
                    onClick={() => { setPeriod(p.id); setSpecificMonth(''); setSpecificYear('') }}
                    style={btn(isActive)}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Specific month */}
          <div style={{marginBottom:16}}>
            <div style={lbl}>Specific month</div>
            <select
              value={specificMonth}
              onChange={e => { setSpecificMonth(e.target.value); if (e.target.value) setSpecificYear('') }}
              style={sel(!!specificMonth)}
            >
              <option value="" style={{background:'#141414'}}>— Use preset above —</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value} style={{background:'#141414'}}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Specific year */}
          <div style={{marginBottom:20}}>
            <div style={lbl}>Specific year</div>
            <select
              value={specificYear}
              onChange={e => { setSpecificYear(e.target.value); if (e.target.value) setSpecificMonth('') }}
              style={sel(!!specificYear)}
            >
              <option value="" style={{background:'#141414'}}>— Use preset above —</option>
              {yearOptions.map(y => (
                <option key={y.value} value={y.value} style={{background:'#141414'}}>{y.label}</option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div style={{marginBottom:20}}>
            <div style={lbl}>Format</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <button onClick={() => setFormat('multi')} style={fmtBtn(format === 'multi')}>
                <div style={{fontWeight:600,fontSize:13}}>📑 Multi-sheet</div>
                <div style={{fontSize:11,color:'#888',marginTop:4,lineHeight:1.4}}>
                  Summary, Orders, Items, Daily & Rankings — separate tabs
                </div>
              </button>
              <button onClick={() => setFormat('flat')} style={fmtBtn(format === 'flat')}>
                <div style={{fontWeight:600,fontSize:13}}>📄 Flat</div>
                <div style={{fontSize:11,color:'#888',marginTop:4,lineHeight:1.4}}>
                  One row per item sold — everything in one sheet
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div style={{background:'#2a1515',border:'1px solid #7f1d1d',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#f87171',marginBottom:16}}>
              {error}
            </div>
          )}

          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={onClose} disabled={exporting} style={{padding:'10px 18px',background:'transparent',border:'1px solid #262626',color:'#888',borderRadius:8,fontSize:13,cursor:exporting?'not-allowed':'pointer'}}>
              Cancel
            </button>
            <button onClick={handleExport} disabled={exporting}
              style={{padding:'10px 22px',background:exporting?'#333':'linear-gradient(135deg, #6366f1, #8b5cf6)',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:exporting?'wait':'pointer',fontFamily:'system-ui'}}>
              {exporting ? 'Exporting…' : '📥 Download Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ovr = {position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}
const modal = {background:'#141414',border:'1px solid #262626',borderRadius:14,width:'100%',maxWidth:520,maxHeight:'90vh',overflow:'auto'}
const lbl = {fontSize:11,color:'#888',textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600,marginBottom:8}

function btn(active) {
  return {
    padding:'7px 14px',
    borderRadius:8,
    fontSize:12,
    fontWeight:600,
    cursor:'pointer',
    background: active ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
    color: active ? 'white' : '#aaa',
    border: active ? 'none' : '1px solid #262626',
    fontFamily:'system-ui',
  }
}

function sel(active) {
  return {
    width:'100%',
    padding:'8px 12px',
    borderRadius:8,
    fontSize:13,
    fontWeight:500,
    cursor:'pointer',
    background: active ? '#1a1a2e' : '#0a0a0a',
    color: active ? 'white' : '#aaa',
    border: active ? '1px solid #6366f1' : '1px solid #262626',
    fontFamily:'system-ui',
    outline:'none',
  }
}

function fmtBtn(active) {
  return {
    padding:'14px',
    textAlign:'left',
    borderRadius:10,
    cursor:'pointer',
    background: active ? '#1a1a2e' : '#0a0a0a',
    color:'white',
    border: active ? '1.5px solid #6366f1' : '1px solid #262626',
    fontFamily:'system-ui',
  }
}