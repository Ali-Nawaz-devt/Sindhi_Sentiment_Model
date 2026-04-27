import React from 'react'

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      padding: 32,
    }}>
      <div style={{ position: 'relative', width: 44, height: 44 }}>
        <div style={{
          width: 44, height: 44,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--ajrak-gold)',
          borderRightColor: 'var(--ajrak-red)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 6,
          border: '1px solid rgba(212,160,23,0.15)',
          borderRadius: '50%',
        }} />
      </div>
      <div style={{
        fontSize: 12, color: 'var(--text-muted)',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.05em',
      }}>
        {message}
      </div>
    </div>
  )
}