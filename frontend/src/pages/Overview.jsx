import React from 'react'

const STATS = [
  { value: '1,898', label: 'Sentences', sub: 'total corpus', color: 'var(--accent-primary)' },
  { value: '3',     label: 'Classifiers', sub: 'LR · SVM · NB', color: 'var(--ajrak-gold)' },
  { value: '94.8%', label: 'Peak CV Acc', sub: 'cross-validated', color: 'var(--pos-color)' },
  { value: '37k+',  label: 'TF-IDF Features', sub: 'char + word n-grams', color: 'var(--accent-violet)' },
]

const PIPELINE = [
  { stage: '01', title: 'Hand-Labeled', count: '~848', method: 'Manual human annotation', src: 'Original Corpus', color: 'var(--pos-color)', conf: '100%' },
  { stage: '02', title: 'AwamiAwaz News', count: '~382', method: 'Pseudo-labeled ≥ 0.72 confidence', src: 'Newspaper corpus', color: 'var(--accent-primary)', conf: '≥72%' },
  { stage: '03', title: 'Daily Kawish', count: '~671', method: 'Pseudo-labeled ≥ 0.70 confidence', src: 'Newspaper corpus', color: 'var(--ajrak-gold)', conf: '≥70%' },
]

const CLASSES = [
  { label: 'Positive', count: 694, pct: 36.6, color: 'var(--pos-color)', emoji: '🌟', sindhi: 'مثبت' },
  { label: 'Negative', count: 670, pct: 35.3, color: 'var(--neg-color)', emoji: '⚡', sindhi: 'منفي' },
  { label: 'Neutral',  count: 534, pct: 28.1, color: 'var(--neu-color)', emoji: '🌊', sindhi: 'غير جانبدار' },
]

const TECH = [
  { name: 'TF-IDF Vectorizer', detail: 'char_wb (2–6) + word (1–2)', icon: '🔤' },
  { name: 'Logistic Regression', detail: 'C=1.0, class_weight=balanced', icon: '📈' },
  { name: 'LinearSVC', detail: 'Calibrated, CalibratedClassifierCV', icon: '🎯' },
  { name: 'Complement NB', detail: 'alpha=0.1, suited for imbalance', icon: '🔬' },
  { name: '5-Fold Stratified CV', detail: 'preserves class proportions', icon: '🔄' },
  { name: 'Sample Weights', detail: 'conf-score trust during training', icon: '⚖️' },
]

const AjrakStripe = () => (
  <div style={{
    height: 4,
    background: 'repeating-linear-gradient(90deg, #C0392B 0px, #C0392B 8px, #D4A017 8px, #D4A017 16px, #C0392B 16px, #C0392B 24px, #04060C 24px, #04060C 28px)',
    borderRadius: 2, opacity: 0.7,
    margin: '28px 0',
  }} />
)

export default function Overview() {
  return (
    <div className="fade-in" style={{ maxWidth: 1100 }}>
      {/* Hero */}
      <div className="page-header">
        <div className="page-eyebrow">سنڌي سينٽيمينٽ تجزيو · Sindhi Sentiment NLP</div>
        <h1 className="page-title">Sindhi Sentiment<br/>Analysis Studio</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, maxWidth: 680 }}>
          A first-of-its-kind machine learning system for sentiment classification in Sindhi —
          a low-resource language spoken by over <strong style={{ color: 'var(--ajrak-gold)' }}>30 million people</strong>.
          Built through a semi-supervised pipeline expanding from 848 hand-labeled sentences.
        </p>
      </div>

      {/* Key stats */}
      <div className="grid-4 mb-8">
        {STATS.map((s, i) => (
          <div key={i} className={`card fade-in delay-${i+1}`} style={{ textAlign: 'center', padding: '22px 16px' }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 34, fontWeight: 800, color: s.color,
              letterSpacing: '-0.02em', lineHeight: 1,
              textShadow: `0 0 30px ${s.color}33`,
            }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 8 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* About the language */}
      <div className="card mb-6" style={{
        background: 'linear-gradient(135deg, rgba(192,57,43,0.06) 0%, rgba(11,15,30,1) 50%, rgba(212,160,23,0.06) 100%)',
        borderColor: 'var(--border-warm)',
      }}>
        <div className="card-header">
          <span className="card-title-serif" style={{ fontSize: 16 }}>🌍 About Sindhi Language</span>
          <span className="insight-badge">Low-Resource NLP</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>
              Sindhi (<span style={{ fontFamily: 'serif', fontSize: 16, color: 'var(--ajrak-gold)' }}>سنڌي</span>) is an Indo-Aryan language written in a Perso-Arabic script with unique letterforms.
              It is the official language of Sindh province, Pakistan, and has virtually <em>no publicly available ML resources</em>.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
              This project addresses that gap by building a custom annotated corpus through a three-stage semi-supervised pipeline,
              using pseudo-labeling on real Sindhi newspaper corpora.
            </p>
          </div>
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 12, padding: 20,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Key Challenges</div>
            {[
              { icon: '🔤', text: 'Right-to-left script requiring special rendering' },
              { icon: '🔗', text: 'Contextual Arabic letterform joining (arabic_reshaper)' },
              { icon: '📉', text: 'Near-zero existing labeled Sindhi ML datasets' },
              { icon: '🔀', text: 'Code-switching with Urdu and Persian' },
              { icon: '⚖️', text: 'Sample weight calibration for pseudo-labels' },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{c.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AjrakStripe />

      {/* Class distribution */}
      <div className="section-label">Sentiment Classes</div>
      <div className="grid-3 mb-8">
        {CLASSES.map((c, i) => (
          <div key={i} className={`card fade-in delay-${i+1}`} style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 120, height: 120, borderRadius: '50%',
              background: c.color, opacity: 0.05,
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <span style={{ fontSize: 26 }}>{c.emoji}</span>
              <span style={{
                fontFamily: 'serif', fontSize: 18, color: c.color, direction: 'rtl',
                fontWeight: 700, opacity: 0.6,
              }}>{c.sindhi}</span>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700,
              color: c.color, lineHeight: 1, marginBottom: 4,
            }}>{c.count.toLocaleString()}</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
              {c.label} Samples
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              {c.pct}% of corpus
            </div>
          </div>
        ))}
      </div>

      {/* Semi-supervised pipeline */}
      <div className="section-label">Data Collection Pipeline</div>
      <div className="card mb-8">
        <div className="card-header">
          <span className="card-title-serif">3-Stage Semi-Supervised Annotation</span>
          <span className="insight-badge">Why semi-supervised?</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7, marginBottom: 20 }}>
          Manual labeling is expensive. Pseudo-labeling uses a model trained on a small labeled set to annotate a larger unlabeled corpus —
          but only accepts predictions above a confidence threshold to control noise.
          The <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, color: 'var(--ajrak-gold)', fontSize: 11 }}>Verified</code> column encodes label quality, converted to <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, color: 'var(--accent-primary)', fontSize: 11 }}>sample_weight</code> during training.
        </p>
        <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
          {/* connector line */}
          <div style={{
            position: 'absolute', top: 28, left: 60, right: 60,
            height: 1, background: 'linear-gradient(90deg, var(--pos-color), var(--accent-primary), var(--ajrak-gold))',
            opacity: 0.3, zIndex: 0,
          }} />
          {PIPELINE.map((p, i) => (
            <div key={i} style={{ flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `linear-gradient(135deg, ${p.color}22, ${p.color}11)`,
                border: `2px solid ${p.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700,
                color: p.color, margin: '0 auto 14px',
                boxShadow: `0 0 20px ${p.color}33`,
              }}>{p.stage}</div>
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 12,
                border: `1px solid ${p.color}30`, padding: '16px 14px',
                margin: '0 6px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{p.title}</div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700,
                  color: p.color, marginBottom: 6,
                }}>{p.count}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>{p.method}</div>
                <span style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 20,
                  background: `${p.color}15`, color: p.color,
                  border: `1px solid ${p.color}30`,
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                }}>conf {p.conf}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical stack */}
      <div className="section-label">Technical Methodology</div>
      <div className="grid-3 mb-6">
        {TECH.map((t, i) => (
          <div key={i} className={`card fade-in delay-${(i%3)+1}`} style={{ padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{t.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>{t.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation hint */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(192,57,43,0.06), rgba(212,160,23,0.06))',
        borderRadius: 14, border: '1px solid var(--border-warm)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <span style={{ fontSize: 28 }}>📊</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Ready to explore the data?
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Head to the <strong style={{ color: 'var(--ajrak-gold)' }}>EDA section</strong> for 8+ interactive visualizations including 3D scatter plots, correlation heatmaps, sunburst charts, and what-if analysis tools.
          </div>
        </div>
      </div>
    </div>
  )
}