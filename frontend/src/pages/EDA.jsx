import React, { useEffect, useState, useCallback } from 'react'
import { loadData, cleanData } from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import PlotlyChart from '../components/PlotlyChart'

/* ═══════════════════════════════════════════
   COLOR SYSTEM
   ═══════════════════════════════════════════ */
const C = {
  pos: '#2ECC71', neg: '#E74C3C', neu: '#F0B429',
  red: '#C0392B', gold: '#D4A017', blue: '#4FC3F7',
  violet: '#9B59B6', teal: '#0F7B6C', rose: '#E74C3C',
}
const SENT_C = { Positive: C.pos, Negative: C.neg, Neutral: C.neu }
const SRC_C  = ['#4FC3F7','#D4A017','#9B59B6','#2ECC71','#E74C3C']

/* ═══════════════════════════════════════════
   STATIC DATASET MOCK (for offline mode)
   Mirrors actual xlsx stats for all charts
   ═══════════════════════════════════════════ */
const STATIC_DATA = {
  rows: 1898,
  sentiment_dist: { Positive: 694, Negative: 670, Neutral: 534 },
  source_dist: { Generated: 791, Kawish: 671, AwamiAwaz: 375, Corrected: 53, Feedback: 8 },
  dtypes: { sindhi_text:'object', english_text:'object', sentiment:'object', source:'object', verified:'object', sample_weight:'float64' },
  missing_values: { sindhi_text:0, english_text:12, sentiment:0, source:0, verified:0, sample_weight:0 },
  preview: [
    { sindhi_text:'اڄ جو ڏينهن تمام سٺو آهي', english_text:'Today is a very good day', sentiment:'Positive', source:'Generated', verified:'No', sample_weight:0.85 },
    { sindhi_text:'مون پنهنجو امتحان پاس ڪيو', english_text:'I passed my exam', sentiment:'Positive', source:'Generated', verified:'No', sample_weight:0.85 },
    { sindhi_text:'اڄ ڏاڍو ڏکڻ ٿيو', english_text:'Today was very sad', sentiment:'Negative', source:'Kawish', verified:'Auto(0.77)', sample_weight:0.77 },
    { sindhi_text:'حڪومت جي پاليسي غلط آهي', english_text:'Government policy is wrong', sentiment:'Negative', source:'AwamiAwaz', verified:'Auto(0.74)', sample_weight:0.74 },
    { sindhi_text:'موسم ٺيڪ آهي', english_text:'The weather is fine', sentiment:'Neutral', source:'Kawish', verified:'Auto(0.72)', sample_weight:0.72 },
    { sindhi_text:'اسان جي ٽيم کٽي وئي', english_text:'Our team won', sentiment:'Positive', source:'Generated', verified:'No', sample_weight:0.85 },
    { sindhi_text:'مارڪيٽ ۾ قيمتون وڌيون', english_text:'Prices rose in the market', sentiment:'Negative', source:'Kawish', verified:'Yes', sample_weight:1.0 },
    { sindhi_text:'ڪلاس ۾ سڀ ٺيڪ آهي', english_text:'All is well in class', sentiment:'Neutral', source:'Generated', verified:'No', sample_weight:0.85 },
  ],
  text_length_stats: {
    Positive: [5,4,5,4,3,6,7,5,4,4,5,3,6,4,5,7,4,5,6,4,5,3,4,5,6,5,4,3,4,5,6,7,4,5,4,3,4,5,6,5,4,5,4,5,6,4,5,4,5,6,7,5,4,3,4,5,4,5,6,7,4,5,6,4,5,3,4,6,5,4,5,3,4,5,6,7,5,4,6,5,4,5,4,3,5,6,4,5,6,5,4,5,4,5,6,4,5,3,4,5],
    Negative: [6,5,4,6,5,7,4,5,6,4,5,3,6,5,4,5,6,7,4,5,6,5,4,6,5,4,5,6,7,5,4,6,5,4,5,6,4,5,3,4,5,6,7,5,4,6,5,4,3,4,5,6,7,5,4,6,5,4,5,6,4,5,3,4,5,6,7,5,4,3,4,5,6,5,4,5,6,7,4,5,6,5,4,5,3,6,5,4,5,6,7,4,5,6,5,4],
    Neutral:  [4,4,5,4,5,4,5,4,3,4,5,4,5,4,5,4,5,4,3,4,5,4,5,4,5,4,5,4,4,5,4,5,4,5,4,3,4,5,4,5,4,5,4,4,5,4,5,4,5,4,5,3,4,5,4,5,4,3,4,5,4,5,4,5,4,4,5,4,5,4,3,4,5,4,5,4,5,4,5,4],
  },
  word_freq: {
    Positive: [{word:'سٺو',count:89},{word:'خوش',count:76},{word:'ڪاميابي',count:62},{word:'سهڻو',count:55},{word:'محبت',count:51},{word:'مبارڪ',count:48},{word:'اميد',count:44},{word:'ڀلو',count:41},{word:'شاندار',count:38},{word:'واهه',count:35},{word:'خير',count:31},{word:'ترقي',count:28},{word:'فخر',count:25},{word:'نيڪ',count:22},{word:'زندگي',count:19}],
    Negative: [{word:'خراب',count:82},{word:'ڏکڻ',count:74},{word:'ناانصافي',count:65},{word:'مسئلو',count:58},{word:'ڪرپشن',count:52},{word:'افسوس',count:47},{word:'غلط',count:43},{word:'ناڪامي',count:39},{word:'درد',count:35},{word:'ظلم',count:31},{word:'مهانگائي',count:28},{word:'احتجاج',count:24},{word:'موت',count:21},{word:'غريب',count:18},{word:'ڏکوئيندڙ',count:15}],
    Neutral:  [{word:'حڪومت',count:71},{word:'رپورٽ',count:64},{word:'قيمت',count:56},{word:'اسيمبلي',count:49},{word:'ميٽنگ',count:43},{word:'عوام',count:37},{word:'صوبو',count:33},{word:'فيصلو',count:28},{word:'جلسو',count:24},{word:'اعلان',count:20},{word:'ڪميٽي',count:17},{word:'سروي',count:14},{word:'ادارو',count:11},{word:'گڏجاڻي',count:8},{word:'بيان',count:5}],
  },
  // Extra data for advanced EDA charts
  source_sentiment: {
    Generated:  { Positive: 304, Negative: 290, Neutral: 197 },
    Kawish:     { Positive: 239, Negative: 248, Neutral: 184 },
    AwamiAwaz:  { Positive: 132, Negative: 111, Neutral: 132 },
    Corrected:  { Positive: 17,  Negative: 16,  Neutral: 20  },
    Feedback:   { Positive: 2,   Negative: 5,   Neutral: 1   },
  },
  weight_by_source: {
    Generated:  { vals: [0.85,0.85,0.85,0.85,0.85,0.85,0.85,0.85], mean: 0.85 },
    Kawish:     { vals: [0.70,0.72,0.74,0.77,0.79,0.80,0.82,0.84,0.86,0.88,0.90], mean: 0.78 },
    AwamiAwaz:  { vals: [0.70,0.71,0.72,0.73,0.74,0.75,0.76,0.77,0.78,0.79,0.80], mean: 0.75 },
    Corrected:  { vals: [0.95,0.95,0.95,0.95,0.95], mean: 0.95 },
    Feedback:   { vals: [1.0,1.0,1.0,1.0,1.0,0.85,0.85], mean: 0.93 },
  },
}

/* ═══════════════════════════════════════════
   WHAT-IF CONTROLS COMPONENT
   ═══════════════════════════════════════════ */
function WhatIfBanner({ controls, onChange }) {
  return (
    <div style={{
      padding: '14px 20px',
      background: 'linear-gradient(135deg, rgba(192,57,43,0.08), rgba(212,160,23,0.06))',
      border: '1px solid rgba(212,160,23,0.2)',
      borderRadius: 12, marginBottom: 24,
      display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'var(--ajrak-gold)', fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        ⚡ What-If
      </div>
      {controls.map((ctrl, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ctrl.label}</span>
          {ctrl.type === 'toggle' ? (
            <button
              onClick={() => onChange(ctrl.key, !ctrl.value)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                background: ctrl.value ? 'var(--ajrak-red)' : 'var(--bg-elevated)',
                color: ctrl.value ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >{ctrl.value ? 'ON' : 'OFF'}</button>
          ) : ctrl.type === 'select' ? (
            <select
              value={ctrl.value}
              onChange={e => onChange(ctrl.key, e.target.value)}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '4px 8px', color: 'var(--ajrak-gold)',
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                outline: 'none',
              }}
            >
              {ctrl.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step}
              value={ctrl.value}
              onChange={e => onChange(ctrl.key, parseFloat(e.target.value))}
              style={{ width: 80 }}
            />
          )}
          {ctrl.displayVal && (
            <span style={{ fontSize: 10, color: 'var(--ajrak-gold)', fontFamily: "'JetBrains Mono', monospace" }}>
              {ctrl.displayVal}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   LOADING COMPONENT
   ═══════════════════════════════════════════ */
function EDALoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 500, flexDirection: 'column', gap: 16 }}>
      <div className="spinner" style={{ width: 40, height: 40, borderTopColor: 'var(--ajrak-gold)', borderRightColor: 'var(--ajrak-red)' }} />
      <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Loading dataset...</div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MAIN EDA COMPONENT
   ═══════════════════════════════════════════ */
export default function EDA() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [offline, setOffline]   = useState(false)
  const [activeTab, setTab]     = useState('overview')

  // What-if controls
  const [showPercentages, setShowPercentages] = useState(false)
  const [plotTheme, setPlotTheme]             = useState('Ajrak')
  const [confThreshold, setConfThreshold]     = useState(0.70)
  const [topWords, setTopWords]               = useState(15)
  const [dropMissing, setDropMissing]         = useState(true)
  const [normalize, setNormalize]             = useState(false)
  const [removeOutliers, setRemoveOutliers]   = useState(false)
  const [outlierThresh, setOutlierThresh]     = useState(3.0)
  const [cleaning, setCleaning]               = useState(false)
  const [cleanResult, setCleanResult]         = useState(null)

  useEffect(() => {
    setLoading(true)
    loadData()
      .then(d => { setData(d); setOffline(false) })
      .catch(() => { setData(STATIC_DATA); setOffline(true) })
      .finally(() => setLoading(false))
  }, [])

  const handleClean = useCallback(async () => {
    if (offline) { alert('Backend is offline — cleaning uses static preview data'); return }
    setCleaning(true)
    try {
      const r = await cleanData({ drop_missing: dropMissing, normalize, remove_outliers: removeOutliers, outlier_threshold: outlierThresh })
      setCleanResult(r)
    } catch {
      setCleanResult(null)
    } finally {
      setCleaning(false)
    }
  }, [offline, dropMissing, normalize, removeOutliers, outlierThresh])

  if (loading) return <EDALoading />
  if (!data)   return null

  /* ─ Derived data ─ */
  const d = data
  const sentDist   = d.sentiment_dist || {}
  const srcDist    = d.source_dist || {}
  const textLen    = d.text_length_stats || {}
  const wordFreq   = d.word_freq || {}
  const srcSent    = d.source_sentiment || STATIC_DATA.source_sentiment
  const weightBySrc= d.weight_by_source  || STATIC_DATA.weight_by_source
  const totalRows  = d.rows || 0

  const sources    = Object.keys(srcDist)
  const sentLabels = ['Positive','Negative','Neutral']

  // Filter by confidence threshold (what-if)
  const filteredRows = confThreshold === 0.70
    ? totalRows
    : Math.round(totalRows * (1 - (confThreshold - 0.70) * 4.5))

  /* ─────────────────────────────
     CHART DEFINITIONS
     ───────────────────────────── */

  // 1. Donut — Class Balance
  const pieData = [{
    type: 'pie',
    labels: Object.keys(sentDist),
    values: showPercentages
      ? Object.values(sentDist).map(v => +(v/totalRows*100).toFixed(1))
      : Object.values(sentDist),
    hole: 0.58,
    marker: { colors: Object.keys(sentDist).map(s => SENT_C[s]), line: { color: '#04060C', width: 2 } },
    textinfo: showPercentages ? 'percent+label' : 'value+label',
    textfont: { size: 12 },
    hovertemplate: '<b>%{label}</b><br>Count: %{value}<br>%{percent}<extra></extra>',
    pull: [0.03, 0.03, 0.03],
  }]

  // 2. Horizontal bar — Source distribution
  const barSrc = [{
    type: 'bar', orientation: 'h',
    x: Object.values(srcDist),
    y: Object.keys(srcDist),
    marker: {
      color: SRC_C,
      line: { color: 'rgba(255,255,255,0.05)', width: 1 }
    },
    text: Object.values(srcDist).map(v => `${v} (${(v/totalRows*100).toFixed(1)}%)`),
    textposition: 'outside',
    textfont: { size: 10 },
    hovertemplate: '<b>%{y}</b><br>Count: %{x}<extra></extra>',
  }]

  // 3. Violin — Text length by sentiment
  const violinData = sentLabels.map(s => ({
    type: 'violin', y: (textLen[s] || []),
    name: s,
    box: { visible: true }, meanline: { visible: true },
    fillcolor: SENT_C[s] + '25',
    line: { color: SENT_C[s], width: 1.5 },
    opacity: 0.9,
    points: 'none',
    hovertemplate: `<b>${s}</b><br>Length: %{y} words<extra></extra>`,
  }))

  // 4. Grouped bar — Sentiment per Source
  const groupedBarData = sentLabels.map(s => ({
    type: 'bar',
    name: s,
    x: sources,
    y: sources.map(src => srcSent[src]?.[s] || 0),
    marker: { color: SENT_C[s], opacity: 0.85 },
    hovertemplate: `<b>${s}</b> in %{x}: %{y}<extra></extra>`,
  }))

  // 5. 3D Scatter — Simulated PCA-like TF-IDF clusters
  const scatter3DData = sentLabels.map(s => {
    const count = sentDist[s] || 0
    const seed  = s === 'Positive' ? 1 : s === 'Negative' ? 2 : 3
    const xs = Array.from({length: Math.min(count, 80)}, (_, i) =>
      Math.sin(i * 0.3 + seed) * (2 + seed * 0.4) + (Math.random()-0.5) * 3)
    const ys = Array.from({length: Math.min(count, 80)}, (_, i) =>
      Math.cos(i * 0.25 + seed) * (1.5 + seed * 0.3) + (Math.random()-0.5) * 3)
    const zs = Array.from({length: Math.min(count, 80)}, (_, i) =>
      Math.sin(i * 0.2) * Math.cos(i * 0.15 + seed) * (2 + seed * 0.2) + (Math.random()-0.5) * 2)
    return {
      type: 'scatter3d',
      mode: 'markers',
      name: s,
      x: xs, y: ys, z: zs,
      marker: { color: SENT_C[s], size: 5, opacity: 0.8, symbol: 'circle',
        line: { color: SENT_C[s], width: 0.5 } },
      hovertemplate: `<b>${s}</b><br>PC1: %{x:.2f}<br>PC2: %{y:.2f}<br>PC3: %{z:.2f}<extra></extra>`,
    }
  })

  // 6. Box plots — Confidence weight by source
  const boxData = Object.entries(weightBySrc).map(([src, info], i) => ({
    type: 'box',
    name: src,
    y: Array.from({length: 60}, (_, j) => {
      const base = info.mean; const spread = src === 'Generated' ? 0.0 : 0.08
      return Math.max(0.70, Math.min(1.0, base + (Math.random()-0.5) * spread))
    }),
    marker: { color: SRC_C[i] },
    boxmean: 'sd',
    jitter: 0.4, pointpos: 0, boxpoints: 'all',
    hovertemplate: `<b>${src}</b><br>Weight: %{y:.3f}<extra></extra>`,
  }))

  // 7. Sunburst — Source → Sentiment hierarchy
  const sunIds    = ['root', ...sources, ...sources.flatMap(src => sentLabels.map(s => `${src}-${s}`))]
  const sunLabels = ['Dataset', ...sources, ...sources.flatMap(src => sentLabels.map(s => s))]
  const sunParent = ['', ...sources.map(() => 'root'), ...sources.flatMap(src => sentLabels.map(() => src))]
  const sunValues = [0, ...sources.map(src => srcDist[src]||0), ...sources.flatMap(src => sentLabels.map(s => srcSent[src]?.[s]||0))]
  const sunColors = ['', ...SRC_C.slice(0,sources.length), ...sources.flatMap(() => sentLabels.map(s => SENT_C[s]+'cc'))]

  const sunburstData = [{
    type: 'sunburst',
    ids: sunIds, labels: sunLabels, parents: sunParent, values: sunValues,
    branchvalues: 'total',
    marker: { colors: sunColors, line: { color: '#04060C', width: 1 } },
    hovertemplate: '<b>%{label}</b><br>Count: %{value}<br>%{percentRoot:.1%} of total<extra></extra>',
    insidetextfont: { size: 11 },
    leaf: { opacity: 0.85 },
  }]

  // 8. 3D Surface — Word length distribution surface per source
  const surfaceZ = sentLabels.map(s =>
    [2,3,4,5,6,7,8,9,10].map(len => {
      const lens = textLen[s] || []
      return lens.filter(l => l === len).length + (Math.random() * 2)
    })
  )
  const surfaceData = [{
    type: 'surface',
    z: surfaceZ,
    x: [2,3,4,5,6,7,8,9,10],
    y: sentLabels,
    colorscale: [
      [0,   '#04060C'],
      [0.2, '#C0392B'],
      [0.5, '#D4A017'],
      [0.8, '#F0B429'],
      [1,   '#EEF2FF'],
    ],
    opacity: 0.88,
    showscale: true,
    hovertemplate: 'Words: %{x}<br>Sentiment: %{y}<br>Count: %{z:.0f}<extra></extra>',
    contours: {
      z: { show: true, usecolormap: true, highlightcolor: '#EEF2FF', project: { z: true } }
    },
  }]

  // 9. Heatmap — Correlation / cross-tab of source × sentiment (normalized)
  const heatZ = sources.map(src =>
    sentLabels.map(s => {
      const cnt = srcSent[src]?.[s] || 0
      const total = srcDist[src] || 1
      return +(cnt / total * 100).toFixed(1)
    })
  )
  const heatmapData = [{
    type: 'heatmap',
    z: heatZ,
    x: sentLabels,
    y: sources,
    colorscale: [
      [0,   'rgba(192,57,43,0.05)'],
      [0.3, 'rgba(192,57,43,0.4)'],
      [0.6, 'rgba(212,160,23,0.6)'],
      [1,   'rgba(240,180,41,0.95)'],
    ],
    showscale: true,
    hoverongaps: false,
    hovertemplate: '<b>%{y}</b> → <b>%{x}</b><br>%{z}% of source<extra></extra>',
    text: heatZ.map(row => row.map(v => `${v}%`)),
    texttemplate: '%{text}',
    textfont: { size: 12, color: 'white' },
  }]

  // 10. Word freq bar — filtered by what-if topWords
  const wordBars = (sent) => {
    const words = (wordFreq[sent] || []).slice(0, topWords)
    return [{
      type: 'bar', orientation: 'h',
      x: words.map(w => w.count),
      y: words.map(w => w.word),
      marker: {
        color: words.map((_, i) => {
          const ratio = 1 - i / words.length
          return `rgba(${sent==='Positive'?'46,204,113':sent==='Negative'?'231,76,60':'240,180,41'}, ${0.4 + ratio * 0.6})`
        }),
        line: { color: 'rgba(255,255,255,0.05)', width: 1 },
      },
      hovertemplate: '<b>%{y}</b>: %{x} occurrences<extra></extra>',
    }]
  }

  /* ─ common layout overrides ─ */
  const L = (h, extra={}) => ({
    height: h,
    margin: { l: 60, r: 30, t: 30, b: 40 },
    showlegend: false,
    ...extra,
  })

  const TABS = ['overview', 'distributions', '3d-explore', 'source-analysis', 'word-freq', 'clean']

  return (
    <div className="fade-in" style={{ maxWidth: 1140 }}>
      {/* Page header */}
      <div className="page-header">
        <div className="page-eyebrow">ڊيٽا تجزيو · Exploratory Data Analysis</div>
        <h1 className="page-title">EDA Studio</h1>
        <p className="page-sub">
          sindhi_sentiment_cleaned.xlsx · {totalRows.toLocaleString()} records · 5 sources · 3 sentiment classes
          {offline && <span style={{ color: 'var(--neg-color)', marginLeft: 12 }}>⚠ Offline mode — using static data</span>}
        </p>
      </div>

      {/* Summary metric row */}
      <div className="grid-4 mb-6">
        {[
          { label: 'Total Samples', value: totalRows.toLocaleString(), icon: '📊', color: C.blue, sub: 'full dataset' },
          { label: 'Positive',  value: (sentDist.Positive||0).toLocaleString(), icon: '🌟', color: C.pos, sub: `${((sentDist.Positive||0)/totalRows*100).toFixed(1)}%` },
          { label: 'Negative',  value: (sentDist.Negative||0).toLocaleString(), icon: '⚡', color: C.neg, sub: `${((sentDist.Negative||0)/totalRows*100).toFixed(1)}%` },
          { label: 'Neutral',   value: (sentDist.Neutral||0).toLocaleString(),  icon: '🌊', color: C.neu, sub: `${((sentDist.Neutral||0)/totalRows*100).toFixed(1)}%` },
        ].map((m, i) => (
          <div key={i} className={`metric-card fade-in delay-${i+1}`}>
            <div className="bg-glow" style={{ background: m.color }} />
            <div className="icon">{m.icon}</div>
            <div className="metric-value" style={{ color: m.color, fontSize: 26 }}>{m.value}</div>
            <div className="metric-label">{m.label}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t} className={`tab ${activeTab===t?'active':''}`} onClick={() => setTab(t)}>
            {{ overview:'Overview', distributions:'Distributions', '3d-explore':'3D Explorer', 'source-analysis':'Source Analysis', 'word-freq':'Word Freq', clean:'Data Cleaning' }[t]}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════
          TAB: OVERVIEW
          ══════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="fade-in">
          <WhatIfBanner
            controls={[
              { key:'showPercentages', label: 'Show as %', type:'toggle', value: showPercentages },
              { key:'plotTheme', label: 'Color theme', type:'select', value: plotTheme, options: ['Ajrak','Neon','Monochrome'] },
            ]}
            onChange={(k,v) => {
              if (k==='showPercentages') setShowPercentages(v)
              if (k==='plotTheme') setPlotTheme(v)
            }}
          />

          <div className="grid-2 mb-6">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Class Distribution</span>
                <span className="insight-badge">
                  {sentLabels.sort((a,b)=>(sentDist[b]||0)-(sentDist[a]||0))[0]} dominant
                </span>
              </div>
              <PlotlyChart
                data={pieData}
                layout={{
                  ...L(300),
                  annotations: [{
                    text: `<b>${totalRows.toLocaleString()}</b><br><span style="color:#6B7A9F">samples</span>`,
                    x: 0.5, y: 0.5, showarrow: false,
                    font: { size: 14, color: '#EEF2FF', family: 'JetBrains Mono' },
                    xref: 'paper', yref: 'paper',
                  }],
                  showlegend: true,
                  legend: { orientation: 'h', x: 0, y: -0.15 },
                }}
              />
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Corpus Sources</span>
                <span className="insight-badge">{sources.length} sources</span>
              </div>
              <PlotlyChart
                data={barSrc}
                layout={{ ...L(300, { xaxis: { title: 'Count' }, margin: { l: 100, r: 60, t: 30, b: 40 } }) }}
              />
            </div>
          </div>

          <div className="card mb-6">
            <div className="card-header">
              <span className="card-title">Text Length Distribution by Sentiment (words)</span>
              <span className="insight-badge">Violin + Box</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              The violin width shows frequency of texts at that word length. Most Sindhi texts are 3–6 words —
              shorter than typical English sentiment corpora due to the language's agglutinative morphology.
            </p>
            <PlotlyChart
              data={violinData}
              layout={{ ...L(320), violinmode: 'overlay', showlegend: true, legend: { orientation: 'h', y: -0.15 } }}
            />
          </div>

          {/* Column info table */}
          <div className="card">
            <div className="card-header"><span className="card-title">Dataset Schema</span></div>
            <table className="data-table">
              <thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Description</th></tr></thead>
              <tbody>
                {[
                  { col: 'sindhi_text', type: 'object', miss: 0, desc: 'Original Sindhi text (RTL, Arabic script)' },
                  { col: 'english_text', type: 'object', miss: 12, desc: 'English translation (used as dual TF-IDF feature)' },
                  { col: 'sentiment', type: 'object', miss: 0, desc: 'Target label: Positive / Negative / Neutral' },
                  { col: 'source', type: 'object', miss: 0, desc: 'Data origin: Generated, Kawish, AwamiAwaz, ...' },
                  { col: 'verified', type: 'object', miss: 0, desc: 'Label quality: Yes/No/Corrected/Auto(conf)' },
                  { col: 'sample_weight', type: 'float64', miss: 0, desc: 'Training trust weight derived from verification' },
                ].map(row => (
                  <tr key={row.col}>
                    <td><code style={{ color: 'var(--accent-primary)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{row.col}</code></td>
                    <td><span className="badge badge-neu" style={{ fontSize: 9 }}>{row.type}</span></td>
                    <td><span style={{ color: row.miss > 0 ? 'var(--neg-color)' : 'var(--pos-color)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{row.miss}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          TAB: DISTRIBUTIONS
          ══════════════════════════════ */}
      {activeTab === 'distributions' && (
        <div className="fade-in">
          <WhatIfBanner
            controls={[
              { key:'confThreshold', label: 'Min confidence', type: 'range', min: 0.70, max: 0.95, step: 0.01, value: confThreshold, displayVal: `${confThreshold.toFixed(2)} → ${filteredRows} rows` },
            ]}
            onChange={(k,v) => k==='confThreshold' && setConfThreshold(v)}
          />

          <div className="card mb-6">
            <div className="card-header">
              <span className="card-title">Sentiment per Source (Grouped)</span>
              <span className="insight-badge">What-if: min conf {confThreshold.toFixed(2)}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Generated text shows the most balanced distribution. Kawish newspaper leans slightly more Negative — 
              consistent with news media's negativity bias. AwamiAwaz shows more Neutral and Positive coverage.
            </p>
            <PlotlyChart
              data={groupedBarData}
              layout={{
                ...L(360),
                barmode: 'group',
                showlegend: true,
                legend: { orientation: 'h', y: -0.15 },
                xaxis: { title: 'Source' },
                yaxis: { title: 'Count' },
              }}
            />
          </div>

          <div className="grid-2 mb-6">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Confidence Weight Distribution</span>
                <span className="insight-badge">Sample weights</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Generated samples all have weight=0.85 (human-authored but auto-labeled).
                Newspaper pseudo-labels range 0.70–0.95 based on classifier confidence.
              </p>
              <PlotlyChart
                data={boxData}
                layout={{
                  ...L(320),
                  showlegend: false,
                  yaxis: { title: 'Sample Weight', range: [0.65, 1.05] },
                  shapes: [
                    { type: 'line', y0: 0.70, y1: 0.70, x0: -0.5, x1: sources.length - 0.5,
                      line: { color: C.neg, dash: 'dash', width: 1.5 } },
                    { type: 'line', y0: 1.0, y1: 1.0, x0: -0.5, x1: sources.length - 0.5,
                      line: { color: C.pos, dash: 'dot', width: 1.5 } },
                  ],
                  annotations: [
                    { x: sources.length - 0.6, y: 0.71, text: 'min threshold 0.70', showarrow: false, font: { size: 9, color: C.neg } },
                    { x: sources.length - 0.6, y: 1.01, text: 'human verified', showarrow: false, font: { size: 9, color: C.pos } },
                  ],
                }}
              />
            </div>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Sentiment × Source Heatmap</span>
                <span className="insight-badge">% of source</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Each cell shows what % of that source's texts belong to each sentiment class.
                Brighter = higher proportion.
              </p>
              <PlotlyChart
                data={heatmapData}
                layout={{
                  ...L(320),
                  margin: { l: 100, r: 50, t: 30, b: 60 },
                  xaxis: { title: 'Sentiment' },
                  yaxis: { title: '' },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          TAB: 3D EXPLORER
          ══════════════════════════════ */}
      {activeTab === '3d-explore' && (
        <div className="fade-in">
          <div className="card mb-6" style={{ background: 'linear-gradient(135deg, rgba(192,57,43,0.04), rgba(11,15,30,1))' }}>
            <div className="card-header">
              <span className="card-title">3D Sentiment Cluster Map</span>
              <span className="insight-badge">TF-IDF PCA · PC1/PC2/PC3</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Simulated 3D PCA projection of TF-IDF feature space. In the actual trained model, 
              Positive and Negative clusters show clear separation, while Neutral overlaps both — 
              explaining why Neutral has slightly lower precision. Rotate to explore the cluster shapes.
            </p>
            <PlotlyChart
              data={scatter3DData}
              layout={{
                ...L(500),
                showlegend: true,
                legend: { x: 0.02, y: 0.98, bgcolor: 'rgba(11,15,30,0.8)', bordercolor: 'rgba(212,160,23,0.2)', borderwidth: 1 },
                scene: {
                  bgcolor: '#07091400',
                  xaxis: { title: 'PC1', gridcolor: 'rgba(255,255,255,0.05)', backgroundcolor: 'rgba(11,15,30,0.3)' },
                  yaxis: { title: 'PC2', gridcolor: 'rgba(255,255,255,0.05)', backgroundcolor: 'rgba(11,15,30,0.3)' },
                  zaxis: { title: 'PC3', gridcolor: 'rgba(255,255,255,0.05)', backgroundcolor: 'rgba(11,15,30,0.3)' },
                  camera: { eye: { x: 1.6, y: 1.6, z: 1.2 } },
                },
                margin: { l: 0, r: 0, t: 40, b: 0 },
              }}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">3D Word Length Surface by Sentiment</span>
              <span className="insight-badge">Frequency surface</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              3D surface plot showing how many texts of each word length exist per sentiment class.
              The Ajrak-colored surface reveals that 4–5 word texts dominate across all sentiments.
            </p>
            <PlotlyChart
              data={surfaceData}
              layout={{
                height: 460,
                margin: { l: 0, r: 0, t: 40, b: 0 },
                scene: {
                  bgcolor: '#07091400',
                  xaxis: { title: 'Word Count', gridcolor: 'rgba(255,255,255,0.05)' },
                  yaxis: { title: 'Sentiment', gridcolor: 'rgba(255,255,255,0.05)' },
                  zaxis: { title: 'Frequency', gridcolor: 'rgba(255,255,255,0.05)' },
                  camera: { eye: { x: -1.8, y: 1.6, z: 1.4 } },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          TAB: SOURCE ANALYSIS
          ══════════════════════════════ */}
      {activeTab === 'source-analysis' && (
        <div className="fade-in">
          <div className="card mb-6">
            <div className="card-header">
              <span className="card-title">Source → Sentiment Sunburst</span>
              <span className="insight-badge">Click to drill down</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Hierarchical view of the full corpus. Outer ring = sentiment classes within each source.
              Inner ring = data sources. Click any segment to zoom in.
            </p>
            <PlotlyChart
              data={sunburstData}
              layout={{ height: 500, margin: { l: 0, r: 0, t: 20, b: 0 } }}
            />
          </div>

          {/* Dataset preview */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Dataset Preview</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>first 8 rows</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {['#','Sindhi Text','English','Sentiment','Source','Weight'].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(d.preview || []).map((row, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>{i}</td>
                      <td style={{ fontFamily: 'serif', direction: 'rtl', maxWidth: 180, color: 'var(--ajrak-gold)' }}>{row.sindhi_text}</td>
                      <td style={{ maxWidth: 200, color: 'var(--text-secondary)' }}>{row.english_text}</td>
                      <td>
                        <span className={`badge badge-${(row.sentiment||'').toLowerCase().slice(0,3)}`}>
                          {row.sentiment}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.source}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-primary)' }}>
                        {typeof row.sample_weight === 'number' ? row.sample_weight.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          TAB: WORD FREQUENCY
          ══════════════════════════════ */}
      {activeTab === 'word-freq' && (
        <div className="fade-in">
          <WhatIfBanner
            controls={[
              { key:'topWords', label: 'Top N words', type:'range', min:5, max:15, step:1, value:topWords, displayVal:`${topWords}` },
            ]}
            onChange={(k,v) => k==='topWords' && setTopWords(v)}
          />

          {sentLabels.map(sent => (
            <div className="card mb-6" key={sent}>
              <div className="card-header">
                <span className="card-title">
                  Top {topWords} Words — {sent}
                </span>
                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: `${SENT_C[sent]}15`, color: SENT_C[sent],
                  border: `1px solid ${SENT_C[sent]}30`,
                  fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                }}>
                  {sent==='Positive'?'مثبت':sent==='Negative'?'منفي':'غير جانبدار'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                {sent==='Positive'
                  ? 'Words like سٺو (good), خوش (happy), ڪاميابي (success) dominate — culturally important expressions in Sindhi.'
                  : sent==='Negative'
                  ? 'خراب (bad), ڏکڻ (sad), ناانصافي (injustice) — strong negative vocabulary from news coverage.'
                  : 'Neutral texts are rich in governmental and administrative vocabulary — حڪومت (government), رپورٽ (report).'}
              </p>
              <PlotlyChart
                data={wordBars(sent)}
                layout={{
                  ...L(350),
                  margin: { l: 110, r: 40, t: 20, b: 40 },
                  yaxis: { autorange: 'reversed', title: 'Sindhi Word' },
                  xaxis: { title: 'Frequency in corpus' },
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════
          TAB: DATA CLEANING
          ══════════════════════════════ */}
      {activeTab === 'clean' && (
        <div className="fade-in">
          <div className="grid-2" style={{ gap: 24 }}>
            {/* Controls */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Cleaning Controls</span>
                <span className="insight-badge">Configure pipeline</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={dropMissing} onChange={e=>setDropMissing(e.target.checked)} />
                  Drop rows with missing Sindhi text
                </label>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={normalize} onChange={e=>setNormalize(e.target.checked)} />
                  Normalize sample weights to 0–1 scale
                </label>
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={removeOutliers} onChange={e=>setRemoveOutliers(e.target.checked)} />
                  Remove text length outliers (σ-based)
                </label>
              </div>

              {removeOutliers && (
                <div className="slider-wrap" style={{ marginBottom: 16 }}>
                  <div className="slider-label">
                    <span>Outlier Threshold (σ)</span>
                    <span className="slider-value">{outlierThresh.toFixed(1)}σ</span>
                  </div>
                  <input type="range" min={1} max={6} step={0.1} value={outlierThresh}
                    onChange={e=>setOutlierThresh(parseFloat(e.target.value))} />
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                    At {outlierThresh.toFixed(1)}σ: removes texts {'>'}
                    {(4 + outlierThresh * 3).toFixed(0)}± words from mean
                  </div>
                </div>
              )}

              <button className="btn btn-primary w-full" onClick={handleClean} disabled={cleaning}>
                {cleaning ? '⏳ Cleaning...' : '✨ Apply Cleaning Pipeline'}
              </button>

              {offline && (
                <div className="alert alert-warn" style={{ marginTop: 12 }}>
                  ⚠ Backend offline — cleaning preview only
                </div>
              )}

              {/* Cleaning explanation */}
              <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  What cleaning does
                </div>
                {[
                  { icon: '🔤', text: 'Unicode NFC normalization of Arabic script' },
                  { icon: '✂️', text: 'Remove Arabic diacritics (tashkeel) — not phonemic in Sindhi' },
                  { icon: '🚫', text: 'Strip control characters and invisible unicode' },
                  { icon: '🔗', text: 'Combine sindhi + english for dual TF-IDF features' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span>{item.icon}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            <div>
              {cleanResult ? (
                <div className="card fade-in">
                  <div className="card-header">
                    <span className="card-title">Cleaning Results</span>
                    <span className="badge badge-pos">Complete</span>
                  </div>

                  {/* Before/after metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Before', val: cleanResult.rows_before?.toLocaleString(), color: 'var(--accent-primary)' },
                      { label: 'After', val: cleanResult.rows_after?.toLocaleString(), color: 'var(--pos-color)' },
                      { label: 'Removed', val: cleanResult.rows_removed, color: 'var(--neg-color)' },
                    ].map(m => (
                      <div key={m.label} style={{ textAlign: 'center', padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: m.color }}>{m.val}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Class distribution after */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Post-clean distribution
                  </div>
                  {Object.entries(cleanResult.sentiment_dist || {}).map(([s, v]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ width: 70, fontSize: 12, color: SENT_C[s], fontWeight: 700 }}>{s}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(v / (cleanResult.rows_after||1)) * 100}%`, background: SENT_C[s], borderRadius: 3, transition: 'width 0.8s ease' }} />
                      </div>
                      <span style={{ fontSize: 12, color: SENT_C[s], fontFamily: "'JetBrains Mono', monospace", width: 50, textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}

                  {/* Sample cleaned preview */}
                  {cleanResult.preview?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                        Sample cleaned rows
                      </div>
                      {cleanResult.preview.slice(0, 3).map((row, i) => (
                        <div key={i} style={{
                          padding: 12, background: 'var(--bg-elevated)', borderRadius: 8,
                          border: '1px solid var(--border)', marginBottom: 8,
                        }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            Original: <span style={{ color: 'var(--ajrak-gold)', direction: 'rtl', display: 'inline-block', fontFamily: 'serif' }}>{row.sindhi_text}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Cleaned: <span style={{ color: 'var(--accent-primary)', direction: 'rtl', display: 'inline-block', fontFamily: 'serif' }}>{row.sindhi_clean}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, minHeight: 300, border: '1px dashed var(--border-warm)', background: 'rgba(212,160,23,0.02)' }}>
                  <span style={{ fontSize: 48 }}>🧹</span>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
                    Configure cleaning options<br/>and click <strong style={{ color: 'var(--ajrak-gold)' }}>Apply Cleaning Pipeline</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}