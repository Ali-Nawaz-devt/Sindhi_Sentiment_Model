import React, { Suspense, lazy } from 'react'

const Plot = lazy(() => import('react-plotly.js'))

// Ajrak-themed dark layout base
const AJRAK_LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor:  '#0B0F1E',
  font: {
    color: '#6B7A9F',
    family: "'JetBrains Mono', monospace",
    size: 11,
  },
  margin: { l: 60, r: 30, t: 40, b: 50 },
  xaxis: {
    gridcolor:   'rgba(255,255,255,0.04)',
    zerolinecolor: 'rgba(212,160,23,0.1)',
    tickfont: { color: '#6B7A9F', size: 10 },
    linecolor: 'rgba(255,255,255,0.05)',
  },
  yaxis: {
    gridcolor:   'rgba(255,255,255,0.04)',
    zerolinecolor: 'rgba(212,160,23,0.1)',
    tickfont: { color: '#6B7A9F', size: 10 },
    linecolor: 'rgba(255,255,255,0.05)',
  },
  legend: {
    bgcolor:     'rgba(11,15,30,0.9)',
    bordercolor: 'rgba(212,160,23,0.15)',
    borderwidth: 1,
    font: { size: 11, color: '#B8C4E0' },
  },
  hoverlabel: {
    bgcolor:     '#0B0F1E',
    bordercolor: 'rgba(212,160,23,0.3)',
    font: { family: "'JetBrains Mono', monospace", size: 11, color: '#EEF2FF' },
  },
  modebar: { bgcolor: 'transparent', color: '#6B7A9F', activecolor: '#D4A017' },
}

export default function PlotlyChart({ data, layout = {}, style = {}, config = {} }) {
  const mergedLayout = {
    ...AJRAK_LAYOUT,
    ...layout,
    font:      { ...AJRAK_LAYOUT.font,      ...(layout.font   || {}) },
    xaxis:     { ...AJRAK_LAYOUT.xaxis,     ...(layout.xaxis  || {}) },
    yaxis:     { ...AJRAK_LAYOUT.yaxis,     ...(layout.yaxis  || {}) },
    legend:    { ...AJRAK_LAYOUT.legend,    ...(layout.legend || {}) },
    hoverlabel:{ ...AJRAK_LAYOUT.hoverlabel,...(layout.hoverlabel||{}) },
  }

  return (
    <Suspense fallback={
      <div style={{
        height: layout.height || 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        ◌ Rendering chart...
      </div>
    }>
      <Plot
        data={data}
        layout={mergedLayout}
        config={{
          displayModeBar: true,
          modeBarButtonsToRemove: ['select2d','lasso2d','autoScale2d','hoverCompareCartesian'],
          responsive: true,
          displaylogo: false,
          ...config,
        }}
        style={{ width: '100%', ...style }}
        useResizeHandler
      />
    </Suspense>
  )
}