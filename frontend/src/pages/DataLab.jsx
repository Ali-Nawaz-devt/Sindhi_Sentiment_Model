import React, { useEffect, useState } from 'react'
import { loadData, cleanData } from '../utils/api'
import MetricCard from '../components/MetricCard'
import LoadingSpinner from '../components/LoadingSpinner'
import PlotlyChart from '../components/PlotlyChart'

const SENT_COLORS = { Positive: '#4ADE80', Negative: '#F87171', Neutral: '#FBBF24' }

export default function DataLab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [activeTab, setTab]   = useState('overview')

  // Cleaning controls
  const [dropMissing,    setDropMissing]    = useState(true)
  const [normalize,      setNormalize]      = useState(false)
  const [removeOutliers, setRemoveOutliers] = useState(false)
  const [outlierThresh,  setOutlierThresh]  = useState(3.0)
  const [cleaning,       setCleaning]       = useState(false)
  const [cleanResult,    setCleanResult]    = useState(null)

  useEffect(() => {
    setLoading(true)
    loadData()
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e?.response?.data?.detail || e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleClean = async () => {
    setCleaning(true)
    try {
      const r = await cleanData({ drop_missing: dropMissing, normalize, remove_outliers: removeOutliers, outlier_threshold: outlierThresh })
      setCleanResult(r)
    } catch(e) {
      setError(e?.response?.data?.detail || e.message)
    } finally {
      setCleaning(false)
    }
  }

  if (loading) return <div className="flex items-center" style={{ justifyContent: 'center', minHeight: 400 }}><LoadingSpinner message="Loading dataset..." /></div>
  if (error)   return <div className="alert alert-over" style={{ marginTop: 20 }}>⚠️ {error}</div>
  if (!data)   return null

  const sentDist = data.sentiment_dist || {}
  const srcDist  = data.source_dist    || {}
  const textLen  = data.text_length_stats || {}
  const wordFreq = data.word_freq || {}
  const totalRows = data.rows || 0

  // Charts
  const pieData = [{
    type: 'pie',
    labels: Object.keys(sentDist),
    values: Object.values(sentDist),
    hole: 0.55,
    marker: { colors: Object.keys(sentDist).map(s => SENT_COLORS[s] || '#8B94A9') },
    textinfo: 'percent+label',
    textfont: { size: 12 },
    hovertemplate: '<b>%{label}</b><br>Count: %{value}<br>%{percent}<extra></extra>',
  }]

  const barSrc = [{
    type: 'bar', orientation: 'h',
    x: Object.values(srcDist),
    y: Object.keys(srcDist),
    marker: { color: ['#4FC3F7','#A78BFA','#FB923C','#4ADE80','#F87171'] },
    text: Object.values(srcDist).map(v => `${v} (${(v/totalRows*100).toFixed(1)}%)`),
    textposition: 'auto',
    hovertemplate: '<b>%{y}</b>: %{x}<extra></extra>',
  }]

  // Violin / box for text length
  const violinData = ['Positive','Negative','Neutral'].map(s => ({
    type: 'violin', y: (textLen[s] || []).slice(0, 200),
    name: s, box: { visible: true }, meanline: { visible: true },
    fillcolor: SENT_COLORS[s] + '30',
    line: { color: SENT_COLORS[s] },
    opacity: 0.85,
  }))

  const display = cleanResult || data
  const rows = display.rows_after ?? display.rows ?? totalRows

  return (
    <div className="fade-in">
      <div className="page-title">⚗️ Data Lab</div>
      <div className="page-sub">// sindhi_sentiment_cleaned.xlsx · {totalRows.toLocaleString()} records</div>

      {/* Tabs */}
      <div className="tabs mb-6">
        {['overview','preview','visualize','clean'].map(t => (
          <button key={t} className={`tab ${activeTab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (<>
        <div className="grid-4 mb-6">
          <MetricCard label="Total Samples" value={totalRows} color="var(--accent-blue)" icon="📊" />
          <MetricCard label="Positive" value={sentDist.Positive || 0} color="var(--pos-color)" icon="😊" />
          <MetricCard label="Negative" value={sentDist.Negative || 0} color="var(--neg-color)" icon="😔" />
          <MetricCard label="Neutral"  value={sentDist.Neutral  || 0} color="var(--neu-color)" icon="😐" />
        </div>

        <div className="grid-2 mb-6">
          <div className="card">
            <div className="card-header"><span className="card-title">Class Distribution</span></div>
            <PlotlyChart data={pieData} layout={{ height: 280, showlegend: false, margin: {l:30,r:30,t:20,b:20} }} />
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Source Breakdown</span></div>
            <PlotlyChart data={barSrc} layout={{ height: 280, margin: {l:90,r:20,t:20,b:30}, xaxis: { title: 'Count' } }} />
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header"><span className="card-title">Text Length Distribution (words)</span></div>
          <PlotlyChart data={violinData} layout={{ height: 280, violinmode: 'group', margin:{l:50,r:20,t:20,b:40} }} />
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Column Info</span></div>
          <table className="data-table">
            <thead><tr><th>Column</th><th>Type</th><th>Missing</th></tr></thead>
            <tbody>
              {Object.entries(data.dtypes || {}).map(([col, dtype]) => (
                <tr key={col}>
                  <td className="mono" style={{ color: 'var(--accent-blue)' }}>{col}</td>
                  <td><span className="badge badge-neu">{String(dtype)}</span></td>
                  <td className="mono">{data.missing_values?.[col] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {/* ── Preview ── */}
      {activeTab === 'preview' && (
        <div className="card fade-in">
          <div className="card-header"><span className="card-title">Dataset Preview</span><span style={{fontSize:12,color:'var(--text-muted)',fontFamily:'Space Mono,monospace'}}>first 10 rows</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {['#','Sindhi Text','English Translation','Sentiment','Source','Verified','Weight'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data.preview || []).map((row, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ color: 'var(--text-dim)' }}>{i}</td>
                    <td style={{ fontFamily: 'serif', direction: 'rtl', maxWidth: 200 }}>{row.sindhi_text || row['Sindhi Text']}</td>
                    <td>{row.english_text || row['English Translation']}</td>
                    <td>
                      <span className={`badge badge-${(row.sentiment||row.Sentiment||'').toLowerCase().slice(0,3)}`}>
                        {row.sentiment || row.Sentiment}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.source || row.Source}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.verified || row.Verified}</td>
                    <td className="mono" style={{ color: 'var(--accent-blue)' }}>{(row.sample_weight || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Visualize ── */}
      {activeTab === 'visualize' && (<>
        {/* Top words per sentiment */}
        {['Positive','Negative','Neutral'].map(sent => {
          const words = wordFreq[sent] || []
          if (!words.length) return null
          return (
            <div className="card mb-6 fade-in" key={sent}>
              <div className="card-header">
                <span className="card-title">Top Words — {sent}</span>
                <span style={{ color: SENT_COLORS[sent], fontSize: 18 }}>
                  {sent==='Positive'?'😊':sent==='Negative'?'😔':'😐'}
                </span>
              </div>
              <PlotlyChart
                data={[{
                  type: 'bar', orientation: 'h',
                  x: words.map(w => w.count),
                  y: words.map(w => w.word),
                  marker: { color: SENT_COLORS[sent], opacity: 0.8 },
                  hovertemplate: '<b>%{y}</b>: %{x}<extra></extra>',
                }]}
                layout={{ height: 320, margin:{l:100,r:30,t:20,b:40}, yaxis:{autorange:'reversed'} }}
              />
            </div>
          )
        })}
      </>)}

      {/* ── Clean ── */}
      {activeTab === 'clean' && (
        <div className="grid-2 fade-in" style={{ gap: 24 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Cleaning Controls</span></div>
            <div className="flex-col gap-4">
              <label className="checkbox-wrap">
                <input type="checkbox" checked={dropMissing} onChange={e=>setDropMissing(e.target.checked)} />
                Drop rows with missing Sindhi text
              </label>
              <label className="checkbox-wrap">
                <input type="checkbox" checked={normalize} onChange={e=>setNormalize(e.target.checked)} />
                Normalize sample weights (0–1 scale)
              </label>
              <label className="checkbox-wrap">
                <input type="checkbox" checked={removeOutliers} onChange={e=>setRemoveOutliers(e.target.checked)} />
                Remove text length outliers
              </label>
              {removeOutliers && (
                <div className="slider-wrap">
                  <div className="slider-label">
                    <span>Outlier Threshold (σ)</span>
                    <span className="slider-value">{outlierThresh.toFixed(1)}</span>
                  </div>
                  <input type="range" min={1} max={6} step={0.1} value={outlierThresh}
                    onChange={e=>setOutlierThresh(parseFloat(e.target.value))} />
                </div>
              )}
              <button className="btn btn-primary" onClick={handleClean} disabled={cleaning}>
                {cleaning ? '⏳ Cleaning...' : '✨ Apply Cleaning'}
              </button>
            </div>
          </div>

          {cleanResult && (
            <div className="card fade-in">
              <div className="card-header"><span className="card-title">Cleaning Results</span></div>
              <div className="flex-col gap-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rows Before</span>
                  <span className="mono" style={{ color: 'var(--text-primary)' }}>{cleanResult.rows_before?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Rows After</span>
                  <span className="mono" style={{ color: 'var(--pos-color)' }}>{cleanResult.rows_after?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Removed</span>
                  <span className="mono" style={{ color: 'var(--neg-color)' }}>{cleanResult.rows_removed}</span>
                </div>
                {Object.entries(cleanResult.sentiment_dist || {}).map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                    <span style={{ color: SENT_COLORS[k], fontSize: 13, fontWeight: 700 }}>{k}</span>
                    <span className="mono">{v}</span>
                  </div>
                ))}
                {cleanResult.preview?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="card-title mb-2">Sample cleaned text</div>
                    {cleanResult.preview.slice(0,3).map((row, i) => (
                      <div key={i} style={{ padding: '8px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                        <div style={{ color: 'var(--text-muted)' }}>Original: <span style={{ color: 'var(--text-primary)', direction: 'rtl', display: 'inline-block' }}>{row.sindhi_text}</span></div>
                        <div style={{ color: 'var(--accent-blue)' }}>Cleaned: <span style={{ color: 'var(--text-primary)', direction: 'rtl', display: 'inline-block' }}>{row.sindhi_clean}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
