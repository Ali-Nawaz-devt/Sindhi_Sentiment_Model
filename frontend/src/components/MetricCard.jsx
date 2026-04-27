import React from 'react'

export default function MetricCard({ label, value, unit = '', color = 'var(--accent-primary)', icon, sub, trend }) {
  const display = typeof value === 'number'
    ? (value > 0 && value < 1 ? (value * 100).toFixed(1) + '%' : value.toLocaleString())
    : (value ?? '—')

  return (
    <div className="metric-card">
      <div className="bg-glow" style={{ background: color }} />

      {trend !== undefined && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 11, fontWeight: 700,
          color: trend >= 0 ? 'var(--pos-color)' : 'var(--neg-color)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}

      {icon && <div className="icon">{icon}</div>}
      <div className="metric-value" style={{ color }}>{display}{unit}</div>
      <div className="metric-label">{label}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  )
}