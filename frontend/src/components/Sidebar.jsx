import React from 'react'
import { NavLink } from 'react-router-dom'

// Ajrak geometric SVG motif
const AjrakMotif = () => (
  <svg width="240" height="16" viewBox="0 0 240 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="ajrak-p" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="16" height="16" fill="none"/>
        <rect x="6" y="0" width="4" height="4" fill="#C0392B" opacity="0.4"/>
        <rect x="0" y="6" width="4" height="4" fill="#D4A017" opacity="0.3"/>
        <rect x="12" y="6" width="4" height="4" fill="#D4A017" opacity="0.3"/>
        <rect x="6" y="12" width="4" height="4" fill="#C0392B" opacity="0.4"/>
        <rect x="6" y="6" width="4" height="4" fill="#E74C3C" opacity="0.2"/>
      </pattern>
    </defs>
    <rect width="240" height="16" fill="url(#ajrak-p)"/>
  </svg>
)

const NAV = [
  { to: '/overview',    icon: '🌐', label: 'Overview',   sub: 'Project & Dataset'  },
  { to: '/',            icon: '📊', label: 'EDA',         sub: 'Explore & Analyze'  },
  { to: '/model',       icon: '🧠', label: 'Model Lab',   sub: 'Train & Tune'       },
  { to: '/comparison',  icon: '⚔️', label: 'Comparison',  sub: 'Side-by-Side'       },
  { to: '/deploy',      icon: '🚀', label: 'Deployment',  sub: 'Live Predictor'     },
]

const SECTION_LABELS = {
  '/overview': 'EXPLORE',
  '/':         'EXPLORE',
  '/model':    'ML PIPELINE',
  '/comparison':'ML PIPELINE',
  '/deploy':   'PRODUCTION',
}

export default function Sidebar({ serverStatus }) {
  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0,
      width: 'var(--sidebar-w)',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Ajrak top border */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #C0392B, #D4A017, #C0392B)' }} />

      {/* Logo Area */}
      <div style={{ padding: '22px 22px 18px' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.25em',
          color: 'var(--ajrak-gold)', textTransform: 'uppercase',
          fontFamily: "'JetBrains Mono', monospace", marginBottom: 6,
          opacity: 0.7,
        }}>
          Sindhi NLP Studio
        </div>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 24, fontWeight: 800,
          background: 'linear-gradient(135deg, #EEF2FF 0%, #D4A017 70%, #C0392B 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.02em', lineHeight: 1.2,
          marginBottom: 2,
        }}>
          ML Interactive<br/>Studio
        </div>

        {/* Server status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
            background: serverStatus === 'online' ? 'var(--pos-color)' : 'var(--neg-color)',
            boxShadow: `0 0 6px ${serverStatus === 'online' ? 'var(--pos-color)' : 'var(--neg-color)'}`,
          }} />
          <span style={{
            fontSize: 10, color: 'var(--text-muted)',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {serverStatus === 'online' ? 'Backend Online' : 'Backend Offline'}
          </span>
        </div>
      </div>

      {/* Ajrak divider motif */}
      <div style={{ padding: '0 0 12px' }}>
        <AjrakMotif />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ to, icon, label, sub }, idx) => {
          const showSection = idx === 0 || SECTION_LABELS[to] !== SECTION_LABELS[NAV[idx-1]?.to]
          const sectionLabel = SECTION_LABELS[to]
          return (
            <React.Fragment key={to}>
              {showSection && (
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
                  color: 'var(--text-dim)', textTransform: 'uppercase',
                  fontFamily: "'JetBrains Mono', monospace",
                  padding: '10px 8px 4px',
                }}>
                  {sectionLabel}
                </div>
              )}
              <NavLink
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(192,57,43,0.12), rgba(212,160,23,0.08))'
                    : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(212,160,23,0.2)' : 'transparent'}`,
                  position: 'relative',
                })}
              >
                {({ isActive }) => (<>
                  {isActive && (
                    <span style={{
                      position: 'absolute', left: 0, top: '20%', bottom: '20%',
                      width: 2, borderRadius: '0 2px 2px 0',
                      background: 'linear-gradient(180deg, var(--ajrak-red), var(--ajrak-gold))',
                    }} />
                  )}
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: isActive ? 'var(--ajrak-gold)' : 'var(--text-secondary)',
                      fontFamily: "'DM Sans', sans-serif",
                      transition: 'color 0.2s',
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: 10, color: 'var(--text-dim)', marginTop: 1,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {sub}
                    </div>
                  </div>
                </>)}
              </NavLink>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Ajrak bottom motif */}
      <div style={{ marginTop: 'auto' }}>
        <AjrakMotif />
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 22px 16px', background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14 }}>🌙</span>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              Ali Nawaz · 24-BSCS-06
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
              Shaikh Ayaz University
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap',
        }}>
          {['LR','SVM','NB'].map(m => (
            <span key={m} style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 10,
              background: 'rgba(212,160,23,0.08)', color: 'var(--ajrak-gold)',
              border: '1px solid rgba(212,160,23,0.15)',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
            }}>{m}</span>
          ))}
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 10,
            background: 'rgba(192,57,43,0.08)', color: 'var(--ajrak-crimson)',
            border: '1px solid rgba(192,57,43,0.15)',
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
          }}>v2.0</span>
        </div>
      </div>
      {/* Ajrak bottom accent */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #C0392B, #D4A017, #C0392B)' }} />
    </aside>
  )
}